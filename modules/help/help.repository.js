const appDb =
  require("../../db/appDb");


// ---------------------------------
// GET HELP TOPICS
// ---------------------------------
async function getTopics() {

  const result =
    await appDb.query(
      `SELECT
         id,
         topic_key,
         title,
         description,
         application,
         module,
         sort_order,
         is_active,
         created_at,
         updated_at

       FROM help_topics

       WHERE is_active = true

       ORDER BY
         application,
         sort_order,
         title`
    );

  return result.rows;
}


// ---------------------------------
// GET HELP KEYS
// ---------------------------------
async function getKeys(topicId = null) {

  const params = [];

  let where =
    `WHERE hk.is_active = true
       AND ht.is_active = true`;

  if (topicId) {

    params.push(topicId);

    where +=
      ` AND hk.topic_id = $1`;
  }


  const result =
    await appDb.query(
      `SELECT
         hk.id,
         hk.topic_id,
         hk.help_key,
         hk.title,
         hk.description,
         hk.sort_order,
         hk.is_overview,
         hk.is_active,

         ht.topic_key,
         ht.title AS topic_title,
         ht.application,
         ht.module

       FROM help_keys hk

       JOIN help_topics ht
         ON ht.id = hk.topic_id

       ${where}

       ORDER BY
         ht.sort_order,
         ht.title,
         hk.sort_order,
         hk.title`,
      params
    );

  return result.rows;
}


// ---------------------------------
// GET SYSTEM HELP CONTENT
// ---------------------------------
async function getSystemContent() {

  const result =
    await appDb.query(
      `SELECT
         hc.id,
         hc.scope,
         hc.content_type,
         hc.topic_id,
         hc.help_key_id,
         hc.title,
         hc.summary,
         hc.keywords,
         hc.status,
         hc.version,
         hc.created_by,
         hc.created_at,
         hc.updated_by,
         hc.updated_at,
         hc.published_by,
         hc.published_at,

         ht.topic_key,
         ht.title AS topic_title,

         hk.help_key,
         hk.title AS help_key_title

       FROM help_content hc

       LEFT JOIN help_topics ht
         ON ht.id = hc.topic_id

       LEFT JOIN help_keys hk
         ON hk.id = hc.help_key_id

       WHERE hc.scope = 'SYSTEM'

       ORDER BY
         ht.sort_order NULLS LAST,
         ht.title NULLS LAST,
         hk.sort_order NULLS LAST,
         hc.status,
         hc.title`
    );

  return result.rows;
}


// ---------------------------------
// GET SYSTEM HELP CONTENT BY ID
// ---------------------------------
async function getSystemContentById(id) {

  const result =
    await appDb.query(
      `SELECT
         hc.id,
         hc.article_id,
         hc.scope,
         hc.tenant_id,
         hc.content_type,
         hc.topic_id,
         hc.help_key_id,
         hc.title,
         hc.summary,
         hc.content_json,
         hc.content_html,
         hc.keywords,
         hc.status,
         hc.version,
         hc.created_by,
         hc.created_at,
         hc.updated_by,
         hc.updated_at,
         hc.published_by,
         hc.published_at,

         ht.topic_key,
         ht.title AS topic_title,

         hk.help_key,
         hk.title AS help_key_title

       FROM help_content hc

       LEFT JOIN help_topics ht
         ON ht.id = hc.topic_id

       LEFT JOIN help_keys hk
         ON hk.id = hc.help_key_id

       WHERE hc.id = $1
         AND hc.scope = 'SYSTEM'`,
      [id]
    );

  return result.rows[0] || null;
}


