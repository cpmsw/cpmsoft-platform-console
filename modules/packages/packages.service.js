const authDb =
  require("../../db/authDb");

const audit =
  require("../audit");


// ---------------------------------
// GET PACKAGES WITH RESOURCES
// ---------------------------------
async function getPackages() {

  const result = await authDb.query(
    `SELECT
       p.id AS package_id,
       p.package_key,
       p.package_name,
       p.description AS package_description,
       p.display_order AS package_display_order,

       r.id AS resource_id,
       r.resource_key,
       r.resource_name,
       r.category,
       r.description AS resource_description,

       pr.is_default,
       pr.display_order AS resource_display_order

     FROM packages p

     LEFT JOIN package_resources pr
       ON pr.package_id = p.id

     LEFT JOIN resources r
       ON r.id = pr.resource_id
      AND r.is_active = true

     WHERE p.is_active = true

     ORDER BY
       p.display_order,
       p.package_name,
       pr.display_order,
       r.resource_name`
  );


  const packages = new Map();


  for (const row of result.rows) {

    if (!packages.has(row.package_id)) {

      packages.set(
        row.package_id,
        {
          packageId:
            row.package_id,

          packageKey:
            row.package_key,

          packageName:
            row.package_name,

          description:
            row.package_description,

          displayOrder:
            row.package_display_order,

          resources: []
        }
      );
    }


    if (row.resource_id) {

      packages
        .get(row.package_id)
        .resources
        .push({
          resourceId:
            row.resource_id,

          resourceKey:
            row.resource_key,

          resourceName:
            row.resource_name,

          category:
            row.category,

          description:
            row.resource_description,

          isDefault:
            row.is_default,

          displayOrder:
            row.resource_display_order
        });
    }
  }


  return [...packages.values()];
}

// ---------------------------------
// ADMIN PACKAGE LIST
// ---------------------------------
// ---------------------------------
// ADMIN PACKAGE LIST
// ---------------------------------
async function getPackagesAdmin({
  search = "",
  status = "active"
} = {}) {

  const values = [];
  const where = [];


  if (search.trim()) {

    values.push(
      `%${search.trim()}%`
    );

    where.push(
      `(package_name ILIKE $${values.length}
        OR package_key ILIKE $${values.length}
        OR description ILIKE $${values.length})`
    );
  }


  if (status === "active") {

    where.push(
      "is_active = true"
    );

  } else if (
    status === "inactive"
  ) {

    where.push(
      "is_active = false"
    );
  }


  const whereSql =
    where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";


  const result =
    await authDb.query(
      `SELECT
         id,
         package_key,
         package_name,
         description,
         is_active,
         display_order,
         created_at,
         updated_at
       FROM packages
       ${whereSql}
       ORDER BY
         display_order,
         package_name
       LIMIT 100`,
      values
    );


  return result.rows;
}

// ---------------------------------
// ADMIN PACKAGE COUNT
// ---------------------------------
async function countPackagesAdmin({
  search = "",
  status = "active"
} = {}) {

  const values = [];
  const where = [];


  if (search.trim()) {

    values.push(
      `%${search.trim()}%`
    );

    where.push(
      `(package_name ILIKE $${values.length}
        OR package_key ILIKE $${values.length}
        OR description ILIKE $${values.length})`
    );
  }


  if (status === "active") {

    where.push(
      "is_active = true"
    );

  } else if (
    status === "inactive"
  ) {

    where.push(
      "is_active = false"
    );
  }


  const whereSql =
    where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";


  const result =
    await authDb.query(
      `SELECT COUNT(*)::int AS count
       FROM packages
       ${whereSql}`,
      values
    );


  return result.rows[0]?.count || 0;
}

// ---------------------------------
// GET PACKAGE BY ID
// ---------------------------------
async function getPackageById(id) {
  const result = await authDb.query(
    `SELECT
       id,
       package_key,
       package_name,
       description,
       is_active,
       display_order,
       created_at,
       updated_at
     FROM packages
     WHERE id = $1`,
    [id]
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "Package not found."
    );

    error.statusCode = 404;
    error.code = "PACKAGE_NOT_FOUND";

    throw error;
  }

  return result.rows[0];
}


// ---------------------------------
// PACKAGE AUDIT SNAPSHOT
// ---------------------------------

function packageSnapshot(
  row
) {

  if (!row) {
    return null;
  }

  return {
    package_key:
      row.package_key,

    package_name:
      row.package_name,

    description:
      row.description,

    display_order:
      row.display_order,

    is_active:
      row.is_active
  };
}


