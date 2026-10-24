const authDb =
  require("../../db/authDb");


const ACCESS_RANK = {
  NONE: 0,
  READ: 1,
  WRITE: 2
};


function requireScreenAccess(
  screenCode,
  requiredLevel = "READ"
) {

  return async function (
    request,
    reply
  ) {

    const adminId =
      request.user?.adminId;


    if (!adminId) {

      return reply
        .code(401)
        .send({
          code:
            "PLATFORM_AUTH_REQUIRED",

          error:
            "Platform administrator authentication is required."
        });
    }


    const result =
      await authDb.query(
        `SELECT
           COALESCE(
             pasa.access_level,
             'NONE'
           ) AS access_level
         FROM platform_screens ps
         LEFT JOIN platform_admin_screen_access pasa
           ON pasa.screen_id = ps.id
          AND pasa.admin_id = $1
         WHERE ps.code = $2
           AND ps.is_active = true
         LIMIT 1`,
        [
          adminId,
          screenCode
        ]
      );


    const accessLevel =
      result.rows[0]?.access_level ||
      "NONE";


    const actualRank =
      ACCESS_RANK[accessLevel] ?? 0;

    const requiredRank =
      ACCESS_RANK[requiredLevel] ?? 0;


    if (
      actualRank <
      requiredRank
    ) {

      return reply
        .code(403)
        .send({
          code:
            "PLATFORM_SCREEN_ACCESS_DENIED",

          error:
            "You do not have permission to perform this action."
        });
    }
  };
}


module.exports = {
  requireScreenAccess
};