// ---------------------------------
// GET PUBLISHED SYSTEM HELP BY KEY
// ---------------------------------
async function getPublishedSystemContentByKey(
  helpKey
) {

  const result =
    await appDb.query(
      `SELECT
         hc.id,
         hc.scope,
         hc.content_type,
         hc.topic_id,
         hc.help_key_id,
         hc.title,
         hc.summary,
         hc.content_json,
         hc.content_html,
         hc.keywords,
         hc.status,
         hc.version,
         hc.published_at,

         ht.topic_key,
         ht.title AS topic_title,

         hk.help_key,
         hk.title AS help_key_title

       FROM help_content hc

       JOIN help_keys hk
         ON hk.id = hc.help_key_id

       LEFT JOIN help_topics ht
         ON ht.id = hc.topic_id

       WHERE hc.scope = 'SYSTEM'
         AND hc.content_type = 'CONTEXT'
         AND hc.status = 'PUBLISHED'
         AND hk.help_key = $1
         AND hk.is_active = true
         AND (
           ht.id IS NULL OR
           ht.is_active = true
         )

       LIMIT 1`,
      [helpKey]
    );

  return result.rows[0] || null;
}

// ---------------------------------
// GET HELP NAVIGATION BY HELP KEY
// ---------------------------------
async function getHelpNavigationByKey(
  helpKey
) {

  const result =
    await appDb.query(
      `SELECT
         ht.id AS topic_id,
         ht.topic_key,
         ht.title AS topic_title,

         hk.id AS help_key_id,
         hk.help_key,
         hk.title AS help_key_title,
         hk.description,
         hk.sort_order,
         hk.is_overview

       FROM help_keys current_key

       JOIN help_topics ht
         ON ht.id = current_key.topic_id
        AND ht.is_active = true

       JOIN help_keys hk
         ON hk.topic_id = ht.id
        AND hk.is_active = true

       WHERE current_key.help_key = $1
         AND current_key.is_active = true

       ORDER BY
         hk.sort_order,
         hk.title`,
      [helpKey]
    );


  if (!result.rows.length) {
    return null;
  }


  const first =
    result.rows[0];


  return {
    topic: {
      id:
        first.topic_id,

      topic_key:
        first.topic_key,

      title:
        first.topic_title
    },

    keys:
      result.rows.map(
        row => ({
          id:
            row.help_key_id,

          help_key:
            row.help_key,

          title:
            row.help_key_title,

          description:
            row.description,

          sort_order:
            row.sort_order,

          is_overview:
            row.is_overview
        })
      )
  };
}

// ---------------------------------
// GET RELATED HELP BY HELP KEY
// ---------------------------------
async function getRelatedHelpByKey(
  helpKey
) {

  const result =
    await appDb.query(
      `SELECT
         hcl.relationship_type,
         hcl.sort_order,

         target_article.id AS article_id,

         target_content.id AS content_id,
         target_content.content_type,
         target_content.title,
         target_content.summary,
         target_content.version,

         target_key.help_key,
         target_key.title AS help_key_title

       FROM help_articles source_article

       JOIN help_keys source_key
         ON source_key.id =
            source_article.help_key_id

       JOIN help_content_links hcl
         ON hcl.from_article_id =
            source_article.id

       JOIN help_articles target_article
         ON target_article.id =
            hcl.to_article_id

       JOIN help_content target_content
         ON target_content.article_id =
            target_article.id
        AND target_content.scope = 'SYSTEM'
        AND target_content.status = 'PUBLISHED'

       LEFT JOIN help_keys target_key
         ON target_key.id =
            target_article.help_key_id

       WHERE source_article.scope = 'SYSTEM'
         AND source_article.content_type = 'CONTEXT'
         AND source_key.help_key = $1

       ORDER BY
         hcl.relationship_type,
         hcl.sort_order,
         target_content.title`,
      [helpKey]
    );


  const related = {
    related_help: [],
    related_concepts: [],
    related_guides: [],
    company_help: []
  };


  for (const row of result.rows) {

    const item = {
      article_id:
        row.article_id,

      content_id:
        row.content_id,

      content_type:
        row.content_type,

      help_key:
        row.help_key,

      title:
        row.title,

      summary:
        row.summary,

      version:
        row.version,

      sort_order:
        row.sort_order
    };


    if (
      row.relationship_type ===
      "RELATED_HELP"
    ) {

      related.related_help.push(
        item
      );

    } else if (
      row.relationship_type ===
      "RELATED_CONCEPT"
    ) {

      related.related_concepts.push(
        item
      );

    } else if (
      row.relationship_type ===
      "RELATED_GUIDE"
    ) {

      related.related_guides.push(
        item
      );
    }
  }


  return related;
}