// ---------------------------------
// CREATE PACKAGE
// ---------------------------------
async function createPackage(
  data,
  adminId
) {

  const client =
    await authDb.connect();

  try {

    await client.query(
      "BEGIN"
    );


    const result =
      await client.query(
        `INSERT INTO packages
         (
           package_key,
           package_name,
           display_name,
           description,
           is_active,
           display_order,
           created_at,
           updated_at
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           now(),
           now()
         )
         RETURNING *`,
        [
          data.package_key.trim(),
          data.package_name.trim(),
          data.package_name.trim(),
          data.description?.trim() || null,
          data.is_active ?? true,
          data.display_order ?? 0
        ]
      );


    const row =
      result.rows[0];


    await audit.createAudit(
      {
        tenant_id:
          null,

        parent_type:
          "package",

        parent_id:
          row.id,

        entity_type:
          "package",

        entity_id:
          row.id,

        action:
          "CREATE",

        old_data:
          null,

        new_data:
          packageSnapshot(
            row
          ),

        changed_by:
          adminId
      },
      client
    );


    await client.query(
      "COMMIT"
    );


    return row;

  } catch (error) {

    await client.query(
      "ROLLBACK"
    );


    if (
      error.code === "23505"
    ) {

      const duplicate =
        new Error(
          "Package key already exists."
        );

      duplicate.statusCode = 409;
      duplicate.code =
        "PACKAGE_KEY_EXISTS";

      throw duplicate;
    }


    throw error;

  } finally {

    client.release();
  }
}

// ---------------------------------
// UPDATE PACKAGE
// ---------------------------------
async function updatePackage(
  id,
  data,
  adminId
) {

  const client =
    await authDb.connect();

  try {

    await client.query(
      "BEGIN"
    );


    const existingResult =
      await client.query(
        `SELECT *
         FROM packages
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );


    if (
      existingResult.rowCount === 0
    ) {

      const error =
        new Error(
          "Package not found."
        );

      error.statusCode = 404;
      error.code =
        "PACKAGE_NOT_FOUND";

      throw error;
    }


    const existing =
      existingResult.rows[0];


    const result =
      await client.query(
        `UPDATE packages
         SET package_name = $2,
             display_name = $2,
             description = $3,
             display_order = $4,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          data.package_name.trim(),
          data.description?.trim() || null,
          data.display_order ?? 0
        ]
      );


    const row =
      result.rows[0];


    await audit.createAudit(
      {
        tenant_id:
          null,

        parent_type:
          "package",

        parent_id:
          id,

        entity_type:
          "package",

        entity_id:
          id,

        action:
          "UPDATE",

        old_data:
          packageSnapshot(
            existing
          ),

        new_data:
          packageSnapshot(
            row
          ),

        changed_by:
          adminId
      },
      client
    );


    await client.query(
      "COMMIT"
    );


    return row;

  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;

  } finally {

    client.release();
  }
}

// ---------------------------------
// ACTIVATE / DEACTIVATE PACKAGE
// ---------------------------------
async function setPackageActive(
  id,
  isActive,
  adminId
) {

  const client =
    await authDb.connect();

  try {

    await client.query(
      "BEGIN"
    );


    const existingResult =
      await client.query(
        `SELECT *
         FROM packages
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );


    if (
      existingResult.rowCount === 0
    ) {

      const error =
        new Error(
          "Package not found."
        );

      error.statusCode = 404;
      error.code =
        "PACKAGE_NOT_FOUND";

      throw error;
    }


    const existing =
      existingResult.rows[0];


    const result =
      await client.query(
        `UPDATE packages
         SET is_active = $2,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          isActive
        ]
      );


    const row =
      result.rows[0];


    await audit.createAudit(
      {
        tenant_id:
          null,

        parent_type:
          "package",

        parent_id:
          id,

        entity_type:
          "package",

        entity_id:
          id,

        action:
          isActive
            ? "REACTIVATE"
            : "DEACTIVATE",

        old_data:
          packageSnapshot(
            existing
          ),

        new_data:
          packageSnapshot(
            row
          ),

        changed_by:
          adminId
      },
      client
    );


    await client.query(
      "COMMIT"
    );


    return row;

  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;

  } finally {

    client.release();
  }
}

// ---------------------------------
// PACKAGE RESOURCE ASSIGNMENTS
// ---------------------------------
async function getPackageResources(
  packageId
) {

  // Make sure the package exists.
  await getPackageById(packageId);

  const result =
    await authDb.query(
      `SELECT
         r.id AS resource_id,
         r.resource_key,
         r.resource_name,
         r.category,
         r.description,
         r.is_active,
         r.display_order,

         CASE
           WHEN pr.id IS NULL
             THEN false
           ELSE true
         END AS is_selected,

         COALESCE(
           pr.is_default,
           false
         ) AS is_default,

         COALESCE(
           pr.display_order,
           r.display_order
         ) AS package_display_order

       FROM resources r

       LEFT JOIN package_resources pr
         ON pr.resource_id = r.id
        AND pr.package_id = $1

       ORDER BY
         r.category,
         COALESCE(
           pr.display_order,
           r.display_order
         ),
         r.resource_name`,
      [packageId]
    );

  return result.rows;
}


