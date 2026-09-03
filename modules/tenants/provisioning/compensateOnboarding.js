// =================================
// COMPENSATE ONBOARDING
//
// Removes APPDB records when APPDB
// committed successfully but AUTHDB
// failed to commit.
//
// Cleanup is performed in dependency
// order so child records are removed
// before their parent records.
// =================================


async function compensateOnboarding({
  appDb,
  tenantId
}) {

  await appDb.query(
    `DELETE FROM role_permissions
     WHERE tenant_id = $1`,
    [
      tenantId
    ]
  );


  await appDb.query(
    `DELETE FROM user_roles
     WHERE tenant_id = $1`,
    [
      tenantId
    ]
  );


  await appDb.query(
    `DELETE FROM list_dropdowns
     WHERE tenant_id = $1`,
    [
      tenantId
    ]
  );


  await appDb.query(
    `DELETE FROM company
     WHERE tenant_id = $1`,
    [
      tenantId
    ]
  );


  await appDb.query(
    `DELETE FROM roles
     WHERE tenant_id = $1`,
    [
      tenantId
    ]
  );
}


module.exports = {
  compensateOnboarding
};