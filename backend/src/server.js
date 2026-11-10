// backend/src/server.js (do not remove this comment)

import dotenv from "dotenv";
dotenv.config();

// ? Environment variables check
const requiredEnvVars = ["DATABASE_URL", "ACCESS_SECRET", "REFRESH_SECRET"];
const missingEnvs = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvs.length > 0) {
  console.error(
    `? FATAL: Missing required environment variables: ${missingEnvs.join(", ")}`,
  );
  process.exit(1);
}

import http from "http";
import app from "./app.js";
import { initSocket } from "./lib/socket.js";
import { startWebhookWorker } from "./cron/workers/webhook.worker.js";
import { startOrderWebhookWorker } from "./cron/workers/order-webhook.worker.js";
import { startBroadcastWorker } from "./cron/workers/broadcast.worker.js";
import { startCallMediaWorker } from "./cron/workers/call-media.worker.js";
import { startCleanupWorker } from "./cron/jobs/abandoned-accounts.job.js";
import "./cron/jobs/expired-subscriptions.job.js";
import "./cron/jobs/expiry-reminders.job.js";
import { startAuditCleanupJob } from "./cron/jobs/audit-cleanup.job.js";
import { startWebhookEventsCleanupJob } from "./cron/jobs/webhook-cleanup.job.js";
import { initQuickReplyIndexes } from "./scripts/initQuickReplyIndexes.js";
import { startZohoSyncWorker } from "./cron/workers/zoho-sync.worker.js";
import { startZohoStaleTaskJob } from "./cron/jobs/zoho-stale-task.job.js";
import { startZohoWatchRenewalJob } from "./cron/jobs/zoho-watch-renewal.job.js";
import { initializeMediasoup } from "./lib/mediasoup/mediasoup.service.js";
import {
  processLowStockAlerts,
  processDailyBusinessSummary,
} from "./modules/woocommerce/woocommerce.alert.service.js";
import { runShopifyReorderReminders } from "./cron/jobs/shopify-reorder.job.js";
import { runShopifyWinBackCampaign } from "./cron/jobs/shopify-win-back.job.js";

import { redisConnection } from "./config/redis.js";

const port = process.env.PORT || 5000;

// Wrap Express app in HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start BullMQ Background Workers & Cleanup Workers
const webhookWorker = startWebhookWorker();
const orderWebhookWorker = startOrderWebhookWorker();
const broadcastWorker = startBroadcastWorker();
const callMediaWorker = startCallMediaWorker();
const zohoSyncWorker = startZohoSyncWorker();
startCleanupWorker();
startAuditCleanupJob();
startWebhookEventsCleanupJob();
startZohoStaleTaskJob();
startZohoWatchRenewalJob(); // ? Handled and running alongside workers
initQuickReplyIndexes();
console.log("?? Background workers and cleanup tasks started successfully!");

// Initialize Mediasoup for WebRTC Calling
initializeMediasoup().catch((err) => {
  console.error("? Failed to initialize Mediasoup:", err);
  process.exit(1);
});

server.listen(port, () => {
  console.log(
    `?? Server is running on http://localhost:${port} [Updated Enum Fix: ${new Date().toISOString()}]`,
  );

  // -- Low Stock Alerts (every 1 hour) ----------------------------------
  setInterval(
    () => {
      console.log("[Scheduler] Running Low Stock Check...");
      processLowStockAlerts().catch((err) =>
        console.error("[Low Stock Scheduler] Error:", err.message),
      );
    },
    60 * 60 * 1000,
  );
  console.log("? [Cron] Low Stock Alerts scheduled (runs every 1 hour)");

  // -- Daily Business Summary (every 1 hour; service checks the hour) --
  setInterval(
    () => {
      console.log("[Scheduler] Checking for Daily Summaries...");
      processDailyBusinessSummary().catch((err) =>
        console.error("[Daily Summary Scheduler] Error:", err.message),
      );
    },
    60 * 60 * 1000,
  );
  console.log("? [Cron] Daily Business Summary scheduled (runs every 1 hour)");

  // -- Shopify Reorder Reminders (runs daily) --
  setInterval(
    () => {
      runShopifyReorderReminders().catch((err) =>
        console.error("[Shopify Reorder Scheduler] Error:", err.message),
      );
    },
    60 * 60 * 1000,
  );
  console.log(
    "? [Cron] Shopify Reorder Reminders scheduled (runs every 1 hour)",
  );

  // -- Shopify Win-Back Campaigns (runs daily) --
  setInterval(
    () => {
      runShopifyWinBackCampaign().catch((err) =>
        console.error("[Shopify Win-Back Scheduler] Error:", err.message),
      );
    },
    60 * 60 * 1000,
  );
  console.log(
    "? [Cron] Shopify Win-Back Campaigns scheduled (runs every 1 hour)",
  );
});

// ------------- Graceful Shutdown for PM2 / Docker / Systemd -------------
const gracefulShutdown = async (signal) => {
  console.log(`\n?? Received ${signal}. Initiating graceful shutdown...`);

  // Stop accepting new incoming HTTP requests
  server.close(async () => {
    console.log("?? HTTP server stopped.");
    try {
      // Allow active BullMQ worker jobs to finish safely
      if (webhookWorker) await webhookWorker.close();
      if (orderWebhookWorker) await orderWebhookWorker.close();
      if (broadcastWorker) await broadcastWorker.close();
      if (callMediaWorker) await callMediaWorker.close();
      if (zohoSyncWorker) await zohoSyncWorker.close();
      console.log("?? BullMQ workers closed successfully.");

      // Safely close Redis connection
      await redisConnection.quit();
      console.log("? Redis connection closed.");

      process.exit(0);
    } catch (err) {
      console.error("? Error during graceful shutdown:", err);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
