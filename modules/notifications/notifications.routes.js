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

  fastify.get("/", async (
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
  // GET UNREAD COUNT
  // ---------------------------------

  fastify.get(
    "/unread-count",
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