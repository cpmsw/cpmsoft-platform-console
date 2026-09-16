// =================================
// SYNC TENANT ROLE PERMISSIONS
//
// Synchronizes appdb role_permissions
// with the Tenant's currently enabled
// Resources.
//
// PRIMARY
//   Full access
//
// ADMIN
//   Full access
//
// MANAGER
//   View / Create / Edit
//   Only when RBAC is enabled
//
// VIEWER
//   View only
//   Only when RBAC is enabled
//
// This function is intended for
// post-onboarding entitlement changes.
// =================================


async function syncTenantRolePermissions({
  appClient,
  tenantId,
  finalResourceIds,
  rbacEnabled
}) {

  // ---------------------------------
  // NORMALIZE RESOURCE IDS
  // ---------------------------------

  const resourceIds =
    [
      ...new Set(
        (finalResourceIds || []).map(
          id => String(id)
        )
      )
    ];


  // ---------------------------------
  // LOAD ACTIVE STANDARD ROLES
  // ---------------------------------

  const roleResult =
    await appClient.query(
      `SELECT
         id,
         role_code

       FROM roles

       WHERE tenant_id = $1
         AND is_active = true
         AND role_code = ANY(
           $2::text[]
         )`,
      [
        tenantId,
        [
          "PRIMARY",
          "ADMIN",
          "MANAGER",
          "VIEWER"
        ]
      ]
    );


  const roleIdByCode =
    new Map(
      roleResult.rows.map(
        row => [
          row.role_code,
          row.id
        ]
      )
    );


  const primaryRoleId =
    roleIdByCode.get("PRIMARY");

  const adminRoleId =
    roleIdByCode.get("ADMIN");

  const managerRoleId =
    roleIdByCode.get("MANAGER");

  const viewerRoleId =
    roleIdByCode.get("VIEWER");


  // PRIMARY and ADMIN are required
  // standard Tenant roles.

  if (!primaryRoleId || !adminRoleId) {

    const missingRoles = [];

    if (!primaryRoleId) {
      missingRoles.push("PRIMARY");
    }

    if (!adminRoleId) {
      missingRoles.push("ADMIN");
    }


    const error =
      new Error(
        `Required Tenant roles are missing: ${missingRoles.join(", ")}`
      );

    error.code =
      "TENANT_STANDARD_ROLES_MISSING";

    throw error;
  }


  // ---------------------------------
  // LOAD ACTIVE GENERIC PERMISSIONS
  // ---------------------------------

  const permissionResult =
    await appClient.query(
      `SELECT
         id,
         permission_key

       FROM permissions

       WHERE is_active = true

       ORDER BY
         display_order,
         permission_key`
    );


  const permissionIds =
    permissionResult.rows.map(
      row => row.id
    );


  const permissionIdByKey =
    new Map(
      permissionResult.rows.map(
        row => [
          row.permission_key,
          row.id
        ]
      )
    );


  const managerPermissionIds =
    [
      permissionIdByKey.get("view"),
      permissionIdByKey.get("create"),
      permissionIdByKey.get("edit")
    ].filter(Boolean);


  const viewerPermissionIds =
    [
      permissionIdByKey.get("view")
    ].filter(Boolean);


  // ---------------------------------
  // DELETE PERMISSIONS FOR RESOURCES
  // NO LONGER ENTITLED
  //
  // This affects only the standard
  // Tenant roles managed here.
  // ---------------------------------

  const managedRoleIds =
    [
      primaryRoleId,
      adminRoleId,
      managerRoleId,
      viewerRoleId
    ].filter(Boolean);


  if (managedRoleIds.length > 0) {

    if (resourceIds.length > 0) {

      await appClient.query(
        `DELETE FROM role_permissions

         WHERE tenant_id = $1

           AND role_id =
               ANY($2::uuid[])

           AND NOT (
             resource_id =
             ANY($3::uuid[])
           )`,
        [
          tenantId,
          managedRoleIds,
          resourceIds
        ]
      );

    } else {

      await appClient.query(
        `DELETE FROM role_permissions

         WHERE tenant_id = $1

           AND role_id =
               ANY($2::uuid[])`,
        [
          tenantId,
          managedRoleIds
        ]
      );
    }
  }


  // ---------------------------------
  // HELPER — INSERT MISSING GRANTS
  // ---------------------------------

  async function grantPermissions(
    roleId,
    actionPermissionIds
  ) {

    if (
      !roleId ||
      resourceIds.length === 0 ||
      actionPermissionIds.length === 0
    ) {

      return 0;
    }


    const result =
      await appClient.query(
        `INSERT INTO role_permissions
         (
           tenant_id,
           role_id,
           resource_id,
           permission_id,
           created_by,
           created_at
         )

         SELECT
           $1,
           $2,
           resource_id,
           permission_id,
           NULL,
           now()

         FROM UNNEST($3::uuid[])
              AS r(resource_id)

         CROSS JOIN UNNEST($4::uuid[])
              AS p(permission_id)

         ON CONFLICT
           (
             tenant_id,
             role_id,
             resource_id,
             permission_id
           )
         DO NOTHING

         RETURNING id`,
        [
          tenantId,
          roleId,
          resourceIds,
          actionPermissionIds
        ]
      );


    return result.rowCount;
  }


  // ---------------------------------
  // PRIMARY — FULL ACCESS
  // ---------------------------------

  const primaryPermissionCount =
    await grantPermissions(
      primaryRoleId,
      permissionIds
    );


  // ---------------------------------
  // ADMIN — FULL ACCESS
  // ---------------------------------

  const adminPermissionCount =
    await grantPermissions(
      adminRoleId,
      permissionIds
    );


  // ---------------------------------
  // MANAGER / VIEWER
  // ---------------------------------

  let managerPermissionCount = 0;
  let viewerPermissionCount = 0;


  if (rbacEnabled) {

    managerPermissionCount =
      await grantPermissions(
        managerRoleId,
        managerPermissionIds
      );


    viewerPermissionCount =
      await grantPermissions(
        viewerRoleId,
        viewerPermissionIds
      );

  } else {

    /*
     * RBAC is disabled.
     *
     * PRIMARY and ADMIN remain fully
     * provisioned. Remove grants from
     * optional RBAC roles so stale
     * permissions are not retained.
     */

    const optionalRoleIds =
      [
        managerRoleId,
        viewerRoleId
      ].filter(Boolean);


    if (optionalRoleIds.length > 0) {

      await appClient.query(
        `DELETE FROM role_permissions

         WHERE tenant_id = $1

           AND role_id =
               ANY($2::uuid[])`,
        [
          tenantId,
          optionalRoleIds
        ]
      );
    }
  }


  return {
    primaryPermissionCount,
    adminPermissionCount,
    managerPermissionCount,
    viewerPermissionCount,
    activePermissionCount:
      permissionIds.length
  };
}


module.exports = {
  syncTenantRolePermissions
};