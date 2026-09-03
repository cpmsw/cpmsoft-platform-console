// =================================
// TENANT ENTITLEMENT VALIDATION
//
// One rule:
//
// Packages and Resources configured
// in Platform Console are the only
// source of tenant entitlements.
//
// Package/resource configuration is
// the entitlement source of truth.
//
// Required operational dependencies
// may be included independently of
// feature enablement.
// =================================


async function validateEntitlements({
  authDb,
  requestedPackageIds,
  requestedResourceIds
}) {

  // ---------------------------------
  // REQUIRE AT LEAST ONE PACKAGE
  // ---------------------------------

  if (
    !Array.isArray(requestedPackageIds) ||
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
  // VERIFY SELECTED PACKAGES
  // ---------------------------------

  const packageResult =
    await authDb.query(
      `SELECT
         id,
         package_key,
         package_name,
         
         is_active
       FROM packages
       WHERE id =
         ANY($1::uuid[])`,
      [
        requestedPackageIds
      ]
    );


  const packageById =
    new Map(
      packageResult.rows.map(
        row => [
          String(row.id),
          row
        ]
      )
    );


  const unknownPackageIds =
    requestedPackageIds.filter(
      id =>
        !packageById.has(
          String(id)
        )
    );


  const inactivePackages =
    packageResult.rows
      .filter(
        row =>
          row.is_active !== true
      )
      .map(
        row => ({
          id:
            row.id,

          packageKey:
            row.package_key,

          packageName:
            row.package_name
        })
      );


  if (
    unknownPackageIds.length > 0 ||
    inactivePackages.length > 0
  ) {

    const error =
      new Error(
        "One or more selected packages are invalid or inactive."
      );

    error.statusCode = 400;

    error.code =
      "INVALID_PACKAGE_IDS";

    error.details = {
      unknownPackageIds,
      inactivePackages
    };

    throw error;
  }


  // ---------------------------------
  // LOAD REQUIRED PACKAGE DEFAULTS
  //
  // Resources marked is_default=true
  // are automatically entitled when
  // their package is selected.
  // ---------------------------------

  const defaultPackageResourceResult =
    await authDb.query(
      `SELECT DISTINCT
         r.id,
         r.resource_key,
         r.resource_name

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
      row =>
        row.id
    );
    
  // ---------------------------------
  // VERIFY REQUESTED RESOURCES
  // ---------------------------------

  let validRequestedResources = [];


  if (
    Array.isArray(requestedResourceIds) &&
    requestedResourceIds.length > 0
  ) {

    // ---------------------------------
    // LOAD REQUESTED RESOURCE CATALOG
    // ---------------------------------

    const requestedResourceResult =
      await authDb.query(
        `SELECT
           id,
           resource_key,
           resource_name,
           is_active
         FROM resources
         WHERE id =
           ANY($1::uuid[])`,
        [
          requestedResourceIds
        ]
      );


    const resourceById =
      new Map(
        requestedResourceResult.rows.map(
          row => [
            String(row.id),
            row
          ]
        )
      );


    // ---------------------------------
    // UNKNOWN RESOURCE IDS
    // ---------------------------------

    const unknownResourceIds =
      requestedResourceIds.filter(
        id =>
          !resourceById.has(
            String(id)
          )
      );


    // ---------------------------------
    // INACTIVE RESOURCES
    // ---------------------------------

    const inactiveResources =
      requestedResourceResult.rows
        .filter(
          row =>
            row.is_active !== true
        )
        .map(
          row => ({
            id:
              row.id,

            resourceKey:
              row.resource_key,

            resourceName:
              row.resource_name
          })
        );


    // ---------------------------------
    // ACTIVE REQUESTED RESOURCES
    // ---------------------------------

    const activeRequestedResources =
      requestedResourceResult.rows
        .filter(
          row =>
            row.is_active === true
        );


    const activeRequestedIds =
      activeRequestedResources.map(
        row =>
          row.id
      );


    let packageResourceRows = [];


    // ---------------------------------
    // VERIFY PACKAGE -> RESOURCE
    // RELATIONSHIP
    // ---------------------------------

    if (
      activeRequestedIds.length > 0
    ) {

      const packageResourceResult =
        await authDb.query(
          `SELECT DISTINCT
             r.id,
             r.resource_key,
             r.resource_name
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
            activeRequestedIds
          ]
        );


      packageResourceRows =
        packageResourceResult.rows;
    }


    const packageResourceIds =
      new Set(
        packageResourceRows.map(
          row =>
            String(row.id)
        )
      );


    // ---------------------------------
    // RESOURCE EXISTS AND IS ACTIVE,
    // BUT DOES NOT BELONG TO ANY
    // SELECTED PACKAGE
    // ---------------------------------

    const notInSelectedPackages =
      activeRequestedResources
        .filter(
          row =>
            !packageResourceIds.has(
              String(row.id)
            )
        )
        .map(
          row => ({
            id:
              row.id,

            resourceKey:
              row.resource_key,

            resourceName:
              row.resource_name
          })
        );


    // ---------------------------------
    // RESOURCE VALIDATION ERROR
    // ---------------------------------

    if (
      unknownResourceIds.length > 0 ||
      inactiveResources.length > 0 ||
      notInSelectedPackages.length > 0
    ) {

      const error =
        new Error(
          "One or more selected resources are not valid for the selected packages."
        );

      error.statusCode = 400;

      error.code =
        "INVALID_PACKAGE_RESOURCE_IDS";

      error.details = {
        unknownResourceIds,
        inactiveResources,
        notInSelectedPackages
      };

      throw error;
    }


    validRequestedResources =
      packageResourceRows;
  }

  // ---------------------------------
  // REQUIRED OPERATIONAL RESOURCES
  //
  // roles_permissions is required by
  // user administration even when the
  // tenant does not have RBAC enabled.
  //
  // RBAC package selection still
  // controls rbacEnabled and the
  // Roles & Permissions feature.
  // ---------------------------------

  const operationalResourceResult =
    await authDb.query(
      `SELECT
         id,
         resource_key,
         resource_name

       FROM resources

       WHERE resource_key =
         'roles_permissions'

         AND is_active = true

       LIMIT 1`
    );


  if (operationalResourceResult.rowCount === 0) {

    const error =
      new Error(
        "Required operational resource roles_permissions is not active."
      );

    error.statusCode = 500;

    error.code =
      "REQUIRED_OPERATIONAL_RESOURCE_MISSING";

    throw error;
  }


  const operationalResourceIds =
    operationalResourceResult.rows.map(
      row =>
        row.id
    );

  // ---------------------------------
  // FINAL TENANT ENTITLEMENT
  //
  // Required package defaults
  // +
  // Valid explicitly requested resources
  // +
  // Required operational dependencies.
  // ---------------------------------


  const requestedValidResourceIds =
    validRequestedResources.map(
      row =>
        row.id
    );


  const finalResourceIds =
    [
      ...new Set([
        ...defaultPackageResourceIds,
        ...requestedValidResourceIds,
        ...operationalResourceIds
      ])
    ];

  // ---------------------------------
  // RESULT
  // ---------------------------------

  return {

    

    finalResourceIds,

    validPackages:
      packageResult.rows,

    defaultPackageResources:
      defaultPackageResourceResult.rows,

    validRequestedResources
  };
}


module.exports = {
  validateEntitlements
};