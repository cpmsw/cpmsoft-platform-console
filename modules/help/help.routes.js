const fs =
  require("fs");

const fsPromises =
  require("fs/promises");

const os =
  require("os");

const path =
  require("path");

const crypto =
  require("crypto");

const {
  pipeline
} =
  require("stream/promises");

const service =
  require("./help.service");

module.exports = async function (fastify) {


  // ---------------------------------
  // GET HELP TOPICS
  // ---------------------------------
  fastify.get(
    "/topics",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get Help topics",

        description:
          "Returns active CPMSOFT Help topics available for SYSTEM Help authoring."
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getTopics();

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_TOPICS_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET HELP KEYS
  // ---------------------------------
  fastify.get(
    "/keys",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get registered Help keys",

        description:
          "Returns registered application Help contexts used by contextual F1 Help.",

        querystring: {
          type: "object",

          properties: {
            topicId: {
              type: "string",
              format: "uuid"
            }
          }
        }
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getKeys({
            topicId:
              request.query.topicId
          });

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_KEYS_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET SYSTEM HELP CONTENT
  // ---------------------------------
  fastify.get(
    "/content",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get SYSTEM Help content",

        description:
          "Returns SYSTEM Help content available for Platform Console Help administration."
      }
    },
    async (request, reply) => {

      try {

        return await service
          .getSystemContent();

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // GET SYSTEM HELP CONTENT BY ID
  // ---------------------------------
  fastify.get(
    "/content/:id",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Get SYSTEM Help content by ID",

        params: {
          type: "object",
          required: ["id"],

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

        return await service
          .getSystemContentById(
            request.params.id
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET PUBLISHED SYSTEM HELP BY KEY
  // ---------------------------------
  fastify.get(
    "/published",
    {
      schema: {
        tags: ["Help"],

        summary:
          "Get published SYSTEM Help by Help key",

        description:
          "Returns the currently published SYSTEM contextual Help article for a registered Help key.",

        querystring: {
          type: "object",

          required: [
            "helpKey"
          ],

          properties: {

            helpKey: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .getPublishedSystemContentByKey(
            request.query.helpKey
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET HELP NAVIGATION BY HELP KEY
  // ---------------------------------
  fastify.get(
    "/navigation",
    {
      schema: {
        tags: ["Help"],

        summary:
          "Get Help navigation by Help key",

        description:
          "Returns the active Help topic and registered Help keys for contextual Help navigation.",

        querystring: {
          type: "object",

          required: [
            "helpKey"
          ],

          properties: {

            helpKey: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .getHelpNavigationByKey(
            request.query.helpKey
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_NAVIGATION_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // GET RELATED HELP BY HELP KEY
  // ---------------------------------
  fastify.get(
    "/related",
    {
      schema: {
        tags: ["Help"],

        summary:
          "Get related Help by Help key",

        description:
          "Returns published related Help, Concepts, and Guides for the selected contextual Help article.",

        querystring: {
          type: "object",

          required: [
            "helpKey"
          ],

          properties: {

            helpKey: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .getRelatedHelpByKey(
            request.query.helpKey
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_RELATED_LOAD_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // CREATE SYSTEM HELP DRAFT
  // ---------------------------------
  fastify.post(
    "/content",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Create SYSTEM Help draft",

        body: {
          type: "object",

          required: [
            "contentType",
            "title"
          ],

          additionalProperties: false,

          properties: {

            contentType: {
              type: "string",
              enum: [
                "CONTEXT",
                "CONCEPT",
                "GUIDE"
              ]
            },

            topicId: {
              type: ["string", "null"],
              format: "uuid"
            },

            helpKeyId: {
              type: ["string", "null"],
              format: "uuid"
            },

            title: {
              type: "string",
              minLength: 1,
              maxLength: 250
            },

            summary: {
              type: ["string", "null"]
            },

            contentJson: {
              type: ["object", "null"],
              additionalProperties: true
            },

            contentHtml: {
              type: ["string", "null"]
            },

            keywords: {
              type: ["string", "null"]
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        const content =
          await service
            .createSystemContent(
              request.body,
              request.user.adminId
            );

        return reply
          .code(201)
          .send(content);

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_CREATE_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // CREATE DRAFT FROM PUBLISHED HELP
  // ---------------------------------
  fastify.post(
    "/content/:id/draft",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Create SYSTEM Help draft from published content",

        description:
          "Creates a working draft from published SYSTEM Help while leaving the published content unchanged.",

        params: {
          type: "object",
          required: ["id"],

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

        const content =
          await service
            .createDraftFromPublished(
              request.params.id,
              request.user.adminId
            );

        return reply
          .code(201)
          .send(content);

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_DRAFT_CREATE_FAILED",

            error:
              error.message
          });
      }
    }
  );

  // ---------------------------------
  // UPDATE SYSTEM HELP DRAFT
  // ---------------------------------
  fastify.put(
    "/content/:id",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Update SYSTEM Help content",

        params: {
          type: "object",
          required: ["id"],

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
            "contentType",
            "title"
          ],

          additionalProperties: false,

          properties: {

            contentType: {
              type: "string",
              enum: [
                "CONTEXT",
                "CONCEPT",
                "GUIDE"
              ]
            },

            topicId: {
              type: ["string", "null"],
              format: "uuid"
            },

            helpKeyId: {
              type: ["string", "null"],
              format: "uuid"
            },

            title: {
              type: "string",
              minLength: 1,
              maxLength: 250
            },

            summary: {
              type: ["string", "null"]
            },

            contentJson: {
              type: ["object", "null"],
              additionalProperties: true
            },

            contentHtml: {
              type: ["string", "null"]
            },

            keywords: {
              type: ["string", "null"]
            }
          }
        }
      }
    },

    async (request, reply) => {

      try {

        return await service
          .updateSystemContent(
            request.params.id,
            request.body,
            request.user.adminId
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_UPDATE_FAILED",

            error:
              error.message
          });
      }
    }
  );


  // ---------------------------------
  // PUBLISH SYSTEM HELP CONTENT
  // ---------------------------------
  fastify.post(
    "/content/:id/publish",
    {
      schema: {
        tags: ["Help"],
        summary:
          "Publish SYSTEM Help content",

        params: {
          type: "object",
          required: ["id"],

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

        return await service
          .publishSystemContent(
            request.params.id,
            request.user.adminId
          );

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_CONTENT_PUBLISH_FAILED",

            error:
              error.message
          });
      }
    }
  );

    // ==================================================
  // UPLOAD SYSTEM HELP IMAGE
  // ==================================================
  fastify.post(
    "/media/:articleId/image",
    {
      schema: {
        tags: ["Help"],

        summary:
          "Upload SYSTEM Help image",

        consumes: [
          "multipart/form-data"
        ],

        params: {
          type: "object",

          required: [
            "articleId"
          ],

          properties: {

            articleId: {
              type: "string",
              format: "uuid"
            }
          },

          additionalProperties:
            false
        }
      },

      config: {
        swaggerTransform: ({
          schema
        }) => {

          return {
            schema: {
              ...schema,

              body: {
                type: "object",

                required: [
                  "file"
                ],

                properties: {

                  file: {
                    type: "string",
                    format: "binary"
                  },

                  altText: {
                    type: "string"
                  },

                  caption: {
                    type: "string"
                  }
                }
              }
            }
          };
        }
      }
    },

    async (request, reply) => {

      if (
        !request.isMultipart()
      ) {

        return reply
          .code(400)
          .send({
            code:
              "HELP_MEDIA_MULTIPART_REQUIRED",

            error:
              "Multipart form data is required."
          });
      }


      const tempDirectory =
        await fsPromises.mkdtemp(
          path.join(
            os.tmpdir(),
            "cpmsoft-help-media-"
          )
        );


      try {

        let stagedFile =
          null;

        let altText =
          null;

        let caption =
          null;


        const parts =
          request.parts({
            limits: {
              files: 1,

              fileSize:
                25 * 1024 * 1024
            }
          });


        for await (
          const part of parts
        ) {

          if (
            part.type === "field"
          ) {

            if (
              part.fieldname ===
              "altText"
            ) {

              altText =
                String(
                  part.value || ""
                ).trim() ||
                null;

            } else if (
              part.fieldname ===
              "caption"
            ) {

              caption =
                String(
                  part.value || ""
                ).trim() ||
                null;
            }


            continue;
          }


          if (stagedFile) {

            const error =
              new Error(
                "Only one Help image may be uploaded at a time."
              );

            error.statusCode = 400;
            error.code =
              "HELP_MEDIA_TOO_MANY_FILES";

            throw error;
          }


          const tempFilename =
            crypto.randomUUID();


          const tempPath =
            path.join(
              tempDirectory,
              tempFilename
            );


          await pipeline(
            part.file,

            fs.createWriteStream(
              tempPath
            )
          );


          if (
            part.file.truncated
          ) {

            const error =
              new Error(
                "Help image exceeds the maximum allowed size."
              );

            error.statusCode = 413;
            error.code =
              "HELP_IMAGE_TOO_LARGE";

            throw error;
          }


          const stats =
            await fsPromises.stat(
              tempPath
            );


          stagedFile = {
            tempPath,

            originalFilename:
              part.filename,

            contentType:
              part.mimetype ||
              "application/octet-stream",

            fileSizeBytes:
              stats.size
          };
        }


        if (!stagedFile) {

          const error =
            new Error(
              "A Help image file is required."
            );

          error.statusCode = 400;
          error.code =
            "HELP_IMAGE_REQUIRED";

          throw error;
        }


        const created =
          await service
            .createSystemHelpImage(
              request.params.articleId,
              request.user.adminId,
              {
                originalFilename:
                  stagedFile
                    .originalFilename,

                contentType:
                  stagedFile
                    .contentType,

                fileSizeBytes:
                  stagedFile
                    .fileSizeBytes,

                altText,

                caption,

                source:
                  fs.createReadStream(
                    stagedFile.tempPath
                  )
              }
            );


        return reply
          .code(201)
          .send(created);

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_IMAGE_UPLOAD_FAILED",

            error:
              error.message
          });

      } finally {

        await fsPromises.rm(
          tempDirectory,
          {
            recursive: true,
            force: true
          }
        );
      }
    }
  );

  // ==================================================
  // OPEN SYSTEM HELP MEDIA
  // ==================================================
  fastify.get(
    "/media/:mediaId/open",
    {
      schema: {
        tags: ["Help"],

        summary:
          "Open SYSTEM Help media",

        params: {
          type: "object",

          required: [
            "mediaId"
          ],

          properties: {

            mediaId: {
              type: "string",
              format: "uuid"
            }
          },

          additionalProperties:
            false
        }
      }
    },

    async (request, reply) => {

      try {

        const opened =
          await service
            .openSystemHelpMedia(
              request.params.mediaId
            );


        const media =
          opened.media;

        const result =
          opened.result;


        if (
          result.type ===
          "redirect"
        ) {

          return {
            type:
              "redirect",

            url:
              result.url
          };
        }


        if (
          result.type ===
          "stream"
        ) {

          reply.header(
            "Content-Type",
            media.content_type ||
            "application/octet-stream"
          );


          reply.header(
            "Content-Disposition",
            `inline; filename*=UTF-8''${encodeURIComponent(
              media.original_filename
            )}`
          );


          return reply.send(
            result.stream
          );
        }


        const error =
          new Error(
            "Unsupported Help media open result."
          );

        error.statusCode = 500;
        error.code =
          "HELP_MEDIA_OPEN_RESULT_INVALID";

        throw error;

      } catch (error) {

        request.log.error(error);

        return reply
          .code(
            error.statusCode || 500
          )
          .send({
            code:
              error.code ||
              "HELP_MEDIA_OPEN_FAILED",

            error:
              error.message
          });
      }
    }
  );

};