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
  adminId
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
           1,
           $9,
           $9,
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
          adminId
        ]
      );

    return result.rows[0];

  } catch (error) {

    if (error.code === "23505") {

      const duplicate =
        new Error(
          "SYSTEM Help content already exists for this Help key."
        );

      duplicate.statusCode = 409;
      duplicate.code =
        "HELP_CONTENT_EXISTS";

      throw duplicate;
    }

    throw error;
  }
}


// ---------------------------------
// UPDATE SYSTEM HELP CONTENT
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
          "SYSTEM Help content already exists for this Help key."
        );

      duplicate.statusCode = 409;
      duplicate.code =
        "HELP_CONTENT_EXISTS";

      throw duplicate;
    }

    throw error;
  }
}


// ---------------------------------
// PUBLISH SYSTEM HELP CONTENT
// ---------------------------------
async function publishSystemContent(
  id,
  adminId
) {

  const result =
    await appDb.query(
      `UPDATE help_content
       SET
         status = 'PUBLISHED',
         published_by = $2,
         published_at = now(),
         updated_by = $2,
         updated_at = now()
       WHERE id = $1
         AND scope = 'SYSTEM'
       RETURNING *`,
      [
        id,
        adminId
      ]
    );

  return result.rows[0] || null;
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