const service =
  require("./resources.service");

const audit =
  require("../audit");

const {
  requireScreenAccess
} = require(
  "../../common/security/requireScreenAccess"
);

module.exports = async function (fastify) {


  // ---------------------------------
  // GET MASTER RESOURCE CATALOG
  // ---------------------------------
  fastify.get(
    "/",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "READ"
        ),
      schema: {
        tags: ["Resources"],
        summary:
          "Get CPMSOFT resource catalog",

        description:
          "Returns all active resources available in the CPMSOFT master catalog."
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getResources();

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "RESOURCE_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET ADMIN RESOURCE LIST
  // ---------------------------------
  fastify.get(
    "/admin",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "READ"
        ),
      schema: {
        tags: ["Resources"],

        summary:
          "Get resources for administration",

        description:
          "Returns up to 100 resources matching the search and status filters.",

        querystring: {
          type: "object",

          additionalProperties: false,

          properties: {
            search: {
              type: "string"
            },

            status: {
              type: "string",
              enum: [
                "active",
                "inactive",
                "all"
              ]
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .getResourcesAdmin({
            search:
              request.query.search || "",

            status:
              request.query.status ||
              "active"
          });

      } catch (error) {

        request.log.error(
          error
        );

        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "RESOURCE_ADMIN_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET ADMIN RESOURCE COUNT
  // ---------------------------------
  fastify.get(
    "/admin/count",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "READ"
        ),
      schema: {
        tags: ["Resources"],

        summary:
          "Count resources for administration",

        querystring: {
          type: "object",

          additionalProperties: false,

          properties: {
            search: {
              type: "string"
            },

            status: {
              type: "string",
              enum: [
                "active",
                "inactive",
                "all"
              ]
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const count =
          await service
            .countResourcesAdmin({
              search:
                request.query.search || "",

              status:
                request.query.status ||
                "active"
            });


        return {
          count
        };

      } catch (error) {

        request.log.error(
          error
        );

        return reply
          .code(
            error.statusCode ||
            500
          )
          .send({
            code:
              error.code ||
              "RESOURCE_ADMIN_COUNT_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET RESOURCE BY ID
  // ---------------------------------
  fastify.get(
    "/:id",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "READ"
        ),
      schema: {
        tags: ["Resources"],
        summary: "Get resource by ID",

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
        return await service.getResourceById(
          request.params.id
        );

      } catch (error) {
        request.log.error(error);

        return reply
          .code(error.statusCode || 500)
          .send({
            code:
              error.code ||
              "RESOURCE_LOAD_FAILED",
            error: error.message
          });
      }
    }
  );


  // ---------------------------------
  // CREATE RESOURCE
  // ---------------------------------
  fastify.post(
    "/",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "WRITE"
        ),
      schema: {
        tags: ["Resources"],
        summary: "Create resource",

        body: {
          type: "object",
          required: [
            "resource_key",
            "resource_name"
          ],
          additionalProperties: false,

          properties: {
            resource_key: {
              type: "string",
              minLength: 1,
              maxLength: 100
            },

            resource_name: {
              type: "string",
              minLength: 1,
              maxLength: 150
            },

            category: {
              type: ["string", "null"],
              maxLength: 100
            },

            description: {
              type: ["string", "null"]
            },

            is_active: {
              type: "boolean"
            },

            display_order: {
              type: "integer"
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const resource =
          await service.createResource(
            request.body,
            request.user.adminId
          );

        return reply
          .code(201)
          .send(resource);

      } catch (error) {
        request.log.error(error);

        return reply
          .code(error.statusCode || 500)
          .send({
            code:
              error.code ||
              "RESOURCE_CREATE_FAILED",
            error: error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET RESOURCE HISTORY
  // ---------------------------------

  fastify.get(
    "/:id/history",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "READ"
        ),

      schema: {
        tags: ["Resources"],

        summary:
          "Get resource audit history",

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
          await audit.getResourceHistory(
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
              "RESOURCE_HISTORY_FAILED",

            message:
              error.message ||
              "Unable to retrieve resource history."
          });
      }
    }
  );

  // ---------------------------------
  // UPDATE RESOURCE
  // ---------------------------------
  fastify.put(
    "/:id",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "WRITE"
        ),
      schema: {
        tags: ["Resources"],
        summary: "Update resource",

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
            "resource_name"
          ],
          additionalProperties: false,

          properties: {
            resource_name: {
              type: "string",
              minLength: 1,
              maxLength: 150
            },

            category: {
              type: ["string", "null"],
              maxLength: 100
            },

            description: {
              type: ["string", "null"]
            },

            display_order: {
              type: "integer"
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        return await service.updateResource(
          request.params.id,
          request.body,
          request.user.adminId
        );
      } catch (error) {
        request.log.error(error);

        return reply
          .code(error.statusCode || 500)
          .send({
            code:
              error.code ||
              "RESOURCE_UPDATE_FAILED",
            error: error.message
          });
      }
    }
  );


  // ---------------------------------
  // ACTIVATE / DEACTIVATE RESOURCE
  // ---------------------------------
  fastify.patch(
    "/:id/active",
    {
      preHandler:
        requireScreenAccess(
          "cpmsoft.resources",
          "WRITE"
        ),
      schema: {
        tags: ["Resources"],
        summary: "Activate or deactivate resource",

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
          required: ["is_active"],
          additionalProperties: false,

          properties: {
            is_active: {
              type: "boolean"
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        return await service.setResourceActive(
          request.params.id,
          request.body.is_active,
          request.user.adminId
        );

      } catch (error) {
        request.log.error(error);

        return reply
          .code(error.statusCode || 500)
          .send({
            code:
              error.code ||
              "RESOURCE_STATUS_UPDATE_FAILED",
            error: error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET TENANT RESOURCE SELECTION
  // ---------------------------------
  fastify.get(
    "/tenant/:tenantId",
    {
      preHandler:
        requireScreenAccess(
          "tenants.tenants",
          "READ"
        ),
      schema: {
        tags: ["Resources"],

        summary:
          "Get tenant resource entitlements",

        description:
          "Returns the complete CPMSOFT resource catalog together with the enabled/disabled entitlement state for the selected tenant.",

        params: {
          type: "object",
          required: [
            "tenantId"
          ],

          properties: {
            tenantId: {
              type: "string",
              format: "uuid",
              description:
                "Tenant UUID"
            }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getTenantResources(
            request.params.tenantId
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "TENANT_RESOURCE_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // SAVE TENANT RESOURCE SELECTION
  // ---------------------------------
  fastify.put(
    "/tenant/:tenantId",
    {
      preHandler:
        requireScreenAccess(
          "tenants.tenants",
          "WRITE"
        ),
      schema: {
        tags: ["Resources"],

        summary:
          "Update tenant resource entitlements",

        description:
          "Replaces the tenant's currently enabled resource set. Selected resources are enabled and previously enabled resources that are not selected are disabled. Existing entitlement rows are retained.",

        params: {
          type: "object",
          required: [
            "tenantId"
          ],

          properties: {
            tenantId: {
              type: "string",
              format: "uuid",
              description:
                "Tenant UUID"
            }
          }
        },

        body: {
          type: "object",
          required: [
            "resourceIds"
          ],

          additionalProperties: false,

          properties: {

            resourceIds: {
              type: "array",

              description:
                "Resource UUIDs that should remain enabled for the tenant.",

              items: {
                type: "string",
                format: "uuid"
              }
            }
          }
        },

        response: {
          200: {
            type: "object",

            properties: {
              success: {
                type: "boolean"
              },

              tenantId: {
                type: "string",
                format: "uuid"
              },

              enabledCount: {
                type: "integer"
              }
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .saveTenantResources(
            request.params.tenantId,
            request.body.resourceIds
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "TENANT_RESOURCE_SAVE_FAILED",

            error:
              error.message
          });
      }
    }
  );

};