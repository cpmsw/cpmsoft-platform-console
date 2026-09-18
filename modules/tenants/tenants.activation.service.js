const crypto =
  require("crypto");

const authDb =
  require("../../db/authDb");

const appDb =
  require("../../db/appDb");

const usersService =
  require("cpmsoft-core/users/users.service");

const {
  provisionCompany
} =
  require("./provisioning/provisionCompany");

const {
  provisionDropdowns
} =
  require("./provisioning/provisionDropdowns");

const {
  provisionRoles
} =
  require("./provisioning/provisionRoles");

const {
  provisionRolePermissions
} =
  require("./provisioning/provisionRolePermissions");

const {
  assignPrimaryUserRoles
} =
  require("./provisioning/assignPrimaryUserRoles");


// =================================
// ACTIVATE TENANT
//
// Phase 2 of Tenant onboarding.
//
// AUTHDB is the authoritative source.
//
// This operation:
//
// - requires PENDING_SETUP
// - reads Tenant configuration
//   from AUTHDB
// - provisions APPDB
// - sends the first activation email
// - changes onboarding status to
//   AWAITING_ACTIVATION
//
// If APPDB provisioning fails,
// APPDB is rolled back and AUTHDB
// remains PENDING_SETUP.
// =================================

async function activateTenant(
  tenantId
) {

  // ---------------------------------
  // LOAD TENANT
  // ---------------------------------

  const tenantResult =
    await authDb.query(
      `SELECT
         id,
         legal_name,
         dba_name,
         company_code,
         website,
         country,
         licensed_users,
         max_companies,
         rbac_enabled,
         onboarding_status,
         pending_primary_contact_user_id
       FROM tenants
       WHERE id = $1
         AND is_active = true
       LIMIT 1`,
      [
        tenantId
      ]
    );


  if (
    tenantResult.rowCount === 0
  ) {

    const error =
      new Error(
        "Tenant was not found."
      );

    error.statusCode = 404;

    error.code =
      "TENANT_NOT_FOUND";

    throw error;
  }


  const tenant =
    tenantResult.rows[0];


  // ---------------------------------
  // VERIFY ONBOARDING STATE
  // ---------------------------------

  if (
    tenant.onboarding_status !==
    "PENDING_SETUP"
  ) {

    const error =
      new Error(
        "Tenant is not pending setup."
      );

    error.statusCode = 409;

    error.code =
      "TENANT_NOT_PENDING_SETUP";

    throw error;
  }


  // ---------------------------------
  // VERIFY PRIMARY USER
  // ---------------------------------

  const primaryUserId =
    tenant
      .pending_primary_contact_user_id;


  if (!primaryUserId) {

    const error =
      new Error(
        "Tenant does not have a pending primary contact."
      );

    error.statusCode = 409;

    error.code =
      "PENDING_PRIMARY_CONTACT_MISSING";

    throw error;
  }


  const userResult =
    await authDb.query(
      `SELECT
         id,
         email,
         first_name,
         last_name,
         is_active,
         is_verified
       FROM users
       WHERE id = $1
         AND tenant_id = $2
       LIMIT 1`,
      [
        primaryUserId,
        tenantId
      ]
    );


  if (
    userResult.rowCount === 0
  ) {

    const error =
      new Error(
        "Pending primary user was not found."
      );

    error.statusCode = 409;

    error.code =
      "PENDING_PRIMARY_USER_MISSING";

    throw error;
  }


  // ---------------------------------
  // LOAD ENABLED RESOURCES
  // ---------------------------------

  const resourceResult =
    await authDb.query(
      `SELECT resource_id
       FROM tenant_resources
       WHERE tenant_id = $1
         AND is_enabled = true
       ORDER BY resource_id`,
      [
        tenantId
      ]
    );


  const finalResourceIds =
    resourceResult.rows.map(
      (row) =>
        row.resource_id
    );


  if (
    finalResourceIds.length === 0
  ) {

    const error =
      new Error(
        "Tenant does not have any enabled resources."
      );

    error.statusCode = 409;

    error.code =
      "TENANT_RESOURCES_MISSING";

    throw error;
  }


  // ---------------------------------
  // RECONSTRUCT TENANT DATA
  //
  // provisionCompany expects the same
  // property names used by onboarding.
  // ---------------------------------

  const tenantData = {
    legalName:
      tenant.legal_name,

    dbaName:
      tenant.dba_name,

    companyCode:
      tenant.company_code,

    website:
      tenant.website,

    country:
      tenant.country
  };


  const rbacEnabled =
    tenant.rbac_enabled === true;


  // ---------------------------------
  // GENERATED APPDB IDS
  // ---------------------------------

  const primaryRoleId =
    crypto.randomUUID();

  const adminRoleId =
    crypto.randomUUID();

  const managerRoleId =
    crypto.randomUUID();

  const viewerRoleId =
    crypto.randomUUID();

  const companyId =
    crypto.randomUUID();


  // ---------------------------------
  // APPDB TRANSACTION
  // ---------------------------------

  const appClient =
    await appDb.connect();


  let rolePermissionCount = 0;

  let dropdownDefaultCount = 0;


  try {

    await appClient.query(
      "BEGIN"
    );


    // ---------------------------------
    // ROLES
    // ---------------------------------

    await provisionRoles({
      appClient,
      tenantId,
      primaryRoleId,
      adminRoleId,
      managerRoleId,
      viewerRoleId,
      rbacEnabled
    });


    // ---------------------------------
    // ROLE PERMISSIONS
    // ---------------------------------

    const rolePermissionResult =
      await provisionRolePermissions({
        appClient,
        tenantId,
        finalResourceIds,
        rbacEnabled,
        primaryRoleId,
        adminRoleId,
        managerRoleId,
        viewerRoleId
      });


    rolePermissionCount =
      rolePermissionResult
        .primaryPermissionCount;


    // ---------------------------------
    // PRIMARY USER ROLES
    // ---------------------------------

    await assignPrimaryUserRoles({
      appClient,
      tenantId,
      primaryUserId,
      primaryRoleId,
      adminRoleId
    });


    // ---------------------------------
    // INITIAL COMPANY
    // ---------------------------------

    await provisionCompany({
      appClient,
      companyId,
      tenantId,
      primaryUserId,
      tenantData
    });


    // ---------------------------------
    // DROPDOWN DEFAULTS
    // ---------------------------------

    const dropdownResult =
      await provisionDropdowns({
        appClient,
        tenantId,
        primaryUserId
      });


    dropdownDefaultCount =
      dropdownResult
        .dropdownDefaultCount;


    await appClient.query(
      "COMMIT"
    );


  } catch (error) {

    try {

      await appClient.query(
        "ROLLBACK"
      );

    } catch (_) {

      // Preserve original error.
    }


    throw error;


  } finally {

    appClient.release();
  }


  // =================================
  // APPDB IS NOW PROVISIONED
  // =================================


  // ---------------------------------
  // SEND FIRST ACTIVATION EMAIL
  // ---------------------------------

  let invitationSent = false;

  let invitationWarning = null;


  try {

    await usersService.resendInvite(
      tenantId,
      primaryUserId
    );

    invitationSent = true;

  } catch (error) {

    invitationWarning =
      error.message ||
      "Tenant was provisioned, but the activation email could not be sent.";
  }


  // ---------------------------------
  // UPDATE ONBOARDING STATUS
  //
  // APPDB provisioning succeeded.
  // Even if email delivery failed,
  // provisioning itself is complete.
  //
  // Resend Email can be used later.
  // ---------------------------------

  await authDb.query(
    `UPDATE tenants
     SET onboarding_status =
           'AWAITING_ACTIVATION',
         updated_at =
           now()
     WHERE id = $1`,
    [
      tenantId
    ]
  );


  // ---------------------------------
  // RESULT
  // ---------------------------------

  return {

    success: true,

    tenantId,

    primaryUserId,

    onboardingStatus:
      "AWAITING_ACTIVATION",

    companyId,

    rbacEnabled,

    enabledResourceCount:
      finalResourceIds.length,

    primaryPermissionCount:
      rolePermissionCount,

    dropdownDefaultCount,

    invitationSent,

    invitationWarning
  };
}

