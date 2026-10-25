const service =
    require("./platform-admins.service");

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
        // CREATE PLATFORM ADMIN
        // ---------------------------------
        fastify.post(
            "/",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "WRITE"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Create Platform administrator",

                    body: {
                        type: "object",

                        required: [
                            "display_name",
                            "email",
                            "screens"
                        ],

                        additionalProperties:
                            false,

                        properties: {

                            display_name: {
                                type: "string",
                                minLength: 1,
                                maxLength: 150
                            },

                            email: {
                                type: "string",
                                format: "email",
                                maxLength: 150
                            },


                            screens: {
                                type: "array",

                                items: {
                                    type: "object",

                                    required: [
                                        "screen_id",
                                        "access_level"
                                    ],

                                    additionalProperties:
                                        false,

                                    properties: {

                                        screen_id: {
                                            type: "string",
                                            format: "uuid"
                                        },

                                        access_level: {
                                            type: "string",
                                            enum: [
                                                "NONE",
                                                "READ",
                                                "WRITE"
                                            ]
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

                    const result =
                        await service
                            .createPlatformAdmin(
                                request.body,
                                request.user.adminId
                            );

                    return reply
                        .code(201)
                        .send({
                            success: true,

                            admin:
                                result.admin,

                            invitationSent:
                                result.invitationSent,

                            invitationWarning:
                                result.invitationWarning,

                            invitationExpiresAt:
                                result.invitationExpires
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
                                "PLATFORM_ADMIN_CREATE_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // SEARCH PLATFORM ADMINS
        // ---------------------------------
        fastify.get(
            "/",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "READ"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Search Platform administrators",

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
                        .searchPlatformAdmins({
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
                                "PLATFORM_ADMIN_SEARCH_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );


        // ---------------------------------
        // COUNT PLATFORM ADMINS
        // ---------------------------------
        fastify.get(
            "/count",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "READ"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Count Platform administrators",

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
                            .countPlatformAdmins({
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
                                "PLATFORM_ADMIN_COUNT_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // GET PLATFORM SCREENS
        // ---------------------------------
        fastify.get(
            "/security/screens",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "READ"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Get registered Platform screens"
                }
            },

            async (request, reply) => {

                try {

                    const screens =
                        await service
                            .getPlatformScreens();


                    return {
                        screens
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
                                "PLATFORM_SCREEN_LOAD_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // GET PLATFORM ADMIN SECURITY
        // ---------------------------------
        fastify.get(
            "/:id/security",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "READ"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Get Platform administrator screen access",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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

                    const admin =
                        await service
                            .getPlatformAdmin(
                                request.params.id
                            );


                    if (!admin) {

                        return reply
                            .code(404)
                            .send({
                                code:
                                    "PLATFORM_ADMIN_NOT_FOUND",

                                error:
                                    "Platform Admin not found."
                            });
                    }


                    const screens =
                        await service
                            .getPlatformAdminScreenAccess(
                                request.params.id
                            );


                    return {
                        admin: {
                            id:
                                admin.id,

                            display_name:
                                admin.display_name,

                            email:
                                admin.email,

                            is_active:
                                admin.is_active
                        },

                        screens
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
                                "PLATFORM_ADMIN_SECURITY_LOAD_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // UPDATE PLATFORM ADMIN SECURITY
        // ---------------------------------
        fastify.put(
            "/:id/security",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "WRITE"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Update Platform administrator screen access",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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
                            "screens"
                        ],

                        additionalProperties:
                            false,

                        properties: {

                            screens: {
                                type: "array",

                                items: {
                                    type: "object",

                                    required: [
                                        "screen_id",
                                        "access_level"
                                    ],

                                    additionalProperties:
                                        false,

                                    properties: {

                                        screen_id: {
                                            type: "string",
                                            format: "uuid"
                                        },

                                        access_level: {
                                            type: "string",
                                            enum: [
                                                "NONE",
                                                "READ",
                                                "WRITE"
                                            ]
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

                    const screens =
                        await service
                            .updatePlatformAdminScreenAccess(
                                request.params.id,
                                request.body.screens,
                                request.user.adminId
                            );

                    return {
                        success: true,
                        screens
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
                                "PLATFORM_ADMIN_SECURITY_UPDATE_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );


        // ---------------------------------
        // RESEND ACTIVATION INVITATION
        // ---------------------------------
        fastify.post(
            "/:id/resend-activation",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "WRITE"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Resend Platform administrator activation invitation",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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

                    const result =
                        await service
                            .resendPlatformAdminActivation(
                                request.params.id
                            );


                    return result;


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
                                "PLATFORM_ADMIN_INVITATION_RESEND_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // GET PLATFORM ADMIN HISTORY
        // ---------------------------------
        fastify.get(
            "/:id/history",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "READ"
                    ),

                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Get Platform administrator history",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

                        properties: {
                            id: {
                                type: "string",
                                format: "uuid"
                            }
                        }
                    },

                    querystring: {
                        type: "object",

                        additionalProperties:
                            false,

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
                                minimum: 1
                            },

                            pageSize: {
                                type: "integer",
                                minimum: 1,
                                maximum: 100
                            }
                        }
                    }
                }
            },

            async (request, reply) => {

                try {

                    const result =
                        await audit
                            .getPlatformAdminHistory(
                                request.params.id,
                                request.query
                            );


                    return result;


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
                                "PLATFORM_ADMIN_HISTORY_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // GET PLATFORM ADMIN
        // ---------------------------------
        fastify.get(
            "/:id",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "READ"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Get Platform administrator",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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

                    const admin =
                        await service
                            .getPlatformAdmin(
                                request.params.id
                            );


                    if (!admin) {

                        return reply
                            .code(404)
                            .send({
                                code:
                                    "PLATFORM_ADMIN_NOT_FOUND",

                                error:
                                    "Platform Admin not found."
                            });
                    }


                    return admin;


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
                                "PLATFORM_ADMIN_LOAD_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // UPDATE PLATFORM ADMIN
        // ---------------------------------
        fastify.put(
            "/:id",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "WRITE"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Update Platform administrator",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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
                            "display_name",
                            "email"
                        ],

                        additionalProperties:
                            false,

                        properties: {
                            display_name: {
                                type: "string",
                                minLength: 1,
                                maxLength: 200
                            },

                            email: {
                                type: "string",
                                format: "email",
                                maxLength: 320
                            }
                        }
                    }
                }
            },

            async (request, reply) => {

                try {

                    const admin =
                        await service
                            .updatePlatformAdmin(
                                request.params.id,
                                request.body,
                                request.user.adminId
                            );

                    if (!admin) {

                        return reply
                            .code(404)
                            .send({
                                code:
                                    "PLATFORM_ADMIN_NOT_FOUND",

                                error:
                                    "Platform Admin not found."
                            });
                    }


                    return admin;


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
                                "PLATFORM_ADMIN_UPDATE_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );

        // ---------------------------------
        // DEACTIVATE PLATFORM ADMIN
        // ---------------------------------
        fastify.delete(
            "/:id",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "WRITE"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Deactivate Platform administrator",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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

                    // A Platform Admin must never be
                    // allowed to deactivate their own
                    // account.
                    if (
                        request.user?.adminId ===
                        request.params.id
                    ) {

                        return reply
                            .code(409)
                            .send({
                                code:
                                    "PLATFORM_ADMIN_SELF_DEACTIVATE",

                                error:
                                    "You cannot deactivate your own Platform Admin account."
                            });
                    }


                    const admin =
                        await service
                            .deactivatePlatformAdmin(
                                request.params.id,
                                request.user.adminId
                            );

                    if (!admin) {

                        return reply
                            .code(404)
                            .send({
                                code:
                                    "PLATFORM_ADMIN_NOT_FOUND",

                                error:
                                    "Platform Admin not found."
                            });
                    }


                    return admin;


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
                                "PLATFORM_ADMIN_DEACTIVATE_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );
        // ---------------------------------
        // REACTIVATE PLATFORM ADMIN
        // ---------------------------------
        fastify.put(
            "/:id/reactivate",
            {
                preHandler:
                    requireScreenAccess(
                        "cpmsoft.platform-admins",
                        "WRITE"
                    ),
                schema: {
                    tags: [
                        "Platform Admins"
                    ],

                    summary:
                        "Reactivate Platform administrator",

                    params: {
                        type: "object",

                        required: [
                            "id"
                        ],

                        additionalProperties:
                            false,

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

                    const admin =
                        await service
                            .reactivatePlatformAdmin(
                                request.params.id,
                                request.user.adminId
                            );


                    if (!admin) {

                        return reply
                            .code(404)
                            .send({
                                code:
                                    "PLATFORM_ADMIN_NOT_FOUND",

                                error:
                                    "Platform Admin not found."
                            });
                    }


                    return admin;


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
                                "PLATFORM_ADMIN_REACTIVATE_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );
    };