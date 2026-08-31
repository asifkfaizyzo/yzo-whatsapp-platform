// src/modules/automation/flowController.js

import flowService from "./flowService.js";
import { checkLimitAccess } from "../../lib/planLimits.js";

const flowController = {
  // ── GET /api/flows ──
  getAllFlows: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const flows = await flowService.getAllFlows(tenantId);
      res.json({ success: true, data: flows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── GET /api/flows/:id ──
  getFlow: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const flow = await flowService.getFlowById(req.params.id, tenantId);
      if (!flow) {
        return res.status(404).json({
          success: false,
          message: "Flow not found",
        });
      }
      res.json({ success: true, data: flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── POST /api/flows ──
  createFlow: async (req, res) => {
    try {
      const tenantId = req.tenantId;

      // Check maxAutomations limit
      const limitCheck = await checkLimitAccess(tenantId, "maxAutomations");
      if (!limitCheck.allowed) {
        return res.status(limitCheck.status).json({
          success: false,
          code: limitCheck.code,
          message: limitCheck.message,
        });
      }

      const flow = await flowService.createFlow(tenantId, req.body);
      res.status(201).json({ success: true, data: flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── PUT /api/flows/:id ──
  saveFlow: async (req, res) => {
    try {
      console.log("📥 saveFlow controller hit");
      console.log("   flowId  :", req.params.id);
      console.log("   body keys:", Object.keys(req.body));
      console.log("   nodes count:", req.body.nodes?.length);

      const tenantId = req.tenantId;
      const flow = await flowService.saveFlow(
        req.params.id,
        tenantId,
        req.body,
      );
      res.json({ success: true, data: flow });
    } catch (error) {
      console.error("❌ saveFlow controller error:", error); // ⭐ ADD THIS
      console.error("❌ error message:", error.message); // ⭐ ADD THIS
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── DELETE /api/flows/:id ──
  deleteFlow: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      await flowService.deleteFlow(req.params.id, tenantId);
      res.json({ success: true, message: "Flow deleted successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── PATCH /api/flows/:id/toggle ──
  toggleFlow: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const { isActive } = req.body;
      const flow = await flowService.toggleFlow(
        req.params.id,
        tenantId,
        isActive,
      );
      res.json({ success: true, data: flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── PATCH /api/flows/:id/set-default ──
    // ── PATCH /api/flows/:id/set-default ──
  setDefault: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const flow = await flowService.setDefaultFlow(req.params.id, tenantId);
      res.json({ success: true, data: flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── PATCH /api/flows/:id/unset-default ──
  unsetDefault: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const flow = await flowService.unsetDefaultFlow(req.params.id, tenantId);
      res.json({ success: true, data: flow });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── GET /api/flows/:id/keywords ──
  getKeywords: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const flow = await flowService.getFlowById(req.params.id, tenantId);
      res.json({ success: true, data: flow.keywords });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── POST /api/flows/:id/keywords ──
  addKeywords: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const flowId = req.params.id;

      // ⭐ DEBUG - see exactly what's coming in
      console.log("🔍 Content-Type:", req.headers["content-type"]);
      console.log("🔍 Full req.body:", JSON.stringify(req.body));
      console.log("🔍 keywords value:", req.body.keywords);
      console.log("🔍 typeof keywords:", typeof req.body.keywords);

      const { keywords } = req.body;

      console.log("📋 req.body:", req.body);
      console.log("📋 keywords:", keywords);

      // ⭐ VALIDATE
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({
          success: false,
          message: "keywords must be a non-empty array",
        });
      }

      await flowService.addKeywords(req.params.id, tenantId, keywords);
      res.json({ success: true, message: "Keywords added successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── DELETE /api/flows/keywords/:keywordId ──
  removeKeyword: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      await flowService.removeKeyword(req.params.keywordId, tenantId);
      res.json({ success: true, message: "Keyword removed successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ── GET /api/flows/keywords/all ──
  getAllKeywords: async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const keywords = await flowService.getAllKeywords(tenantId);
      res.json({ success: true, data: keywords });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default flowController;