// =================================
// RESEND ACTIVATION EMAIL
//
// Email only.
//
// This operation does NOT:
//
// - provision APPDB
// - change entitlements
// - change roles / permissions
//
// Tenant must already have completed
// APPDB provisioning and be awaiting
// primary-user activation.
// =================================

async function resendActivationEmail(
  tenantId
) {

  // ---------------------------------
  // LOAD TENANT
  // ---------------------------------

  const tenantResult =
    await authDb.query(
      `SELECT
         id,
         onboarding_status,
         pending_primary_contact_user_id
       FROM tenants
       WHERE id = $1
         AND is_active = true
       LIMIT 1`,
      [
        tenantId
      ]
    );


  if (
    tenantResult.rowCount === 0
  ) {

    const error =
      new Error(
        "Tenant was not found."
      );

    error.statusCode = 404;

    error.code =
      "TENANT_NOT_FOUND";

    throw error;
  }


  const tenant =
    tenantResult.rows[0];


  // ---------------------------------
  // VERIFY ONBOARDING STATE
  // ---------------------------------

  if (
    tenant.onboarding_status !==
    "AWAITING_ACTIVATION"
  ) {

    const error =
      new Error(
        "Tenant is not awaiting activation."
      );

    error.statusCode = 409;

    error.code =
      "TENANT_NOT_AWAITING_ACTIVATION";

    throw error;
  }


  // ---------------------------------
  // VERIFY PENDING PRIMARY USER
  // ---------------------------------

  const primaryUserId =
    tenant
      .pending_primary_contact_user_id;


  if (!primaryUserId) {

    const error =
      new Error(
        "Tenant does not have a pending primary contact."
      );

    error.statusCode = 409;

    error.code =
      "PENDING_PRIMARY_CONTACT_MISSING";

    throw error;
  }


  // ---------------------------------
  // SEND EMAIL ONLY
  // ---------------------------------

  await usersService.resendInvite(
    tenantId,
    primaryUserId
  );


  return {
    success: true,

    tenantId,

    primaryUserId,

    onboardingStatus:
      "AWAITING_ACTIVATION",

    invitationSent: true
  };
}


module.exports = {
  activateTenant,
  resendActivationEmail
};