// =================================
// PROVISION ROLE PERMISSIONS
//
// Grants permissions to the standard
// tenant roles created during
// onboarding.
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
// =================================


async function provisionRolePermissions({
  appClient,
  tenantId,
  finalResourceIds,
  rbacEnabled,
  primaryRoleId,
  adminRoleId,
  managerRoleId,
  viewerRoleId
}) {

  // ---------------------------------
  // GRANT ROLE PERMISSIONS
  // ---------------------------------

  async function grantRolePermissions(
    roleId,
    resourceIds,
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
      row =>
        row.id
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
  // PRIMARY - FULL ACCESS
  // ---------------------------------

  const primaryPermissionCount =
    await grantRolePermissions(
      primaryRoleId,
      finalResourceIds,
      permissionIds
    );


  // ---------------------------------
  // ADMIN - FULL ACCESS
  // ---------------------------------

  const adminPermissionCount =
    await grantRolePermissions(
      adminRoleId,
      finalResourceIds,
      permissionIds
    );


  // ---------------------------------
  // ADDITIONAL RBAC ROLE PERMISSIONS
  // ---------------------------------

  let managerPermissionCount = 0;
  let viewerPermissionCount = 0;


  if (rbacEnabled) {

    // MANAGER - view/create/edit

    managerPermissionCount =
      await grantRolePermissions(
        managerRoleId,
        finalResourceIds,
        managerPermissionIds
      );


    // VIEWER - view only

    viewerPermissionCount =
      await grantRolePermissions(
        viewerRoleId,
        finalResourceIds,
        viewerPermissionIds
      );
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
  provisionRolePermissions
};