// ---------------------------------
// GET SYSTEM DRAFT FOR HELP KEY
// ---------------------------------
async function getSystemDraftByHelpKey(
  helpKeyId
) {

  const result =
    await appDb.query(
      `SELECT *
       FROM help_content
       WHERE scope = 'SYSTEM'
         AND content_type = 'CONTEXT'
         AND help_key_id = $1
         AND status = 'DRAFT'
       LIMIT 1`,
      [helpKeyId]
    );

  return result.rows[0] || null;
}


// ---------------------------------
// CREATE SYSTEM HELP CONTENT
// ---------------------------------
// ---------------------------------
// CREATE SYSTEM HELP CONTENT
// ---------------------------------
async function createSystemContent({
  contentType,
  topicId,
  helpKeyId,
  title,
  summary,
  contentJson,
  contentHtml,
  keywords,
  adminId,
  version = 1
}) {

  const client =
    await appDb.connect();

  try {

    await client.query("BEGIN");


    let articleId = null;


    /*
     * Context Help has a stable identity through
     * its registered Help Key.
     */
    if (
      contentType === "CONTEXT" &&
      helpKeyId
    ) {

      const articleResult =
        await client.query(
          `INSERT INTO help_articles (
             scope,
             tenant_id,
             content_type,
             topic_id,
             help_key_id
           )
           VALUES (
             'SYSTEM',
             NULL,
             'CONTEXT',
             $1,
             $2
           )
           ON CONFLICT (help_key_id)
             WHERE scope = 'SYSTEM'
               AND content_type = 'CONTEXT'
           DO UPDATE
           SET topic_id = EXCLUDED.topic_id
           RETURNING id`,
          [
            topicId,
            helpKeyId
          ]
        );

      articleId =
        articleResult.rows[0].id;

    } else {

      /*
       * Concepts and Guides do not have Help Keys,
       * so creating the content also creates their
       * permanent article identity.
       */
      const articleResult =
        await client.query(
          `INSERT INTO help_articles (
             scope,
             tenant_id,
             content_type,
             topic_id,
             help_key_id
           )
           VALUES (
             'SYSTEM',
             NULL,
             $1,
             $2,
             NULL
           )
           RETURNING id`,
          [
            contentType,
            topicId
          ]
        );

      articleId =
        articleResult.rows[0].id;
    }


    const result =
      await client.query(
        `INSERT INTO help_content (
           article_id,
           scope,
           tenant_id,
           content_type,
           topic_id,
           help_key_id,
           title,
           summary,
           content_json,
           content_html,
           keywords,
           status,
           version,
           created_by,
           updated_by,
           created_at,
           updated_at
         )
         VALUES (
           $1,
           'SYSTEM',
           NULL,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           'DRAFT',
           $10,
           $11,
           $11,
           now(),
           now()
         )
         RETURNING *`,
        [
          articleId,
          contentType,
          topicId,
          helpKeyId,
          title,
          summary,
          contentJson,
          contentHtml,
          keywords,
          version,
          adminId
        ]
      );


    await client.query("COMMIT");

    return result.rows[0];

  } catch (error) {

    await client.query("ROLLBACK");


    if (error.code === "23505") {

      const duplicate =
        new Error(
          "A SYSTEM Help draft already exists for this Help key."
        );

      duplicate.statusCode = 409;
      duplicate.code =
        "HELP_DRAFT_EXISTS";

      throw duplicate;
    }


    throw error;

  } finally {

    client.release();
  }
}

