const authDb =
  require("../../db/authDb");

const appDb =
  require("../../db/appDb");

const {
  syncTenantRolePermissions
} = require(
  "./provisioning/syncTenantRolePermissions"
);

// =================================
// RESOLVE TENANT ENTITLEMENTS
// =================================

async function resolveTenantEntitlements({
  client,
  requestedPackageIds,
  requestedResourceIds
}) {

  if (!Array.isArray(requestedPackageIds)) {

    const error =
      new Error(
        "packageIds must be an array."
      );

    error.statusCode = 400;

    error.code =
      "INVALID_PACKAGE_IDS";

    throw error;
  }


  if (!Array.isArray(requestedResourceIds)) {

    const error =
      new Error(
        "resourceIds must be an array."
      );

    error.statusCode = 400;

    error.code =
      "INVALID_RESOURCE_IDS";

    throw error;
  }


  // ---------------------------------
  // REMOVE DUPLICATES
  // ---------------------------------

  const packageIds =
    [
      ...new Set(
        requestedPackageIds.map(
          id => String(id)
        )
      )
    ];


  const resourceIds =
    [
      ...new Set(
        requestedResourceIds.map(
          id => String(id)
        )
      )
    ];


  // ---------------------------------
  // VALIDATE REQUESTED PACKAGES
  // ---------------------------------

  let validPackages = [];


  if (packageIds.length > 0) {

    const result =
      await client.query(
        `SELECT
           id,
           package_key,
           package_name
         FROM packages
         WHERE id = ANY($1::uuid[])
           AND is_active = true`,
        [
          packageIds
        ]
      );


    validPackages =
      result.rows;


    if (
      validPackages.length !==
      packageIds.length
    ) {

      const validIds =
        new Set(
          validPackages.map(
            row =>
              String(row.id)
          )
        );


      const invalidIds =
        packageIds.filter(
          id =>
            !validIds.has(id)
        );


      const error =
        new Error(
          `Invalid or inactive package IDs: ${invalidIds.join(", ")}`
        );

      error.statusCode = 400;

      error.code =
        "INVALID_PACKAGE_IDS";

      throw error;
    }
  }


  // ---------------------------------
  // VALIDATE REQUESTED RESOURCES
  // ---------------------------------

  let validResources = [];


  if (resourceIds.length > 0) {

    const result =
      await client.query(
        `SELECT
           id,
           resource_key,
           resource_name
         FROM resources
         WHERE id = ANY($1::uuid[])
           AND is_active = true`,
        [
          resourceIds
        ]
      );


    validResources =
      result.rows;


    if (
      validResources.length !==
      resourceIds.length
    ) {

      const validIds =
        new Set(
          validResources.map(
            row =>
              String(row.id)
          )
        );


      const invalidIds =
        resourceIds.filter(
          id =>
            !validIds.has(id)
        );


      const error =
        new Error(
          `Invalid or inactive resource IDs: ${invalidIds.join(", ")}`
        );

      error.statusCode = 400;

      error.code =
        "INVALID_RESOURCE_IDS";

      throw error;
    }
  }


  // ---------------------------------
  // REQUIRED SYSTEM PACKAGE
  //
  // Settings is always assigned to
  // every Tenant.
  // ---------------------------------

  const settingsResult =
    await client.query(
      `SELECT
         id,
         package_key,
         package_name
       FROM packages
       WHERE package_key = 'settings'
         AND is_active = true
       LIMIT 1`
    );


  if (
    settingsResult.rowCount === 0
  ) {

    const error =
      new Error(
        "Required Settings package is missing or inactive."
      );

    error.statusCode = 500;

    error.code =
      "SETTINGS_PACKAGE_MISSING";

    throw error;
  }


  const settingsPackage =
    settingsResult.rows[0];


  const finalPackageIds =
    [
      ...new Set([
        ...packageIds,
        String(
          settingsPackage.id
        )
      ])
    ];


  // ---------------------------------
  // SYSTEM RESOURCES
  //
  // These resources are required for
  // every Tenant and are not editable
  // commercial entitlements.
  // ---------------------------------

  const systemResult =
    await client.query(
      `SELECT
         id,
         resource_key,
         resource_name
       FROM resources
       WHERE resource_key = ANY(
         $1::text[]
       )
         AND is_active = true`,
      [
        [
          "users",
          "company",
          "roles_permissions"
        ]
      ]
    );


  const systemByKey =
    new Map(
      systemResult.rows.map(
        row => [
          row.resource_key,
          row
        ]
      )
    );


  const requiredSystemKeys =
    [
      "users",
      "company",
      "roles_permissions"
    ];


  const missingSystemKeys =
    requiredSystemKeys.filter(
      key =>
        !systemByKey.has(key)
    );


  if (
    missingSystemKeys.length > 0
  ) {

    const error =
      new Error(
        `Required system resources are missing or inactive: ${missingSystemKeys.join(", ")}`
      );

    error.statusCode = 500;

    error.code =
      "SYSTEM_RESOURCE_MISSING";

    throw error;
  }


  const systemResources =
    requiredSystemKeys.map(
      key =>
        systemByKey.get(key)
    );


  const finalResourceIds =
    [
      ...new Set([
        ...resourceIds,

        ...systemResources.map(
          resource =>
            String(resource.id)
        )
      ])
    ];


  // ---------------------------------
  // VALIDATE RESOURCE COVERAGE
  //
  // Every enabled Resource must belong
  // to at least one selected Package.
  //
  // A shared Resource may also belong
  // to other unselected Packages.
  // Those Packages are NOT activated.
  // ---------------------------------

  if (
    finalResourceIds.length > 0
  ) {

    const coverageResult =
      await client.query(
        `SELECT DISTINCT
           pr.resource_id
         FROM package_resources pr
         WHERE pr.package_id =
               ANY($1::uuid[])
           AND pr.resource_id =
               ANY($2::uuid[])`,
        [
          finalPackageIds,
          finalResourceIds
        ]
      );


    const coveredResourceIds =
      new Set(
        coverageResult.rows.map(
          row =>
            String(
              row.resource_id
            )
        )
      );


    const uncoveredResourceIds =
      finalResourceIds.filter(
        resourceId =>
          !coveredResourceIds.has(
            resourceId
          )
      );


    if (
      uncoveredResourceIds.length > 0
    ) {

      const error =
        new Error(
          `Resources must belong to at least one selected package: ${uncoveredResourceIds.join(", ")}`
        );

      error.statusCode = 400;

      error.code =
        "RESOURCE_NOT_IN_SELECTED_PACKAGE";

      throw error;
    }
  }


  return {
    finalResourceIds,
    finalPackageIds,
    validResources,
    validPackages,
    systemResources,
    settingsPackage
  };
}
// =================================
// UPDATE TENANT ENTITLEMENTS
// =================================

