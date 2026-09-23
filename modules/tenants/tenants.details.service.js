const authDb =
  require("../../db/authDb");

const audit =
  require("../audit");


// ==================================================
// UPDATE TENANT DETAILS
// ==================================================

async function updateTenantDetails(
  tenantId,
  data = {},
  changedBy = null
) {

  const legalName =
    cleanRequired(
      data.legalName
    );

  if (!legalName) {

    const error =
      new Error(
        "Legal name is required."
      );

    error.statusCode = 400;

    error.code =
      "LEGAL_NAME_REQUIRED";

    throw error;
  }


  const authClient =
    await authDb.connect();


  try {

    await authClient.query(
      "BEGIN"
    );


    // ---------------------------------
    // LOAD CURRENT TENANT
    //
    // FOR UPDATE prevents another
    // transaction from changing this
    // Tenant while we build the audit
    // before/after snapshots.
    // ---------------------------------

    const currentResult =
      await authClient.query(
        `
          SELECT
            id,
            company_code,
            legal_name,
            dba_name,
            phone,
            email,
            website,
            addr1,
            addr2,
            city,
            state,
            postal_code,
            country,
            status,
            is_active,
            onboarding_status
          FROM tenants
          WHERE id = $1
          FOR UPDATE
        `,
        [
          tenantId
        ]
      );


    const current =
      currentResult.rows[0];


    if (!current) {

      const error =
        new Error(
          "Tenant was not found."
        );

      error.statusCode = 404;

      error.code =
        "TENANT_NOT_FOUND";

      throw error;
    }


    // ---------------------------------
    // UPDATE EDITABLE DETAILS
    //
    // IMPORTANT:
    // company_code is intentionally
    // NOT updated.
    //
    // status, is_active and
    // onboarding_status are lifecycle
    // fields and are also NOT updated.
    // ---------------------------------

    const updatedResult =
      await authClient.query(
        `
          UPDATE tenants

          SET
            legal_name  = $1,
            dba_name    = $2,
            phone       = $3,
            email       = $4,
            website     = $5,
            addr1       = $6,
            addr2       = $7,
            city        = $8,
            state       = $9,
            postal_code = $10,
            country     = $11,
            updated_at  = now()

          WHERE id = $12

          RETURNING
            id,
            company_code,
            legal_name,
            dba_name,
            phone,
            email,
            website,
            addr1,
            addr2,
            city,
            state,
            postal_code,
            country,
            status,
            is_active,
            onboarding_status,
            updated_at
        `,
        [
          legalName,

          cleanOptional(
            data.dbaName
          ),

          cleanOptional(
            data.phone
          ),

          cleanOptional(
            data.email
          ),

          cleanOptional(
            data.website
          ),

          cleanOptional(
            data.addr1
          ),

          cleanOptional(
            data.addr2
          ),

          cleanOptional(
            data.city
          ),

          cleanOptional(
            data.state
          ),

          cleanOptional(
            data.postalCode
          ),

          cleanOptional(
            data.country
          ),

          tenantId
        ]
      );


    const updated =
      updatedResult.rows[0];


    // ---------------------------------
    // AUDIT
    // ---------------------------------

    const oldData =
      tenantSnapshot(
        current
      );

    const newData =
      tenantSnapshot(
        updated
      );


    if (
      !valuesEqual(
        oldData,
        newData
      )
    ) {

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


    return updated;

  } catch (error) {

    try {

      await authClient.query(
        "ROLLBACK"
      );

    } catch (
      rollbackError
    ) {

      // Preserve the original error.
    }


    throw error;

  } finally {

    authClient.release();
  }
}


// ==================================================
// AUDIT SNAPSHOT
// ==================================================

function tenantSnapshot(
  tenant
) {

  return {
    company_code:
      tenant.company_code,

    legal_name:
      tenant.legal_name,

    dba_name:
      tenant.dba_name,

    phone:
      tenant.phone,

    email:
      tenant.email,

    website:
      tenant.website,

    addr1:
      tenant.addr1,

    addr2:
      tenant.addr2,

    city:
      tenant.city,

    state:
      tenant.state,

    postal_code:
      tenant.postal_code,

    country:
      tenant.country
  };
}


// ==================================================
// CLEAN VALUES
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


// ==================================================
// COMPARE SNAPSHOTS
// ==================================================

function valuesEqual(
  left,
  right
) {

  return JSON.stringify(left) ===
    JSON.stringify(right);
}


// ==================================================
// EXPORTS
// ==================================================

module.exports = {
  updateTenantDetails
};