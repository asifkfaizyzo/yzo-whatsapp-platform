import prisma from '../../config/prisma.js';
import axios from 'axios';
import { sendMessageService } from '../messages/messageService.js';
import { emitToTenant } from '../../lib/socket.js';

/**
 * 1. 🆕 NEW ORDER ALERT
 * Triggered instantly from WooCommerce webhook
 */
export async function sendNewOrderAdminAlert(tenantId, wooOrderId, total, customerName, items) {
  try {
    const wooConn = await prisma.wooCommerceConnection.findUnique({
      where: { tenantId },
      include: { tenant: true },
    });

    if (!wooConn || !wooConn.newOrderAlert) return;

    // Use specific alert phone or fallback to tenant account phone
    const phoneToAlert = wooConn.alertPhone || wooConn.tenant.phone;
    if (!phoneToAlert) return;

    // 1. Send silent in-app badge notification to Dashboard
    emitToTenant(tenantId, 'notification', {
      title: 'New order from woocomm store',
      message: `Order #${wooOrderId} • ${customerName} • ₹${total}`,
      type: 'WOO_ORDER_ALERT',
      silent: true // No sound
    });

    // 2. Send WhatsApp Utility Message to Store Manager
    const messageBody = `🆕 *NEW ORDER RECEIVED!*\n\n*Order:* #${wooOrderId}\n*Customer:* ${customerName}\n*Amount:* ₹${total}\n*Items:* ${items.length} item(s)\n\n🔗 Manage in Sudo Reply dashboard.`;

    await sendSystemWhatsApp(tenantId, phoneToAlert, messageBody);
    console.log(`🔔 [Woo Alert] New Order #${wooOrderId} alert sent to ${phoneToAlert}`);

  } catch (error) {
    console.error(`❌ [Woo Alert] Failed to send new order alert:`, error.message);
  }
}

/**
 * 2. ⚠️ LOW INVENTORY ALERT
 * Polled by background worker (e.g., every 30 mins)
 */
export async function processLowStockAlerts() {
  console.log('📦 [Woo Alert] Scanning for low inventory...');

  const connections = await prisma.wooCommerceConnection.findMany({
    where: { lowStockAlert: true },
    include: { tenant: true },
  });

  for (const conn of connections) {
    try {
      const phoneToAlert = conn.alertPhone || conn.tenant.phone;
      if (!phoneToAlert || !conn.wpUrl || !conn.consumerKey) continue;

      const storeUrl = conn.wpUrl.replace(/\/+$/, '');
      const authHeader = `Basic ${Buffer.from(`${conn.consumerKey}:${conn.consumerSecret}`).toString('base64')}`;

      // Fetch products with manage_stock enabled
      const response = await axios.get(`${storeUrl}/wp-json/wc/v3/products`, {
        headers: { Authorization: authHeader },
        params: { manage_stock: true, per_page: 100 },
        timeout: 10000
      });

      const lowProducts = response.data.filter(p => 
        p.stock_quantity !== null && p.stock_quantity <= conn.lowStockThreshold
      );

      if (lowProducts.length === 0) continue;

      let cache = conn.lowStockAlertCache ? (typeof conn.lowStockAlertCache === 'string' ? JSON.parse(conn.lowStockAlertCache) : conn.lowStockAlertCache) : {};
      let alertSent = false;
      let alertMsg = `⚠️ *LOW STOCK ALERT*\n\nThe following products have ${conn.lowStockThreshold} or fewer units remaining:\n\n`;

      const now = Date.now();
      const OneDayMs = 24 * 60 * 60 * 1000;

      for (const p of lowProducts) {
        const lastAlerted = cache[p.id] || 0;
        // Anti-spam: Only alert if we haven't alerted for this product in 24 hours
        if (now - lastAlerted > OneDayMs) {
          alertMsg += `• ${p.name} (SKU: ${p.sku || 'N/A'})\n  *Stock:* ${p.stock_quantity} left\n\n`;
          cache[p.id] = now;
          alertSent = true;
        }
      }

      if (alertSent) {
        alertMsg += `💡 Please restock soon!`;
        await sendSystemWhatsApp(conn.tenantId, phoneToAlert, alertMsg);
        
        // Save updated cache
        await prisma.wooCommerceConnection.update({
          where: { id: conn.id },
          data: { lowStockAlertCache: cache }
        });
        
        console.log(`🔔 [Woo Alert] Low stock alert sent to ${phoneToAlert} for store ${storeUrl}`);
      }

    } catch (err) {
      console.error(`❌ [Woo Alert] Low stock scan failed for tenant ${conn.tenantId}:`, err.message);
    }
  }
}

