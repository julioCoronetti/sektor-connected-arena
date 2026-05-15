const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({ region: process.env.AWS_REGION });

const REQUIRED_ENV = ["MEDIA_BUCKET"];
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const URL_TTL_SECONDS = 300;

function assertEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      console.error(
        JSON.stringify({ level: "ERROR", message: "missing env", env: key }),
      );
      throw new Error(`Missing env var: ${key}`);
    }
  }
}

function ok(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function err(statusCode, message) {
  return ok(statusCode, { error: message });
}

function getClaims(event) {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims || !claims.sub) return null;
  return claims;
}

function sanitize(name) {
  return String(name).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
}

exports.handler = async (event) => {
  assertEnv();

  const claims = getClaims(event);
  if (!claims) return err(401, "unauthenticated");

  const qs = event?.queryStringParameters || {};
  const filename = qs.filename;
  const type = qs.type;

  if (typeof filename !== "string" || filename.length === 0) {
    return err(400, "filename required");
  }

  if (!ALLOWED.has(type)) {
    return err(400, "unsupported type");
  }

  const bucket = process.env.MEDIA_BUCKET;
  const key = `posts/${claims.sub}/${Date.now()}-${sanitize(filename)}`;

  let uploadUrl;
  try {
    uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: type,
      }),
      { expiresIn: URL_TTL_SECONDS },
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "presign failed",
        userId: claims.sub,
        key,
        cause: e.message,
      }),
    );
    return err(500, "internal");
  }

  const fileUrl = `https://sektor-media-bucket.s3.us-east-1.amazonaws.com/${key}`;

  return ok(200, { uploadUrl, fileUrl });
};

module.exports.sanitize = sanitize;
