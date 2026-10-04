const notesService =
  require("cpmsoft-core/notes");

const PARENT_TYPE =
  "platform_customer";


module.exports =
  async function notesRoutes(
    fastify
  ) {

    // ---------------------------------
    // GET PLATFORM CUSTOMER NOTES
    // ---------------------------------
    fastify.get(
      "/platform_customer/:tenantId",
      {
        schema: {
          tags: ["Notes"],

          summary:
            "Get Platform Customer notes",

          params: {
            type: "object",

            required: [
              "tenantId"
            ],

            properties: {

              tenantId: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      },

      async (request) => {

        const tenantId =
          request.params.tenantId;

        return notesService.getNotes(
          tenantId,
          PARENT_TYPE,
          tenantId
        );
      }
    );


    // ---------------------------------
    // ADD PLATFORM CUSTOMER NOTE
    // ---------------------------------
    fastify.post(
      "/platform_customer/:tenantId",
      {
        schema: {
          tags: ["Notes"],

          summary:
            "Add Platform Customer note",

          params: {
            type: "object",

            required: [
              "tenantId"
            ],

            properties: {

              tenantId: {
                type: "string",
                format: "uuid"
              }
            }
          },

          body: {
            type: "object",

            additionalProperties: false,

            required: [
              "notes"
            ],

            properties: {

              notesRef: {
                type: [
                  "string",
                  "null"
                ]
              },

              notes: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request, reply) => {

        const tenantId =
          request.params.tenantId;


        const result =
          await notesService.createNote(
            tenantId,
            PARENT_TYPE,
            tenantId,

            request.user.adminId,

            request.body
          );


        return reply
          .code(201)
          .send(result);
      }
    );


    // ---------------------------------
    // EDIT PLATFORM CUSTOMER NOTE
    // ---------------------------------
    fastify.put(
      "/platform_customer/:tenantId/:noteId",
      {
        schema: {
          tags: ["Notes"],

          summary:
            "Update Platform Customer note",

          params: {
            type: "object",

            required: [
              "tenantId",
              "noteId"
            ],

            properties: {

              tenantId: {
                type: "string",
                format: "uuid"
              },

              noteId: {
                type: "string",
                format: "uuid"
              }
            }
          },

          body: {
            type: "object",

            additionalProperties: false,

            required: [
              "notes"
            ],

            properties: {

              notesRef: {
                type: [
                  "string",
                  "null"
                ]
              },

              notes: {
                type: "string",
                minLength: 1
              }
            }
          }
        }
      },

      async (request) => {

        return notesService.updateNote(
          request.params.tenantId,
          request.params.noteId,
          request.user.adminId,
          request.body
        );
      }
    );


    // ---------------------------------
    // DELETE PLATFORM CUSTOMER NOTE
    // ---------------------------------
    fastify.delete(
      "/platform_customer/:tenantId/:noteId",
      {
        schema: {
          tags: ["Notes"],

          summary:
            "Delete Platform Customer note",

          params: {
            type: "object",

            required: [
              "tenantId",
              "noteId"
            ],

            properties: {

              tenantId: {
                type: "string",
                format: "uuid"
              },

              noteId: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      },

      async (request) => {

        return notesService.deleteNote(
          request.params.tenantId,
          request.params.noteId,
          request.user.adminId
        );
      }
    );

  };