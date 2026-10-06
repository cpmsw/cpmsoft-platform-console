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

  try {

    const result =
      await appDb.query(
        `INSERT INTO help_content (
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
           'SYSTEM',
           NULL,
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           'DRAFT',
           $9,
           $10,
           $10,
           now(),
           now()
         )
         RETURNING *`,
        [
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

    return result.rows[0];

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
           'SYSTEM',
           NULL,
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           'DRAFT',
           $9,
           $10,
           $10,
           now(),
           now()
         )
         RETURNING *`,
        [
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


module.exports = {
  getTopics,
  getKeys,
  getSystemContent,
  getSystemContentById,
  getPublishedSystemContentByKey,
  getSystemDraftByHelpKey,
  createSystemContent,
  createDraftFromPublished,
  updateSystemContent,
  publishSystemContent
};