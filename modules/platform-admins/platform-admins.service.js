const crypto =
    require("crypto");

const authDb =
    require("../../db/authDb");

const {
    sendEmail
} =
    require(
        "../../../cpmsoft-core/common/services/emailService"
    );

const {
    buildPlatformAdminActivationEmail
} =
    require(
        "./platform-admin-activation-email"
    );

// ---------------------------------
// CREATE PLATFORM ADMIN
// ---------------------------------
async function createPlatformAdmin({
    display_name,
    email,
    screens = []
}) {
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


    if (!Array.isArray(screens)) {

        const error =
            new Error(
                "Screen access is invalid."
            );

        error.statusCode = 400;
        error.code =
            "PLATFORM_ADMIN_SCREENS_INVALID";

        throw error;
    }


    const allowedAccessLevels =
        new Set([
            "NONE",
            "READ",
            "WRITE"
        ]);


    for (const screen of screens) {

        if (
            !screen?.screen_id ||
            !allowedAccessLevels.has(
                screen.access_level
            )
        ) {

            const error =
                new Error(
                    "One or more screen access assignments are invalid."
                );

            error.statusCode = 400;
            error.code =
                "PLATFORM_ADMIN_SCREEN_ACCESS_INVALID";

            throw error;
        }
    }


    const screenIds =
        screens.map(
            screen => screen.screen_id
        );


    if (
        new Set(screenIds).size !==
        screenIds.length
    ) {

        const error =
            new Error(
                "Duplicate screen access assignments are not allowed."
            );

        error.statusCode = 400;
        error.code =
            "PLATFORM_ADMIN_SCREEN_DUPLICATE";

        throw error;
    }


    // Create the same 30-day invitation
    // credential used by CPMSOFT Users.
    const invitationToken =
        crypto
            .randomBytes(32)
            .toString("hex");


    const invitationTokenHash =
        crypto
            .createHash("sha256")
            .update(invitationToken)
            .digest("hex");


    const invitationExpires =
        new Date(
            Date.now() +
            30 * 24 * 60 * 60 * 1000
        );


    const client =
        await authDb.connect();


    try {

        await client.query(
            "BEGIN"
        );


        // Validate every submitted screen against
        // the active Platform screen registry.
        if (screenIds.length > 0) {

            const registeredResult =
                await client.query(
                    `SELECT id
                     FROM platform_screens
                     WHERE is_active = true
                       AND id = ANY($1::uuid[])`,
                    [
                        screenIds
                    ]
                );


            if (
                registeredResult.rows.length !==
                screenIds.length
            ) {

                const error =
                    new Error(
                        "One or more Platform screens are invalid."
                    );

                error.statusCode = 400;
                error.code =
                    "PLATFORM_SCREEN_INVALID";

                throw error;
            }
        }


        const adminResult =
            await client.query(
                `INSERT INTO platform_admins (
                    email,
                    display_name,
                    password_hash,
                    twofa_enabled,
                    is_active,
                    is_verified,
                    verified_at,
                    verification_code,
                    verification_expires,
                    activation_invitation_token_hash,
                    activation_invitation_expires_at,
                    activation_invitation_sent_at,
                    created_at,
                    updated_at
                 )
                VALUES (
                    $1,
                    $2,
                    NULL,
                    false,
                    true,
                    false,
                    NULL,
                    NULL,
                    NULL,
                    $3,
                    $4,
                    NULL,
                    NOW(),
                    NOW()
                )
                 RETURNING
                    id,
                    display_name,
                    email,
                    is_active,
                    is_verified,
                    twofa_enabled,
                    created_at,
                    updated_at`,
                [
                    normalizedEmail,
                    normalizedDisplayName,
                    invitationTokenHash,
                    invitationExpires
                ]
            );


        const admin =
            adminResult.rows[0];


        // NONE is represented by no row.
        for (const screen of screens) {

            if (
                screen.access_level ===
                "NONE"
            ) {
                continue;
            }


            await client.query(
                `INSERT INTO platform_admin_screen_access (
                    admin_id,
                    screen_id,
                    access_level
                 )
                 VALUES ($1, $2, $3)`,
                [
                    admin.id,
                    screen.screen_id,
                    screen.access_level
                ]
            );
        }


        await client.query(
            "COMMIT"
        );


        // ---------------------------------
        // SEND ACTIVATION INVITATION
        // ---------------------------------
        //
        // The Platform Admin and screen access
        // have already been committed.
        //
        // An email failure must NOT roll back
        // the successfully created account.
        let invitationSent = false;
        let invitationWarning = null;


        try {

            const email =
                buildPlatformAdminActivationEmail({
                    displayName:
                        admin.display_name,

                    invitationToken,

                    invitationExpires
                });

            await sendEmail({
                to:
                    admin.email,

                subject:
                    email.subject,

                text:
                    email.text,

                html:
                    email.html
            });


            await authDb.query(
                `UPDATE platform_admins
                 SET
                    activation_invitation_sent_at =
                        NOW(),
                    updated_at =
                        NOW()
                 WHERE id = $1`,
                [
                    admin.id
                ]
            );


            invitationSent = true;


        } catch (emailError) {

            console.error(
                "Platform Admin activation invitation email failed:",
                emailError
            );


            invitationWarning =
                "Platform Admin was created, but the activation invitation email could not be sent.";
        }


        return {
            admin,
            invitationSent,
            invitationWarning,
            invitationExpires
        };

    } catch (error) {

        try {

            await client.query(
                "ROLLBACK"
            );

        } catch (_) {

            // Preserve original error.
        }


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


    } finally {

        client.release();
    }
}

