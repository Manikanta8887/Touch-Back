import express from "express";
import upload from "../middleware/upload.js";
import {
  uploadVideo,
  getUserVideos,
  getAllVideos,
  deleteVideo,
} from "../Controllers/videoController.js";
import { authenticate } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { validateVideoUpload } from "../middleware/validator.js";

const router = express.Router();

router.post(
  "/upload/:uid",
  authenticate,
  strictLimiter,
  upload.single("video"),
  validateVideoUpload,
  uploadVideo
);

router.get("/", getAllVideos);
router.get("/:uid", getUserVideos);

// public_id can contain slashes (e.g. touch_live_videos/uid/123), so accept it via query param
router.delete("/", authenticate, deleteVideo);

export default router;
