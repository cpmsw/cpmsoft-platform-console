const authDb =
  require("../../db/authDb");

// ==================================================
// CREATE AUDIT RECORD
// ==================================================

async function createAudit(
  data,
  client = null
) {

  const executor =
    client || authDb;

  const result =
    await executor.query(
      `
        INSERT INTO audit_history
        (
          tenant_id,
          parent_type,
          parent_id,
          entity_type,
          entity_id,
          action,
          old_data,
          new_data,
          changed_by,
          changed_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9,
          now()
        )
        RETURNING *
      `,
      [
        data.tenant_id,
        data.parent_type,
        data.parent_id,
        data.entity_type,
        data.entity_id || null,
        data.action,

        data.old_data !== undefined &&
          data.old_data !== null
          ? JSON.stringify(
            data.old_data
          )
          : null,

        data.new_data !== undefined &&
          data.new_data !== null
          ? JSON.stringify(
            data.new_data
          )
          : null,

        data.changed_by || null
      ]
    );

  return result.rows[0];
}

// ==================================================
// GET AUDIT HISTORY BY PARENT
// ==================================================

async function getByParent(
  tenantId,
  parentType,
  parentId,
  options = {},
  client = null
) {

  const executor =
    client || authDb;

  const page =
    Math.max(
      Number(options.page) || 1,
      1
    );

  const pageSize =
    Math.min(
      Math.max(
        Number(options.pageSize) || 25,
        1
      ),
      100
    );

  const offset =
    (page - 1) *
    pageSize;

  const params = [
    tenantId,
    parentType,
    parentId
  ];

  const where = [
    "ah.tenant_id = $1",
    "ah.parent_type = $2",
    "ah.parent_id = $3"
  ];

  if (options.entityType) {

    params.push(
      options.entityType
    );

    where.push(
      `ah.entity_type =
       $${params.length}`
    );
  }

  if (options.action) {

    params.push(
      options.action
    );

    where.push(
      `ah.action =
       $${params.length}`
    );
  }

  if (options.userSearch) {

    params.push(
      `%${options.userSearch}%`
    );

    where.push(
      `(
        pa.display_name ILIKE
          $${params.length}
        OR
        pa.email ILIKE
          $${params.length}
      )`
    );
  }

  if (options.dateFrom) {

    params.push(
      options.dateFrom
    );

    where.push(
      `ah.changed_at >=
       $${params.length}::date`
    );
  }

  if (options.dateTo) {

    params.push(
      options.dateTo
    );

    where.push(
      `ah.changed_at < (
        $${params.length}::date
        + INTERVAL '1 day'
      )`
    );
  }

  const whereSql =
    where.join(
      "\n          AND "
    );

  // ---------------------------------
  // COUNT
  // ---------------------------------

  const countResult =
    await executor.query(
      `
        SELECT
          COUNT(*)::integer AS total
        FROM audit_history ah

        LEFT JOIN platform_admins pa
          ON pa.id =
             ah.changed_by

        WHERE ${whereSql}
      `,
      params
    );

  const total =
    countResult.rows[0]?.total ||
    0;

  // ---------------------------------
  // PAGE
  // ---------------------------------

  const dataParams =
    [...params];

  dataParams.push(
    pageSize
  );

  const limitPosition =
    dataParams.length;

  dataParams.push(
    offset
  );

  const offsetPosition =
    dataParams.length;

  const result =
    await executor.query(
      `
        SELECT
          ah.id,
          ah.tenant_id,
          ah.parent_type,
          ah.parent_id,
          ah.entity_type,
          ah.entity_id,
          ah.action,
          ah.old_data,
          ah.new_data,
          ah.changed_by,
          ah.changed_at,

          pa.display_name
            AS changed_by_name,

          pa.email
            AS changed_by_email

        FROM audit_history ah

        LEFT JOIN platform_admins pa
          ON pa.id =
             ah.changed_by

        WHERE ${whereSql}

        ORDER BY
          ah.changed_at DESC,
          ah.id DESC

        LIMIT $${limitPosition}
        OFFSET $${offsetPosition}
      `,
      dataParams
    );

  return {
    items:
      result.rows,

    page,

    pageSize,

    total,

    hasMore:
      offset +
      result.rows.length <
      total
  };
}

// ==================================================
// GET PACKAGE DISPLAY NAMES
// ==================================================

async function getPackageNames(
  ids = [],
  client = null
) {

  if (
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    return [];
  }

  const executor =
    client || authDb;

  const result =
    await executor.query(
      `
        SELECT
          id,
          package_key,
          package_name,
          display_name
        FROM packages
        WHERE id = ANY($1::uuid[])
      `,
      [
        ids
      ]
    );

  return result.rows;
}


// ==================================================
// GET RESOURCE DISPLAY NAMES
// ==================================================

async function getResourceNames(
  ids = [],
  client = null
) {

  if (
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    return [];
  }

  const executor =
    client || authDb;

  const result =
    await executor.query(
      `
        SELECT
          id,
          resource_key,
          resource_name,
          display_name
        FROM resources
        WHERE id = ANY($1::uuid[])
      `,
      [
        ids
      ]
    );

  return result.rows;
}

// ==================================================
// EXPORTS
// ==================================================

module.exports = {
  createAudit,
  getByParent,
  getPackageNames,
  getResourceNames
};