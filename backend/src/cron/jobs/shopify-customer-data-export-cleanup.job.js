
import cron from "node-cron";

import {
  cleanupExpiredShopifyCustomerDataExports,
} from "../../modules/shopify/maintenance/shopify.customerDataExport.cleanup.service.js";

export const startShopifyCustomerDataExportCleanupJob = () => {
  // Runs daily at 04:00 AM.
  cron.schedule("0 4 * * *", async () => {
    console.log(
      "[ShopifyExportCleanup] Starting scheduled expired export cleanup...",
    );

    try {
      await cleanupExpiredShopifyCustomerDataExports();
    } catch (error) {
      console.error(
        "[ShopifyExportCleanup] Scheduled cleanup failed:",
        error.message,
      );
    }
  });

  console.log(
    "[ShopifyExportCleanup] Job scheduled — runs daily at 04:00 AM.",
  );
};
