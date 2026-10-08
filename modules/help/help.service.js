const crypto =
  require("crypto");

const path =
  require("path");

const repository =
  require("./help.repository");

const storageFactory =
  require(
    "cpmsoft-core/attachments/storage/storageFactory"
  );

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
// GET PUBLISHED SYSTEM HELP BY KEY
// ---------------------------------
async function getPublishedSystemContentByKey(
  helpKey
) {

  if (
    !helpKey ||
    !String(helpKey).trim()
  ) {

    const error =
      new Error(
        "Help key is required."
      );

    error.statusCode = 400;
    error.code =
      "HELP_KEY_REQUIRED";

    throw error;
  }


  const content =
    await repository
      .getPublishedSystemContentByKey(
        String(helpKey).trim()
      );


  if (!content) {

    const error =
      new Error(
        "Published Help content not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_CONTENT_NOT_FOUND";

    throw error;
  }


  return content;
}

// ---------------------------------
// GET HELP NAVIGATION BY HELP KEY
// ---------------------------------
async function getHelpNavigationByKey(
  helpKey
) {

  if (
    !helpKey ||
    !String(helpKey).trim()
  ) {

    const error =
      new Error(
        "Help key is required."
      );

    error.statusCode = 400;
    error.code =
      "HELP_KEY_REQUIRED";

    throw error;
  }


  const navigation =
    await repository
      .getHelpNavigationByKey(
        String(helpKey).trim()
      );


  if (!navigation) {

    const error =
      new Error(
        "Help navigation not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_NAVIGATION_NOT_FOUND";

    throw error;
  }


  return navigation;
}

// ---------------------------------
// GET RELATED HELP BY HELP KEY
// ---------------------------------
async function getRelatedHelpByKey(
  helpKey
) {

  if (
    !helpKey ||
    !String(helpKey).trim()
  ) {

    const error =
      new Error(
        "Help key is required."
      );

    error.statusCode = 400;
    error.code =
      "HELP_KEY_REQUIRED";

    throw error;
  }


  return await repository
    .getRelatedHelpByKey(
      String(helpKey).trim()
    );
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
// CREATE DRAFT FROM PUBLISHED
// ---------------------------------
async function createDraftFromPublished(
  id,
  adminId
) {

  const existing =
    await getSystemContentById(id);


  if (
    existing.status === "DRAFT"
  ) {
    return existing;
  }


  if (
    existing.status !== "PUBLISHED"
  ) {

    const error =
      new Error(
        "Only published Help content can be opened as a new draft."
      );

    error.statusCode = 409;
    error.code =
      "HELP_CONTENT_NOT_PUBLISHED";

    throw error;
  }


  const draft =
    await repository
      .createDraftFromPublished(
        id,
        adminId
      );


  if (!draft) {

    const error =
      new Error(
        "Published Help content could not be opened for editing."
      );

    error.statusCode = 404;
    error.code =
      "HELP_CONTENT_NOT_FOUND";

    throw error;
  }


  return draft;
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
  const existing =
    await getSystemContentById(id);

  if (
    existing.status !== "DRAFT"
  ) {

    const error =
      new Error(
        "Only draft Help content can be published."
      );

    error.statusCode = 409;
    error.code =
      "HELP_CONTENT_NOT_DRAFT";

    throw error;
  }


  if (
    existing.status !== "DRAFT"
  ) {

    const error =
      new Error(
        "Published Help content cannot be edited directly. Create a draft first."
      );

    error.statusCode = 409;
    error.code =
      "HELP_CONTENT_NOT_DRAFT";

    throw error;
  }


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
// COLLECT HELP MEDIA REFERENCES
// ---------------------------------
function collectMediaIds(
  value,
  mediaIds = new Set()
) {

  if (!value) {
    return mediaIds;
  }


  if (Array.isArray(value)) {

    for (const item of value) {

      collectMediaIds(
        item,
        mediaIds
      );
    }

    return mediaIds;
  }


  if (
    typeof value !== "object"
  ) {
    return mediaIds;
  }


  if (
    value.attrs &&
    value.attrs.mediaId
  ) {

    mediaIds.add(
      String(
        value.attrs.mediaId
      )
    );
  }


  for (
    const childValue
    of Object.values(value)
  ) {

    collectMediaIds(
      childValue,
      mediaIds
    );
  }


  return mediaIds;
}


// ---------------------------------
// CLEAN UP UNREFERENCED HELP MEDIA
// ---------------------------------
async function cleanupUnreferencedSystemMedia(
  articleId
) {

  if (!articleId) {
    return;
  }


  const [
    contentRows,
    mediaRows
  ] =
    await Promise.all([
      repository
        .getSystemContentForArticle(
          articleId
        ),

      repository
        .getSystemMediaForArticle(
          articleId
        )
    ]);


  const referencedMediaIds =
    new Set();


  for (const content of contentRows) {

    collectMediaIds(
      content.content_json,
      referencedMediaIds
    );
  }


  for (const media of mediaRows) {

    if (
      referencedMediaIds.has(
        String(media.id)
      )
    ) {
      continue;
    }


    const storage =
      storageFactory
        .getStorageProviderByName(
          media.storage_provider
        );


    try {

      await storage.remove(
        media.storage_key
      );


      await repository
        .deleteSystemMedia(
          media.id
        );

    } catch (error) {

      /*
       * Publishing has already succeeded.
       * A cleanup failure must not make the
       * successful publish appear to have failed.
       *
       * Leaving the media row allows us to
       * identify/retry orphan cleanup later.
       */
      console.error(
        "Unable to clean up unreferenced Help media.",
        {
          articleId,
          mediaId:
            media.id,
          storageKey:
            media.storage_key,
          error
        }
      );
    }
  }
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


  await cleanupUnreferencedSystemMedia(
    content.article_id
  );


  return content;
}

// ---------------------------------
// SANITIZE HELP MEDIA FILE NAME
// ---------------------------------
function sanitizeMediaFilename(
  originalFilename
) {

  const extension =
    path.extname(
      originalFilename || ""
    );

  const base =
    path.basename(
      originalFilename || "",
      extension
    );


  let safeBase =
    base
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9._ -]/g,
        "_"
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .replace(
        /[. ]+$/g,
        ""
      );


  if (!safeBase) {
    safeBase = "image";
  }


  let safeExtension =
    extension
      .replace(
        /[^a-zA-Z0-9.]/g,
        ""
      )
      .toLowerCase();


  if (
    safeExtension &&
    !safeExtension.startsWith(".")
  ) {
    safeExtension =
      `.${safeExtension}`;
  }


  return (
    safeBase +
    safeExtension
  );
}


// ---------------------------------
// CREATE SYSTEM HELP IMAGE
// ---------------------------------
async function createSystemHelpImage(
  articleId,
  adminId,
  file
) {

  const article =
    await repository
      .getArticleById(
        articleId
      );


  if (!article) {

    const error =
      new Error(
        "Help article not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_ARTICLE_NOT_FOUND";

    throw error;
  }


  const originalFilename =
    String(
      file.originalFilename || ""
    ).trim();


  if (!originalFilename) {

    const error =
      new Error(
        "Image filename is required."
      );

    error.statusCode = 400;
    error.code =
      "HELP_MEDIA_FILENAME_REQUIRED";

    throw error;
  }


  const contentType =
    String(
      file.contentType || ""
    )
      .trim()
      .toLowerCase();


  const allowedTypes =
    new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif"
    ]);


  if (!allowedTypes.has(contentType)) {

    const error =
      new Error(
        "Help image must be PNG, JPEG, WEBP, or GIF."
      );

    error.statusCode = 400;
    error.code =
      "HELP_IMAGE_TYPE_INVALID";

    throw error;
  }


  const fileSizeBytes =
    Number(
      file.fileSizeBytes || 0
    );


  if (
    !Number.isFinite(
      fileSizeBytes
    ) ||
    fileSizeBytes <= 0
  ) {

    const error =
      new Error(
        "Help image is empty."
      );

    error.statusCode = 400;
    error.code =
      "HELP_IMAGE_EMPTY";

    throw error;
  }


  const mediaId =
    crypto.randomUUID();


  const safeFilename =
    sanitizeMediaFilename(
      originalFilename
    );


  const storageKey =
    `help/system/images/${mediaId}___${safeFilename}`;


  const storage =
    storageFactory
      .getStorageProvider();


  const storageProvider =
    String(
      process.env
        .ATTACHMENT_STORAGE_PROVIDER ||
      ""
    )
      .trim()
      .toLowerCase();


  await storage.put(
    storageKey,
    file.source,
    {
      contentType,
      contentLength:
        fileSizeBytes
    }
  );


  try {

    return await repository
      .createSystemMedia({
        id:
          mediaId,

        articleId,

        mediaType:
          "IMAGE",

        originalFilename,

        storageProvider,

        storageKey,

        contentType,

        fileSizeBytes,

        altText:
          file.altText || null,

        caption:
          file.caption || null,

        adminId
      });

  } catch (error) {

    // If the DB write fails after S3/local
    // succeeds, remove the physical file.
    try {

      await storage.remove(
        storageKey
      );

    } catch (cleanupError) {

      console.error(
        "Unable to clean up Help media after database failure.",
        cleanupError
      );
    }


    throw error;
  }
}


// ---------------------------------
// OPEN SYSTEM HELP MEDIA
// ---------------------------------
async function openSystemHelpMedia(
  mediaId
) {

  const media =
    await repository
      .getSystemMediaById(
        mediaId
      );


  if (!media) {

    const error =
      new Error(
        "Help media not found."
      );

    error.statusCode = 404;
    error.code =
      "HELP_MEDIA_NOT_FOUND";

    throw error;
  }


  const storage =
    storageFactory
      .getStorageProviderByName(
        media.storage_provider
      );


  const result =
    await storage.open(
      media.storage_key
    );


  return {
    media,
    result
  };
}

module.exports = {
  getTopics,
  getKeys,
  getSystemContent,
  getSystemContentById,
  getPublishedSystemContentByKey,
  getHelpNavigationByKey,
  getRelatedHelpByKey,
  createSystemContent,
  createDraftFromPublished,
  updateSystemContent,
  publishSystemContent,

  createSystemHelpImage,
  openSystemHelpMedia
};