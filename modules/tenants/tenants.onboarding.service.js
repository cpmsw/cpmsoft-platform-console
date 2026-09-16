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
  compensateOnboarding
} =
  require("./provisioning/compensateOnboarding");

const {
  validateOnboardingInput
} =
  require("./provisioning/validateOnboardingInput");

const {
  validateEntitlements
} =
  require("./provisioning/validateEntitlements");

const {
  provisionAuthTenant
} =
  require("./provisioning/provisionAuthTenant");

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
// ONBOARD TENANT
// =================================

async function onboardTenant(
  payload = {}
) {
  const {
    tenantData,
    primaryContact,
    requestedPackageIds,
    requestedResourceIds,
    legalName,
    companyCode,
    licensedUsers,
    maxCompanies,
    rbacEnabled,
    firstName,
    lastName,
    primaryEmail
  } =
    validateOnboardingInput(
      payload
    );
  // ---------------------------------
  // CHECK ACTIVE EMAIL UNIQUENESS
  // ---------------------------------

  const duplicateUserResult =
    await authDb.query(
      `SELECT id
       FROM users
       WHERE LOWER(email) = LOWER($1)
         AND is_active = true
       LIMIT 1`,
      [
        primaryEmail
      ]
    );


  if (
    duplicateUserResult.rowCount > 0
  ) {

    const error =
      new Error(
        "An active user already exists with this email address."
      );

    error.statusCode = 409;
    error.code =
      "ACTIVE_EMAIL_EXISTS";

    throw error;
  }


  // ---------------------------------
  // INITIAL TENANT PACKAGE BASELINE
  //
  // New Tenant creation may omit
  // commercial Package selections.
  //
  // In that case, onboard with only
  // the required Settings Package.
  // Commercial entitlements are added
  // later through Tenant Resources.
  // ---------------------------------

  let onboardingPackageIds =
    requestedPackageIds;


  if (
    onboardingPackageIds.length === 0
  ) {

    const settingsPackageResult =
      await authDb.query(
        `SELECT id
         FROM packages
         WHERE package_key = 'settings'
           AND is_active = true
         LIMIT 1`
      );


    if (
      settingsPackageResult.rowCount === 0
    ) {

      const error =
        new Error(
          "Required Settings package is not active."
        );

      error.statusCode = 500;

      error.code =
        "SETTINGS_PACKAGE_MISSING";

      throw error;
    }


    onboardingPackageIds = [
      settingsPackageResult.rows[0].id
    ];
  }


  // ---------------------------------
  // VALIDATE TENANT ENTITLEMENTS
  //
  // Packages and their Resources are
  // the single source of truth.
  // ---------------------------------

  const {
    finalResourceIds
  } =
    await validateEntitlements({
      authDb,
      requestedPackageIds:
        onboardingPackageIds,
      requestedResourceIds
    });
  // ---------------------------------
  // GENERATED IDS
  // ---------------------------------

  const tenantId =
    crypto.randomUUID();

  const primaryUserId =
    crypto.randomUUID();

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

  const authClient =
    await authDb.connect();

  const appClient =
    await appDb.connect();


  let appCommitted = false;



  let rolePermissionCount = 0;

  let dropdownDefaultCount = 0;




  try {

    await authClient.query(
      "BEGIN"
    );

    await appClient.query(
      "BEGIN"
    );

    // =================================
    // AUTHDB
    // =================================

    await provisionAuthTenant({
      authClient,
      tenantId,
      primaryUserId,
      tenantData,
      primaryContact,
      requestedPackageIds:
        onboardingPackageIds,
      finalResourceIds,
      legalName,
      companyCode,
      licensedUsers,
      maxCompanies,
      firstName,
      lastName,
      primaryEmail,
      rbacEnabled
    });

    // =================================
    // APPDB
    // =================================

    // ---------------------------------
    // PROVISION TENANT ROLES
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
    // PROVISION ROLE PERMISSIONS
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
    // ASSIGN PRIMARY USER ROLES
    // ---------------------------------

    await assignPrimaryUserRoles({
      appClient,
      tenantId,
      primaryUserId,
      primaryRoleId,
      adminRoleId
    });

    // ---------------------------------
    // CREATE INITIAL COMPANY
    // ---------------------------------

    await provisionCompany({
      appClient,
      companyId,
      tenantId,
      primaryUserId,
      tenantData
    });


    // ---------------------------------
    // COPY STANDARD DROPDOWN DEFAULTS
    // ---------------------------------

    const dropdownResult =
      await provisionDropdowns({
        appClient,
        tenantId,
        primaryUserId
      });

    dropdownDefaultCount =
      dropdownResult.dropdownDefaultCount;


    // ---------------------------------
    // COMMIT APPDB FIRST
    // ---------------------------------

    await appClient.query(
      "COMMIT"
    );

    appCommitted = true;


    // ---------------------------------
    // COMMIT AUTHDB
    // ---------------------------------

    await authClient.query(
      "COMMIT"
    );


  } catch (error) {

    try {

      await authClient.query(
        "ROLLBACK"
      );

    } catch (_) {

      // Preserve original error.
    }


    if (!appCommitted) {

      try {

        await appClient.query(
          "ROLLBACK"
        );

      } catch (_) {

        // Preserve original error.
      }
    }


    // ---------------------------------
    // COMPENSATE IF APPDB COMMITTED
    // BUT AUTHDB FAILED TO COMMIT
    // ---------------------------------

    if (appCommitted) {

      try {

        await compensateOnboarding({
          appDb,
          tenantId
        });

      } catch (cleanupError) {

        console.error(
          "Onboarding compensation failed:",
          cleanupError
        );
      }
    }


    throw error;

  } finally {

    authClient.release();
    appClient.release();
  }


  // =================================
  // SEND ACTIVATION ONLY AFTER
  // PROVISIONING IS COMPLETE
  // =================================

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
      "The tenant was provisioned, but the activation email could not be sent.";
  }


  // ---------------------------------
  // RESULT
  // ---------------------------------

  return {

    success: true,

    tenantId,

    primaryUserId,

    primaryRoleId,

    adminRoleId,

    companyId,

    licensedUsers,

    maxCompanies,

    dropdownDefaultCount,

    rbacEnabled,

    enabledResourceCount:
      finalResourceIds.length,

    primaryPermissionCount:
      rolePermissionCount,

    invitationSent,

    invitationWarning
  };
}


module.exports = {
  onboardTenant
};