async function resendPlatformAdminActivation(
    adminId
) {

    const admin =
        await getPlatformAdmin(
            adminId
        );


    if (!admin) {

        const error =
            new Error(
                "Platform Admin not found."
            );

        error.statusCode = 404;
        error.code =
            "PLATFORM_ADMIN_NOT_FOUND";

        throw error;
    }


    if (!admin.is_active) {

        const error =
            new Error(
                "Activation invitation cannot be sent to an inactive Platform Admin."
            );

        error.statusCode = 409;
        error.code =
            "PLATFORM_ADMIN_INACTIVE";

        throw error;
    }


    if (admin.is_verified) {

        const error =
            new Error(
                "This Platform Admin has already activated the account."
            );

        error.statusCode = 409;
        error.code =
            "PLATFORM_ADMIN_ALREADY_ACTIVATED";

        throw error;
    }


    const invitationToken =
        crypto
            .randomBytes(32)
            .toString("hex");


    const invitationTokenHash =
        crypto
            .createHash("sha256")
            .update(invitationToken)
            .digest("hex");


    const invitationExpires =
        new Date(
            Date.now() +
            30 * 24 * 60 * 60 * 1000
        );


    await authDb.query(
        `UPDATE platform_admins
         SET
             activation_invitation_token_hash = $2,
             activation_invitation_expires_at = $3,
             activation_invitation_sent_at = NULL,
             verification_code = NULL,
             verification_expires = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [
            adminId,
            invitationTokenHash,
            invitationExpires
        ]
    );


    const email =
        buildPlatformAdminActivationEmail({
            displayName:
                admin.display_name,

            invitationToken,

            invitationExpires
        });

    try {

        await sendEmail({
            to:
                admin.email,

            subject:
                email.subject,

            text:
                email.text,

            html:
                email.html
        });


        await authDb.query(
            `UPDATE platform_admins
             SET
                 activation_invitation_sent_at =
                     NOW(),
                 updated_at =
                     NOW()
             WHERE id = $1`,
            [
                adminId
            ]
        );


    } catch (emailError) {

        console.error(
            "Platform Admin activation invitation resend failed:",
            emailError
        );


        const error =
            new Error(
                "Unable to send the activation invitation email."
            );

        error.statusCode = 502;
        error.code =
            "PLATFORM_ADMIN_INVITATION_SEND_FAILED";

        throw error;
    }


    return {
        success: true,
        invitationSent: true,
        invitationExpiresAt:
            invitationExpires
    };
}

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
                is_verified,
                twofa_enabled,
                activation_invitation_sent_at,
                activation_invitation_expires_at,
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

// ---------------------------------
// GET PLATFORM ADMIN SCREEN ACCESS
// ---------------------------------
async function getPlatformAdminScreenAccess(
    adminId
) {

    const result =
        await authDb.query(
            `SELECT
               s.id AS screen_id,
               s.code,
               s.area,
               s.name,
               s.sort_order,
               COALESCE(
                   a.access_level,
                   'NONE'
               ) AS access_level
             FROM platform_screens s
             LEFT JOIN platform_admin_screen_access a
               ON a.screen_id = s.id
              AND a.admin_id = $1
             WHERE s.is_active = true
             ORDER BY
               CASE s.area
                   WHEN 'CPMSOFT' THEN 10
                   WHEN 'Tenants' THEN 20
                   ELSE 100
               END,
               s.area,
               s.sort_order,
               s.name`,
            [
                adminId
            ]
        );


    return result.rows;
}

// ---------------------------------
// GET PLATFORM SCREENS
// ---------------------------------
async function getPlatformScreens() {

    const result =
        await authDb.query(
            `SELECT
               id AS screen_id,
               code,
               area,
               name,
               sort_order
             FROM platform_screens
             WHERE is_active = true
             ORDER BY
               CASE area
                   WHEN 'CPMSOFT' THEN 10
                   WHEN 'Tenants' THEN 20
                   ELSE 100
               END,
               area,
               sort_order,
               name`
        );


    return result.rows;
}

// ---------------------------------
// UPDATE PLATFORM ADMIN SCREEN ACCESS
// ---------------------------------
async function updatePlatformAdminScreenAccess(
    adminId,
    screens
) {

    const client =
        await authDb.connect();


    try {

        await client.query(
            "BEGIN"
        );


        // Lock Platform Admin rows so two
        // simultaneous security changes cannot
        // both remove the final recovery admin.
        await client.query(
            `SELECT id
             FROM platform_admins
             FOR UPDATE`
        );


        const adminResult =
            await client.query(
                `SELECT
                   id,
                   display_name,
                   email,
                   is_active
                 FROM platform_admins
                 WHERE id = $1`,
                [
                    adminId
                ]
            );


        const admin =
            adminResult.rows[0];


        if (!admin) {

            const error =
                new Error(
                    "Platform Admin not found."
                );

            error.statusCode = 404;
            error.code =
                "PLATFORM_ADMIN_NOT_FOUND";

            throw error;
        }


        // Validate that every submitted screen
        // is an active registered screen.
        const screenIds =
            screens.map(
                item => item.screen_id
            );


        const registeredResult =
            await client.query(
                `SELECT id
                 FROM platform_screens
                 WHERE is_active = true
                   AND id = ANY($1::uuid[])`,
                [
                    screenIds
                ]
            );


        if (
            registeredResult.rows.length !==
            screenIds.length
        ) {

            const error =
                new Error(
                    "One or more Platform screens are invalid."
                );

            error.statusCode = 400;
            error.code =
                "PLATFORM_SCREEN_INVALID";

            throw error;
        }


        // Replace the target admin's assignments.
        await client.query(
            `DELETE FROM platform_admin_screen_access
             WHERE admin_id = $1`,
            [
                adminId
            ]
        );


        for (const screen of screens) {

            // NONE is represented by no row.
            if (
                screen.access_level ===
                "NONE"
            ) {
                continue;
            }


            await client.query(
                `INSERT INTO platform_admin_screen_access (
                    admin_id,
                    screen_id,
                    access_level
                 )
                 VALUES ($1, $2, $3)`,
                [
                    adminId,
                    screen.screen_id,
                    screen.access_level
                ]
            );
        }


        // There must always be at least one
        // ACTIVE admin with WRITE access to
        // Platform Admins.
        const recoveryResult =
            await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM platform_admins pa
                 INNER JOIN platform_admin_screen_access psa
                   ON psa.admin_id = pa.id
                 INNER JOIN platform_screens ps
                   ON ps.id = psa.screen_id
                 WHERE pa.is_active = true
                   AND pa.is_verified = true
                   AND ps.is_active = true
                   AND ps.code =
                       'cpmsoft.platform-admins'
                   AND psa.access_level =
                       'WRITE'`
            );


        const recoveryCount =
            recoveryResult.rows[0]?.count || 0;


        if (recoveryCount < 1) {

            const error =
                new Error(
                    "This change would leave no active Platform Admin with administrative access."
                );

            error.statusCode = 409;
            error.code =
                "LAST_PLATFORM_ADMIN_LOCKOUT";

            throw error;
        }


        await client.query(
            "COMMIT"
        );


        return await getPlatformAdminScreenAccess(
            adminId
        );


    } catch (error) {

        await client.query(
            "ROLLBACK"
        );

        throw error;


    } finally {

        client.release();
    }
}

module.exports = {
    createPlatformAdmin,
    resendPlatformAdminActivation,
    searchPlatformAdmins,
    countPlatformAdmins,
    getPlatformAdmin,
    updatePlatformAdmin,
    deactivatePlatformAdmin,
    reactivatePlatformAdmin,
    getPlatformScreens,
    getPlatformAdminScreenAccess,
    updatePlatformAdminScreenAccess
};