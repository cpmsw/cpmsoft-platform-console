const authDb =
  require("../../db/authDb");

const audit =
  require("../audit");

const {
  findActiveUserByEmail,
  createActiveEmailError
} =
  require("cpmsoft-core/users/userLookup");

const usersService =
  require("cpmsoft-core/users/users.service");


// ==================================================
// UPDATE PRIMARY CONTACT
// ==================================================

async function updatePrimaryContact(
  tenantId,
  data = {},
  changedBy = null
) {

  const firstName =
    cleanRequired(
      data.firstName
    );

  const lastName =
    cleanRequired(
      data.lastName
    );

  const email =
    cleanRequired(
      data.email
    ).toLowerCase();


  if (!firstName) {
    throwBadRequest(
      "First name is required.",
      "FIRST_NAME_REQUIRED"
    );
  }


  if (!lastName) {
    throwBadRequest(
      "Last name is required.",
      "LAST_NAME_REQUIRED"
    );
  }


  if (!email) {
    throwBadRequest(
      "Email is required.",
      "EMAIL_REQUIRED"
    );
  }


  const authClient =
    await authDb.connect();


let updated;
let tenant;
let emailChanged = false;
let changesMade = false;


  try {

    await authClient.query(
      "BEGIN"
    );


    // ---------------------------------
    // LOAD / LOCK TENANT
    // ---------------------------------

    const tenantResult =
      await authClient.query(
        `
          SELECT
            id,
            legal_name,
            tenant_code,
            status,
            is_active,
            onboarding_status,
            primary_contact_user_id,
            pending_primary_contact_user_id

          FROM tenants

          WHERE id = $1

          FOR UPDATE
        `,
        [
          tenantId
        ]
      );


    tenant =
      tenantResult.rows[0];


    if (!tenant) {

      const error =
        new Error(
          "Tenant was not found."
        );

      error.statusCode = 404;
      error.code =
        "TENANT_NOT_FOUND";

      throw error;
    }


    if (
      tenant.is_active === false ||
      String(
        tenant.status || ""
      ).toLowerCase() === "inactive"
    ) {

      const error =
        new Error(
          "Primary Contact cannot be edited while the Tenant is inactive."
        );

      error.statusCode = 409;
      error.code =
        "TENANT_INACTIVE";

      throw error;
    }


    // ---------------------------------
    // RESOLVE PRIMARY CONTACT
    //
    // Before activation:
    // pending_primary_contact_user_id
    //
    // After activation:
    // primary_contact_user_id
    // ---------------------------------

    const primaryUserId =
      tenant.primary_contact_user_id ||
      tenant.pending_primary_contact_user_id;


    if (!primaryUserId) {

      const error =
        new Error(
          "Tenant does not have a Primary Contact."
        );

      error.statusCode = 409;
      error.code =
        "PRIMARY_CONTACT_MISSING";

      throw error;
    }


    // ---------------------------------
    // LOAD / LOCK USER
    // ---------------------------------

    const currentResult =
      await authClient.query(
        `
          SELECT
            id,
            tenant_id,
            first_name,
            last_name,
            email,
            phone,
            job_title,
            twofa_required,
            is_active,
            is_verified

          FROM users

          WHERE id = $1
            AND tenant_id = $2

          FOR UPDATE
        `,
        [
          primaryUserId,
          tenantId
        ]
      );


    const current =
      currentResult.rows[0];


    if (!current) {

      const error =
        new Error(
          "Primary Contact user was not found."
        );

      error.statusCode = 404;
      error.code =
        "PRIMARY_CONTACT_USER_NOT_FOUND";

      throw error;
    }


    if (current.is_active === false) {

      const error =
        new Error(
          "Primary Contact user is inactive."
        );

      error.statusCode = 409;
      error.code =
        "PRIMARY_CONTACT_INACTIVE";

      throw error;
    }


    // ---------------------------------
    // EMAIL UNIQUENESS
    //
    // Same global active-email rule used
    // by the CPMSOFT Users module.
    // ---------------------------------

    emailChanged =
      normalizeEmail(
        current.email
      ) !== email;


    if (emailChanged) {

      const activeUser =
        await findActiveUserByEmail(
          email,
          primaryUserId
        );


      if (activeUser) {

        if (
          activeUser.tenant_id ===
          tenantId
        ) {

          const error =
            new Error(
              "Another active user in this company already uses this email address."
            );

          error.statusCode = 409;
          error.code =
            "USER_ALREADY_EXISTS";
          error.userId =
            activeUser.id;

          throw error;
        }


        throw createActiveEmailError();
      }
    }


    // ---------------------------------
    // UPDATE PRIMARY CONTACT
    // ---------------------------------

    const updatedResult =
      await authClient.query(
        `
          UPDATE users

          SET
            first_name      = $1,
            last_name       = $2,
            email           = $3,
            phone           = $4,
            job_title       = $5,
            twofa_required  = $6,
            updated_at      = now()

          WHERE id = $7
            AND tenant_id = $8

          RETURNING
            id,
            tenant_id,
            first_name,
            last_name,
            email,
            phone,
            job_title,
            twofa_required,
            is_active,
            is_verified,
            updated_at
        `,
        [
          firstName,
          lastName,
          email,

          cleanOptional(
            data.phone
          ),

          cleanOptional(
            data.jobTitle
          ),

          data.twofaRequired === true,

          primaryUserId,
          tenantId
        ]
      );


    updated =
      updatedResult.rows[0];


    // ---------------------------------
    // AUDIT
    // ---------------------------------

    const oldData =
      primaryContactSnapshot(
        current
      );

    const newData =
      primaryContactSnapshot(
        updated
      );


    changesMade =
      !valuesEqual(
        oldData,
        newData
      );


    if (changesMade) {

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
            "UPDATE",

          old_data:
            oldData,

          new_data:
            newData,

          changed_by:
            changedBy
        },
        authClient
      );
    }


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


    /*
     * Preserve the same user-friendly
     * duplicate-email behavior if the
     * database constraint wins a race.
     */
    if (
      error.code === "23505"
    ) {

      const conflict =
        new Error(
          "This email address is already associated with another active account."
        );

      conflict.statusCode = 409;
      conflict.code =
        "EMAIL_ACTIVE_IN_ANOTHER_TENANT";

      throw conflict;
    }


    throw error;

  } finally {

    authClient.release();
  }


  // ---------------------------------
  // POST-COMMIT EMAIL ACTIONS
  //
  // Email failures must NOT undo the
  // successfully committed contact edit.
  // ---------------------------------



  let invitationRequired = false;
  let invitationSent = false;
  let invitationWarning = null;

  

  if (
    changesMade &&
    emailChanged &&
    tenant.onboarding_status ===
    "AWAITING_ACTIVATION"
  ) {

    invitationRequired = true;


    try {

      await usersService.resendInvite(
        tenantId,
        updated.id
      );

      invitationSent = true;

    } catch (error) {

      invitationWarning =
        error.message ||
        "Primary Contact was updated, but the activation invitation could not be sent.";
    }
  }


  return {
    success: true,

    tenantId,

    primaryContact: {
      id:
        updated.id,

      firstName:
        updated.first_name,

      lastName:
        updated.last_name,

      email:
        updated.email,

      phone:
        updated.phone,

      jobTitle:
        updated.job_title,

      twofaRequired:
        updated.twofa_required === true,

      isActive:
        updated.is_active === true,

      isVerified:
        updated.is_verified === true
    },

    onboardingStatus:
      tenant.onboarding_status,

    changesMade,

    emailChanged,

    invitationRequired,
    invitationSent,
    invitationWarning
  };
}


// ==================================================
// SNAPSHOT
// ==================================================

function primaryContactSnapshot(
  user
) {

  return {
    first_name:
      user.first_name,

    last_name:
      user.last_name,

    email:
      user.email,

    phone:
      user.phone,

    job_title:
      user.job_title,

    twofa_required:
      user.twofa_required === true
  };
}


// ==================================================
// HELPERS
// ==================================================

function cleanRequired(
  value
) {

  return String(
    value ?? ""
  ).trim();
}


function cleanOptional(
  value
) {

  const cleaned =
    String(
      value ?? ""
    ).trim();

  return cleaned || null;
}


function normalizeEmail(
  value
) {

  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function valuesEqual(
  left,
  right
) {

  return JSON.stringify(left) ===
    JSON.stringify(right);
}


function throwBadRequest(
  message,
  code
) {

  const error =
    new Error(
      message
    );

  error.statusCode = 400;
  error.code = code;

  throw error;
}


// ==================================================
// EXPORTS
// ==================================================

module.exports = {
  updatePrimaryContact
};