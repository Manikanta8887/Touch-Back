import express from "express";
import upload from "../middleware/upload.js";
import {
  uploadVideo,
  getUserVideos,
  getAllVideos,
  deleteVideo,
  likeVideo,
  viewVideo,
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
router.post("/like/:videoId", likeVideo);
router.post("/view/:videoId", viewVideo);

// public_id can contain slashes, so accept it via query param
router.delete("/", authenticate, deleteVideo);

export default router;
