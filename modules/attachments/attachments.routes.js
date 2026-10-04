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
  require("cpmsoft-core/attachments");

const folderService =
  require(
    "cpmsoft-core/attachments/attachmentFolders.service"
  );

const attachmentMaxFiles =
  Number(
    process.env.ATTACHMENT_MAX_FILES_PER_UPLOAD ||
    20
  );

const attachmentMaxFileSizeMb =
  Number(
    process.env.ATTACHMENT_MAX_FILE_SIZE_MB ||
    100
  );

const attachmentMaxFileSizeBytes =
  attachmentMaxFileSizeMb *
  1024 *
  1024;

function toPublicAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    parent_type: attachment.parent_type,
    parent_id: attachment.parent_id,
    folder_id: attachment.folder_id,
    category: attachment.category,
    original_filename: attachment.original_filename,
    content_type: attachment.content_type,
    file_size_bytes: attachment.file_size_bytes,
    created_by: attachment.created_by,
    created_at: attachment.created_at,
    updated_by: attachment.updated_by,
    updated_at: attachment.updated_at
  };
}

module.exports =
  async function (fastify) {


    // ==================================================
    // GET ATTACHMENTS FOR PARENT
    // ==================================================

    fastify.get(
      "/:parentType/:parentId",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Get attachments for a parent record",

          params: {
            type: "object",

            required: [
              "parentType",
              "parentId"
            ],

            properties: {

              parentType: {
                type: "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type: "string",
                format: "uuid"
              }
            },

            additionalProperties:
              false
          }
        }
      },

      async (request) => {

        const tenantId =
          request.params.parentId;


        const {
          parentType,
          parentId
        } =
          request.params;


        const attachments =
          await service.getAttachments(
            tenantId,
            parentType,
            parentId
          );

        return attachments.map(toPublicAttachment);
      }
    );

    // ---------------------------------
    // GET PARENT STORAGE SUMMARY
    // ---------------------------------

    fastify.get(
      "/:parentType/:parentId/storage-summary",
      {
        schema: {
          tags: ["Attachments"],
          summary:
            "Get attachment storage summary for a record",

          params: {
            type: "object",

            required: [
              "parentType",
              "parentId"
            ],

            properties: {

              parentType: {
                type: "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const {
          parentType,
          parentId
        } =
          request.params;


        return service
          .getParentStorageSummary(
            tenantId,
            parentType,
            parentId
          );
      }
    );


    // ---------------------------------
    // OPEN / DOWNLOAD ATTACHMENT
    // ---------------------------------

    fastify.get(
      "/:parentType/:parentId/:attachmentId/open",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Open or download an attachment",

          params: {
            type: "object",

            required: [
              "parentType",
              "parentId",
              "attachmentId"
            ],

            properties: {

              parentType: {
                type: "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type: "string",
                format: "uuid"
              },

              attachmentId: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      },

      async function (request, reply) {

        const tenantId =
          request.params.parentId;

        const {
          parentType,
          parentId,
          attachmentId
        } =
          request.params;


        const opened =
          await service.openAttachment(
            tenantId,
            parentType,
            parentId,
            attachmentId
          );


        const attachment =
          opened.attachment;

        const result =
          opened.result;


        // S3 returns a short-lived
        // presigned download URL.
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


        // Local storage returns a stream.
        if (
          result.type ===
          "stream"
        ) {

          reply.header(
            "Content-Type",
            attachment.content_type ||
            "application/octet-stream"
          );

          reply.header(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(
              attachment.original_filename
            )}`
          );

          return reply.send(
            result.stream
          );
        }


        const error =
          new Error(
            "Unsupported attachment open result."
          );

        error.statusCode =
          500;

        error.code =
          "ATTACHMENT_OPEN_RESULT_INVALID";

        throw error;
      }
    );


    // ---------------------------------
    // DELETE ATTACHMENT PERMANENTLY
    // ---------------------------------

    fastify.delete(
      "/:parentType/:parentId/:attachmentId",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Permanently delete an attachment",

          params: {
            type: "object",

            required: [
              "parentType",
              "parentId",
              "attachmentId"
            ],

            properties: {

              parentType: {
                type: "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type: "string",
                format: "uuid"
              },

              attachmentId: {
                type: "string",
                format: "uuid"
              }
            }
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const deletedBy =
          request.user.adminId;

        const {
          parentType,
          parentId,
          attachmentId
        } =
          request.params;


        return service.deleteAttachment(
          tenantId,
          parentType,
          parentId,
          attachmentId,
          deletedBy
        );
      }
    );


    // ==================================================
    // UPLOAD ATTACHMENTS
    //
    // Accepts multipart/form-data.
    // Multiple files may be uploaded in one request.
    //
    // Incoming files are streamed to temporary disk
    // storage first. This allows CPMSOFT to determine
    // the actual file size without buffering the entire
    // file in application memory.
    // ==================================================

    fastify.post(
      "/:parentType/:parentId",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Upload attachments to a parent record",

          consumes: [
            "multipart/form-data"
          ],

          params: {
            type: "object",

            required: [
              "parentType",
              "parentId"
            ],

            properties: {

              parentType: {
                type: "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
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
                  type:
                    "object",

                  required: [
                    "files"
                  ],

                  properties: {

                    folderId: {
                      type:
                        "string",

                      format:
                        "uuid"
                    },

                    files: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",

                        format:
                          "binary"
                      }
                    }
                  }
                }
              }
            };
          }
        }
      },

      async (request) => {

        const tenantId =
          request.params.parentId;

        const userId =
          request.user.adminId;


        const {
          parentType,
          parentId
        } =
          request.params;


        if (
          !request.isMultipart()
        ) {

          const error =
            new Error(
              "Multipart form data is required."
            );

          error.statusCode =
            400;

          error.code =
            "ATTACHMENT_MULTIPART_REQUIRED";

          throw error;
        }


        const tempDirectory =
          await fsPromises.mkdtemp(
            path.join(
              os.tmpdir(),
              "cpmsoft-attachments-"
            )
          );


        const stagedFiles =
          [];

        const createdAttachments =
          [];

        let folderId =
          null;


        try {

          let fileCount =
            0;


          const parts =
            request.parts({
              limits: {
                files:
                  attachmentMaxFiles,

                fileSize:
                  attachmentMaxFileSizeBytes
              }
            });


          // ==================================================
          // PHASE 1
          // Receive the complete multipart request.
          //
          // Nothing is copied to permanent attachment
          // storage during this phase.
          // ==================================================

          for await (
            const part
            of parts
          ) {

            if (
              part.type ===
              "field"
            ) {

              if (
                part.fieldname ===
                "folderId"
              ) {

                folderId =
                  String(
                    part.value ||
                    ""
                  ).trim() ||
                  null;
              }

              continue;
            }


            fileCount +=
              1;


            if (
              fileCount >
              attachmentMaxFiles
            ) {

              const error =
                new Error(
                  `A maximum of ${attachmentMaxFiles} attachment files can be uploaded at one time.`
                );

              error.statusCode =
                413;

              error.code =
                "ATTACHMENT_TOO_MANY_FILES";

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


            // @fastify/multipart marks the
            // stream when the configured
            // file-size limit was reached.
            if (
              part.file.truncated
            ) {

              const error =
                new Error(
                  `File exceeds the maximum allowed size: ${part.filename}`
                );

              error.statusCode =
                413;

              error.code =
                "ATTACHMENT_FILE_TOO_LARGE";

              throw error;
            }


            const stats =
              await fsPromises.stat(
                tempPath
              );


            const fileHandle =
              await fsPromises.open(
                tempPath,
                "r"
              );


            let headerBuffer;


            try {

              const headerSize =
                Math.min(
                  stats.size,
                  8192
                );


              headerBuffer =
                Buffer.alloc(
                  headerSize
                );


              if (
                headerSize >
                0
              ) {

                await fileHandle.read(
                  headerBuffer,
                  0,
                  headerSize,
                  0
                );
              }

            } finally {

              await fileHandle.close();
            }


            const fileHash =
              await new Promise(
                (
                  resolve,
                  reject
                ) => {

                  const hash =
                    crypto.createHash(
                      "sha256"
                    );


                  const stream =
                    fs.createReadStream(
                      tempPath
                    );


                  stream.on(
                    "data",
                    (chunk) => {

                      hash.update(
                        chunk
                      );
                    }
                  );


                  stream.on(
                    "end",
                    () => {

                      resolve(
                        hash.digest(
                          "hex"
                        )
                      );
                    }
                  );


                  stream.on(
                    "error",
                    reject
                  );
                }
              );


            stagedFiles.push({
              tempPath,

              originalFilename:
                part.filename,

              contentType:
                part.mimetype ||
                "application/octet-stream",

              fileSizeBytes:
                stats.size,

              headerBuffer,

              fileHash
            });
          }


          if (
            stagedFiles.length ===
            0
          ) {

            const error =
              new Error(
                "At least one attachment file is required."
              );

            error.statusCode =
              400;

            error.code =
              "ATTACHMENT_FILE_REQUIRED";

            throw error;
          }


          // ==================================================
          // VALIDATION PHASE
          // Validate every staged file before creating
          // any permanent attachment.
          //
          // Also reject duplicate files selected within
          // this same upload batch.
          //
          // If any file fails validation, nothing has
          // yet been written to permanent storage or DB.
          // ==================================================

          const batchFileHashes =
            new Set();


          for (
            const stagedFile
            of stagedFiles
          ) {

            if (
              batchFileHashes.has(
                stagedFile.fileHash
              )
            ) {

              const error =
                new Error(
                  `The same file was selected more than once: ${stagedFile.originalFilename}`
                );

              error.statusCode =
                409;

              error.code =
                "ATTACHMENT_DUPLICATE_FILE";

              throw error;
            }


            batchFileHashes.add(
              stagedFile.fileHash
            );


            await service
              .validateAttachmentForCreate(
                tenantId,
                parentType,
                parentId,
                {
                  originalFilename:
                    stagedFile.originalFilename,

                  contentType:
                    stagedFile.contentType,

                  fileSizeBytes:
                    stagedFile.fileSizeBytes,

                  headerBuffer:
                    stagedFile.headerBuffer,

                  validationPath:
                    stagedFile.tempPath,

                  fileHash:
                    stagedFile.fileHash
                }
              );
          }


          // ==================================================
          // PHASE 2
          // All staged files passed validation.
          //
          // Only now create permanent attachments.
          // ==================================================

          for (
            const stagedFile
            of stagedFiles
          ) {

            const created =
              await service.createAttachment(
                tenantId,
                parentType,
                parentId,
                userId,
                folderId,
                {
                  originalFilename:
                    stagedFile.originalFilename,

                  contentType:
                    stagedFile.contentType,

                  fileSizeBytes:
                    stagedFile.fileSizeBytes,

                  headerBuffer:
                    stagedFile.headerBuffer,

                  validationPath:
                    stagedFile.tempPath,

                  fileHash:
                    stagedFile.fileHash,

                  source:
                    fs.createReadStream(
                      stagedFile.tempPath
                    )
                }
              );


            createdAttachments.push(
              created
            );
          }


          return {
            count:
              createdAttachments.length,

            attachments:
              createdAttachments.map(
                toPublicAttachment
              )
          };

        } catch (error) {

          if (
            error?.code ===
            "FST_FILES_LIMIT"
          ) {

            const limitError =
              new Error(
                "Too many attachment files were uploaded."
              );

            limitError.statusCode =
              413;

            limitError.code =
              "ATTACHMENT_TOO_MANY_FILES";

            throw limitError;
          }


          throw error;

        } finally {

          // Always remove all temporary files
          // after the request succeeds or fails.
          await fsPromises.rm(
            tempDirectory,
            {
              recursive:
                true,

              force:
                true
            }
          );
        }
      }
    );


    // ==================================================
    // ATTACHMENT FOLDERS
    // ==================================================


    // ---------------------------------
    // GET FOLDERS FOR PARENT
    // ---------------------------------

    fastify.get(
      "/:parentType/:parentId/folders",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Get attachment folders for a parent record",

          params: {
            type:
              "object",

            required: [
              "parentType",
              "parentId"
            ],

            properties: {

              parentType: {
                type:
                  "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type:
                  "string",

                format:
                  "uuid"
              }
            },

            additionalProperties:
              false
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const {
          parentType,
          parentId
        } =
          request.params;


        return folderService.getFolders(
          tenantId,
          parentType,
          parentId
        );
      }
    );


    // ---------------------------------
    // GET FOLDER
    // ---------------------------------

    fastify.get(
      "/:parentType/:parentId/folders/:folderId",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Get an attachment folder",

          params: {
            type:
              "object",

            required: [
              "parentType",
              "parentId",
              "folderId"
            ],

            properties: {

              parentType: {
                type:
                  "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type:
                  "string",

                format:
                  "uuid"
              },

              folderId: {
                type:
                  "string",

                format:
                  "uuid"
              }
            },

            additionalProperties:
              false
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const {
          parentType,
          parentId,
          folderId
        } =
          request.params;


        return folderService.getFolder(
          tenantId,
          parentType,
          parentId,
          folderId
        );
      }
    );


    // ---------------------------------
    // CREATE FOLDER
    // ---------------------------------

    fastify.post(
      "/:parentType/:parentId/folders",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Create an attachment folder",

          params: {
            type:
              "object",

            required: [
              "parentType",
              "parentId"
            ],

            properties: {

              parentType: {
                type:
                  "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type:
                  "string",

                format:
                  "uuid"
              }
            },

            additionalProperties:
              false
          },

          body: {
            type:
              "object",

            required: [
              "folderName"
            ],

            properties: {

              folderName: {
                type:
                  "string",

                minLength:
                  1,

                maxLength:
                  255
              },

              description: {
                type: [
                  "string",
                  "null"
                ],

                maxLength:
                  500
              },

              displayOrder: {
                type:
                  "integer"
              }
            },

            additionalProperties:
              false
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const userId =
          request.user.adminId;

        const {
          parentType,
          parentId
        } =
          request.params;


        return folderService.createFolder(
          tenantId,
          parentType,
          parentId,
          userId,
          request.body
        );
      }
    );


    // ---------------------------------
    // UPDATE FOLDER
    // ---------------------------------

    fastify.put(
      "/:parentType/:parentId/folders/:folderId",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Update an attachment folder",

          params: {
            type:
              "object",

            required: [
              "parentType",
              "parentId",
              "folderId"
            ],

            properties: {

              parentType: {
                type:
                  "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type:
                  "string",

                format:
                  "uuid"
              },

              folderId: {
                type:
                  "string",

                format:
                  "uuid"
              }
            },

            additionalProperties:
              false
          },

          body: {
            type:
              "object",

            required: [
              "folderName"
            ],

            properties: {

              folderName: {
                type:
                  "string",

                minLength:
                  1,

                maxLength:
                  255
              },

              description: {
                type: [
                  "string",
                  "null"
                ],

                maxLength:
                  500
              },

              displayOrder: {
                type:
                  "integer"
              }
            },

            additionalProperties:
              false
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const userId =
          request.user.adminId;

        const {
          parentType,
          parentId,
          folderId
        } =
          request.params;


        return folderService.updateFolder(
          tenantId,
          parentType,
          parentId,
          folderId,
          userId,
          request.body
        );
      }
    );


    // ---------------------------------
    // DELETE EMPTY FOLDER
    // ---------------------------------

    fastify.delete(
      "/:parentType/:parentId/folders/:folderId",
      {
        schema: {
          tags: [
            "Attachments"
          ],

          summary:
            "Delete an empty attachment folder",

          params: {
            type:
              "object",

            required: [
              "parentType",
              "parentId",
              "folderId"
            ],

            properties: {

              parentType: {
                type:
                  "string",

                enum: [
                  "platform_customer"
                ]
              },

              parentId: {
                type:
                  "string",

                format:
                  "uuid"
              },

              folderId: {
                type:
                  "string",

                format:
                  "uuid"
              }
            },

            additionalProperties:
              false
          }
        }
      },

      async function (request) {

        const tenantId =
          request.params.parentId;

        const {
          parentType,
          parentId,
          folderId
        } =
          request.params;


        const userId =
          request.user.adminId;


        return folderService.deleteFolder(
          tenantId,
          parentType,
          parentId,
          folderId,
          userId
        );
      }
    );

  };