const notifications =
  require("cpmsoft-core/notifications");


// ==================================================
// GET NOTIFICATIONS FOR CURRENT ADMIN
// ==================================================

async function getNotifications(
  adminId,
  limit = 50
) {

  return notifications.getNotifications(
    adminId,
    limit
  );
}


// ==================================================
// GET UNREAD NOTIFICATIONS
// ==================================================

async function getUnreadNotifications(
  adminId
) {

  return notifications
    .getUnreadNotifications(
      adminId
    );
}


// ==================================================
// GET UNREAD COUNT
// ==================================================

async function getUnreadCount(
  adminId
) {

  return notifications
    .getUnreadCount(
      adminId
    );
}


// ==================================================
// MARK NOTIFICATION READ
// ==================================================

async function markNotificationRead(
  adminId,
  notificationId
) {

  return notifications
    .markNotificationRead(
      adminId,
      notificationId
    );
}


module.exports = {
  getNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markNotificationRead
};