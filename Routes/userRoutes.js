import express from "express";
import { saveUser, getAllUsers } from "../Controllers/userController.js";
import { authenticate } from "../middleware/auth.js";
import { validateUserSave } from "../middleware/validator.js";

const router = express.Router();

router.post("/", authenticate, validateUserSave, saveUser);
// P2-1/SEC-003: Authenticated route — no email in public responses
router.get("/", authenticate, getAllUsers);

export default router;
