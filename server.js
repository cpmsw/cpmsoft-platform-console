const fastify = require("fastify")({ logger: true });
const cors = require("@fastify/cors");
const swagger = require("@fastify/swagger");
const swaggerUi = require("@fastify/swagger-ui");
const path = require("path");
const AutoLoad = require("@fastify/autoload");
const cookie = require("@fastify/cookie");
const jwt = require("@fastify/jwt");

// ---------------------------------
// CORS
// ---------------------------------
fastify.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      "http://localhost:4100",
      "http://127.0.0.1:4100",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://192.168.1.67:5173",
      "https://console.cpmsoft.app"
    ];

    if (!origin || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type"
  ]
});

fastify.register(cookie);

fastify.register(jwt, {
  secret: process.env.PLATFORM_JWT_SECRET,

  cookie: {
    cookieName: "cpmsoft_platform",
    signed: false
  },

  sign: {
    expiresIn: "8h"
  }
});


// ---------------------------------
// PLATFORM ADMIN AUTH GUARD
// ---------------------------------
fastify.addHook(
  "onRequest",
  async (request, reply) => {

    const url =
      request.raw.url || "";

    // Authentication endpoints must remain public.
    if (
      url.startsWith(
        "/api/platform/auth/"
      )
    ) {
      return;
    }

    // Only protect Platform API routes.
    if (
      !url.startsWith(
        "/api/platform/"
      )
    ) {
      return;
    }

    try {

      await request.jwtVerify();

      if (
        request.user?.stage !==
        "authenticated" ||
        request.user?.role !==
        "platform_admin"
      ) {

        return reply
          .code(401)
          .send({
            code:
              "PLATFORM_AUTH_REQUIRED",

            error:
              "Platform administrator authentication is required."
          });
      }

    } catch (error) {

      return reply
        .code(401)
        .send({
          code:
            "PLATFORM_AUTH_REQUIRED",

          error:
            "Platform administrator authentication is required."
        });
    }
  }
);

// ---------------------------------
// SWAGGER / OPENAPI
// ---------------------------------
fastify.register(swagger, {
  openapi: {
    info: {
      title: "CPMSOFT Platform Console API",
      description:
        "Private CPMSOFT platform administration API",
      version: "1.0.0"
    },

    servers: [
      {
        url: "https://console.cpmsoft.app",
        description: "CPMSOFT Platform Console"
      }
    ],

    tags: [
      {
        name: "System",
        description: "Platform Console status"
      },
      {
        name: "Tenants",
        description: "Tenant administration"
      },
      {
        name: "Resources",
        description:
          "CPMSOFT resource catalog and tenant entitlements"
      },
      {
        name: "Packages",
        description: "CPMSOFT commercial package catalog"
      },
      {
        name: "Authentication",
        description:
          "Platform administrator authentication"
      },
    ]
  }
});


// ---------------------------------
// SWAGGER UI
// ---------------------------------
fastify.register(swaggerUi, {
  routePrefix: "/api/docs",

  uiConfig: {
    docExpansion: "list",
    deepLinking: true
  },

  staticCSP: true
});


// ---------------------------------
// BASIC STATUS ENDPOINT
// ---------------------------------
fastify.get("/", {
  schema: {
    tags: ["System"],
    summary: "Platform Console status",

    response: {
      200: {
        type: "object",

        properties: {
          status: {
            type: "string"
          },

          application: {
            type: "string"
          }
        }
      }
    }
  }
}, async () => {
  return {
    status: "ok",
    application: "CPMSOFT Platform Console"
  };
});




// ---------------------------------
// LOAD BUSINESS MODULES
// ---------------------------------
fastify.register(AutoLoad, {
  dir: path.join(__dirname, "modules"),

  options: {
    prefix: "/api/platform"
  }
});


// ---------------------------------
// START SERVER
// ---------------------------------
const start = async () => {
  const requiredEnv = [
    "DB_PASSWORD"
  ];

  const missing = requiredEnv.filter(
    variableName =>
      !process.env[variableName]
  );

  if (missing.length) {
    fastify.log.error(
      `Missing environment variables: ${missing.join(", ")}`
    );

    process.exit(1);
  }

  const host =
    process.env.HOST ||
    "127.0.0.1";

  const port =
    Number(
      process.env.PORT ||
      4100
    );

  try {
    await fastify.listen({
      host,
      port
    });

    fastify.log.info(
      `CPMSOFT Platform Console running on http://${host}:${port}`
    );

  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};


start();
