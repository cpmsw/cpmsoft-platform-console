// =================================
// PROVISION TENANT ROLES
//
// PRIMARY + ADMIN
//   Always created.
//
// MANAGER + VIEWER
//   Created only when RBAC is enabled.
// =================================


async function provisionRoles({
  appClient,
  tenantId,
  primaryRoleId,
  adminRoleId,
  managerRoleId,
  viewerRoleId,
  rbacEnabled
}) {

  // ---------------------------------
  // CREATE PRIMARY + ADMIN
  // ---------------------------------

  await appClient.query(
    `INSERT INTO roles
     (
       id,
       tenant_id,
       role_code,
       role_name,
       description,
       is_system,
       is_active,
       created_at
     )

     VALUES
     (
       $1,
       $3,
       'PRIMARY',
       'Primary User',
       'Protected role identifying the tenant Primary User.',
       true,
       true,
       now()
     ),

     (
       $2,
       $3,
       'ADMIN',
       'Administrator',
       'Full administrative access.',
       true,
       true,
       now()
     )`,
    [
      primaryRoleId,
      adminRoleId,
      tenantId
    ]
  );


  // ---------------------------------
  // CREATE MANAGER + VIEWER
  // ---------------------------------

  if (rbacEnabled) {

    await appClient.query(
      `INSERT INTO roles
       (
         id,
         tenant_id,
         role_code,
         role_name,
         description,
         is_system,
         is_active,
         created_at
       )

       VALUES
       (
         $1,
         $3,
         'MANAGER',
         'Manager',
         'Standard management access.',
         true,
         true,
         now()
       ),

       (
         $2,
         $3,
         'VIEWER',
         'Viewer',
         'Read-only access.',
         true,
         true,
         now()
       )`,
      [
        managerRoleId,
        viewerRoleId,
        tenantId
      ]
    );
  }


  return {
    primaryRoleId,
    adminRoleId,
    managerRoleId:
      rbacEnabled
        ? managerRoleId
        : null,
    viewerRoleId:
      rbacEnabled
        ? viewerRoleId
        : null
  };
}


module.exports = {
  provisionRoles
};