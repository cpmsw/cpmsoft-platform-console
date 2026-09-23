const service =
  require("cpmsoft-core/tenants/tenants.service");

const onboardingService =
  require("./tenants.onboarding.service");

const activationService =
  require("./tenants.activation.service");

const tenantEntitlementsService =
  require("./tenantEntitlements.service");

const audit =
  require("../audit");

const tenantDetailsService =
  require("./tenants.details.service");

module.exports = async function (fastify) {

  // GET TENANTS
  fastify.get('/', async (request, reply) => {
    try {
      const { search } = request.query;
      return await service.getTenants(search);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // CREATE TENANT
  fastify.post('/', async (request, reply) => {
    try {
      const result = await service.createTenant(request.body);
      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // -----------------------------
  // TENANT PURGE PREVIEW
  // -----------------------------
  fastify.get(
    "/:id/purge/count",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        const result =
          await service
            .getTenantPurgeCount(
              request.params.id
            );

        return result;

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "TENANT_PURGE_PREVIEW_FAILED",

            message:
              error.message ||
              "Unable to preview tenant purge."
          });
      }
    }
  );

  // -----------------------------
  // PERMANENTLY PURGE ONE TENANT
  // -----------------------------
  fastify.post(
    "/:id/purge",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        const result =
          await service.purgeTenant(
            request.params.id
          );

        return result;

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "TENANT_PURGE_FAILED",

            message:
              error.message ||
              "Unable to purge tenant."
          });
      }
    }
  );

  // ---------------------------------
  // ONBOARD NEW TENANT
  // ---------------------------------
  fastify.post(
    "/onboard",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Onboard a new CPMSOFT customer",

        body: {
          type: "object",
          additionalProperties: false,

          required: [
            "tenant",
            "primaryContact"
          ],
          properties: {

            tenant: {
              type: "object",
              additionalProperties: false,

              required: [
                "legalName"
              ],

              properties: {
                legalName: {
                  type: "string",
                  minLength: 1
                },

                dbaName: {
                  type: "string"
                },

                phone: {
                  type: "string"
                },

                email: {
                  type: "string",
                  format: "email"
                },

                website: {
                  type: "string"
                },

                addr1: {
                  type: "string"
                },

                addr2: {
                  type: "string"
                },

                city: {
                  type: "string"
                },

                state: {
                  type: "string"
                },

                postalCode: {
                  type: "string"
                },

                country: {
                  type: "string"
                },

                licensedUsers: {
                  type: "integer",
                  minimum: 1,
                  default: 1
                },

                maxCompanies: {
                  type: "integer",
                  minimum: 1,
                  default: 1
                },

                rbacEnabled: {
                  type: "boolean",
                  default: false
                }
              }
            },


            primaryContact: {
              type: "object",
              additionalProperties: false,

              required: [
                "firstName",
                "lastName",
                "email"
              ],

              properties: {
                firstName: {
                  type: "string",
                  minLength: 1
                },

                lastName: {
                  type: "string",
                  minLength: 1
                },

                email: {
                  type: "string",
                  format: "email"
                },

                phone: {
                  type: "string"
                },

                jobTitle: {
                  type: "string"
                },

                department: {
                  type: "string"
                },

                twofaRequired: {
                  type: "boolean",
                  default: true
                }
              }
            },

            packageIds: {
              type: "array",
              minItems: 1,

              items: {
                type: "string",
                format: "uuid"
              }
            },

            resourceIds: {
              type: "array",

              items: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await onboardingService
            .onboardTenant(
              request.body,
              request.user.adminId
            );
        return reply
          .code(201)
          .send(result);

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_ONBOARDING_FAILED",

            message:
              error.message ||
              "The customer could not be onboarded.",

            details:
              error.details ||
              null
          });
      }
    }
  );

  // ---------------------------------
  // ACTIVATE TENANT
  //
  // Phase 2 of Tenant onboarding.
  //
  // Provisions APPDB from the Tenant's
  // saved AUTHDB configuration and
  // sends the first activation email.
  // ---------------------------------

  fastify.post(
    "/:id/activate",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Provision and activate a pending Tenant",

        params: {
          type: "object",

          required: [
            "id"
          ],

          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await activationService
            .activateTenant(
              request.params.id
            );


        return result;


      } catch (error) {

        request.log.error(error);


        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_ACTIVATION_FAILED",

            message:
              error.message ||
              "The Tenant could not be activated."
          });
      }
    }
  );

  // ---------------------------------
  // RESEND ACTIVATION EMAIL
  //
  // Email only.
  //
  // APPDB must already be provisioned.
  // No provisioning is performed here.
  // ---------------------------------

  fastify.post(
    "/:id/resend-activation",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Resend Tenant activation email",

        params: {
          type: "object",

          required: [
            "id"
          ],

          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await activationService
            .resendActivationEmail(
              request.params.id
            );


        return result;


      } catch (error) {

        request.log.error(error);


        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_ACTIVATION_EMAIL_FAILED",

            message:
              error.message ||
              "The activation email could not be sent."
          });
      }
    }
  );


  // ---------------------------------
  // GET TENANT HISTORY
  // ---------------------------------

  fastify.get(
    "/:id/history",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Get tenant audit history",

        params: {
          type: "object",
          required: ["id"],

          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        },

        querystring: {
          type: "object",

          properties: {

            entityType: {
              type: "string"
            },

            action: {
              type: "string"
            },

            userSearch: {
              type: "string"
            },

            dateFrom: {
              type: "string"
            },

            dateTo: {
              type: "string"
            },

            page: {
              type: "integer",
              minimum: 1,
              default: 1
            },

            pageSize: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 25
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await audit.getTenantHistory(
            request.params.id,
            request.query
          );

        return result;

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_HISTORY_FAILED",

            message:
              error.message ||
              "Unable to retrieve tenant history."
          });
      }
    }
  );
  // ---------------------------------
  // GET TENANT ENTITLEMENTS
  // ---------------------------------
  fastify.get(
    "/:id/entitlements",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Get tenant package and resource entitlements",

        params: {
          type: "object",
          required: ["id"],

          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await tenantEntitlementsService
            .getTenantEntitlements(
              request.params.id
            );

        return result;

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_ENTITLEMENTS_FAILED",

            message:
              error.message ||
              "Unable to retrieve tenant entitlements."
          });
      }
    }
  );

  // ---------------------------------
  // UPDATE TENANT ENTITLEMENTS
  // ---------------------------------
  fastify.put(
    "/:id/entitlements",
    {
      schema: {
        tags: ["Tenants"],

        summary:
          "Update tenant package and resource entitlements",

        params: {
          type: "object",
          required: ["id"],

          properties: {
            id: {
              type: "string",
              format: "uuid"
            }
          }
        },

        body: {
          type: "object",

          required: [
            "packageIds",
            "resourceIds",
            "licensedUsers",
            "maxCompanies",
            "rbacEnabled"
          ],

          additionalProperties: false,

          properties: {
            packageIds: {
              type: "array",

              items: {
                type: "string",
                format: "uuid"
              },

              uniqueItems: true
            },
            resourceIds: {
              type: "array",

              items: {
                type: "string",
                format: "uuid"
              },

              uniqueItems: true
            },

            licensedUsers: {
              type: "integer",
              minimum: 1
            },

            maxCompanies: {
              type: "integer",
              minimum: 1
            },

            rbacEnabled: {
              type: "boolean"
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const result =
          await tenantEntitlementsService
            .updateTenantEntitlements({
              tenantId:
                request.params.id,

              packageIds:
                request.body.packageIds,

              resourceIds:
                request.body.resourceIds,

              licensedUsers:
                request.body.licensedUsers,

              maxCompanies:
                request.body.maxCompanies,

              rbacEnabled:
                request.body.rbacEnabled
            });


        return result;


      } catch (error) {

        request.log.error(error);


        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "TENANT_ENTITLEMENTS_UPDATE_FAILED",

            message:
              error.message ||
              "Unable to update tenant entitlements."
          });
      }
    }
  );

  // REACTIVATE TENANT
  fastify.put('/:id/reactivate', async (request, reply) => {
    try {
      return await service.reactivateTenant(request.params.id);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // UPDATE TENANT
  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          }
        }
      },

      body: {
        type: 'object',
        required: ['legalName'],
        additionalProperties: false,

        properties: {
          legalName: {
            type: 'string',
            minLength: 1
          },

          dbaName: {
            type: ['string', 'null']
          },

          phone: {
            type: ['string', 'null']
          },

          email: {
            type: ['string', 'null']
          },

          website: {
            type: ['string', 'null']
          },

          addr1: {
            type: ['string', 'null']
          },

          addr2: {
            type: ['string', 'null']
          },

          city: {
            type: ['string', 'null']
          },

          state: {
            type: ['string', 'null']
          },

          postalCode: {
            type: ['string', 'null']
          },

          country: {
            type: ['string', 'null']
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      return await tenantDetailsService
        .updateTenantDetails(
          request.params.id,
          request.body,
          request.user.adminId
        );
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

  // DEACTIVATE TENANT
  fastify.delete('/:id', async (request, reply) => {
    try {
      return await service.deactivateTenant(request.params.id);
    } catch (error) {
      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.message
      });
    }
  });

};
