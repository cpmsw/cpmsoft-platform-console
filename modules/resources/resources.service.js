const authDb =
  require("../../db/authDb");


// ---------------------------------
// MASTER CPMSOFT RESOURCE CATALOG
// ---------------------------------
async function getResources() {

  const result = await authDb.query(
    `SELECT
       id,
       resource_key,
       resource_name,
       category,
       description,
       is_active,
       display_order
     FROM resources
     WHERE is_active = true
     ORDER BY
       category,
       display_order,
       resource_name`
  );

  return result.rows;
}


// ---------------------------------
// ALL RESOURCES + TENANT SELECTION
// ---------------------------------
async function getTenantResources(
  tenantId
) {

  const result = await authDb.query(
    `SELECT
       r.id AS resource_id,
       r.resource_key,
       r.resource_name,
       r.category,
       r.description,
       r.display_order,

       COALESCE(
         tr.is_enabled,
         false
       ) AS is_enabled

     FROM resources r

     LEFT JOIN tenant_resources tr
       ON tr.resource_id = r.id
      AND tr.tenant_id = $1

     WHERE r.is_active = true

     ORDER BY
       r.category,
       r.display_order,
       r.resource_name`,
    [tenantId]
  );

  return result.rows;
}


// ---------------------------------
// SAVE TENANT RESOURCE SELECTIONS
// ---------------------------------
async function saveTenantResources(
  tenantId,
  resourceIds
) {

  if (!Array.isArray(resourceIds)) {

    const error = new Error(
      "resourceIds must be an array."
    );

    error.statusCode = 400;
    error.code =
      "RESOURCE_IDS_REQUIRED";

    throw error;
  }

  const uniqueIds =
    [...new Set(resourceIds)];

  const client =
    await authDb.connect();

  try {

    await client.query("BEGIN");

    // ---------------------------------
    // DISABLE CURRENT SELECTIONS
    // ---------------------------------
    await client.query(
      `UPDATE tenant_resources
       SET is_enabled = false,
           disabled_at = now(),
           updated_at = now()
       WHERE tenant_id = $1
         AND is_enabled = true`,
      [tenantId]
    );


    // ---------------------------------
    // ENABLE SELECTED RESOURCES
    // ---------------------------------
    if (uniqueIds.length > 0) {

      await client.query(
        `INSERT INTO tenant_resources
         (
           tenant_id,
           resource_id,
           is_enabled,
           enabled_at,
           disabled_at,
           created_at,
           updated_at
         )

         SELECT
           $1,
           r.id,
           true,
           now(),
           NULL,
           now(),
           now()

         FROM resources r

         WHERE r.id =
           ANY($2::uuid[])
           AND r.is_active = true

         ON CONFLICT
           (tenant_id, resource_id)

         DO UPDATE
         SET
           is_enabled = true,
           enabled_at = now(),
           disabled_at = NULL,
           updated_at = now()`,
        [
          tenantId,
          uniqueIds
        ]
      );
    }


    // ---------------------------------
    // VERIFY ALL IDs WERE VALID
    // ---------------------------------
    if (uniqueIds.length > 0) {

      const validResult =
        await client.query(
          `SELECT COUNT(*)::int AS count
           FROM resources
           WHERE id =
             ANY($1::uuid[])
             AND is_active = true`,
          [uniqueIds]
        );

      if (
        validResult.rows[0].count !==
        uniqueIds.length
      ) {

        const error = new Error(
          "One or more selected resources are invalid or inactive."
        );

        error.statusCode = 400;
        error.code =
          "INVALID_RESOURCE_IDS";

        throw error;
      }
    }


    await client.query("COMMIT");

  } catch (error) {

    await client.query("ROLLBACK");
    throw error;

  } finally {

    client.release();
  }


  return {
    success: true,
    tenantId,
    enabledCount:
      uniqueIds.length
  };
}

// ---------------------------------
// ADMIN RESOURCE LIST
// ---------------------------------
async function getResourcesAdmin() {
  const result = await authDb.query(
    `SELECT
       id,
       resource_key,
       resource_name,
       category,
       description,
       is_active,
       display_order,
       created_at,
       updated_at
     FROM resources
     ORDER BY
       category,
       display_order,
       resource_name`
  );

  return result.rows;
}


// ---------------------------------
// GET RESOURCE
// ---------------------------------
async function getResourceById(id) {
  const result = await authDb.query(
    `SELECT
       id,
       resource_key,
       resource_name,
       category,
       description,
       is_active,
       display_order,
       created_at,
       updated_at
     FROM resources
     WHERE id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    const error = new Error("Resource not found.");
    error.statusCode = 404;
    error.code = "RESOURCE_NOT_FOUND";
    throw error;
  }

  return result.rows[0];
}


// ---------------------------------
// CREATE RESOURCE
// ---------------------------------
async function createResource(data) {
  try {
    const result = await authDb.query(
      `INSERT INTO resources
       (
         resource_key,
         resource_name,
         display_name,
         category,
         description,
         is_active,
         display_order,
         created_at,
         updated_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         now(),
         now()
       )
       RETURNING *`,
      [
        data.resource_key.trim(),
        data.resource_name.trim(),
        data.resource_name.trim(),
        data.category?.trim() || null,
        data.description?.trim() || null,
        data.is_active ?? true,
        data.display_order ?? 0
      ]
    );

    return result.rows[0];

  } catch (error) {
    if (error.code === "23505") {
      const duplicate = new Error(
        "Resource key already exists."
      );

      duplicate.statusCode = 409;
      duplicate.code = "RESOURCE_KEY_EXISTS";

      throw duplicate;
    }

    throw error;
  }
}


// ---------------------------------
// UPDATE RESOURCE
// ---------------------------------
async function updateResource(id, data) {
  const result = await authDb.query(
    `UPDATE resources
     SET resource_name = $2,
         display_name = $2,
         category = $3,
         description = $4,
         display_order = $5,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.resource_name.trim(),
      data.category?.trim() || null,
      data.description?.trim() || null,
      data.display_order ?? 0
    ]
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "Resource not found."
    );

    error.statusCode = 404;
    error.code = "RESOURCE_NOT_FOUND";

    throw error;
  }

  return result.rows[0];
}

// ---------------------------------
// ACTIVATE / DEACTIVATE RESOURCE
// ---------------------------------
async function setResourceActive(id, isActive) {
  const result = await authDb.query(
    `UPDATE resources
     SET is_active = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, isActive]
  );

  if (result.rowCount === 0) {
    const error = new Error("Resource not found.");
    error.statusCode = 404;
    error.code = "RESOURCE_NOT_FOUND";
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  getResources,
  getResourcesAdmin,
  getResourceById,
  createResource,
  updateResource,
  setResourceActive,
  getTenantResources,
  saveTenantResources
};