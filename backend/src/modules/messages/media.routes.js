// backend/src/modules/messages/media.routes.js (do not remove this comment)

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { serveMediaFile, refreshMediaUrl } from "./media.controller.js";

const router = express.Router();

// Public - signed URL is self authenticating
router.get("/serve", serveMediaFile);

// Protected - needs auth token to refresh URL
router.get("/refresh/:messageId", authenticate, requireTenantOrUser, refreshMediaUrl);

export default router;