/**
 * 3. 📊 DAILY BUSINESS SUMMARY
 * Polled by background worker (every hour, triggers at target local hour)
 */
export async function processDailyBusinessSummary() {
  console.log('📊 [Woo Alert] Checking for daily business summaries...');

  const connections = await prisma.wooCommerceConnection.findMany({
    where: { dailySummaryAlert: true },
    include: { tenant: true },
  });

  const now = new Date();
  const currentHourUTC = now.getUTCHours();

  for (const conn of connections) {
    try {
      const phoneToAlert = conn.alertPhone || conn.tenant.phone;
      if (!phoneToAlert) continue;

      // Adjust for Indian Standard Time (IST = UTC + 5.5) -> Approx mapping for target hour
      // For precision, we assume tenant is in IST. (21:00 IST = 15:30 UTC. We'll run matching on target hour roughly)
      const istHour = (currentHourUTC + 5.5) % 24;
      
      // If we are within the target hour (e.g. 21) and haven't sent today
      if (Math.floor(istHour) === conn.dailySummaryHour) {
        const lastSent = conn.lastDailySummaryAt;
        if (lastSent && (now.getTime() - lastSent.getTime() < 12 * 60 * 60 * 1000)) {
          continue; // Already sent recently
        }

        // Calculate 24h stats
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const orders = await prisma.ecommerceOrder.findMany({
          where: {
            tenantId: conn.tenantId,
            createdAt: { gte: yesterday }
          }
        });

        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        const codCount = orders.filter(o => o.paymentMethod?.toLowerCase().includes('cod')).length;
        const onlineCount = orders.length - codCount;

        const msg = `📊 *DAILY BUSINESS SUMMARY*\n\n*Store:* ${conn.tenant.tenantName}\n*Total Orders:* ${orders.length}\n*Total Revenue:* ₹${totalRevenue.toLocaleString()}\n\n💳 *Payment Split:*\n• Prepaid: ${onlineCount}\n• COD: ${codCount}\n\nHave a great evening!`;

        await sendSystemWhatsApp(conn.tenantId, phoneToAlert, msg);

        await prisma.wooCommerceConnection.update({
          where: { id: conn.id },
          data: { lastDailySummaryAt: now }
        });

        console.log(`🔔 [Woo Alert] Daily summary sent to ${phoneToAlert} for tenant ${conn.tenantId}`);
      }
    } catch (err) {
      console.error(`❌ [Woo Alert] Daily summary failed for tenant ${conn.tenantId}:`, err.message);
    }
  }
}

/**
 * Internal Helper: Sends WhatsApp Message safely
 */
async function sendSystemWhatsApp(tenantId, phone, text) {
  // Find or create dummy contact for the manager phone
  const cleanPhone = String(phone).replace(/\D/g, '');
  let contact = await prisma.contact.findFirst({
    where: { tenantId, phone: cleanPhone },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: { tenantId, phone: cleanPhone, name: 'Store Admin' },
    });
  }

  // Sends as text in dev, easy to convert to template later for prod
  await sendMessageService({
    tenantId,
    contactId: contact.id,
    type: 'text',
    text: text,
    senderType: 'SYSTEM',
  });
}