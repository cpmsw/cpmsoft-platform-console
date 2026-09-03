function requiredText(value) {
  return String(
    value || ""
  ).trim();
}


function validationError(
  message,
  code,
  statusCode = 400
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  error.code =
    code;

  return error;
}


function validateOnboardingInput(
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
  // TENANT
  // ---------------------------------

  const legalName =
    requiredText(
      tenantData.legalName
    );


  if (!legalName) {
    throw validationError(
      "Legal Name is required.",
      "LEGAL_NAME_REQUIRED"
    );
  }


  const companyCode =
    requiredText(
      tenantData.companyCode
    );


  if (!companyCode) {
    throw validationError(
      "Company Code is required.",
      "COMPANY_CODE_REQUIRED"
    );
  }


  const licensedUsers =
    Number(
      tenantData.licensedUsers ?? 1
    );


  if (
    !Number.isInteger(licensedUsers) ||
    licensedUsers < 1
  ) {
    throw validationError(
      "Licensed Users must be at least 1.",
      "INVALID_LICENSED_USERS"
    );
  }


  const maxCompanies =
    Number(
      tenantData.maxCompanies ?? 1
    );


  if (
    !Number.isInteger(maxCompanies) ||
    maxCompanies < 1
  ) {
    throw validationError(
      "Maximum Companies must be at least 1.",
      "INVALID_MAX_COMPANIES"
    );
  }
  const rbacEnabled =
    tenantData.rbacEnabled === true;

  // ---------------------------------
  // PRIMARY CONTACT
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
    throw validationError(
      "Primary Contact First Name is required.",
      "PRIMARY_FIRST_NAME_REQUIRED"
    );
  }


  if (!lastName) {
    throw validationError(
      "Primary Contact Last Name is required.",
      "PRIMARY_LAST_NAME_REQUIRED"
    );
  }


  if (!primaryEmail) {
    throw validationError(
      "Primary Contact Email is required.",
      "PRIMARY_EMAIL_REQUIRED"
    );
  }


  return {
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
  };
}


module.exports = {
  validateOnboardingInput
};