const service =
  require("./help.service");

module.exports = async function (fastify) {


  // ---------------------------------
  // GET HELP TOPICS
  // ---------------------------------
  fastify.get(
    "/topics",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get Help topics",

        description:
          "Returns active CPMSOFT Help topics available for SYSTEM Help authoring."
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getTopics();

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_TOPICS_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET HELP KEYS
  // ---------------------------------
  fastify.get(
    "/keys",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get registered Help keys",

        description:
          "Returns registered application Help contexts used by contextual F1 Help.",

        querystring: {
          type: "object",

          properties: {
            topicId: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getKeys({
            topicId:
              request.query.topicId
          });

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_KEYS_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET SYSTEM HELP CONTENT
  // ---------------------------------
  fastify.get(
    "/content",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get SYSTEM Help content",

        description:
          "Returns SYSTEM Help content available for Platform Console Help administration."
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getSystemContent();

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET SYSTEM HELP CONTENT BY ID
  // ---------------------------------
  fastify.get(
    "/content/:id",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get SYSTEM Help content by ID",

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

        return await service
          .getSystemContentById(
            request.params.id
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
              "HELP_CONTENT_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // CREATE SYSTEM HELP DRAFT
  // ---------------------------------
  fastify.post(
    "/content",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Create SYSTEM Help draft",

        body: {
          type: "object",

          required: [
            "contentType",
            "title"
          ],

          additionalProperties: false,

          properties: {

            contentType: {
              type: "string",
              enum: [
                "CONTEXT",
                "CONCEPT",
                "GUIDE"
              ]
            },

            topicId: {
              type: ["string", "null"],
              format: "uuid"
            },

            helpKeyId: {
              type: ["string", "null"],
              format: "uuid"
            },

            title: {
              type: "string",
              minLength: 1,
              maxLength: 250
            },

            summary: {
              type: ["string", "null"]
            },

            contentJson: {
              type: ["object", "null"],
              additionalProperties: true
            },

            contentHtml: {
              type: ["string", "null"]
            },

            keywords: {
              type: ["string", "null"]
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const content =
          await service
            .createSystemContent(
              request.body,
              request.user.adminId
            );

        return reply
          .code(201)
          .send(content);

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_CREATE_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // UPDATE SYSTEM HELP DRAFT
  // ---------------------------------
  fastify.put(
    "/content/:id",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Update SYSTEM Help content",

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
            "contentType",
            "title"
          ],

          additionalProperties: false,

          properties: {

            contentType: {
              type: "string",
              enum: [
                "CONTEXT",
                "CONCEPT",
                "GUIDE"
              ]
            },

            topicId: {
              type: ["string", "null"],
              format: "uuid"
            },

            helpKeyId: {
              type: ["string", "null"],
              format: "uuid"
            },

            title: {
              type: "string",
              minLength: 1,
              maxLength: 250
            },

            summary: {
              type: ["string", "null"]
            },

            contentJson: {
              type: ["object", "null"],
              additionalProperties: true
            },

            contentHtml: {
              type: ["string", "null"]
            },

            keywords: {
              type: ["string", "null"]
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .updateSystemContent(
            request.params.id,
            request.body,
            request.user.adminId
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
              "HELP_CONTENT_UPDATE_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // PUBLISH SYSTEM HELP CONTENT
  // ---------------------------------
  fastify.post(
    "/content/:id/publish",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Publish SYSTEM Help content",

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

        return await service
          .publishSystemContent(
            request.params.id,
            request.user.adminId
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
              "HELP_CONTENT_PUBLISH_FAILED",

            error:
              error.message
          });
      }
    }
  );


};