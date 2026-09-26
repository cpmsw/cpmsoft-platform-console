function optionalText(value) {
  const result =
    String(
      value || ""
    ).trim();

  return result || null;
}


async function provisionCompany({
  appClient,
  companyId,
  tenantId,
  primaryUserId,
  tenantData
}) {

  const tenantCode =
    String(
      tenantData.tenantCode || ""
    ).trim();

  if (!tenantCode) {
    const error =
      new Error(
        "Tenant Code is required to provision the Company."
      );

    error.statusCode = 409;

    error.code =
      "TENANT_CODE_REQUIRED";

    throw error;
  }

  const companyCode =
    `${tenantCode}-1`;

  const legalName =
    String(
      tenantData.legalName || ""
    ).trim();

  await appClient.query(
    `INSERT INTO company
     (
       id,
       tenant_id,
       company_code,
       legal_name,
       dba_name,
       website,
       default_country,
       is_active,
       created_at,
       created_by
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
       true,
       now(),
       $8
     )`,
    [
      companyId,
      tenantId,
      companyCode,
      legalName,

      optionalText(
        tenantData.dbaName
      ),

      optionalText(
        tenantData.website
      ),

      optionalText(
        tenantData.country
      ) || "US",

      primaryUserId
    ]
  );


  return {
    companyId,
    companyCode
  };
}


module.exports = {
  provisionCompany
};