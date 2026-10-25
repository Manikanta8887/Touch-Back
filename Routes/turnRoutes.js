import express from "express";
import { getTurnCredentials } from "../Controllers/turnController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// SEC-008: TURN credentials must be authenticated to prevent Xirsys credential exposure
router.get("/", authenticate, getTurnCredentials);

export default router;
