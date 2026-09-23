const repository =
  require("./audit.repository");

// ==================================================
// FIELD DISPLAY DEFINITIONS
// ==================================================

const FIELD_DEFINITIONS = {

  tenant: {

    company_code: {
      label: "Company Number",
      display: "text"
    },

    legal_name: {
      label: "Legal Name",
      display: "text"
    },

    dba_name: {
      label: "DBA Name",
      display: "text"
    },

    phone: {
      label: "Phone",
      display: "text"
    },

    website: {
      label: "Website",
      display: "text"
    },

    addr1: {
      label: "Address Line 1",
      display: "text"
    },

    addr2: {
      label: "Address Line 2",
      display: "text"
    },

    city: {
      label: "City",
      display: "text"
    },

    state: {
      label: "State",
      display: "text"
    },

    postal_code: {
      label: "Postal Code",
      display: "text"
    },

    country: {
      label: "Country",
      display: "text"
    },

    onboarding_status: {
      label: "Onboarding Status",
      display: "text"
    }
  },

  primary_contact: {

    first_name: {
      label: "First Name",
      display: "text"
    },

    last_name: {
      label: "Last Name",
      display: "text"
    },

    email: {
      label: "Email",
      display: "text"
    },

    phone: {
      label: "Phone",
      display: "text"
    },

    job_title: {
      label: "Job Title",
      display: "text"
    },

    twofa_required: {
      label: "Two-Factor Required",
      display: "boolean"
    }
  },

  tenant_entitlement: {

    licensed_users: {
      label: "Licensed Users",
      display: "text"
    },

    max_companies: {
      label: "Max Companies",
      display: "text"
    },

    rbac_enabled: {
      label: "RBAC Enabled",
      display: "boolean"
    },

    package_ids: {
      label: "Packages",
      display: "longText"
    },

    resource_ids: {
      label: "Resources",
      display: "longText"
    }
  }
};

// ==================================================
// CLEAN HELPERS
// ==================================================

function cleanEntityType(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function cleanAction(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}


// ==================================================
// RESOLVE PACKAGE / RESOURCE DISPLAY NAMES
// ==================================================

async function getPackageNames(
  ids = []
) {

  if (
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    return [];
  }

  const result =
    await repository.getPackageNames(
      ids
    );

  const namesById =
    new Map(
      result.map(
        row => [
          row.id,
          row.display_name ||
          row.package_name ||
          row.package_key
        ]
      )
    );

  return ids.map(
    id =>
      namesById.get(id) ||
      id
  );
}


async function getResourceNames(
  ids = []
) {

  if (
    !Array.isArray(ids) ||
    ids.length === 0
  ) {
    return [];
  }

  const result =
    await repository.getResourceNames(
      ids
    );

  const namesById =
    new Map(
      result.map(
        row => [
          row.id,
          row.display_name ||
          row.resource_name ||
          row.resource_key
        ]
      )
    );

  return ids.map(
    id =>
      namesById.get(id) ||
      id
  );
}


// ==================================================
// GET TENANT HISTORY
// ==================================================

async function getTenantHistory(
  tenantId,
  options = {}
) {

  const result =
    await repository.getByParent(
      tenantId,
      "tenant",
      tenantId,
      {
        page:
          options.page,

        pageSize:
          options.pageSize,

        entityType:
          cleanEntityType(
            options.entityType
          ),

        action:
          cleanAction(
            options.action
          ),

        userSearch:
          String(
            options.userSearch || ""
          ).trim(),

        dateFrom:
          String(
            options.dateFrom || ""
          ).trim(),

        dateTo:
          String(
            options.dateTo || ""
          ).trim()
      }
    );

  const items =
    await Promise.all(
      result.items.map(
        prepareHistoryItem
      )
    );

  return {
    ...result,
    items
  };


}

// ==================================================
// PREPARE HISTORY ITEM
// ==================================================

async function prepareHistoryItem(
  item
) {

  const oldData = {
    ...(item.old_data || {})
  };

  const newData = {
    ...(item.new_data || {})
  };


  if (
    item.entity_type ===
    "tenant_entitlement"
  ) {

    if (
      Array.isArray(
        oldData.package_ids
      )
    ) {
      oldData.package_ids =
        await getPackageNames(
          oldData.package_ids
        );
    }

    if (
      Array.isArray(
        newData.package_ids
      )
    ) {
      newData.package_ids =
        await getPackageNames(
          newData.package_ids
        );
    }

    if (
      Array.isArray(
        oldData.resource_ids
      )
    ) {
      oldData.resource_ids =
        await getResourceNames(
          oldData.resource_ids
        );
    }

    if (
      Array.isArray(
        newData.resource_ids
      )
    ) {
      newData.resource_ids =
        await getResourceNames(
          newData.resource_ids
        );
    }
  }

  return {
    id:
      item.id,

    parentType:
      item.parent_type,

    parentId:
      item.parent_id,

    entityType:
      item.entity_type,

    entityId:
      item.entity_id,

    action:
      item.action,

    changedBy:
      item.changed_by,

    changedByName:
      item.changed_by_name ||
      item.changed_by_email ||
      null,

    changedAt:
      item.changed_at,

    fields:
      buildFieldChanges(
        item.entity_type,
        item.action,
        oldData,
        newData
      )
  };
}

// ==================================================
// BUILD DISPLAYABLE FIELD CHANGES
// ==================================================

function buildFieldChanges(
  entityType,
  action,
  oldData,
  newData
) {

  const definitions =
    FIELD_DEFINITIONS[
    String(
      entityType || ""
    ).toLowerCase()
    ] || {};

  const keys =
    new Set([
      ...Object.keys(
        oldData || {}
      ),
      ...Object.keys(
        newData || {}
      )
    ]);

  const rows = [];

  for (const key of keys) {

    const definition =
      definitions[key];

    if (!definition) {
      continue;
    }

    const before =
      oldData?.[key];

    const after =
      newData?.[key];

    // CREATE:
    // Do not show fields that had no value
    // when the record was created.

    if (
      action === "CREATE" &&
      (
        after === null ||
        after === undefined ||
        after === ""
      )
    ) {
      continue;
    }

    if (
      action === "UPDATE" &&
      valuesEqual(
        before,
        after
      )
    ) {
      continue;
    }

    rows.push({
      key,

      label:
        definition.label ||
        key,

      display:
        definition.display ||
        "text",

      before:
        before ?? null,

      after:
        after ?? null
    });
  }

  return rows;
}

// ==================================================
// VALUE COMPARISON
// ==================================================

function valuesEqual(
  left,
  right
) {

  if (left === right) {
    return true;
  }

  return JSON.stringify(
    left ?? null
  ) === JSON.stringify(
    right ?? null
  );
}

// ==================================================
// EXPORTS
// ==================================================

module.exports = {
  getTenantHistory
};