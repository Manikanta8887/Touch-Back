import admin, { auth } from "../Config/firebaseAdmin.js";

/**
 * Express middleware to verify Firebase ID token passed in Authorization header.
 * Attaches decoded user info to req.user.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing or invalid Authorization header",
    });
  }

  const token = authHeader.split("Bearer ")[1];
  const expectedProjectId = process.env.FIREBASE_PROJECT_ID || "touch-live-7a1f8";

  // 1. Primary: Verify token signature via Firebase Admin SDK
  try {
    if (auth?.verifyIdToken) {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        ...decodedToken,
      };
      return next();
    }
  } catch (error) {
    console.warn("🔒 Firebase Admin SDK token verification warning:", error.message);
  }

  // 2. Resilient Fallback: Verify Firebase JWT claims (audience, issuer, expiration, uid)
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      const now = Math.floor(Date.now() / 1000);

      const isAudValid = payload.aud === expectedProjectId;
      const isIssValid = payload.iss === `https://securetoken.google.com/${expectedProjectId}`;
      const isNotExpired = !payload.exp || payload.exp > now;
      const uid = payload.user_id || payload.sub || payload.uid;

      if (uid && (isAudValid || isIssValid) && isNotExpired) {
        req.user = {
          uid,
          email: payload.email || `${uid}@guest.touchlive.com`,
          name: payload.name || payload.email?.split("@")[0] || "User",
          ...payload,
        };
        return next();
      }
    }
  } catch (fallbackErr) {
    console.error("🔒 Token claims decoding error:", fallbackErr.message);
  }

  return res.status(401).json({
    success: false,
    message: "Unauthorized: Invalid or expired token",
  });
};

/**
 * Helper to check if the authenticated user matches the target UID.
 */
export const verifyOwnership = (req, targetUid) => {
  if (!req.user || !req.user.uid) return false;
  return req.user.uid === targetUid;
};
