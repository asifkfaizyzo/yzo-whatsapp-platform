import { Router } from "express";
import {
  getPlans,
  getPublicPlans,
  getPlan,
  createPlan,
  updatePlan,
  toggleStatus,
  deletePlan,
  getFeatures,
  createFeature,
  deleteFeature,
  createPaymentOrder,      
  verifyPaymentAndActivate,
} from "./planController.js";
import {verifySuperAdmin} from "../../middlewares/authSuperAdmin.js"
import { verifyTenantOrUser } from "../../middlewares/authVerfyTenOrUser.js"

const router = Router();

// ── Public routes (no auth — for tenant pricing page) ──
router.get("/public", getPublicPlans);
router.get("/features", getFeatures);

// ── Razorpay routes (tenant auth) ── ✅ Add these
router.post("/create-order", verifyTenantOrUser, createPaymentOrder);
router.post("/verify-payment", verifyTenantOrUser, verifyPaymentAndActivate);

// ── Protected routes (superadmin only) ──
router.use(verifySuperAdmin);

router.get("/", getPlans);
router.get("/:id", getPlan);
router.post("/", createPlan);
router.put("/:id", updatePlan);
router.patch("/:id/toggle-status", toggleStatus);
router.delete("/:id", deletePlan);

router.post("/features/create", createFeature);
router.delete("/features/:id", deleteFeature);

export default router;