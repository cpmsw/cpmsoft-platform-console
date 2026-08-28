const crypto =
  require("crypto");

const authDb =
  require("../../db/authDb");

const appDb =
  require("../../db/appDb");

const usersService =
  require("cpmsoft-core/users/users.service");


// =================================
// HELPERS
// =================================

function requiredText(value) {

  return String(
    value || ""
  ).trim();
}


function optionalText(value) {

  const result =
    String(
      value || ""
    ).trim();

  return result || null;
}


// =================================
// ONBOARD TENANT
// =================================

async function onboardTenant(
  payload = {}
) {

  const tenantData =
    payload.tenant || {};

  const primaryContact =
    payload.primaryContact || {};

  const requestedPackageIds =
    Array.isArray(payload.packageIds)
      ? [
        ...new Set(
          payload.packageIds
            .filter(Boolean)
        )
      ]
      : [];

  const requestedResourceIds =
    Array.isArray(payload.resourceIds)
      ? [
        ...new Set(
          payload.resourceIds
            .filter(Boolean)
        )
      ]
      : [];


  // ---------------------------------
  // VALIDATE TENANT
  // ---------------------------------

  const legalName =
    requiredText(
      tenantData.legalName
    );


  if (!legalName) {

    const error =
      new Error(
        "Legal Name is required."
      );

    error.statusCode = 400;
    error.code =
      "LEGAL_NAME_REQUIRED";

    throw error;
  }


  const licensedUsers =
    Number(
      tenantData.licensedUsers ?? 1
    );


  if (
    !Number.isInteger(licensedUsers) ||
    licensedUsers < 1
  ) {

    const error =
      new Error(
        "Licensed Users must be at least 1."
      );

    error.statusCode = 400;
    error.code =
      "INVALID_LICENSED_USERS";

    throw error;
  }


  // ---------------------------------
  // VALIDATE PRIMARY CONTACT
  // ---------------------------------

  const firstName =
    requiredText(
      primaryContact.firstName
    );

  const lastName =
    requiredText(
      primaryContact.lastName
    );

  const primaryEmail =
    requiredText(
      primaryContact.email
    ).toLowerCase();


  if (!firstName) {

    const error =
      new Error(
        "Primary Contact First Name is required."
      );

    error.statusCode = 400;
    error.code =
      "PRIMARY_FIRST_NAME_REQUIRED";

    throw error;
  }


  if (!lastName) {

    const error =
      new Error(
        "Primary Contact Last Name is required."
      );

    error.statusCode = 400;
    error.code =
      "PRIMARY_LAST_NAME_REQUIRED";

    throw error;
  }


  if (!primaryEmail) {

    const error =
      new Error(
        "Primary Contact Email is required."
      );

    error.statusCode = 400;
    error.code =
      "PRIMARY_EMAIL_REQUIRED";

    throw error;
  }


  // ---------------------------------
  // REQUIRE AT LEAST ONE PACKAGE
  // ---------------------------------

  if (
    requestedPackageIds.length === 0
  ) {

    const error =
      new Error(
        "At least one package must be selected."
      );

    error.statusCode = 400;
    error.code =
      "PACKAGE_REQUIRED";

    throw error;
  }


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
  // VERIFY SELECTED PACKAGES
  //
  // enables_rbac is catalog data.
  // No RBAC package key is hard-coded.
  // ---------------------------------

  const validPackages =
    await authDb.query(
      `SELECT
         id,
         package_key,
         enables_rbac
       FROM packages
       WHERE id = ANY($1::uuid[])
         AND is_active = true`,
      [
        requestedPackageIds
      ]
    );


  if (
    validPackages.rowCount !==
    requestedPackageIds.length
  ) {

    const error =
      new Error(
        "One or more selected packages are invalid or inactive."
      );

    error.statusCode = 400;
    error.code =
      "INVALID_PACKAGE_IDS";

    throw error;
  }


  // ---------------------------------
  // RBAC ENTITLEMENT
  //
  // The package catalog controls
  // whether RBAC is enabled.
  // ---------------------------------

  const rbacEnabled =
    validPackages.rows.some(
      row =>
        row.enables_rbac === true
    );


  // ---------------------------------
  // LOAD REQUIRED BASELINE RESOURCES
  //
  // No individual resource keys are
  // hard-coded here.
  //
  // authdb.resource_sets and
  // resource_set_resources are the
  // source of truth.
  // ---------------------------------

  const baselineResult =
    await authDb.query(
      `SELECT DISTINCT
         r.id,
         r.resource_key,
         r.resource_name
       FROM resource_sets rs

       JOIN resource_set_resources rsr
         ON rsr.resource_set_id = rs.id

       JOIN resources r
         ON r.id = rsr.resource_id

       WHERE rs.is_active = true
         AND rs.is_baseline = true
         AND rsr.is_required = true
         AND r.is_active = true

       ORDER BY
         r.resource_name`
    );


  const baselineIds =
    baselineResult.rows.map(
      row => row.id
    );


  // ---------------------------------
  // LOAD DEFAULT PACKAGE RESOURCES
  //
  // Selecting a package automatically
  // enables all active resources marked
  // as default for that package.
  // ---------------------------------

  const defaultPackageResourceResult =
    await authDb.query(
      `SELECT DISTINCT
         r.id,
         r.resource_key
       FROM package_resources pr

       JOIN resources r
         ON r.id = pr.resource_id

       WHERE pr.package_id =
             ANY($1::uuid[])

         AND pr.is_default = true
         AND r.is_active = true`,
      [
        requestedPackageIds
      ]
    );


  const defaultPackageResourceIds =
    defaultPackageResourceResult.rows.map(
      row => row.id
    );


  // ---------------------------------
  // VALIDATE OPTIONAL REQUESTED
  // PACKAGE RESOURCES
  //
  // The client may request additional
  // resources, but only when they belong
  // to one of the selected packages.
  // ---------------------------------

  let optionalResourceIds = [];


  if (
    requestedResourceIds.length > 0
  ) {

    const requestedResourceResult =
      await authDb.query(
        `SELECT DISTINCT
           r.id
         FROM package_resources pr

         JOIN resources r
           ON r.id = pr.resource_id

         WHERE pr.package_id =
               ANY($1::uuid[])

           AND r.id =
               ANY($2::uuid[])

           AND r.is_active = true`,
        [
          requestedPackageIds,
          requestedResourceIds
        ]
      );


    if (
      requestedResourceResult.rowCount !==
      requestedResourceIds.length
    ) {

      const error =
        new Error(
          "One or more selected resources do not belong to the selected packages or are inactive."
        );

      error.statusCode = 400;
      error.code =
        "INVALID_PACKAGE_RESOURCE_IDS";

      throw error;
    }


    optionalResourceIds =
      requestedResourceResult.rows.map(
        row => row.id
      );
  }


  // ---------------------------------
  // FINAL TENANT ENTITLEMENT
  //
  // baseline
  // + package defaults
  // + valid optional resources
  // ---------------------------------

  const finalResourceIds =
    [
      ...new Set([
        ...baselineIds,
        ...defaultPackageResourceIds,
        ...optionalResourceIds
      ])
    ];

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


  const authClient =
    await authDb.connect();

  const appClient =
    await appDb.connect();


  let appCommitted = false;

  let permissionIds = [];

  let rolePermissionCount = 0;


  // ---------------------------------
  // GRANT ROLE PERMISSIONS
  // ---------------------------------

  async function grantRolePermissions(
    roleId,
    resourceIds,
    actionPermissionIds
  ) {

    if (
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


    // ---------------------------------
    // CREATE TENANT
    // ---------------------------------

    await authClient.query(
      `INSERT INTO tenants
       (
         id,
         legal_name,
         dba_name,
         company_code,
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

        optionalText(
          tenantData.companyCode
        ),

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
    // No email is sent yet.
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


    // =================================
    // APPDB
    // =================================


    // ---------------------------------
    // CREATE PRIMARY + ADMIN
    //
    // These roles exist for EVERY
    // tenant, regardless of RBAC.
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
    // ONLY WHEN RBAC IS ENABLED
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


    permissionIds =
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
    // PRIMARY - FULL ACCESS
    // ---------------------------------

    rolePermissionCount =
      await grantRolePermissions(
        primaryRoleId,
        finalResourceIds,
        permissionIds
      );


    // ---------------------------------
    // ADMIN - FULL ACCESS
    //
    // ADMIN exists for every tenant.
    // ---------------------------------

    await grantRolePermissions(
      adminRoleId,
      finalResourceIds,
      permissionIds
    );


    // ---------------------------------
    // ADDITIONAL RBAC ROLE PERMISSIONS
    // ---------------------------------

    if (rbacEnabled) {

      // MANAGER - view/create/edit

      await grantRolePermissions(
        managerRoleId,
        finalResourceIds,
        managerPermissionIds
      );


      // VIEWER - view only

      await grantRolePermissions(
        viewerRoleId,
        finalResourceIds,
        viewerPermissionIds
      );
    }


    // ---------------------------------
    // ASSIGN PRIMARY + ADMIN
    // TO PRIMARY USER
    // ---------------------------------

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
          `DELETE FROM roles
           WHERE tenant_id = $1`,
          [
            tenantId
          ]
        );

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

    licensedUsers,

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