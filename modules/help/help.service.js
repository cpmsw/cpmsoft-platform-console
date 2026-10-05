const repository =
  require("./help.repository");


// ---------------------------------
// GET HELP TOPICS
// ---------------------------------
async function getTopics() {
  return await repository.getTopics();
}


// ---------------------------------
// GET HELP KEYS
// ---------------------------------
async function getKeys(options = {}) {

  return await repository.getKeys(
    options.topicId || null
  );
}


// ---------------------------------
// GET SYSTEM HELP CONTENT
// ---------------------------------
async function getSystemContent() {
  return await repository
    .getSystemContent();
}


// ---------------------------------
// GET SYSTEM HELP CONTENT BY ID
// ---------------------------------
async function getSystemContentById(id) {

  const content =
    await repository
      .getSystemContentById(id);

  if (!content) {

    const error =
      new Error(
        "Help content not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_CONTENT_NOT_FOUND";

    throw error;
  }

  return content;
}


// ---------------------------------
// VALIDATE HELP CONTENT
// ---------------------------------
async function validateContent({
  contentType,
  topicId,
  helpKeyId,
  title
}) {

  const validTypes =
    new Set([
      "CONTEXT",
      "CONCEPT",
      "GUIDE"
    ]);

  if (!validTypes.has(contentType)) {

    const error =
      new Error(
        "Invalid Help content type."
      );

    error.statusCode = 400;
    error.code =
      "INVALID_HELP_CONTENT_TYPE";

    throw error;
  }


  if (
    !title ||
    !String(title).trim()
  ) {

    const error =
      new Error(
        "Help title is required."
      );

    error.statusCode = 400;
    error.code =
      "HELP_TITLE_REQUIRED";

    throw error;
  }


  if (
    contentType === "CONTEXT" &&
    !helpKeyId
  ) {

    const error =
      new Error(
        "Context Help requires a Help key."
      );

    error.statusCode = 400;
    error.code =
      "HELP_KEY_REQUIRED";

    throw error;
  }


  if (
    contentType === "CONTEXT"
  ) {

    const keys =
      await repository.getKeys(
        topicId || null
      );

    const helpKey =
      keys.find(
        item =>
          String(item.id) ===
          String(helpKeyId)
      );

    if (!helpKey) {

      const error =
        new Error(
          "The selected Help key is invalid or inactive."
        );

      error.statusCode = 400;
      error.code =
        "INVALID_HELP_KEY";

      throw error;
    }


    if (
      topicId &&
      String(helpKey.topic_id) !==
        String(topicId)
    ) {

      const error =
        new Error(
          "The selected Help key does not belong to the selected Help topic."
        );

      error.statusCode = 400;
      error.code =
        "HELP_KEY_TOPIC_MISMATCH";

      throw error;
    }
  }
}


// ---------------------------------
// CREATE SYSTEM HELP CONTENT
// ---------------------------------
async function createSystemContent(
  data,
  adminId
) {

  await validateContent(data);

  return await repository
    .createSystemContent({
      ...data,

      title:
        data.title.trim(),

      summary:
        data.summary?.trim() || null,

      keywords:
        data.keywords?.trim() || null,

      contentJson:
        data.contentJson || null,

      contentHtml:
        data.contentHtml || null,

      topicId:
        data.topicId || null,

      helpKeyId:
        data.helpKeyId || null,

      adminId
    });
}


// ---------------------------------
// UPDATE SYSTEM HELP CONTENT
// ---------------------------------
async function updateSystemContent(
  id,
  data,
  adminId
) {

  // Make sure it belongs to SYSTEM
  // Help before attempting update.
  await getSystemContentById(id);

  await validateContent(data);

  const content =
    await repository
      .updateSystemContent(
        id,
        {
          ...data,

          title:
            data.title.trim(),

          summary:
            data.summary?.trim() ||
            null,

          keywords:
            data.keywords?.trim() ||
            null,

          contentJson:
            data.contentJson || null,

          contentHtml:
            data.contentHtml || null,

          topicId:
            data.topicId || null,

          helpKeyId:
            data.helpKeyId || null,

          adminId
        }
      );

  if (!content) {

    const error =
      new Error(
        "Help content not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_CONTENT_NOT_FOUND";

    throw error;
  }

  return content;
}


// ---------------------------------
// PUBLISH SYSTEM HELP CONTENT
// ---------------------------------
async function publishSystemContent(
  id,
  adminId
) {

  const existing =
    await getSystemContentById(id);

  if (
    existing.content_type ===
      "CONTEXT" &&
    !existing.help_key_id
  ) {

    const error =
      new Error(
        "Context Help cannot be published without a Help key."
      );

    error.statusCode = 400;
    error.code =
      "HELP_KEY_REQUIRED";

    throw error;
  }


  if (
    !existing.content_html ||
    !existing.content_html.trim()
  ) {

    const error =
      new Error(
        "Help content cannot be published without article content."
      );

    error.statusCode = 400;
    error.code =
      "HELP_CONTENT_REQUIRED";

    throw error;
  }


  const content =
    await repository
      .publishSystemContent(
        id,
        adminId
      );

  if (!content) {

    const error =
      new Error(
        "Help content not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_CONTENT_NOT_FOUND";

    throw error;
  }

  return content;
}

module.exports = {
  getTopics,
  getKeys,
  getSystemContent,
  getSystemContentById,
  createSystemContent,
  updateSystemContent,
  publishSystemContent
};