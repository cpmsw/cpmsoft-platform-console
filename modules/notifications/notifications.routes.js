const service =
  require("./notifications.service");


// ==================================================
// NOTIFICATIONS
// ==================================================

module.exports = async function (
  fastify
) {

  // ---------------------------------
  // GET NOTIFICATIONS
  // ---------------------------------

  fastify.get("/", {

    schema: {
      tags: ["Notifications"],

      querystring: {
        type: "object",

        properties: {
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 50
          }
        },

        additionalProperties: false
      },

      response: {
        200: {
          type: "array"
        }
      }
    }

  }, async (
    request
  ) => {

    const adminId =
      request.user.adminId;

    const limit =
      request.query.limit || 50;

    return service.getNotifications(
      adminId,
      limit
    );
  });


  // ---------------------------------
  // GET UNREAD NOTIFICATIONS
  // ---------------------------------

  fastify.get(
    "/unread",
    {

      schema: {
        tags: ["Notifications"],

        response: {
          200: {
            type: "array"
          }
        }
      }

    },
    async (request) => {

      const adminId =
        request.user.adminId;

      return service
        .getUnreadNotifications(
          adminId
        );
    }
  );


  // ---------------------------------
  // GET ACTIVE NOTIFICATIONS
  // ---------------------------------

  fastify.get(
    "/active",
    {

      schema: {
        tags: ["Notifications"],

        response: {
          200: {
            type: "array"
          }
        }
      }

    },
    async (request) => {

      const adminId =
        request.user.adminId;

      return service
        .getActiveNotifications(
          adminId
        );
    }
  );


  // ---------------------------------
  // DISMISS NOTIFICATION
  // ---------------------------------

  fastify.put(
    "/:notificationId/dismiss",
    {

      schema: {
        tags: ["Notifications"],

        params: {
          type: "object",

          required: [
            "notificationId"
          ],

          properties: {
            notificationId: {
              type: "string",
              format: "uuid"
            }
          },

          additionalProperties: false
        },

        response: {
          200: {
            type: "object",

            properties: {
              success: {
                type: "boolean"
              },

              id: {
                type: "string",
                format: "uuid"
              },

              dismissed_at: {
                type: "string",
                format: "date-time"
              }
            }
          }
        }
      }

    },
    async (request) => {

      const adminId =
        request.user.adminId;

      const {
        notificationId
      } = request.params;

      return service
        .dismissNotification(
          adminId,
          notificationId
        );
    }
  );


  // ---------------------------------
  // GET UNREAD COUNT
  // ---------------------------------

  fastify.get(
    "/unread-count",
    {

      schema: {
        tags: ["Notifications"],

        response: {
          200: {
            type: "object",

            properties: {
              count: {
                type: "integer"
              }
            }
          }
        }
      }

    },
    async (request) => {

      const adminId =
        request.user.adminId;

      const count =
        await service.getUnreadCount(
          adminId
        );

      return {
        count
      };
    }
  );


  // ---------------------------------
  // MARK NOTIFICATION READ
  // ---------------------------------

  fastify.put(
    "/:id/read",
    {

      schema: {
        tags: ["Notifications"],

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
          },

          additionalProperties: false
        },

        response: {
          200: {
            type: "object",

            properties: {
              success: {
                type: "boolean"
              },

              notification: {
                type: "object"
              },

              message: {
                type: "string"
              }
            }
          }
        }
      }

    },
    async (request) => {

      const adminId =
        request.user.adminId;

      const notificationId =
        request.params.id;

      const notification =
        await service
          .markNotificationRead(
            adminId,
            notificationId
          );

      if (!notification) {

        return {
          success: false,
          message:
            "Notification not found."
        };
      }

      return {
        success: true,
        notification
      };
    }
  );
};