// ---------------------------------
// CREATE DRAFT FROM PUBLISHED
// ---------------------------------
async function createDraftFromPublished(
  id,
  adminId
) {

  const client =
    await appDb.connect();

  try {

    await client.query("BEGIN");


    const publishedResult =
      await client.query(
        `SELECT *
         FROM help_content
         WHERE id = $1
           AND scope = 'SYSTEM'
           AND status = 'PUBLISHED'
         FOR UPDATE`,
        [id]
      );


    const published =
      publishedResult.rows[0];

    if (!published) {

      await client.query("ROLLBACK");

      return null;
    }


    if (
      published.content_type === "CONTEXT" &&
      published.help_key_id
    ) {

      const draftResult =
        await client.query(
          `SELECT *
           FROM help_content
           WHERE scope = 'SYSTEM'
             AND content_type = 'CONTEXT'
             AND help_key_id = $1
             AND status = 'DRAFT'
           LIMIT 1`,
          [published.help_key_id]
        );


      if (draftResult.rows[0]) {

        await client.query("COMMIT");

        return draftResult.rows[0];
      }
    }


    const insertResult =
      await client.query(
        `INSERT INTO help_content (
           article_id,
           scope,
           tenant_id,
           content_type,
           topic_id,
           help_key_id,
           title,
           summary,
           content_json,
           content_html,
           keywords,
           status,
           version,
           created_by,
           updated_by,
           created_at,
           updated_at
         )
         VALUES (
           $1,
           'SYSTEM',
           NULL,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           'DRAFT',
           $10,
           $11,
           $11,
           now(),
           now()
         )
         RETURNING *`,
        [
          published.article_id,
          published.content_type,
          published.topic_id,
          published.help_key_id,
          published.title,
          published.summary,
          published.content_json,
          published.content_html,
          published.keywords,
          Number(
            published.version || 1
          ) + 1,
          adminId
        ]
      );


    await client.query("COMMIT");

    return insertResult.rows[0];

  } catch (error) {

    await client.query("ROLLBACK");

    throw error;

  } finally {

    client.release();
  }
}


// ---------------------------------
// UPDATE SYSTEM HELP DRAFT
// ---------------------------------
async function updateSystemContent(
  id,
  {
    contentType,
    topicId,
    helpKeyId,
    title,
    summary,
    contentJson,
    contentHtml,
    keywords,
    adminId
  }
) {

  try {

    const result =
      await appDb.query(
        `UPDATE help_content
         SET
           content_type = $2,
           topic_id = $3,
           help_key_id = $4,
           title = $5,
           summary = $6,
           content_json = $7,
           content_html = $8,
           keywords = $9,
           updated_by = $10,
           updated_at = now()

         WHERE id = $1
           AND scope = 'SYSTEM'
           AND status = 'DRAFT'

         RETURNING *`,
        [
          id,
          contentType,
          topicId,
          helpKeyId,
          title,
          summary,
          contentJson,
          contentHtml,
          keywords,
          adminId
        ]
      );

    return result.rows[0] || null;

  } catch (error) {

    if (error.code === "23505") {

      const duplicate =
        new Error(
          "A SYSTEM Help draft already exists for this Help key."
        );

      duplicate.statusCode = 409;
      duplicate.code =
        "HELP_DRAFT_EXISTS";

      throw duplicate;
    }

    throw error;
  }
}


// ---------------------------------
// PUBLISH SYSTEM HELP DRAFT
// ---------------------------------
async function publishSystemContent(
  id,
  adminId
) {

  const client =
    await appDb.connect();

  try {

    await client.query("BEGIN");


    const draftResult =
      await client.query(
        `SELECT *
         FROM help_content
         WHERE id = $1
           AND scope = 'SYSTEM'
           AND status = 'DRAFT'
         FOR UPDATE`,
        [id]
      );


    const draft =
      draftResult.rows[0];

    if (!draft) {

      await client.query("ROLLBACK");

      return null;
    }


    /*
     * Remove the currently published copy for the same
     * Help article before promoting this draft.
     *
     * For Context Help the stable article identity is
     * the Help Key.
     */
    if (
      draft.content_type === "CONTEXT" &&
      draft.help_key_id
    ) {

      await client.query(
        `DELETE FROM help_content
         WHERE scope = 'SYSTEM'
           AND content_type = 'CONTEXT'
           AND help_key_id = $1
           AND status = 'PUBLISHED'
           AND id <> $2`,
        [
          draft.help_key_id,
          draft.id
        ]
      );
    }


    const publishResult =
      await client.query(
        `UPDATE help_content
         SET
           status = 'PUBLISHED',
           published_by = $2,
           published_at = now(),
           updated_by = $2,
           updated_at = now()

         WHERE id = $1
           AND scope = 'SYSTEM'
           AND status = 'DRAFT'

         RETURNING *`,
        [
          id,
          adminId
        ]
      );


    await client.query("COMMIT");

    return publishResult.rows[0] || null;

  } catch (error) {

    await client.query("ROLLBACK");

    throw error;

  } finally {

    client.release();
  }
}

