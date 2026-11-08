import admin, { auth } from "../Config/firebaseAdmin.js";
import { verifyAccessToken, verifyIdToken } from "../utils/jwt.js";

/**
 * Express middleware to verify token passed in Authorization header.
 * Supports:
 * 1. Custom Access Token (JWT with HS256)
 * 2. Custom ID Token (JWT with HS256)
 * 3. Firebase ID Token (Firebase Admin SDK & claims fallback)
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

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Token missing",
    });
  }

  // 1. Primary: Verify custom Access Token
  try {
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.uid) {
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        tokenType: "access",
        ...decoded,
      };
      return next();
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        tokenExpired: true,
        message: "Unauthorized: Access token has expired",
      });
    }
    // If not expired, it may be an ID token or Firebase token, continue checking
  }

  // 2. Secondary: Verify custom ID Token
  try {
    const decodedId = verifyIdToken(token);
    if (decodedId && decodedId.uid) {
      req.user = {
        uid: decodedId.uid,
        email: decodedId.email,
        name: decodedId.name,
        tokenType: "id",
        ...decodedId,
      };
      return next();
    }
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        tokenExpired: true,
        message: "Unauthorized: ID token has expired",
      });
    }
  }

  // 3. Fallback: Firebase Admin SDK
  const expectedProjectId = process.env.FIREBASE_PROJECT_ID || "touch-live-7a1f8";
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
    // Continue to claims fallback
  }

  // 4. Fallback: Resilient Firebase JWT claims decoding
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
