import express from "express";
import { getUserProfile, toggleSubscribe, getSubscribedChannels } from "../Controllers/userProfile.js";
import updateUserProfile from "../Controllers/bioUpdate.js";
import { authenticate } from "../middleware/auth.js";
import { validateProfileUpdate } from "../middleware/validator.js";

const router = express.Router();

router.get("/subscriptions/:uid", getSubscribedChannels);
router.get("/:uid", getUserProfile);
router.put("/:uid", authenticate, validateProfileUpdate, updateUserProfile);
router.post("/subscribe/:uid", toggleSubscribe);

export default router;