async function updateTenantEntitlements({
  tenantId,
  packageIds,
  resourceIds,
  licensedUsers,
  maxCompanies,
  rbacEnabled
}) {

  const client =
    await authDb.connect();

  const appClient =
    await appDb.connect();


  try {

    await client.query("BEGIN");
    await appClient.query("BEGIN");


    // ---------------------------------
    // LOCK + VALIDATE TENANT
    // ---------------------------------

    const tenantResult =
      await client.query(
        `SELECT
           id,
           licensed_users,
           max_companies,
           rbac_enabled
         FROM tenants
         WHERE id = $1
         FOR UPDATE`,
        [
          tenantId
        ]
      );


    if (
      tenantResult.rowCount === 0
    ) {

      const error =
        new Error(
          "Tenant not found."
        );

      error.statusCode = 404;

      error.code =
        "TENANT_NOT_FOUND";

      throw error;
    }


    // ---------------------------------
    // VALIDATE LICENSE LIMITS
    // ---------------------------------

    if (
      !Number.isInteger(
        licensedUsers
      ) ||
      licensedUsers < 1
    ) {

      const error =
        new Error(
          "licensedUsers must be an integer greater than or equal to 1."
        );

      error.statusCode = 400;

      error.code =
        "INVALID_LICENSED_USERS";

      throw error;
    }


    if (
      !Number.isInteger(
        maxCompanies
      ) ||
      maxCompanies < 1
    ) {

      const error =
        new Error(
          "maxCompanies must be an integer greater than or equal to 1."
        );

      error.statusCode = 400;

      error.code =
        "INVALID_MAX_COMPANIES";

      throw error;
    }


    if (
      typeof rbacEnabled !==
      "boolean"
    ) {

      const error =
        new Error(
          "rbacEnabled must be a boolean."
        );

      error.statusCode = 400;

      error.code =
        "INVALID_RBAC_ENABLED";

      throw error;
    }


    // ---------------------------------
    // RESOLVE FINAL ENTITLEMENTS
    // ---------------------------------

    const resolved =
      await resolveTenantEntitlements({
        client,

        requestedPackageIds:
          packageIds,

        requestedResourceIds:
          resourceIds
      });

    const finalResourceIds =
      resolved.finalResourceIds;


    const finalPackageIds =
      resolved.finalPackageIds;


    // ---------------------------------
    // UPDATE TENANT LIMITS
    // ---------------------------------

    await client.query(
      `UPDATE tenants
       SET
         licensed_users = $2,
         max_companies = $3,
         rbac_enabled = $4,
         updated_at = now()
       WHERE id = $1`,
      [
        tenantId,
        licensedUsers,
        maxCompanies,
        rbacEnabled
      ]
    );


    // ---------------------------------
    // DISABLE PACKAGES NO LONGER USED
    // ---------------------------------

    await client.query(
      `UPDATE tenant_packages
       SET
         is_active = false,
         disabled_at = now(),
         updated_at = now()
       WHERE tenant_id = $1
         AND is_active = true
         AND NOT (
           package_id =
           ANY($2::uuid[])
         )`,
      [
        tenantId,
        finalPackageIds
      ]
    );


    // ---------------------------------
    // ENABLE / REACTIVATE PACKAGES
    // ---------------------------------

    for (
      const packageId
      of finalPackageIds
    ) {

      await client.query(
        `INSERT INTO tenant_packages (
           tenant_id,
           package_id,
           is_active,
           enabled_at,
           disabled_at
         )
         VALUES (
           $1,
           $2,
           true,
           now(),
           NULL
         )

         ON CONFLICT (
           tenant_id,
           package_id
         )

         DO UPDATE SET
           is_active = true,
           enabled_at =
             CASE
               WHEN tenant_packages.is_active = false
                 THEN now()
               ELSE tenant_packages.enabled_at
             END,
           disabled_at = NULL,
           updated_at = now()`,
        [
          tenantId,
          packageId
        ]
      );
    }


    // ---------------------------------
    // DISABLE RESOURCES NO LONGER USED
    // ---------------------------------

    await client.query(
      `UPDATE tenant_resources
       SET
         is_enabled = false,
         disabled_at = now(),
         updated_at = now()
       WHERE tenant_id = $1
         AND is_enabled = true
         AND NOT (
           resource_id =
           ANY($2::uuid[])
         )`,
      [
        tenantId,
        finalResourceIds
      ]
    );


    // ---------------------------------
    // ENABLE / REACTIVATE RESOURCES
    // ---------------------------------

    for (
      const resourceId
      of finalResourceIds
    ) {

      await client.query(
        `INSERT INTO tenant_resources (
           tenant_id,
           resource_id,
           is_enabled,
           enabled_at,
           disabled_at
         )
         VALUES (
           $1,
           $2,
           true,
           now(),
           NULL
         )

         ON CONFLICT (
           tenant_id,
           resource_id
         )

         DO UPDATE SET
           is_enabled = true,
           enabled_at =
             CASE
               WHEN tenant_resources.is_enabled = false
                 THEN now()
               ELSE tenant_resources.enabled_at
             END,
           disabled_at = NULL,
           updated_at = now()`,
        [
          tenantId,
          resourceId
        ]
      );
    }


    // ---------------------------------
    // SYNCHRONIZE APPDB RBAC
    //
    // Tenant entitlements live in
    // authdb. role_permissions live in
    // appdb.
    //
    // Keep the standard Tenant roles
    // synchronized with the final
    // enabled Resource set.
    // ---------------------------------

    await syncTenantRolePermissions({
      appClient,
      tenantId,
      finalResourceIds,
      rbacEnabled
    });


    // ---------------------------------
    // COMMIT
    // ---------------------------------

    await appClient.query("COMMIT");

    await client.query("COMMIT");




    // ---------------------------------
    // RETURN FRESH STATE
    // ---------------------------------

    return await getTenantEntitlements(
      tenantId
    );


  } catch (error) {

    try {

      await appClient.query(
        "ROLLBACK"
      );

    } catch (rollbackError) {

      // Preserve the original error.
    }


    try {

      await client.query(
        "ROLLBACK"
      );

    } catch (rollbackError) {

      // Preserve the original error.
    }


    throw error;


  } finally {

    appClient.release();
    client.release();
  }
}

