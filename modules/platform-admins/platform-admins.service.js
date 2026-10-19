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

module.exports = {
    searchPlatformAdmins,
    countPlatformAdmins
};