// ---------------------------------
// GET HELP ARTICLE BY ID
// ---------------------------------

async function getArticleById(
  articleId
) {

  const result =
    await appDb.query(
      `SELECT
         id,
         scope,
         tenant_id,
         content_type,
         topic_id,
         help_key_id,
         created_at

       FROM help_articles

       WHERE id = $1
         AND scope = 'SYSTEM'

       LIMIT 1`,
      [articleId]
    );


  return result.rows[0] || null;
}

// ---------------------------------
// CREATE SYSTEM HELP MEDIA
// ---------------------------------
async function createSystemMedia({
  id,
  articleId,
  mediaType,
  originalFilename,
  storageProvider,
  storageKey,
  contentType,
  fileSizeBytes,
  altText,
  caption,
  adminId
}) {

  const result =
    await appDb.query(
      `INSERT INTO help_media (
         id,
         scope,
         tenant_id,
         article_id,
         media_type,
         original_filename,
         storage_provider,
         storage_key,
         content_type,
         file_size_bytes,
         alt_text,
         caption,
         created_by,
         created_at
       )
       VALUES (
         $1,
         'SYSTEM',
         NULL,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         now()
       )
       RETURNING *`,
      [
        id,
        articleId,
        mediaType,
        originalFilename,
        storageProvider,
        storageKey,
        contentType,
        fileSizeBytes,
        altText || null,
        caption || null,
        adminId
      ]
    );


  return result.rows[0];
}


// ---------------------------------
// GET SYSTEM HELP MEDIA BY ID
// ---------------------------------
async function getSystemMediaById(
  mediaId
) {

  const result =
    await appDb.query(
      `SELECT
         hm.*,

         ha.content_type AS article_content_type,
         ha.topic_id,
         ha.help_key_id

       FROM help_media hm

       JOIN help_articles ha
         ON ha.id = hm.article_id

       WHERE hm.id = $1
         AND hm.scope = 'SYSTEM'
         AND ha.scope = 'SYSTEM'

       LIMIT 1`,
      [mediaId]
    );


  return result.rows[0] || null;
}

// ---------------------------------
// GET SYSTEM HELP MEDIA FOR ARTICLE
// ---------------------------------
async function getSystemMediaForArticle(
  articleId
) {

  const result =
    await appDb.query(
      `SELECT *
       FROM help_media

       WHERE article_id = $1
         AND scope = 'SYSTEM'

       ORDER BY created_at`,
      [articleId]
    );


  return result.rows;
}


// ---------------------------------
// GET SAVED SYSTEM CONTENT FOR ARTICLE
// ---------------------------------
async function getSystemContentForArticle(
  articleId
) {

  const result =
    await appDb.query(
      `SELECT
         id,
         article_id,
         status,
         content_json

       FROM help_content

       WHERE article_id = $1
         AND scope = 'SYSTEM'`,
      [articleId]
    );


  return result.rows;
}

// ---------------------------------
// DELETE SYSTEM HELP MEDIA ROW
// ---------------------------------
async function deleteSystemMedia(
  mediaId
) {

  const result =
    await appDb.query(
      `DELETE FROM help_media

       WHERE id = $1
         AND scope = 'SYSTEM'

       RETURNING *`,
      [mediaId]
    );


  return result.rows[0] || null;
}

module.exports = {
  getTopics,
  getKeys,
  getSystemContent,
  getSystemContentById,
  getPublishedSystemContentByKey,
  getHelpNavigationByKey,
  getRelatedHelpByKey,
  getSystemDraftByHelpKey,
  createSystemContent,
  createDraftFromPublished,
  updateSystemContent,
  publishSystemContent,

  getArticleById,
  createSystemMedia,
  getSystemMediaById,
  getSystemMediaForArticle,
  getSystemContentForArticle,
  deleteSystemMedia
};