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

    };