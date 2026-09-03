// =================================
// ASSIGN PRIMARY USER ROLES
//
// The tenant's primary user receives
// both the protected PRIMARY role and
// the ADMIN role during onboarding.
// =================================


async function assignPrimaryUserRoles({
  appClient,
  tenantId,
  primaryUserId,
  primaryRoleId,
  adminRoleId
}) {

  await appClient.query(
    `INSERT INTO user_roles
     (
       tenant_id,
       user_id,
       role_id,
       is_active,
       created_at,
       created_by
     )

     VALUES
     (
       $1,
       $2,
       $3,
       true,
       now(),
       NULL
     ),

     (
       $1,
       $2,
       $4,
       true,
       now(),
       NULL
     )`,
    [
      tenantId,
      primaryUserId,
      primaryRoleId,
      adminRoleId
    ]
  );
}


module.exports = {
  assignPrimaryUserRoles
};