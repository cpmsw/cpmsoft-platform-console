const authDb =
    require("../../db/authDb");


async function searchPlatformAdmins({
    search = "",
    status = "active"
} = {}) {

    const values = [];

    const where = [];


    if (search.trim()) {

        values.push(
            `%${search.trim()}%`
        );

        where.push(
            `(display_name ILIKE $${values.length}
        OR email ILIKE $${values.length})`
        );
    }


    if (status === "active") {

        where.push(
            "is_active = true"
        );

    } else if (
        status === "inactive"
    ) {

        where.push(
            "is_active = false"
        );
    }


    const whereSql =
        where.length
            ? `WHERE ${where.join(" AND ")}`
            : "";


    const result =
        await authDb.query(
            `SELECT
         id,
         display_name,
         email,
         is_active,
         twofa_enabled,
         last_login_at,
         created_at,
         updated_at
       FROM platform_admins
       ${whereSql}
       ORDER BY
         display_name ASC,
         email ASC LIMIT 100` ,

            values
        );


    return result.rows;
}


async function countPlatformAdmins({
    search = "",
    status = "active"
} = {}) {

    const values = [];
    const where = [];


    if (search.trim()) {

        values.push(
            `%${search.trim()}%`
        );

        where.push(
            `(display_name ILIKE $${values.length}
        OR email ILIKE $${values.length})`
        );
    }


    if (status === "active") {

        where.push(
            "is_active = true"
        );

    } else if (
        status === "inactive"
    ) {

        where.push(
            "is_active = false"
        );
    }


    const whereSql =
        where.length
            ? `WHERE ${where.join(" AND ")}`
            : "";


    const result =
        await authDb.query(
            `SELECT COUNT(*)::int AS count
       FROM platform_admins
       ${whereSql}`,
            values
        );


    return result.rows[0]?.count || 0;
}

// ---------------------------------
// GET PLATFORM ADMIN
// ---------------------------------
async function getPlatformAdmin(
    adminId
) {

    const result =
        await authDb.query(
            `SELECT
               id,
               display_name,
               email,
               is_active,
               twofa_enabled,
               last_login_at,
               created_at,
               updated_at
             FROM platform_admins
             WHERE id = $1`,
            [
                adminId
            ]
        );


    return result.rows[0] || null;
}

// ---------------------------------
// UPDATE PLATFORM ADMIN
// ---------------------------------
async function updatePlatformAdmin(
    adminId,
    {
        display_name,
        email
    }
) {

    const normalizedDisplayName =
        String(
            display_name || ""
        ).trim();

    const normalizedEmail =
        String(
            email || ""
        )
            .trim()
            .toLowerCase();


    if (!normalizedDisplayName) {

        const error =
            new Error(
                "Display Name is required."
            );

        error.statusCode = 400;
        error.code =
            "PLATFORM_ADMIN_DISPLAY_NAME_REQUIRED";

        throw error;
    }


    if (!normalizedEmail) {

        const error =
            new Error(
                "Email is required."
            );

        error.statusCode = 400;
        error.code =
            "PLATFORM_ADMIN_EMAIL_REQUIRED";

        throw error;
    }


    try {

        const result =
            await authDb.query(
                `UPDATE platform_admins
                 SET
                   display_name = $2,
                   email = $3,
                   updated_at = NOW()
                 WHERE id = $1
                 RETURNING
                   id,
                   display_name,
                   email,
                   is_active,
                   twofa_enabled,
                   last_login_at,
                   created_at,
                   updated_at`,
                [
                    adminId,
                    normalizedDisplayName,
                    normalizedEmail
                ]
            );


        return result.rows[0] || null;


    } catch (error) {

        if (
            error.code === "23505"
        ) {

            const conflict =
                new Error(
                    "A Platform Admin with this email already exists."
                );

            conflict.statusCode = 409;
            conflict.code =
                "PLATFORM_ADMIN_EMAIL_EXISTS";

            throw conflict;
        }


        throw error;
    }
}

// ---------------------------------
// DEACTIVATE PLATFORM ADMIN
// ---------------------------------
async function deactivatePlatformAdmin(
    adminId
) {

    const result =
        await authDb.query(
            `UPDATE platform_admins
             SET
               is_active = false,
               updated_at = NOW()
             WHERE id = $1
             RETURNING
               id,
               display_name,
               email,
               is_active,
               twofa_enabled,
               last_login_at,
               created_at,
               updated_at`,
            [
                adminId
            ]
        );


    return result.rows[0] || null;
}


// ---------------------------------
// REACTIVATE PLATFORM ADMIN
// ---------------------------------
async function reactivatePlatformAdmin(
    adminId
) {

    const result =
        await authDb.query(
            `UPDATE platform_admins
             SET
               is_active = true,
               updated_at = NOW()
             WHERE id = $1
             RETURNING
               id,
               display_name,
               email,
               is_active,
               twofa_enabled,
               last_login_at,
               created_at,
               updated_at`,
            [
                adminId
            ]
        );


    return result.rows[0] || null;
}

module.exports = {
    searchPlatformAdmins,
    countPlatformAdmins,
    getPlatformAdmin,
    updatePlatformAdmin,
    deactivatePlatformAdmin,
    reactivatePlatformAdmin
};