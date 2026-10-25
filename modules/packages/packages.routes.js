const service =
  require("./packages.service");

const audit =
  require("../audit");

const {
  requireScreenAccess
} = require(
  "../../common/security/requireScreenAccess"
);


module.exports =
  async function (fastify) {


    // ---------------------------------
    // GET PACKAGE CATALOG
    // ---------------------------------
    fastify.get(
      "/",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "READ"
          ),
        schema: {
          tags: [
            "Packages",
          ],

          summary:
            "Get CPMSOFT package catalog",

          description:
            "Returns active CPMSOFT commercial packages together with the resources contained in each package and their default selection state."
        }
      },

      async (request, reply) => {

        try {

          return await service
            .getPackages();

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
                "PACKAGE_LOAD_FAILED",

              error:
                error.message
            });
        }
      }
    );


    // ---------------------------------
    // GET ADMIN PACKAGE LIST
    // ---------------------------------
    fastify.get(
      "/admin",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "READ"
          ),
        schema: {
          tags: ["Packages"],

          summary:
            "Get packages for administration",

          description:
            "Returns up to 100 packages matching the search and status filters.",

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
            .getPackagesAdmin({
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
                "PACKAGE_ADMIN_LOAD_FAILED",

              error:
                error.message
            });
        }
      }
    );

    // ---------------------------------
    // GET ADMIN PACKAGE COUNT
    // ---------------------------------
    fastify.get(
      "/admin/count",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "READ"
          ),
        schema: {
          tags: ["Packages"],

          summary:
            "Count packages for administration",

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
              .countPackagesAdmin({
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
                "PACKAGE_ADMIN_COUNT_FAILED",

              error:
                error.message
            });
        }
      }
    );

    // ---------------------------------
    // GET PACKAGE HISTORY
    // ---------------------------------

    fastify.get(
      "/:id/history",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "READ"
          ),

        schema: {
          tags: ["Packages"],

          summary:
            "Get package audit history",

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
            await audit.getPackageHistory(
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
                "PACKAGE_HISTORY_FAILED",

              message:
                error.message ||
                "Unable to retrieve package history."
            });
        }
      }
    );

    // ---------------------------------
    // GET PACKAGE BY ID
    // ---------------------------------
    fastify.get(
      "/:id",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "READ"
          ),
        schema: {
          tags: ["Packages"],
          summary: "Get package by ID",

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
          return await service.getPackageById(
            request.params.id
          );
        } catch (error) {
          request.log.error(error);

          return reply
            .code(error.statusCode || 500)
            .send({
              code:
                error.code ||
                "PACKAGE_LOAD_FAILED",
              error: error.message
            });
        }
      }
    );


    // ---------------------------------
    // CREATE PACKAGE
    // ---------------------------------
    fastify.post(
      "/",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "WRITE"
          ),
        schema: {
          tags: ["Packages"],
          summary: "Create package",

          body: {
            type: "object",
            required: [
              "package_key",
              "package_name"
            ],
            additionalProperties: false,

            properties: {
              package_key: {
                type: "string",
                minLength: 1,
                maxLength: 100
              },

              package_name: {
                type: "string",
                minLength: 1,
                maxLength: 150
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
          const pkg =
            await service.createPackage(
              request.body,
              request.user.adminId
            );

          return reply
            .code(201)
            .send(pkg);
        } catch (error) {
          request.log.error(error);

          return reply
            .code(error.statusCode || 500)
            .send({
              code:
                error.code ||
                "PACKAGE_CREATE_FAILED",
              error: error.message
            });
        }
      }
    );


    // ---------------------------------
    // UPDATE PACKAGE
    // ---------------------------------
    fastify.put(
      "/:id",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "WRITE"
          ),
        schema: {
          tags: ["Packages"],
          summary: "Update package",

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
              "package_name"
            ],
            additionalProperties: false,

            properties: {
              package_name: {
                type: "string",
                minLength: 1,
                maxLength: 150
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
          return await service.updatePackage(
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
                "PACKAGE_UPDATE_FAILED",
              error: error.message
            });
        }
      }
    );


    // ---------------------------------
    // ACTIVATE / DEACTIVATE PACKAGE
    // ---------------------------------
    fastify.patch(
      "/:id/active",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "WRITE"
          ),
        schema: {
          tags: ["Packages"],
          summary: "Activate or deactivate package",

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
          return await service.setPackageActive(
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
                "PACKAGE_STATUS_UPDATE_FAILED",
              error: error.message
            });
        }
      }
    );


    // ---------------------------------
    // GET PACKAGE RESOURCE ASSIGNMENTS
    // ---------------------------------
    fastify.get(
      "/:id/resources",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "READ"
          ),
        schema: {
          tags: ["Packages"],
          summary: "Get package resources",

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
          return await service.getPackageResources(
            request.params.id
          );
        } catch (error) {
          request.log.error(error);

          return reply
            .code(error.statusCode || 500)
            .send({
              code:
                error.code ||
                "PACKAGE_RESOURCE_LOAD_FAILED",
              error: error.message
            });
        }
      }
    );


    // ---------------------------------
    // SAVE PACKAGE RESOURCE ASSIGNMENTS
    // ---------------------------------
    fastify.put(
      "/:id/resources",
      {
        preHandler:
          requireScreenAccess(
            "cpmsoft.packages",
            "WRITE"
          ),
        schema: {
          tags: ["Packages"],
          summary: "Update package resources",

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
            required: ["resources"],
            additionalProperties: false,

            properties: {
              resources: {
                type: "array",

                items: {
                  type: "object",
                  required: ["resource_id"],
                  additionalProperties: false,

                  properties: {
                    resource_id: {
                      type: "string",
                      format: "uuid"
                    },

                    is_default: {
                      type: "boolean"
                    },

                    display_order: {
                      type: "integer"
                    }
                  }
                }
              }
            }
          }
        }
      },
      async (request, reply) => {
        try {
          return await service.savePackageResources(
            request.params.id,
            request.body.resources,
            request.user.adminId
          );
        } catch (error) {
          request.log.error(error);

          return reply
            .code(error.statusCode || 500)
            .send({
              code:
                error.code ||
                "PACKAGE_RESOURCE_SAVE_FAILED",
              error: error.message
            });
        }
      }
    );

  };