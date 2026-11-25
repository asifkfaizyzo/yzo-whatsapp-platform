// backend/src/modules/tags/tag.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import {
  createTag,
  getTags,
  assignUserToTag,
  changeUserTag,
} from "./tag.controller.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";

const router = express.Router();

router.post("/createtag", authenticate, requireTenant, createTag);

router.get("/get-all-tag", authenticate, requireTenantOrUser, getTags);
// "Assign a user to handle this tag"
router.post("/:tagId/assign-user", authenticate, requireTenant, assignUserToTag);
//change User from OldTag to newTag
router.patch("/users/:userId/change-tag", authenticate, requireTenant, changeUserTag);

export default router;
