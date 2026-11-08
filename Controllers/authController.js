import User from "../Models/user.js";
import RefreshToken from "../Models/refreshToken.js";
import {
  generateAccessToken,
  generateIdToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

/**
 * Issue new Access Token, ID Token, and Refresh Token
 * Called on login / signup / token exchange
 */
export const issueTokens = async (req, res) => {
  try {
    const { uid, email, name, profilePic } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "User UID is required to issue tokens",
      });
    }

    // Find or upsert user in MongoDB
    let user = await User.findOne({ uid });
    if (!user) {
      user = new User({
        uid,
        name: name || email?.split("@")[0] || "Streamer",
        email: email || `${uid}@guest.touchlive.com`,
        profilePic: profilePic || undefined,
        videos: [],
        subscribersCount: 0,
        subscribers: [],
        subscribedTo: [],
      });
      await user.save();
    } else {
      let changed = false;
      if (name && user.name !== name) {
        user.name = name;
        changed = true;
      }
      if (profilePic && user.profilePic !== profilePic) {
        user.profilePic = profilePic;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    }

    // Generate token trio
    const accessToken = generateAccessToken(user);
    const idToken = generateIdToken(user);
    const refreshToken = generateRefreshToken(user);

    // Persist refresh token in MongoDB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({
      token: refreshToken,
      uid: user.uid,
      expiresAt,
      createdByIp: req.ip || req.headers["x-forwarded-for"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Tokens issued successfully",
      tokenType: "Bearer",
      accessToken,
      idToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      user: {
        uid: user.uid,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        bio: user.bio,
        subscribersCount: user.subscribersCount || 0,
      },
    });
  } catch (error) {
    console.error("issueTokens error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error issuing authentication tokens",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

/**
 * Refresh access token & id token using valid refresh token (with token rotation)
 */
export const refreshTokens = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Missing refreshToken in request body",
      });
    }

    // 1. Verify token cryptographic signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.name === "TokenExpiredError" ? "Refresh token expired" : "Invalid refresh token",
      });
    }

    // 2. Check persistence and revocation in database
    const tokenDoc = await RefreshToken.findOne({ token: refreshToken });
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found or already invalidated",
      });
    }

    if (tokenDoc.revoked) {
      // Reuse detection: Invalidate all active tokens for this user
      await RefreshToken.updateMany({ uid: decoded.uid }, { $set: { revoked: true } });
      return res.status(401).json({
        success: false,
        message: "Revoked refresh token reuse detected. All sessions invalidated.",
      });
    }

    // 3. Lookup user
    const user = await User.findOne({ uid: decoded.uid });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User associated with refresh token not found",
      });
    }

    // 4. Issue new token trio
    const newAccessToken = generateAccessToken(user);
    const newIdToken = generateIdToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // 5. Rotate refresh token: revoke current and insert new
    tokenDoc.revoked = true;
    tokenDoc.replacedByToken = newRefreshToken;
    await tokenDoc.save();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      token: newRefreshToken,
      uid: user.uid,
      expiresAt,
      createdByIp: req.ip || req.headers["x-forwarded-for"] || null,
    });

    return res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      tokenType: "Bearer",
      accessToken: newAccessToken,
      idToken: newIdToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error("refreshTokens error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error refreshing tokens",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

/**
 * Revoke refresh token on logout
 */
export const revokeToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.updateMany(
        { token: refreshToken },
        { $set: { revoked: true } }
      );
    } else if (req.user?.uid) {
      // Revoke all tokens for current authenticated user
      await RefreshToken.updateMany(
        { uid: req.user.uid },
        { $set: { revoked: true } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully and refresh tokens revoked",
    });
  } catch (error) {
    console.error("revokeToken error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during token revocation",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

/**
 * Get current authenticated user details from token
 */
export const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findOne({ uid: req.user.uid });
    return res.status(200).json({
      success: true,
      user: user || req.user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error retrieving user data",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

