// =================================
// PROVISION AUTH TENANT
//
// Creates the tenant's AUTHDB records
// inside the transaction owned by the
// onboarding service.
//
// This helper does NOT:
// - begin/commit/rollback transactions
// - validate entitlements
// - provision APPDB data
// - send activation email
// =================================


function optionalText(value) {

  const result =
    String(
      value || ""
    ).trim();

  return result || null;
}


async function provisionAuthTenant({
  authClient,
  tenantId,
  primaryUserId,
  tenantData,
  primaryContact,
  requestedPackageIds,
  finalResourceIds,
  legalName,
  tenantCode,
  licensedUsers,
  maxCompanies,
  firstName,
  lastName,
  primaryEmail,
  rbacEnabled
}) {

  // ---------------------------------
  // CREATE TENANT
  // ---------------------------------

  await authClient.query(
    `INSERT INTO tenants
     (
       id,
       legal_name,
       dba_name,
       tenant_code,
       status,
       phone,
       email,
       website,
       addr1,
       addr2,
       city,
       state,
       postal_code,
       country,
       licensed_users,
       max_companies,
       rbac_enabled,
       is_active,
       primary_contact_user_id,
       pending_primary_contact_user_id,
       created_at,
       updated_at
     )

     VALUES
     (
       $1,
       $2,
       $3,
       $4,
       'active',
       $5,
       $6,
       $7,
       $8,
       $9,
       $10,
       $11,
       $12,
       $13,
       $14,
       $15,
       $16,
       true,
       NULL,
       NULL,
       now(),
       now()
     )`,
    [
      tenantId,

      legalName,

      optionalText(
        tenantData.dbaName
      ),

      tenantCode,

      optionalText(
        tenantData.phone
      ),

      optionalText(
        tenantData.email
      ),

      optionalText(
        tenantData.website
      ),

      optionalText(
        tenantData.addr1
      ),

      optionalText(
        tenantData.addr2
      ),

      optionalText(
        tenantData.city
      ),

      optionalText(
        tenantData.state
      ),

      optionalText(
        tenantData.postalCode
      ),

      optionalText(
        tenantData.country
      ) || "US",

      licensedUsers,

      maxCompanies,

      rbacEnabled
    ]
  );


  // ---------------------------------
  // SAVE TENANT PACKAGE ASSIGNMENTS
  // ---------------------------------

  await authClient.query(
    `INSERT INTO tenant_packages
     (
       tenant_id,
       package_id,
       is_active,
       enabled_at,
       disabled_at,
       created_at,
       updated_at
     )

     SELECT
       $1,
       package_id,
       true,
       now(),
       NULL,
       now(),
       now()

     FROM UNNEST($2::uuid[])
          AS package_id`,
    [
      tenantId,
      requestedPackageIds
    ]
  );


  // ---------------------------------
  // CREATE PENDING PRIMARY USER
  //
  // No activation email is sent here.
  // ---------------------------------

  await authClient.query(
    `INSERT INTO users
     (
       id,
       tenant_id,
       email,
       first_name,
       last_name,
       display_name,
       phone,
       job_title,
       department,
       password_hash,
       is_active,
       is_verified,
       twofa_required,
       created_at,
       updated_at
     )

     VALUES
     (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9,
       NULL,
       true,
       false,
       $10,
       now(),
       now()
     )`,
    [
      primaryUserId,
      tenantId,
      primaryEmail,
      firstName,
      lastName,
      `${firstName} ${lastName}`,

      optionalText(
        primaryContact.phone
      ),

      optionalText(
        primaryContact.jobTitle
      ),

      optionalText(
        primaryContact.department
      ),

      primaryContact.twofaRequired
      ?? true
    ]
  );


  // ---------------------------------
  // SET PENDING PRIMARY CONTACT
  // ---------------------------------

  await authClient.query(
    `UPDATE tenants
     SET
       pending_primary_contact_user_id =
         $1,

       updated_at =
         now()

     WHERE id = $2`,
    [
      primaryUserId,
      tenantId
    ]
  );


  // ---------------------------------
  // SAVE FINAL TENANT RESOURCES
  // ---------------------------------

  await authClient.query(
    `INSERT INTO tenant_resources
     (
       tenant_id,
       resource_id,
       is_enabled,
       enabled_at,
       disabled_at,
       created_at,
       updated_at
     )

     SELECT
       $1,
       resource_id,
       true,
       now(),
       NULL,
       now(),
       now()

     FROM UNNEST($2::uuid[])
          AS resource_id`,
    [
      tenantId,
      finalResourceIds
    ]
  );
}


module.exports = {
  provisionAuthTenant
};