// ---------------------------------
// SAVE PACKAGE RESOURCE ASSIGNMENTS
// ---------------------------------
async function savePackageResources(
  packageId,
  resources,
  adminId
) {

  if (!Array.isArray(resources)) {
    const error =
      new Error(
        "resources must be an array."
      );

    error.statusCode = 400;
    error.code =
      "PACKAGE_RESOURCES_REQUIRED";

    throw error;
  }


  // Confirm package exists.
  await getPackageById(packageId);


  // Remove accidental duplicate resource IDs.
  const uniqueMap = new Map();

  for (const item of resources) {

    if (!item?.resource_id) {
      const error =
        new Error(
          "Each resource must include resource_id."
        );

      error.statusCode = 400;
      error.code =
        "RESOURCE_ID_REQUIRED";

      throw error;
    }

    uniqueMap.set(
      item.resource_id,
      {
        resource_id:
          item.resource_id,

        is_default:
          item.is_default ?? true,

        display_order:
          item.display_order ?? 0
      }
    );
  }


  const selections =
    [...uniqueMap.values()];


  const client =
    await authDb.connect();

  try {

    await client.query("BEGIN");

    const oldSnapshot =
      await getPackageResourcesSnapshot(
        packageId,
        client
      );


    // Validate selected resources.
    if (selections.length > 0) {

      const resourceIds =
        selections.map(
          item =>
            item.resource_id
        );


      const validResult =
        await client.query(
          `SELECT COUNT(*)::int AS count
           FROM resources
           WHERE id =
             ANY($1::uuid[])
             AND is_active = true`,
          [resourceIds]
        );


      if (
        validResult.rows[0].count !==
        resourceIds.length
      ) {

        const error =
          new Error(
            "One or more package resources are invalid or inactive."
          );

        error.statusCode = 400;
        error.code =
          "INVALID_PACKAGE_RESOURCE_IDS";

        throw error;
      }
    }


    // Replace the package's resource configuration.
    await client.query(
      `DELETE FROM package_resources
       WHERE package_id = $1`,
      [packageId]
    );


    for (const item of selections) {

      await client.query(
        `INSERT INTO package_resources
         (
           package_id,
           resource_id,
           is_default,
           display_order,
           created_at,
           updated_at
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           now(),
           now()
         )`,
        [
          packageId,
          item.resource_id,
          item.is_default,
          item.display_order
        ]
      );
    }

    const newSnapshot =
      await getPackageResourcesSnapshot(
        packageId,
        client
      );


    await audit.createAudit(
      {
        tenant_id:
          null,

        parent_type:
          "package",

        parent_id:
          packageId,

        entity_type:
          "package_resources",

        entity_id:
          packageId,

        action:
          "UPDATE",

        old_data:
          oldSnapshot,

        new_data:
          newSnapshot,

        changed_by:
          adminId
      },
      client
    );

    await client.query("COMMIT");

  } catch (error) {

    await client.query("ROLLBACK");
    throw error;

  } finally {

    client.release();
  }


  return {
    success: true,
    packageId,
    resourceCount:
      selections.length
  };
}

// ---------------------------------
// PACKAGE RESOURCES AUDIT SNAPSHOT
// ---------------------------------

async function getPackageResourcesSnapshot(
  packageId,
  client
) {

  const result =
    await client.query(
      `SELECT
         r.id AS resource_id,
         r.resource_key,
         r.resource_name,
         pr.is_default,
         pr.display_order
       FROM package_resources pr
       JOIN resources r
         ON r.id = pr.resource_id
       WHERE pr.package_id = $1
       ORDER BY
         pr.display_order,
         r.resource_name`,
      [packageId]
    );


  return {
    resources:
      result.rows.map(
        row => ({
          resource_id:
            row.resource_id,

          resource_key:
            row.resource_key,

          resource_name:
            row.resource_name,

          is_default:
            row.is_default,

          display_order:
            row.display_order
        })
      )
  };
}

module.exports = {
  getPackages,
  getPackagesAdmin,
  countPackagesAdmin,
  getPackageById,
  createPackage,
  updatePackage,
  setPackageActive,
  getPackageResources,
  savePackageResources
};