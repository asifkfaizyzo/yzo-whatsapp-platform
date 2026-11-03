const fs = require('fs');
const path = require('path');

function walk(dir) {
  let r = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) r = r.concat(walk(fp));
    else if (f.name.endsWith('.js')) r.push(fp);
  });
  return r;
}

const files = walk('src');
let fixCount = 0;

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  const orig = c;
  const isCron = f.split(path.sep).includes('cron');

  if (isCron) {
    c = c.replace(/from ['"]\.\.\/(config|modules|lib)\//g, "from '../../$1/");
    c = c.replace(/import\(['"]\.\.\/(config|modules|lib)\//g, "import('../../$1/");
    c = c.replace(/broadcastQueue\.js/g, 'broadcast.queue.js');
    c = c.replace(/callMediaQueue\.js/g, 'call-media.queue.js');
    c = c.replace(/dlqQueue\.js/g, 'dlq.queue.js');
    c = c.replace(/orderWebhookQueue\.js/g, 'order-webhook.queue.js');
    c = c.replace(/webhookQueue\.js/g, 'webhook.queue.js');
    c = c.replace(/zohoSyncQueue\.js/g, 'zoho-sync.queue.js');
  }

  if (!isCron) {
    c = c.replace(/workers\/cleanupWorker\.js/g, 'cron/jobs/abandoned-accounts.job.js');
    c = c.replace(/utils\/trackingHelper\.js/g, 'lib/utils/tracking.helper.js');
    c = c.replace(/services\/pushService\.js/g, 'modules/notifications/push.service.js');
    c = c.replace(/(\/)(queues\/)/g, '$1cron/$2');
    c = c.replace(/(\/)(workers\/)/g, '$1cron/$2');
    c = c.replace(/(\/)(jobs\/)/g, '$1cron/$2');
    c = c.replace(/broadcastQueue\.js/g, 'broadcast.queue.js');
    c = c.replace(/callMediaQueue\.js/g, 'call-media.queue.js');
    c = c.replace(/dlqQueue\.js/g, 'dlq.queue.js');
    c = c.replace(/orderWebhookQueue\.js/g, 'order-webhook.queue.js');
    c = c.replace(/webhookQueue\.js/g, 'webhook.queue.js');
    c = c.replace(/zohoSyncQueue\.js/g, 'zoho-sync.queue.js');
    c = c.replace(/broadcastWorker\.js/g, 'broadcast.worker.js');
    c = c.replace(/callMediaWorker\.js/g, 'call-media.worker.js');
    c = c.replace(/orderWebhookWorker\.js/g, 'order-webhook.worker.js');
    c = c.replace(/webhookWorker\.js/g, 'webhook.worker.js');
    c = c.replace(/zohoSyncWorker\.js/g, 'zoho-sync.worker.js');
    c = c.replace(/auditCleanupJob\.js/g, 'audit-cleanup.job.js');
    c = c.replace(/checkExpiredSubscriptions\.js/g, 'expired-subscriptions.job.js');
    c = c.replace(/cleanupWebhookEventsJob\.js/g, 'webhook-cleanup.job.js');
    c = c.replace(/expiryRemindersJob\.js/g, 'expiry-reminders.job.js');
    c = c.replace(/shopifyReorderReminderJob\.js/g, 'shopify-reorder.job.js');
    c = c.replace(/shopifyWinBackJob\.js/g, 'shopify-win-back.job.js');
    c = c.replace(/zohoStaleTaskJob\.js/g, 'zoho-stale-task.job.js');
    c = c.replace(/zohoWatchRenewalJob\.js/g, 'zoho-watch-renewal.job.js');
  }

  c = c.replace(/src\/queues\//g, 'src/cron/queues/');
  c = c.replace(/src\/workers\//g, 'src/cron/workers/');
  c = c.replace(/src\/jobs\//g, 'src/cron/jobs/');
  c = c.replace(/src\/services\/pushService/g, 'src/modules/notifications/push.service');
  c = c.replace(/src\/utils\/trackingHelper/g, 'src/lib/utils/tracking.helper');

  if (c !== orig) {
    fs.writeFileSync(f, c, 'utf8');
    fixCount++;
  }
});
console.log('Fixed ' + fixCount + ' files');