// =================================
// GET TENANT ENTITLEMENTS
// =================================

async function getTenantEntitlements(
  tenantId
) {

  // ---------------------------------
  // TENANT + LICENSE LIMITS
  // ---------------------------------

  const tenantResult =
    await authDb.query(
      `SELECT
         id,
         legal_name,
         dba_name,
         tenant_code,
         status,
         is_active,
         licensed_users,
         max_companies,
         rbac_enabled
       FROM tenants
       WHERE id = $1`,
      [
        tenantId
      ]
    );


  if (tenantResult.rowCount === 0) {

    const error =
      new Error(
        "Tenant not found."
      );

    error.statusCode = 404;

    error.code =
      "TENANT_NOT_FOUND";

    throw error;
  }


  const tenant =
    tenantResult.rows[0];


  // ---------------------------------
  // ACTIVE PACKAGE / RESOURCE CATALOG
  //
  // This is the master configuration
  // available to Platform Console.
  // ---------------------------------

  const catalogResult =
    await authDb.query(
      `SELECT
         p.id AS package_id,
         p.package_key,
         p.package_name,
         p.display_name
           AS package_display_name,
         p.description
           AS package_description,
         p.display_order
           AS package_display_order,

         r.id AS resource_id,
         r.resource_key,
         r.resource_name,
         r.display_name
           AS resource_display_name,
         r.category
           AS resource_category,
         r.description
           AS resource_description,
         r.display_order
           AS resource_display_order,

         pr.is_default,
         pr.display_order
           AS package_resource_display_order

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
         r.display_order,
         r.resource_name`
    );


  // ---------------------------------
  // TENANT PACKAGE STATE
  // ---------------------------------

  const tenantPackageResult =
    await authDb.query(
      `SELECT
         tp.package_id,
         tp.is_active,
         tp.enabled_at,
         tp.disabled_at

       FROM tenant_packages tp

       JOIN packages p
         ON p.id = tp.package_id

       WHERE tp.tenant_id = $1
         AND p.is_active = true`,
      [
        tenantId
      ]
    );


  const tenantPackageById =
    new Map(
      tenantPackageResult.rows.map(
        row => [
          String(row.package_id),
          row
        ]
      )
    );


  // ---------------------------------
  // TENANT RESOURCE STATE
  // ---------------------------------

  const tenantResourceResult =
    await authDb.query(
      `SELECT
         tr.resource_id,
         tr.is_enabled,
         tr.enabled_at,
         tr.disabled_at

       FROM tenant_resources tr

       JOIN resources r
         ON r.id = tr.resource_id

       WHERE tr.tenant_id = $1
         AND r.is_active = true`,
      [
        tenantId
      ]
    );


  const tenantResourceById =
    new Map(
      tenantResourceResult.rows.map(
        row => [
          String(row.resource_id),
          row
        ]
      )
    );


  // ---------------------------------
  // BUILD PACKAGE CATALOG
  // ---------------------------------

  const packageById =
    new Map();


  for (const row of catalogResult.rows) {

    const packageId =
      String(row.package_id);


    let packageItem =
      packageById.get(packageId);


    if (!packageItem) {

      const tenantPackage =
        tenantPackageById.get(
          packageId
        );


      packageItem = {

        id:
          row.package_id,

        packageKey:
          row.package_key,

        packageName:
          row.package_name,

        displayName:
          row.package_display_name,

        description:
          row.package_description,

        displayOrder:
          row.package_display_order,

        isSelected:
          tenantPackage?.is_active ===
          true,

        enabledAt:
          tenantPackage?.enabled_at ||
          null,

        disabledAt:
          tenantPackage?.disabled_at ||
          null,

        resources: []
      };


      packageById.set(
        packageId,
        packageItem
      );
    }


    // Package may currently have no
    // Resources configured.
    if (!row.resource_id) {
      continue;
    }


    const resourceId =
      String(row.resource_id);


    const tenantResource =
      tenantResourceById.get(
        resourceId
      );


    packageItem.resources.push({

      id:
        row.resource_id,

      resourceKey:
        row.resource_key,

      resourceName:
        row.resource_name,

      displayName:
        row.resource_display_name,

      category:
        row.resource_category,

      description:
        row.resource_description,

      displayOrder:
        row.resource_display_order,

      packageDisplayOrder:
        row.package_resource_display_order,

      isDefault:
        row.is_default === true,

      isEnabled:
        tenantResource?.is_enabled ===
        true,

      enabledAt:
        tenantResource?.enabled_at ||
        null,

      disabledAt:
        tenantResource?.disabled_at ||
        null
    });
  }


  const packages =
    [...packageById.values()];


  // ---------------------------------
  // CURRENT ENABLED IDS
  // ---------------------------------

  const selectedPackageIds =
    tenantPackageResult.rows
      .filter(
        row =>
          row.is_active === true
      )
      .map(
        row =>
          row.package_id
      );


  const enabledResourceIds =
    tenantResourceResult.rows
      .filter(
        row =>
          row.is_enabled === true
      )
      .map(
        row =>
          row.resource_id
      );


  // ---------------------------------
  // RESULT
  // ---------------------------------

  return {

    tenant: {
      id:
        tenant.id,

      legalName:
        tenant.legal_name,

      dbaName:
        tenant.dba_name,

      tenantCode:
        tenant.tenant_code,

      status:
        tenant.status,

      isActive:
        tenant.is_active,

      licensedUsers:
        tenant.licensed_users,

      maxCompanies:
        tenant.max_companies,

      rbacEnabled:
        tenant.rbac_enabled
    },

    selectedPackageIds,

    enabledResourceIds,

    packages
  };
}

module.exports = {
  getTenantEntitlements,
  resolveTenantEntitlements,
  updateTenantEntitlements
};