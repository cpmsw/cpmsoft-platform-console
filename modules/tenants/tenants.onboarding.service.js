const crypto =
  require("crypto");

const authDb =
  require("../../db/authDb");

const audit =
  require("../audit");

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


// =================================
// ONBOARD TENANT
//
// Phase 1 of Tenant onboarding.
//
// This operation:
//
// - validates Tenant information
// - validates Packages / Resources
// - creates Tenant in AUTHDB
// - creates pending primary user
// - saves licensing
// - saves Package assignments
// - saves Resource assignments
//
// This operation DOES NOT:
//
// - provision APPDB
// - assign APPDB roles
// - create APPDB company
// - create APPDB dropdown defaults
// - send activation email
//
// The Tenant remains:
//
//   onboarding_status =
//     PENDING_SETUP
//
// until the separate Activate Tenant
// operation is successfully completed.
// =================================

async function onboardTenant(
  payload = {},
  changedBy = null
) {

  const {
    tenantData,
    primaryContact,
    requestedPackageIds,
    requestedResourceIds,
    legalName,
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
  // If the caller does not provide
  // Package selections, use only the
  // required Settings Package.
  //
  // The new onboarding wizard will
  // eventually provide the complete
  // Package / Resource selections.
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


  // ---------------------------------
  // AUTHDB TRANSACTION
  // ---------------------------------

  const authClient =
    await authDb.connect();

  let companyCode;

  try {

    await authClient.query(
      "BEGIN"
    );


    // ---------------------------------
    // GENERATE COMPANY NUMBER
    //
    // Internal immutable Company Number.
    //
    // PostgreSQL sequence guarantees that
    // concurrent Tenant creation cannot
    // generate the same number.
    //
    // Example:
    //   C100001
    //   C100002
    // ---------------------------------

    const companyNumberResult =
      await authClient.query(
        `SELECT
       nextval(
         'tenant_company_number_seq'
       ) AS company_number`
      );

    companyCode =
      `C${companyNumberResult.rows[0].company_number}`;


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


    // Explicitly establish the
    // onboarding state.
    //
    // provisionAuthTenant currently
    // relies on the DB default, but
    // keeping this explicit here makes
    // the onboarding boundary clear.

    await authClient.query(
      `UPDATE tenants
   SET onboarding_status =
         'PENDING_SETUP',
       updated_at =
         now()
   WHERE id = $1`,
      [
        tenantId
      ]
    );


    // ---------------------------------
    // AUDIT HISTORY
    //
    // All audit records participate in
    // the same AUTHDB transaction as the
    // Tenant creation.
    // ---------------------------------

    await audit.createAudit(
      {
        tenant_id:
          tenantId,

        parent_type:
          "tenant",

        parent_id:
          tenantId,

        entity_type:
          "tenant",

        entity_id:
          tenantId,

        action:
          "CREATE",

        old_data:
          null,

        new_data: {
          company_code:
            companyCode,

          legal_name:
            legalName,

          dba_name:
            tenantData.dbaName || null,

          phone:
            tenantData.phone || null,

          website:
            tenantData.website || null,

          addr1:
            tenantData.addr1 || null,

          addr2:
            tenantData.addr2 || null,

          city:
            tenantData.city || null,

          state:
            tenantData.state || null,

          postal_code:
            tenantData.postalCode || null,

          country:
            tenantData.country || "US",

          onboarding_status:
            "PENDING_SETUP"
        },

        changed_by:
          changedBy
      },
      authClient
    );


    await audit.createAudit(
      {
        tenant_id:
          tenantId,

        parent_type:
          "tenant",

        parent_id:
          tenantId,

        entity_type:
          "primary_contact",

        entity_id:
          primaryUserId,

        action:
          "CREATE",

        old_data:
          null,

        new_data: {
          first_name:
            firstName,

          last_name:
            lastName,

          email:
            primaryEmail,

          phone:
            primaryContact.phone || null,

          job_title:
            primaryContact.jobTitle || null,

          twofa_required:
            Boolean(
              primaryContact.twofaRequired
            )
        },

        changed_by:
          changedBy
      },
      authClient
    );


    await audit.createAudit(
      {
        tenant_id:
          tenantId,

        parent_type:
          "tenant",

        parent_id:
          tenantId,

        entity_type:
          "tenant_entitlement",

        entity_id:
          tenantId,

        action:
          "CREATE",

        old_data:
          null,

        new_data: {
          licensed_users:
            licensedUsers,

          max_companies:
            maxCompanies,

          rbac_enabled:
            rbacEnabled,

          package_ids:
            onboardingPackageIds,

          resource_ids:
            finalResourceIds
        },

        changed_by:
          changedBy
      },
      authClient
    );


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


    throw error;


  } finally {

    authClient.release();
  }


  // ---------------------------------
  // RESULT
  // ---------------------------------

  return {

    success: true,

    tenantId,

    primaryUserId,

    companyNumber:
      companyCode,

    onboardingStatus:
      "PENDING_SETUP",

    licensedUsers,

    maxCompanies,

    rbacEnabled,

    enabledResourceCount:
      finalResourceIds.length,

    invitationSent: false
  };
}


module.exports = {
  onboardTenant
};