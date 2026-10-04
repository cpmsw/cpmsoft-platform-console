const fs = require("fs");

function loadEnvFile(filePath) {
  const lines =
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/);

  for (const line of lines) {
    const text = line.trim();

    if (!text || text.startsWith("#")) {
      continue;
    }

    const index = text.indexOf("=");

    if (index < 1) {
      continue;
    }

    const key =
      text.substring(0, index).trim();

    const value =
      text.substring(index + 1).trim();

    process.env[key] = value;
  }
}

loadEnvFile("/etc/cpmsoft/cpmsoft.env");

module.exports = {
  apps: [
    {
      name:
        "cpmsoft-platform-console",

      cwd:
        "/var/www/backend/cpmsoft-platform-console",

      script:
        "server.js",

      env: {
        NODE_ENV:
          "production",

        HOST:
          "127.0.0.1",

        PORT:
          "4100",

        DB_PASSWORD:
          process.env.DB_PASSWORD,

        PLATFORM_JWT_SECRET:
          process.env.PLATFORM_JWT_SECRET,

        SMTP_HOST:
          process.env.SMTP_HOST,

        SMTP_PORT:
          process.env.SMTP_PORT,

        SMTP_USER:
          process.env.SMTP_USER,

        SMTP_PASS:
          process.env.SMTP_PASS,

        SMTP_FROM:
          process.env.SMTP_FROM,

        ATTACHMENT_STORAGE_PROVIDER:
          process.env.ATTACHMENT_STORAGE_PROVIDER,

        ATTACHMENT_S3_BUCKET:
          process.env.ATTACHMENT_S3_BUCKET,

        ATTACHMENT_S3_REGION:
          process.env.ATTACHMENT_S3_REGION,

        ATTACHMENT_S3_PREFIX:
          process.env.ATTACHMENT_S3_PREFIX,

        ATTACHMENT_MAX_FILES_PER_UPLOAD:
          process.env.ATTACHMENT_MAX_FILES_PER_UPLOAD,

        ATTACHMENT_MAX_FILE_SIZE_MB:
          process.env.ATTACHMENT_MAX_FILE_SIZE_MB
      }
    }
  ]
};