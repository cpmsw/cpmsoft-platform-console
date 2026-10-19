const service =
    require("./platform-admins.service");


module.exports =
    async function (fastify) {


        // ---------------------------------
        // SEARCH PLATFORM ADMINS
        // ---------------------------------
        fastify.get(
            "/",
            {
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
        // GET PLATFORM ADMIN
        // ---------------------------------
        fastify.get(
            "/:id",
            {
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
                                request.body
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
                                "PLATFORM_ADMIN_REACTIVATE_FAILED",

                            error:
                                error.message
                        });
                }
            }
        );
    };