const bcrypt = require("bcryptjs");

const authDb =
  require("../../db/authDb");


async function getAdminByEmail(email) {

  const result =
    await authDb.query(
      `SELECT
         id,
         email,
          display_name,
          theme_mode,
          accent_theme,
          password_hash,
         twofa_secret,
         twofa_enabled,
         is_active,
         is_verified,
         failed_login_attempts,
         locked_until,
         last_login_at
       FROM platform_admins
       WHERE lower(email) =
         lower($1)
       LIMIT 1`,
      [email]
    );

  return result.rows[0] || null;
}


async function verifyPassword(
  password,
  passwordHash
) {
  return bcrypt.compare(
    password,
    passwordHash
  );
}


async function recordFailedLogin(admin) {

  const attempts =
    (admin.failed_login_attempts || 0) + 1;

  let lockedUntil = null;

  if (attempts >= 5) {
    lockedUntil =
      new Date(
        Date.now() +
        15 * 60 * 1000
      );
  }

  await authDb.query(
    `UPDATE platform_admins
     SET failed_login_attempts = $2,
         locked_until = $3,
         updated_at = now()
     WHERE id = $1`,
    [
      admin.id,
      attempts,
      lockedUntil
    ]
  );
}


async function clearFailedLogin(adminId) {

  await authDb.query(
    `UPDATE platform_admins
     SET failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

async function saveTwoFactorSecret(
  adminId,
  secret
) {
  await authDb.query(
    `UPDATE platform_admins
     SET twofa_secret = $2,
         twofa_enabled = false,
         updated_at = now()
     WHERE id = $1`,
    [
      adminId,
      secret
    ]
  );
}


async function getAdminById(adminId) {
  const result =
    await authDb.query(
      `SELECT
         id,
         email,
          display_name,
          theme_mode,
          accent_theme,
          password_hash,
         twofa_secret,
         twofa_enabled,
         is_active,
         failed_login_attempts,
         locked_until,
         last_login_at
       FROM platform_admins
       WHERE id = $1
       LIMIT 1`,
      [adminId]
    );

  return result.rows[0] || null;
}


async function enableTwoFactor(
  adminId
) {
  await authDb.query(
    `UPDATE platform_admins
     SET twofa_enabled = true,
         last_login_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

async function recordSuccessfulLogin(
  adminId
) {
  await authDb.query(
    `UPDATE platform_admins
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

async function updateTheme(
  adminId,
  themeMode,
  accentTheme
) {
  const result =
    await authDb.query(
      `UPDATE platform_admins
       SET theme_mode = $2,
           accent_theme = $3,
           updated_at = now()
       WHERE id = $1
       RETURNING
         theme_mode,
         accent_theme`,
      [
        adminId,
        themeMode,
        accentTheme
      ]
    );

  return result.rows[0] || null;
}

async function updatePassword(
  adminId,
  passwordHash
) {
  const result =
    await authDb.query(
      `UPDATE platform_admins
       SET password_hash = $2,
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [
        adminId,
        passwordHash
      ]
    );

  return result.rows[0] || null;
}


async function getAdminForPasswordReset(
  email
) {
  const result =
    await authDb.query(
      `SELECT
         id,
         display_name,
         reset_code,
         reset_code_expires
       FROM platform_admins
       WHERE LOWER(email) = LOWER($1)
         AND is_active = true`,
      [email]
    );

  return result.rows[0] || null;
}


async function setPasswordResetCode(
  adminId,
  resetCode,
  expires
) {
  await authDb.query(
    `UPDATE platform_admins
     SET reset_code = $2,
         reset_code_expires = $3,
         updated_at = now()
     WHERE id = $1`,
    [
      adminId,
      resetCode,
      expires
    ]
  );
}


async function clearPasswordResetCode(
  adminId
) {
  await authDb.query(
    `UPDATE platform_admins
     SET reset_code = NULL,
         reset_code_expires = NULL,
         updated_at = now()
     WHERE id = $1`,
    [adminId]
  );
}

// ---------------------------------
// GET PLATFORM ADMIN BY
// ACTIVATION INVITATION TOKEN
// ---------------------------------
async function getAdminByInvitationTokenHash(
  tokenHash
) {

  const result =
    await authDb.query(
      `SELECT
         id,
         email,
         display_name,
         is_active,
         is_verified,
         twofa_enabled,
         verification_code,
         verification_expires,
         activation_invitation_expires_at
       FROM platform_admins
       WHERE activation_invitation_token_hash = $1
       LIMIT 1`,
      [
        tokenHash
      ]
    );


  return result.rows[0] || null;
}

// ---------------------------------
// SET ACTIVATION VERIFICATION CODE
// ---------------------------------
async function setActivationVerificationCode(
  adminId,
  verificationCode,
  expires
) {

  await authDb.query(
    `UPDATE platform_admins
     SET
       verification_code = $2,
       verification_expires = $3,
       updated_at = NOW()
     WHERE id = $1`,
    [
      adminId,
      verificationCode,
      expires
    ]
  );
}


// ---------------------------------
// ACTIVATE PLATFORM ADMIN
// ---------------------------------
async function activatePlatformAdmin(
  adminId,
  passwordHash
) {

  const client =
    await authDb.connect();


  try {

    await client.query(
      "BEGIN"
    );


    const result =
      await client.query(
        `UPDATE platform_admins
         SET
           password_hash = $2,
           is_verified = true,
           verified_at = NOW(),
           verification_code = NULL,
           verification_expires = NULL,
           activation_invitation_token_hash = NULL,
           activation_invitation_expires_at = NULL,
           updated_at = NOW()
         WHERE id = $1
           AND is_active = true
           AND is_verified = false
         RETURNING
           id,
           email,
           display_name,
           is_active,
           is_verified,
           twofa_enabled,
           verified_at`,
        [
          adminId,
          passwordHash
        ]
      );


    await client.query(
      "COMMIT"
    );


    return result.rows[0] || null;


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;


  } finally {

    client.release();
  }
}

function validatePassword(password) {

  if (
    !password ||
    password.length < 8
  ) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }

  return null;
}

module.exports = {
  getAdminByEmail,
  getAdminForPasswordReset,
  setPasswordResetCode,
  clearPasswordResetCode,
  getAdminById,

  getAdminByInvitationTokenHash,
  setActivationVerificationCode,
  activatePlatformAdmin,

  verifyPassword,
  updatePassword,
  validatePassword,
  recordFailedLogin,
  clearFailedLogin,
  saveTwoFactorSecret,
  enableTwoFactor,
  recordSuccessfulLogin,
  updateTheme
};