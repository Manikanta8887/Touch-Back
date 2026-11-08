import crypto from "crypto";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "touch_live_access_secret_2026_!@#$%^&*()";
const ID_SECRET = process.env.JWT_ID_SECRET || "touch_live_id_secret_2026_!@#$%^&*()";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "touch_live_refresh_secret_2026_!@#$%^&*()";

const base64urlEncode = (buffer) => {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const base64urlDecode = (str) => {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
};

/**
 * Sign standard HS256 JWT
 */
export const signJwt = (payload, secret, expiresInSeconds = 900) => {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64urlEncode(Buffer.from(JSON.stringify(header), "utf8"));
  const encodedPayload = base64urlEncode(Buffer.from(JSON.stringify(fullPayload), "utf8"));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest();

  const encodedSignature = base64urlEncode(signature);
  return `${dataToSign}.${encodedSignature}`;
};

/**
 * Verify standard HS256 JWT
 */
export const verifyJwt = (token, secret) => {
  if (!token || typeof token !== "string") {
    throw new Error("Token missing or not a string");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest();

  const providedSignature = base64urlDecode(encodedSignature);

  if (
    expectedSignature.length !== providedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new Error("Invalid token signature");
  }

  const payloadJson = base64urlDecode(encodedPayload).toString("utf8");
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    const expError = new Error("Token expired");
    expError.name = "TokenExpiredError";
    expError.expiredAt = new Date(payload.exp * 1000);
    throw expError;
  }

  return payload;
};

/**
 * Decode JWT payload without verification
 */
export const decodeJwt = (token) => {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = base64urlDecode(parts[1]).toString("utf8");
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
};

/**
 * Generate short-lived Access Token (15 minutes)
 */
export const generateAccessToken = (user) => {
  return signJwt(
    {
      uid: user.uid,
      email: user.email,
      name: user.name || user.displayName || "Streamer",
      type: "access",
    },
    ACCESS_SECRET,
    15 * 60 // 15 mins
  );
};

/**
 * Generate Identity Token containing user claims (1 hour)
 */
export const generateIdToken = (user) => {
  return signJwt(
    {
      uid: user.uid,
      email: user.email,
      name: user.name || user.displayName || "Streamer",
      profilePic: user.profilePic || user.photoURL || "",
      subscribersCount: user.subscribersCount || user.subscribers?.length || 0,
      type: "id",
    },
    ID_SECRET,
    60 * 60 // 1 hour
  );
};

/**
 * Generate long-lived Refresh Token (7 days)
 */
export const generateRefreshToken = (user) => {
  const jti = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  return signJwt(
    {
      uid: user.uid,
      type: "refresh",
      jti,
    },
    REFRESH_SECRET,
    7 * 24 * 60 * 60 // 7 days
  );
};

export const verifyAccessToken = (token) => verifyJwt(token, ACCESS_SECRET);
export const verifyIdToken = (token) => verifyJwt(token, ID_SECRET);
export const verifyRefreshToken = (token) => verifyJwt(token, REFRESH_SECRET);

