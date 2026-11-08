import express from "express";
import {
  issueTokens,
  refreshTokens,
  revokeToken,
  getMe,
} from "../Controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public auth endpoints
router.post("/tokens", issueTokens);
router.post("/refresh", refreshTokens);
router.post("/logout", revokeToken);

// Protected auth endpoints
router.get("/me", authenticate, getMe);

export default router;

