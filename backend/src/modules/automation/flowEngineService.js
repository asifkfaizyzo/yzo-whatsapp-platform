// src/modules/automation/flowEngineService.js

import prisma from '../../config/prisma.js'
import flowService from './flowService.js'
import { emitToTenant, emitToUser, isUserOnline } from '../../lib/socket.js'
import { decrypt } from '../../lib/crypto.js'
import { sendWhatsAppMedia } from '../../lib/utils/whatsappMediaSender.js'
import * as googleSheetsService from '../google-sheets/googleSheetsService.js'
import { logLeadStatusToSheet } from '../google-sheets/googleSheetsService.js';

const flowEngine = {

  // ─────────────────────────────────────────
  // MAIN ENTRY POINT
  // ─────────────────────────────────────────
  processIncomingMessage: async (conversation, contact, userMessage, isNewContact = false, extraData = {}) => {
    try {

      console.log(`\n📩 New message: "${userMessage}"`)
      console.log(`   Conversation ID : ${conversation.id}`)
      console.log(`   Mode            : ${conversation.mode}`)
      console.log(`   CurrentNodeId   : ${conversation.currentNodeId}`)
      console.log(`   BotPaused       : ${conversation.botPaused}`)
      console.log(`   IsNewContact    : ${isNewContact}`)

      // ── Handle Incoming Location Message for Google Sheets Syncing ──
      const isLocationMsg = (typeof userMessage === 'string' && (userMessage.includes('📍 Location') || userMessage.includes('maps.google.com'))) ||
                            extraData?.message?.locLatitude ||
                            extraData?.locLatitude;
      
      if (isLocationMsg) {
        const locText = extraData?.message?.locAddress ||
                        extraData?.message?.locName ||
                        (extraData?.message?.locLatitude ? `https://maps.google.com/?q=${extraData.message.locLatitude},${extraData.message.locLongitude}` : (typeof userMessage === 'string' ? userMessage : 'Location Shared'));

        const tenantId = conversation?.tenantId;
        const resolvedName = contact?.name || contact?.pushName || conversation?.contactName || "WhatsApp Customer";
        const resolvedPhone = contact?.phone || contact?.wa_id || conversation?.contactPhone || "";

        if (tenantId && resolvedPhone) {
          logLeadStatusToSheet(tenantId, {
            "Timestamp": new Date().toLocaleString(),
            "Contact Name": resolvedName,
            "Phone": resolvedPhone,
            "Delivery Location": String(locText),
            "Notes": "Location received via WhatsApp"
          }).catch(e => console.warn('[GoogleSheets Sync] Location log warning:', e.message));
        }
      }

      // ── CASE 1: Agent is handling → notify agent only ──
      if (conversation.mode === 'AGENT' || conversation.botPaused) {
        console.log('👤 Agent is handling - skipping bot')
        await flowEngine.notifyAgents(conversation, contact, userMessage)
        return
      }

           // ── CHECK ORDER CONFIRMATION / GOOGLE SHEETS / INTERACTIVE ACTIONS FIRST ──
      const handledOrderAction = await flowEngine.handleOrderConfirmationAction(
        conversation,
        contact,
        userMessage
      )
      
      if (handledOrderAction) {
        // If the action returned a bot response (text or buttons), SEND IT to the user
        if (typeof handledOrderAction === 'object' && handledOrderAction.reply) {
          console.log(`🤖 Sending automation reply back to customer...`);
          
          if (handledOrderAction.buttons) {
            // Send Interactive Buttons
            await flowEngine.sendBotInteractiveButtons(conversation, contact, handledOrderAction.reply, handledOrderAction.buttons);
            await flowEngine.saveBotMessage(conversation.id, handledOrderAction.reply, { 
              type: 'INTERACTIVE_BUTTONS', 
              buttons: handledOrderAction.buttons 
            });
          } else {
            // Send Plain Text
            await flowEngine.sendBotTextMessage(conversation, contact, handledOrderAction.reply);
            await flowEngine.saveBotMessage(conversation.id, handledOrderAction.reply);
          }
        }
        
        return; // Stop standard flow execution because the sheet automation handled it
      }

console.log(`🔍 DEBUG BEFORE CASE 1.5:`)
console.log(`   isNewContact: ${isNewContact}`)
console.log(`   contact.assignedTo: ${contact.assignedTo}`)
console.log(`   contact.name: ${contact.name}`)
console.log(`   contact.id: ${contact.id}`) 

   // ── CASE 1.5: Existing contact with assigned agent → skip bot ──
if (!isNewContact && contact.assignedTo) {
  console.log(`👤 Contact ${contact.name} already assigned - skipping bot`)

  // ✅ Only update conversation assignedTo
  // Do NOT force botPaused or mode change here
  // The conversation mode was already set correctly before
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      assignedTo: contact.assignedTo,  // sync assignment
    }
  })

  // ✅ Notify the assigned agent directly
  emitToUser(contact.assignedTo, 'new_message', {
    conversationId: conversation.id,
    message: {
      text:           userMessage,
      senderType:     'CONTACT',
      direction:      'INBOUND',
      isFromCustomer: true,
      createdAt:      new Date(),
    },
    contactName:  contact.name,
    contactPhone: contact.phone,
  })

  emitToUser(contact.assignedTo, 'new_notification', {
    notification: {
      id:        `msg_agent_${Date.now()}`,
      type:      'new_message',
      title:     `New message from ${contact.name}`,
      message:   userMessage.substring(0, 100),
      isRead:    false,
      createdAt: new Date(),
      metadata: {
        contactId:      contact.id,
        conversationId: conversation.id,
      }
    }
  })

  // ✅ Also notify tenant room for dashboard update
  emitToTenant(conversation.tenantId, 'new_message', {
    conversationId: conversation.id,
    message: {
      text:           userMessage,
      senderType:     'CONTACT',
      direction:      'INBOUND',
      isFromCustomer: true,
      createdAt:      new Date(),
    },
    contactName:  contact.name,
    contactPhone: contact.phone,
    assignedTo:   contact.assignedTo,
  })

  console.log(`📤 Notified assigned agent: ${contact.assignedTo}`)
  return
}

  // ── CASE 1.6: Contact in queue → don't restart bot ──
if (conversation.mode === 'QUEUED') {
  console.log(`⏳ Contact ${contact.name} in queue - no bot restart`)
  
  // Just deliver to tenant inbox
  emitToTenant(conversation.tenantId, 'new_message', {
    conversationId: conversation.id,
    message: {
      text: userMessage,
      senderType: 'CONTACT',
      direction: 'INBOUND',
      isFromCustomer: true,
      createdAt: new Date(),
    },
    contactName: contact.name,
    contactPhone: contact.phone,
  })
  return
}

      // ── CASE 2: Bot active + waiting on a node → continue flow ──
       // ✅ ADD DEBUG BEFORE THE CHECK
      console.log(`🐛 CASE 2 CHECK:`)
      console.log(`   mode: ${conversation.mode}`)
      console.log(`   currentFlowId: ${conversation.currentFlowId}`)
      console.log(`   currentNodeId: ${conversation.currentNodeId}`)
      
      if (
        conversation.mode === 'BOT' &&
        conversation.currentFlowId &&
        conversation.currentNodeId
      ) {

        console.log(`✅ CASE 2 entered - checking timeout`)

        // Check if session has timed out
        const timedOut = await flowEngine.checkSessionTimeout(
          conversation,
          24  // hours
        )
          console.log(`⏰ timedOut result: ${timedOut}`)
        if (timedOut) {
          console.log('⏰ Session timed out. Restarting flow...')

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              currentFlowId: null,
              currentNodeId: null,
              flowData: {},
              mode: 'BOT'
            }
          })

          const timeoutMsg =
            '⏰ Your previous session has ended.\n\n' +
            'Let me start fresh for you!'

          await flowEngine.sendBotTextMessage(
            conversation,
            contact,
            timeoutMsg
          )

          await flowEngine.saveBotMessage(
            conversation.id,
            timeoutMsg
          )

          const freshConversation = {
            ...conversation,
            currentFlowId: null,
            currentNodeId: null,
            flowData: {}
          }

          await flowEngine.startNewFlow(
            freshConversation,
            contact,
            userMessage,
            isNewContact
          )
          return
        }

        // Session active: resume
        console.log('🤖 Resuming flow from last node...')
        await flowEngine.continueFlow(
          conversation,
          contact,
          userMessage,
          isNewContact,
          extraData
        )
        return
      }

      // ── CASE 3: No active flow → find by keyword ──
      console.log('🔍 Looking for flow by keyword...')
      await flowEngine.startNewFlow(
        conversation,
        contact,
        userMessage,
        isNewContact
      )

    } catch (error) {
      console.error('❌ Flow Engine Error:', error)
    }
  },


     // ─────────────────────────────────────────
  // Handle Menu Actions, Payment & Single-Row Sheet Tracking
  // ─────────────────────────────────────────
  // ─────────────────────────────────────────
  // Handle Menu Actions, Payment & Single-Row Sheet Tracking
  // ─────────────────────────────────────────
  handleOrderConfirmationAction: async (conversation, contact, userMessage) => {
    try {
      let actualUserMessage = userMessage;
      let actualContact = contact;

      // Handle case where function is called with (conversation, message) signature
      if (typeof contact === 'string' && !userMessage) {
        actualUserMessage = contact;
        actualContact = conversation?.contact || {};
      }

      // 1. Extract text string safely from plain text OR interactive button reply
      let msgStr = '';
      if (typeof actualUserMessage === 'string') {
        msgStr = actualUserMessage;
      } else if (typeof actualUserMessage === 'object' && actualUserMessage !== null) {
        msgStr = actualUserMessage.text?.body ||
                 actualUserMessage.interactive?.button_reply?.title ||
                 actualUserMessage.interactive?.button_reply?.id ||
                 actualUserMessage.body ||
                 '';
      }

      msgStr = String(msgStr || '').trim();
      const textLower = msgStr.toLowerCase();

      // ═══════════════════════════════════════════════════
      // BRANCH A: ORDER CONFIRMATION / PAYMENT ACTIONS
      // (Confirm / Cancel / Modify / COD / Pay Retry)
      // ═══════════════════════════════════════════════════
      const isConfirm  = textLower === 'confirm order' || textLower === 'confirm' || textLower === 'yes' || textLower.startsWith('btn_confirm');
      const isCancel   = textLower === 'cancel order' || textLower === 'cancel' || textLower === 'no' || textLower.startsWith('btn_cancel');
      const isModify   = textLower.includes('modify') || textLower.includes('reorder') || textLower.includes('change cart') || textLower.startsWith('btn_modify');
      const isCodSwitch = textLower === 'cod' || textLower === 'cash on delivery' || textLower === 'pay on delivery' || textLower.startsWith('btn_cod');
      const isPayRetry  = textLower === 'pay' || textLower === 'pay online' || textLower === 'retry' || textLower === 'retry payment';

      const isOrderAction = isConfirm || isCancel || isModify || isCodSwitch || isPayRetry;

      if (isOrderAction) {
        // Find active pending order from flowData OR find latest PENDING order for this conversation
        let activeOrder = null;
        if (conversation.flowData?.activeOrderId) {
          activeOrder = await prisma.order.findUnique({
            where: { id: conversation.flowData.activeOrderId }
          }).catch(() => null);
        }
        if (!activeOrder) {
          activeOrder = await prisma.order.findFirst({
            where: {
              conversationId: conversation.id,
              status: { in: ['PENDING', 'CONFIRMED'] }
            },
            orderBy: { createdAt: 'desc' }
          }).catch(() => null);
        }

        const activeOrderId = activeOrder?.id || null;
        const orderNumber = activeOrder?.orderNumber || 'N/A';

        // ── Handle Switching from Online Payment to COD ──
        if (isCodSwitch && activeOrderId) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: conversation.tenantId },
            select: { enableCod: true }
          });

          if (tenant?.enableCod) {
            await prisma.order.update({
              where: { id: activeOrderId },
              data: {
                paymentMethod: 'COD',
                paymentStatus: 'UNPAID',
                status: 'CONFIRMED',
                adminNotes: 'Customer opted for Cash on Delivery'
              }
            });

            emitToTenant(conversation.tenantId, 'order_status_update', {
              orderId: activeOrderId,
              paymentMethod: 'COD',
              status: 'CONFIRMED'
            });

            const codMsg = `✅ *Switched to Cash on Delivery*\n\nOrder #${orderNumber} is now confirmed for *Cash on Delivery*! 🚚\n\nPlease keep ${activeOrder?.currency || 'INR'} ${activeOrder ? Number(activeOrder.totalAmount).toFixed(2) : ''} ready upon delivery.`;
            await flowEngine.sendBotTextMessage(conversation, actualContact, codMsg);
            await flowEngine.saveBotMessage(conversation.id, codMsg);
            await flowEngine.endFlow(conversation);
            return true;
          }
        }

        // ── Handle Payment Link Retry / Resend ──
        if (isPayRetry && activeOrderId) {
          try {
            const { resendOrderPaymentLink } = await import('../orders/orderPaymentService.js');
            const { paymentLink, order: freshOrder } = await resendOrderPaymentLink({
              orderId: activeOrderId,
              tenantId: conversation.tenantId,
            });

            const payBody = `💳 *Payment Link for Order #${orderNumber}*\n\n💰 Total Amount: *${freshOrder.currency} ${Number(freshOrder.totalAmount).toFixed(2)}*\n\nPlease tap the button below to complete your payment:\n\n❌ _Want to cancel? Reply *Cancel*._`;
            await flowEngine.sendWhatsAppPaymentCTA(conversation.tenantId, actualContact.phone, {
              headerText: '💳 Complete Payment',
              bodyText: payBody,
              buttonText: 'Pay Now',
              url: paymentLink.short_url,
            });
            await flowEngine.saveBotMessage(conversation.id, payBody);
            return true;
          } catch (err) {
            console.error('Error resending payment link:', err.message);
          }
        }

        // ── Handle Order Confirmation ──
        if (isConfirm) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: conversation.tenantId },
            select: {
              id: true,
              enableOnlinePayment: true,
              enableCod: true,
              razorpayAuthType: true,
              razorpayAccountId: true,
              razorpayAccessToken: true,
              razorpayKeyId: true,
              razorpayKeySecret: true,
              defaultCurrency: true,
              paymentLinkExpiryMins: true,
            }
          });

          const hasOAuth = tenant?.razorpayAuthType === 'OAUTH' && Boolean(tenant?.razorpayAccountId || tenant?.razorpayAccessToken);
          const hasDirectKeys = Boolean(tenant?.razorpayKeyId && tenant?.razorpayKeySecret);
          const canPayOnline = Boolean(tenant?.enableOnlinePayment && (hasOAuth || hasDirectKeys));

          if (canPayOnline && activeOrder) {
            try {
              const { createOrderPaymentLink } = await import('../orders/orderPaymentService.js');
              const { paymentLink, fallbackCod } = await createOrderPaymentLink({
                order: activeOrder,
                tenant,
                contact: actualContact
              });

              if (fallbackCod) {
                const confirmMsg = `🎉 *Order #${orderNumber} Confirmed!*\n\nThank you! Your order has been placed with Cash on Delivery (Total: ${activeOrder.currency} ${Number(activeOrder.totalAmount).toFixed(2)}). We will notify you once it's on the way! 🚚`;
                await flowEngine.sendBotTextMessage(conversation, actualContact, confirmMsg);
                await flowEngine.saveBotMessage(conversation.id, confirmMsg);
                await flowEngine.endFlow(conversation);
                return true;
              }

              const payBody = `📦 *Order #${orderNumber} Confirmed!*\n\n💰 Total Amount: *${activeOrder.currency} ${Number(activeOrder.totalAmount).toFixed(2)}*\n\nPlease tap the button below to complete your payment securely.${tenant.enableCod ? '\n\n💡 _Prefer Cash on Delivery? Simply reply *COD*._' : ''}\n❌ _Want to cancel? Reply *Cancel*._`;

              await flowEngine.sendWhatsAppPaymentCTA(conversation.tenantId, actualContact.phone, {
                headerText: '💳 Complete Payment',
                bodyText: payBody,
                footerText: `Expires in ${tenant.paymentLinkExpiryMins || 30} mins`,
                buttonText: 'Pay Now',
                url: paymentLink.short_url,
              });

              await flowEngine.saveBotMessage(conversation.id, payBody, {
                type: 'TEXT',
                buttons: [{ id: 'pay_now', title: 'Pay Now', url: paymentLink.short_url }]
              });

              await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                  currentNodeId: 'WAITING_FOR_PAYMENT',
                  mode: 'BOT',
                  flowData: {
                    ...conversation.flowData,
                    activeOrderId: activeOrder.id,
                    paymentLinkId: paymentLink.id,
                  }
                }
              });

              return true;

            } catch (payLinkErr) {
              console.error('❌ Failed to generate Razorpay payment link:', payLinkErr.message);
              if (tenant?.enableCod) {
                await prisma.order.update({
                  where: { id: activeOrder.id },
                  data: { paymentMethod: 'COD', paymentStatus: 'UNPAID', status: 'CONFIRMED' }
                });
                const confirmMsg = `🎉 *Order #${orderNumber} Confirmed!*\n\nYour order has been confirmed with Cash on Delivery (Total: ${activeOrder.currency} ${Number(activeOrder.totalAmount).toFixed(2)}). We will notify you once it's on the way! 🚚`;
                await flowEngine.sendBotTextMessage(conversation, actualContact, confirmMsg);
                await flowEngine.saveBotMessage(conversation.id, confirmMsg);
                await flowEngine.endFlow(conversation);
                return true;
              }
            }
          }

          // Standard COD Order Confirmation
          if (activeOrderId) {
            await prisma.order.update({
              where: { id: activeOrderId },
              data: { status: 'CONFIRMED', paymentMethod: 'COD', paymentStatus: 'UNPAID' }
            }).catch(err => console.error('Error confirming order in DB:', err.message));

            emitToTenant(conversation.tenantId, 'order_status_update', {
              orderId: activeOrderId,
              status: 'CONFIRMED',
              paymentMethod: 'COD'
            });

            // 📊 Sync Confirmed Order to Google Sheets
            try {
              const fullOrder = await prisma.order.findUnique({
                where: { id: activeOrderId },
                include: { items: true }
              });
              const productSummary = (fullOrder?.items || []).map(i => `${i.productName || 'Item'} (x${i.quantity || 1})`).join(', ');

              logLeadStatusToSheet(conversation.tenantId, {
                "Timestamp": new Date().toLocaleString(),
                "Contact Name": actualContact?.name || actualContact?.pushName || conversation?.contactName || "WhatsApp Customer",
                "Phone": actualContact?.phone || actualContact?.wa_id || conversation?.contactPhone || "Unknown Phone",
                "Order ID": orderNumber || activeOrderId,
                "Order Status": "CONFIRMED",
                "Payment Status": "UNPAID",
                "Payment Method": "Cash on Delivery",
                "Amount": String(fullOrder?.totalAmount || "0.00"),
                "Products": productSummary,
                "Delivery Location": fullOrder?.deliveryAddress || "",
                "Notes": "Order confirmed via Cash on Delivery"
              }).catch(e => console.warn('[GoogleSheets Sync] Confirm log warning:', e.message));
            } catch (sheetErr) {
              console.warn('[GoogleSheets Sync] Warning on confirm:', sheetErr.message);
            }

            const confirmMsg = `🎉 *Order #${orderNumber} Confirmed!*\n\nYour order has been placed with Cash on Delivery. We will notify you once it's on the way! 🚚`;
            await flowEngine.sendBotTextMessage(conversation, actualContact, confirmMsg);
            await flowEngine.saveBotMessage(conversation.id, confirmMsg);
            await flowEngine.endFlow(conversation);
            return true;
          }
        }

        // ── Handle Order Cancellation ──
        if (isCancel) {
          if (activeOrderId) {
            await prisma.order.update({
              where: { id: activeOrderId },
              data: { status: 'CANCELLED', paymentStatus: 'CANCELLED' }
            }).catch(err => console.error('Error cancelling order in DB:', err.message));

            emitToTenant(conversation.tenantId, 'order_status_update', {
              orderId: activeOrderId,
              status: 'CANCELLED',
              paymentStatus: 'CANCELLED'
            });

            // 📊 Sync Cancelled Order to Google Sheets
            try {
              const fullOrder = await prisma.order.findUnique({
                where: { id: activeOrderId },
                include: { items: true }
              });
              const productSummary = (fullOrder?.items || []).map(i => `${i.productName || 'Item'} (x${i.quantity || 1})`).join(', ');

              logLeadStatusToSheet(conversation.tenantId, {
                "Timestamp": new Date().toLocaleString(),
                "Contact Name": actualContact?.name || actualContact?.pushName || conversation?.contactName || "WhatsApp Customer",
                "Phone": actualContact?.phone || actualContact?.wa_id || conversation?.contactPhone || "Unknown Phone",
                "Order ID": orderNumber || activeOrderId,
                "Order Status": "CANCELLED",
                "Payment Status": "CANCELLED",
                "Payment Method": fullOrder?.paymentMethod || "Pending",
                "Amount": String(fullOrder?.totalAmount || "0.00"),
                "Products": productSummary,
                "Delivery Location": fullOrder?.deliveryAddress || "",
                "Notes": "Order cancelled by customer"
              }).catch(e => console.warn('[GoogleSheets Sync] Cancel log warning:', e.message));
            } catch (sheetErr) {
              console.warn('[GoogleSheets Sync] Warning on cancel:', sheetErr.message);
            }
          }

          const cancelMsg = `❌ *Order #${orderNumber} Cancelled*\n\nYour order has been cancelled. If you would like to start a new order anytime, simply message us "menu" or "order"!`;
          await flowEngine.sendBotTextMessage(conversation, actualContact, cancelMsg);
          await flowEngine.saveBotMessage(conversation.id, cancelMsg);

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              currentFlowId: null,
              currentNodeId: null,
              flowData: {},
              mode: 'BOT'
            }
          });
          return true;
        }

        // If we got here with an order action but no branch handled it, still return true
        return true;
      }

      // ═══════════════════════════════════════════════════
      // BRANCH B: CUSTOM AUTOMATION FLOWS HANDLE ALL OTHER MESSAGES
      // ═══════════════════════════════════════════════════
      return false;
    } catch (error) {
      console.error('Error in handleOrderConfirmationAction:', error);
      return false;
    }
  },


  // ─────────────────────────────────────────
  // Trigger Event: ORDER_RECEIVED (WhatsApp cart order)
  // ─────────────────────────────────────────
  triggerOrderFlow: async (conversation, contact, order) => {
    try {
      const tenantId = conversation.tenantId

      console.log(`🛍️ Triggering ORDER_RECEIVED flow for order ${order.orderNumber} (tenant: ${tenantId})`)

      // Automatically sync order details to connected Google Sheet
      try {
        const productSummary = (order.items || []).map(i => {
          const rawName = (i.productName || i.productRetailerId || 'Item').replace(/^SKU:\s*/i, '');
          return `${rawName} (x${i.quantity || 1})`;
        }).join(', ');

        const locationStr = order.deliveryAddress || order.deliveryName || '';

        logLeadStatusToSheet(tenantId, {
          "Timestamp": new Date().toLocaleString(),
          "Contact Name": contact?.name || contact?.pushName || conversation?.contactName || "WhatsApp Customer",
          "Phone": contact?.phone || contact?.wa_id || conversation?.contactPhone || "Unknown Phone",
          "Order ID": order.orderNumber || order.id,
          "Order Status": order.status || "PENDING",
          "Payment Status": order.paymentStatus || "UNPAID",
          "Payment Method": order.paymentMethod || "Pending",
          "Amount": String(order.totalAmount || "0.00"),
          "Products": productSummary,
          "Delivery Location": locationStr,
          "Notes": `Order #${order.orderNumber || order.id} received`
        }).catch(e => console.warn('[GoogleSheets Sync] Log warning:', e.message));
      } catch (err) {
        console.warn('[GoogleSheets Sync] Warning:', err.message);
      }

      const flow = await flowService.findOrderFlow(tenantId)

      if (!flow) {
        console.log('ℹ️ No active custom ORDER_RECEIVED flow configured. Sending dynamic order summary & confirmation buttons.')
        
        const items = order.items || []
        const formattedItems = items.map((it, idx) => {
          const rawName = (it.productName || it.productRetailerId || `Item ${idx + 1}`).replace(/^SKU:\s*/i, '')
          return `• *${rawName}* (x${it.quantity}) — ${it.currency || order.currency} ${(Number(it.itemPrice) * it.quantity).toFixed(2)}`
        }).join('\n')
        
        let deliveryLine = ''
        if (order.deliveryType === 'HOME_DELIVERY') {
          deliveryLine = `\n🚚 *Delivery:* Home Delivery\n📍 *Address:* ${order.deliveryAddress || 'Shared GPS Location'}`
        } else if (order.deliveryType === 'STORE_PICKUP') {
          deliveryLine = `\n🏬 *Delivery:* Store Pick Up\n📍 *Location:* ${order.deliveryName || 'Main Store'} (${order.deliveryAddress || ''})`
        }

        const summaryText = `📦 *Order Summary #${order.orderNumber}*\n\n${formattedItems}\n\n💰 *Total Amount:* ${order.currency} ${Number(order.totalAmount).toFixed(2)}${deliveryLine}${order.customerNote ? `\n📝 *Note:* ${order.customerNote}` : ''}\n\nPlease review and confirm your order below:`

        const buttons = [
          { id: `btn_confirm_${order.id}`, title: 'Confirm Order' },
          { id: `btn_cancel_${order.id}`, title: 'Cancel Order' },
          { id: `btn_modify_${order.id}`, title: 'Modify / Reorder' }
        ]

        await flowEngine.sendBotInteractiveButtons(conversation, contact, summaryText, buttons)
        await flowEngine.saveBotMessage(conversation.id, summaryText, {
          type: 'INTERACTIVE_BUTTONS',
          buttons
        })

        const initialFlowData = {
          activeOrderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: String(order.totalAmount),
          currency: order.currency,
          deliveryType: order.deliveryType,
          deliveryAddress: order.deliveryAddress
        }

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            currentNodeId: 'ORDER_CONFIRMATION_STAGE',
            mode: 'BOT',
            botPaused: false,
            flowData: initialFlowData
          }
        })
        return
      }

      if (!flow.nodes || flow.nodes.length === 0) {
        console.log('⚠️ Order flow has no nodes:', flow.id)
        return
      }

      const firstNode = flow.nodes[0]
      const initialFlowData = {
        activeOrderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: String(order.totalAmount),
        currency: order.currency
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentFlowId: flow.id,
          currentNodeId: firstNode.id,
          mode: 'BOT',
          botPaused: false,
          status: 'OPEN',
          flowData: initialFlowData
        }
      })

      const updatedConversation = {
        ...conversation,
        currentFlowId: flow.id,
        currentNodeId: firstNode.id,
        mode: 'BOT',
        botPaused: false,
        status: 'OPEN',
        flowData: initialFlowData
      }

      console.log(`🚀 Executing first node of order flow: ${firstNode.id} (${firstNode.type})`)

      await flowEngine.executeNode(
        firstNode,
        updatedConversation,
        contact,
        `ORDER_RECEIVED_${order.orderNumber}`,
        false
      )
    } catch (err) {
      console.error('❌ triggerOrderFlow error:', err)
    }
  },

  // ─────────────────────────────────────────
  // Start new flow by keyword
  // ─────────────────────────────────────────
  startNewFlow: async (conversation, contact, userMessage, isNewContact = false) => {
    const tenantId = conversation.tenantId

    // Try keyword match
    let flow = await flowService.findFlowByKeyword(tenantId, userMessage)

    // Try default flow
    if (!flow) {
      console.log('No keyword match. Trying default flow...')
      flow = await flowService.findDefaultFlow(tenantId)
    }

    // No flow found at all
    if (!flow) {
      console.log('⚠️ No flow found. Ignoring message.')
      return
    }

    // Flow has no nodes
    if (!flow.nodes || flow.nodes.length === 0) {
      console.log('⚠️ Flow has no nodes:', flow.id)
      return
    }

    console.log(`✅ Flow found: "${flow.name}" | Nodes: ${flow.nodes.length}`)

    // Get first node
    const firstNode = flow.nodes[0]

    // Update conversation state
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        currentFlowId: flow.id,
        currentNodeId: firstNode.id,
        mode: 'BOT',
        botPaused: false,
        status: 'OPEN',
        flowData: {}
      }
    })

    // Build updated conversation object
    const updatedConversation = {
      ...conversation,
      currentFlowId: flow.id,
      currentNodeId: firstNode.id,
      mode: 'BOT',
      botPaused: false,
      status: 'OPEN',
      flowData: {}
    }

    // Execute first node
    await flowEngine.executeNode(
      firstNode,
      updatedConversation,
      contact,
      userMessage,
      isNewContact
    )
  },

  // ─────────────────────────────────────────
  // Continue from current node
  // ─────────────────────────────────────────
  continueFlow: async (conversation, contact, userMessage, isNewContact = false, extraData = {}) => {

    const currentNode = await flowService.getNodeById(conversation.currentNodeId)

    if (!currentNode) {
      console.log('⚠️ Node not found. Ending flow.')
      await flowEngine.endFlow(conversation)
      return
    }

    await flowEngine.executeNode(
      currentNode,
      conversation,
      contact,
      userMessage,
      isNewContact,
      extraData
    )
  },

  // ─────────────────────────────────────────
  // Execute a single node
  // ─────────────────────────────────────────
  executeNode: async (node, conversation, contact, userMessage, isNewContact = false, extraData = {}) => {
    console.log(`\n⚙️  Node: ${node.id} | Type: ${node.type}`)

    switch (node.type) {

      case 'SEND_MESSAGE':
        await flowEngine.handleSendMessage(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'ASK_QUESTION':
        await flowEngine.handleAskQuestion(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'CONDITION':
        await flowEngine.handleCondition(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'ASSIGN_AGENT':
        await flowEngine.handleAssignAgent(
          node, conversation, contact
        )
        break

      case 'INTERACTIVE_BUTTONS':
        await flowEngine.handleInteractiveButtons(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'SEND_CATALOG':
        await flowEngine.handleSendCatalog(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'ASK_LOCATION':
        await flowEngine.handleAskLocation(
          node, conversation, contact, userMessage, isNewContact, extraData
        )
        break

      case 'SEND_LOCATION':
        await flowEngine.handleSendLocation(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'PAYMENT':
        await flowEngine.handlePaymentNode(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'END_FLOW':
        await flowEngine.endFlow(conversation)
        break


      default:
        console.log('⚠️ Unknown node type:', node.type)
    }
  },

  // ─────────────────────────────────────────
  // SEND_MESSAGE Node
  // ─────────────────────────────────────────
// ─────────────────────────────────────────
// SEND_MESSAGE Node (with media support)
// ─────────────────────────────────────────
handleSendMessage: async (node, conversation, contact, userMessage, isNewContact = false) => {

  const options  = node.options || {}
  const hasMedia = options.mediaUrl && options.mediaType

  if (hasMedia) {
    // ── Send MEDIA message (image/video) ──
    console.log(`📎 Sending media: ${options.mediaType} → ${options.mediaUrl}`)

    await flowEngine.sendBotMediaMessage(
      conversation.tenantId,
      contact.phone,
      {
        mediaType:     options.mediaType,
        mediaUrl:      options.mediaUrl,
        mediaName:     options.mediaName,
        mediaMimeType: options.mediaMimeType,
        mediaSize:     options.mediaSize,
        caption:       node.content || null,
      },
      conversation,
      contact
    )

    await flowEngine.saveBotMediaMessage(
      conversation.id,
      {
        mediaType:     options.mediaType,
        mediaUrl:      options.mediaUrl,
        mediaName:     options.mediaName,
        mediaMimeType: options.mediaMimeType,
        mediaSize:     options.mediaSize,
        caption:       node.content || null,
      }
    )

  } else {
    // ── Send TEXT message (existing behavior) ──
    console.log(`📨 Sending message: "${node.content}"`)

    await flowEngine.sendBotTextMessage(
      conversation,
      contact,
      node.content
    )

    await flowEngine.saveBotMessage(conversation.id, node.content)
  }

  // ── Move to next node (same as before) ──
  if (node.nextNodeId) {
    const nextNode = await flowService.getNodeById(node.nextNodeId)

    if (nextNode) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { currentNodeId: nextNode.id }
      })

      const updatedConversation = {
        ...conversation,
        currentNodeId: null
      }

      await flowEngine.executeNode(
        nextNode,
        updatedConversation,
        contact,
        userMessage,
        isNewContact
      )
    } else {
      await flowEngine.endFlow(conversation)
    }

  } else {
    await flowEngine.endFlow(conversation)
  }
},


  // ─────────────────────────────────────────
  // ASK_QUESTION Node (with media support)
  // ─────────────────────────────────────────
  handleAskQuestion: async (node, conversation, contact, userMessage, isNewContact = false) => {

    const isReplying = conversation.currentNodeId === node.id

    if (!isReplying) {
      // ── ARRIVING: Send question (text or media) and STOP ──
      const options = node.options || {}
      const hasMedia = options.mediaUrl && options.mediaType

      if (hasMedia) {
        console.log(`❓ Asking with media (${options.mediaType}): "${node.content}"`)

        await flowEngine.sendBotMediaMessage(
          conversation.tenantId,
          contact.phone,
          {
            mediaType:     options.mediaType,
            mediaUrl:      options.mediaUrl,
            mediaName:     options.mediaName,
            mediaMimeType: options.mediaMimeType,
            mediaSize:     options.mediaSize,
            caption:       node.content || null,
          },
          conversation,
          contact
        )

        await flowEngine.saveBotMediaMessage(conversation.id, {
          mediaType:     options.mediaType,
          mediaUrl:      options.mediaUrl,
          mediaName:     options.mediaName,
          mediaMimeType: options.mediaMimeType,
          mediaSize:     options.mediaSize,
          caption:       node.content || null,
        })
      } else {
        console.log(`❓ Asking: "${node.content}"`)

        await flowEngine.sendBotTextMessage(
          conversation,
          contact,
          node.content
        )

        await flowEngine.saveBotMessage(conversation.id, node.content)
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT'
        }
      })

      console.log(`⏸️  Waiting for reply on node: ${node.id}`)

    } else {
      // ── REPLYING: User answered ──
      console.log(`💬 User answered: "${userMessage}"`)

      const options = node.options || {}

      if (options.saveAs) {
        const currentFlowData = conversation.flowData || {}
        currentFlowData[options.saveAs] = userMessage

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { flowData: currentFlowData }
        })

        conversation.flowData = currentFlowData
        console.log(`💾 Saved "${options.saveAs}": "${userMessage}"`)
      }

      if (node.nextNodeId) {
        const nextNode = await flowService.getNodeById(node.nextNodeId)

        if (nextNode) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { currentNodeId: nextNode.id }
          })

          const updatedConversation = {
            ...conversation,
            currentNodeId: null
          }

          await flowEngine.executeNode(
            nextNode,
            updatedConversation,
            contact,
            userMessage,
            isNewContact
          )
        }
      } else {
        await flowEngine.endFlow(conversation)
      }
    }
  },

  // ─────────────────────────────────────────
  // CONDITION Node
  // ─────────────────────────────────────────
  handleCondition: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`🔀 Evaluating condition...`)

    const options = node.options || []
    const answer = (userMessage || '').toLowerCase().trim()

    console.log(`   Contact  : ${contact.name} (${contact.phone})`)
    console.log(`   Answer   : "${answer}"`)
    console.log(`   IsNew    : ${isNewContact}`)
    console.log(`   Branches : ${options.length}`)
    console.log(`   Raw options from DB:`, JSON.stringify(options, null, 2))

    let matched = null

    for (const opt of options) {
      if (opt.default) continue

      const rule = (opt.value || '').toLowerCase().trim()
      if (!rule) continue

      console.log(`   🔍 Checking rule: "${rule}"`)

      let isMatch = false

      // ─── DB-BASED RULES ───
      if (rule === 'new_contact') {
        isMatch = isNewContact
        console.log(`   🆕 New contact (flag): ${isMatch}`)

      } else if (rule === 'registered' || rule === 'contact_exists') {
        isMatch = !isNewContact
        console.log(`   🗄️ Existing contact check: ${isMatch}`)

      } else if (rule === 'has_agent' || rule === 'assigned') {
        const c = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !!c?.assignedTo
        console.log(`   👤 Has agent: ${isMatch}`)

      } else if (rule === 'no_agent' || rule === 'unassigned') {
        const c = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !isNewContact && !c?.assignedTo
        console.log(`   👤 Existing without agent: ${isMatch}`)

      } else if (rule.startsWith('has_tag:')) {
        const tagName = rule.replace('has_tag:', '').trim()
        const tagExists = await prisma.contactTagMapping.findFirst({
          where: {
            contactId: contact.id,
            tag: {
              name: { equals: tagName, mode: 'insensitive' }
            }
          }
        })
        isMatch = !!tagExists
        console.log(`   🏷️  Tag "${tagName}": ${isMatch}`)

      // ─── TEXT-BASED RULES ───
      } else if (rule === answer) {
        isMatch = true
        console.log(`   📝 Exact match: true`)

      } else if (rule.endsWith('*')) {
        const prefix = rule.slice(0, -1)
        if (answer.startsWith(prefix)) isMatch = true
        console.log(`   ⭐ Wildcard match: ${isMatch}`)

      } else if (answer.includes(rule)) {
        isMatch = true
        console.log(`   📝 Contains match: true`)

      } else if (rule === 'valid_order' || rule === 'valid') {
        const orderPattern = /^[a-z]{2,}\d+$/i
        if (orderPattern.test(answer)) isMatch = true
        console.log(`   📦 Valid order pattern: ${isMatch}`)
      }

      if (isMatch) {
        matched = opt
        console.log(`   ✅ Matched: "${opt.value}"`)
        break
      }
    }

    // Default/else branch
    const defaultOption = options.find(opt => opt.default === true)
    const chosen = matched || defaultOption

    if (chosen && chosen.nextNodeId) {
      console.log(
        `➡️  Going to: ${chosen.default ? 'Else branch' : chosen.value}`
      )

      const nextNode = await flowService.getNodeById(chosen.nextNodeId)

      if (nextNode) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: null }
        })

        const freshConversation = {
          ...conversation,
          currentNodeId: null
        }

        await flowEngine.executeNode(
          nextNode,
          freshConversation,
          contact,
          userMessage,
          isNewContact
        )
      } else {
        console.log('⚠️ Next node not found')
        await flowEngine.endFlow(conversation)
      }

    } else {
      console.log('⚠️ No matching branch. Ending flow.')
      await flowEngine.endFlow(conversation)
    }
  },

    // ─────────────────────────────────────────
  // INTERACTIVE_BUTTONS Node (with header media support)
  // ─────────────────────────────────────────
  handleInteractiveButtons: async (node, conversation, contact, userMessage, isNewContact = false) => {

    const isReplying = conversation.currentNodeId === node.id

    // Support both formats:
    // old: options = [buttons...]
    // new: options = { buttons: [...], media: {...} }
    const rawOptions = node.options || {}
    const buttons = Array.isArray(rawOptions)
      ? rawOptions
      : (rawOptions.buttons || [])
    const media = Array.isArray(rawOptions)
      ? null
      : (rawOptions.media || null)

    if (!isReplying) {
      // ── ARRIVING: optional media header, then buttons ──
      if (media?.mediaUrl && media?.mediaType) {
        console.log(`🔘 Sending header media (${media.mediaType}) before buttons`)

        await flowEngine.sendBotMediaMessage(
          conversation.tenantId,
          contact.phone,
          {
            mediaType:     media.mediaType,
            mediaUrl:      media.mediaUrl,
            mediaName:     media.mediaName,
            mediaMimeType: media.mediaMimeType,
            mediaSize:     media.mediaSize,
            caption:       null,
          }
        )

        await flowEngine.saveBotMediaMessage(conversation.id, {
          mediaType:     media.mediaType,
          mediaUrl:      media.mediaUrl,
          mediaName:     media.mediaName,
          mediaMimeType: media.mediaMimeType,
          mediaSize:     media.mediaSize,
          caption:       null,
        })
      }

      console.log(`🔘 Sending buttons: "${node.content}"`)

      await flowEngine.sendBotInteractiveButtons(
        conversation,
        contact,
        node.content,
        buttons
      )

      await flowEngine.saveBotMessage(
        conversation.id,
        node.content,
        {
          type: 'INTERACTIVE_BUTTONS',
          buttons: buttons.map(b => ({
            id: b.id,
            title: b.title
          }))
        }
      )

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT'
        }
      })

      console.log(`⏸️  Waiting for button click: ${node.id}`)

    } else {
      // ── REPLYING: User clicked a button ──
      console.log(`🖱️  Button clicked: "${userMessage}"`)

      console.log(`🔍 DEBUG BUTTONS:`)
      console.log(`   Available buttons:`, JSON.stringify(buttons, null, 2))
      console.log(`   User message: "${userMessage}"`)

      const userMsgNormalized = (userMessage || '').toLowerCase().trim()
      const clickedButton = buttons.find(
        btn =>
          (btn.title || '').toLowerCase().trim() === userMsgNormalized ||
          (btn.id || '').toLowerCase().trim() === userMsgNormalized
      )

      if (!clickedButton) {
        console.log('⚠️ No button matched. Re-sending buttons...')

        // Re-send media header if exists
        if (media?.mediaUrl && media?.mediaType) {
          await flowEngine.sendBotMediaMessage(
            conversation.tenantId,
            contact.phone,
            {
              mediaType:     media.mediaType,
              mediaUrl:      media.mediaUrl,
              mediaName:     media.mediaName,
              mediaMimeType: media.mediaMimeType,
              mediaSize:     media.mediaSize,
              caption:       null,
            }
          )
        }

        await flowEngine.sendBotInteractiveButtons(
          conversation,
          contact,
          node.content,
          buttons
        )

        await flowEngine.saveBotMessage(
          conversation.id,
          node.content,
          {
            type: 'INTERACTIVE_BUTTONS',
            buttons: buttons.map(b => ({
              id: b.id,
              title: b.title
            }))
          }
        )

        console.log('✅ Buttons re-sent and saved')
        return
      }

      console.log(
        `✅ Button matched: "${clickedButton.title}"` +
        ` → Node: ${clickedButton.nextNodeId}`
      )

      if (clickedButton.nextNodeId) {
        const nextNode = await flowService.getNodeById(
          clickedButton.nextNodeId
        )

        if (nextNode) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { currentNodeId: null }
          })

          const updatedConversation = {
            ...conversation,
            currentNodeId: null
          }

          await flowEngine.executeNode(
            nextNode,
            updatedConversation,
            contact,
            userMessage,
            isNewContact
          )
        } else {
          console.log('⚠️ Target node not found')
          await flowEngine.endFlow(conversation)
        }

      } else {
        console.log('⚠️ Button has no nextNodeId')
        await flowEngine.endFlow(conversation)
      }
    }
  },

  // ─────────────────────────────────────────
  // SEND_CATALOG Node
  // ─────────────────────────────────────────
  handleSendCatalog: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`📦 Executing SEND_CATALOG node: ${node.id}`)
    const options = node.options || {}
    const bodyText = node.content || options.bodyText || 'Browse our catalog below:'
    const footerText = options.footerText || null
    const thumbnailSku = options.thumbnailSku || null

    await flowEngine.sendWhatsAppCatalogMessage(
      conversation.tenantId,
      contact.phone,
      bodyText,
      footerText,
      thumbnailSku
    )

    await flowEngine.saveBotMessage(conversation.id, bodyText, {
      type: 'CATALOG'
    })

    if (node.nextNodeId) {
      const nextNode = await flowService.getNodeById(node.nextNodeId)
      if (nextNode) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: nextNode.id }
        })
        const updatedConversation = { ...conversation, currentNodeId: nextNode.id }
        await flowEngine.executeNode(nextNode, updatedConversation, contact, userMessage, isNewContact)
      }
    } else {
      await flowEngine.endFlow(conversation)
    }
  },

  // ─────────────────────────────────────────
  // ASK_LOCATION Node (Home Delivery GPS request)
  // ─────────────────────────────────────────
  handleAskLocation: async (node, conversation, contact, userMessage, isNewContact = false, extraData = {}) => {
    const isReplying = conversation.currentNodeId === node.id

    if (!isReplying) {
      // Arriving at node: send location request message and wait
      console.log(`📍 Sending Location Request message: "${node.content}"`)
      const promptText = node.content || 'Please share your delivery location so we can deliver your order accurately 🚚'

      await flowEngine.sendLocationRequestMessage(
        conversation.tenantId,
        contact.phone,
        promptText
      )

      await flowEngine.saveBotMessage(conversation.id, promptText, {
        type: 'TEXT'
      })

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT'
        }
      })

      console.log(`⏸️  Waiting for location from contact: ${contact.phone}`)

    } else {
      // Replying at node: customer sent location or text or other media
      console.log(`📍 Location reply received. extraData:`, extraData, `userMessage: "${userMessage}"`)

      const activeOrderId = conversation.flowData?.activeOrderId
      let locationAddress = null

      if (extraData?.locLatitude && extraData?.locLongitude) {
        // Native WhatsApp location received
        locationAddress = extraData.locAddress || extraData.locName || `GPS: ${Number(extraData.locLatitude).toFixed(4)}, ${Number(extraData.locLongitude).toFixed(4)}`

        if (activeOrderId) {
          await prisma.order.update({
            where: { id: activeOrderId },
            data: {
              deliveryType: 'HOME_DELIVERY',
              deliveryLat: Number(extraData.locLatitude),
              deliveryLng: Number(extraData.locLongitude),
              deliveryName: extraData.locName || null,
              deliveryAddress: locationAddress,
              status: 'CONFIRMED'
            }
          }).catch(err => console.error('Order update error:', err.message))
        }
      } else if (userMessage && typeof userMessage === 'string' && userMessage.trim().length > 3 && userMessage !== 'LOCATION_RECEIVED') {
        // Fallback: customer typed address as text
        locationAddress = userMessage.trim()

        if (activeOrderId) {
          await prisma.order.update({
            where: { id: activeOrderId },
            data: {
              deliveryType: 'HOME_DELIVERY',
              deliveryAddress: locationAddress,
              status: 'CONFIRMED'
            }
          }).catch(err => console.error('Order update error:', err.message))
        }
      } else {
        // Customer sent non-text/non-location (e.g. image, audio, sticker)
        console.log('⚠️ Non-location/non-text received at ASK_LOCATION step. Prompting retry.')
        const retryPrompt = 'Please share your delivery address by tapping the "Send location" button or typing your address in text 🚚'
        await flowEngine.sendBotTextMessage(conversation, contact, retryPrompt)
        await flowEngine.saveBotMessage(conversation.id, retryPrompt)
        return
      }

      // Save delivery details to conversation flowData
      const currentFlowData = conversation.flowData || {}
      const updatedFlowData = {
        ...currentFlowData,
        deliveryType: 'HOME_DELIVERY',
        deliveryAddress: locationAddress,
        deliveryLat: extraData?.locLatitude ? Number(extraData.locLatitude) : null,
        deliveryLng: extraData?.locLongitude ? Number(extraData.locLongitude) : null,
      }

      // Move to next node if location captured
      if (node.nextNodeId) {
        const nextNode = await flowService.getNodeById(node.nextNodeId)
        if (nextNode) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              currentNodeId: nextNode.id,
              flowData: updatedFlowData
            }
          })
          const updatedConversation = { ...conversation, currentNodeId: nextNode.id, flowData: updatedFlowData }
          await flowEngine.executeNode(nextNode, updatedConversation, contact, userMessage, isNewContact)
        } else {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { flowData: updatedFlowData }
          })
          await flowEngine.endFlow(conversation)
        }
      } else {
        // Default confirmation if end of flow
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { flowData: updatedFlowData }
        })
        const orderNumber = conversation.flowData?.orderNumber || 'your order'
        const confirmationMsg = `✅ *Order #${orderNumber} Confirmed!*\n\n🚚 Delivery Address:\n${locationAddress}\n\nWe will notify you when your order is out for delivery!`
        await flowEngine.sendBotTextMessage(conversation, contact, confirmationMsg)
        await flowEngine.saveBotMessage(conversation.id, confirmationMsg)
        await flowEngine.endFlow(conversation)
      }
    }
  },

  // ─────────────────────────────────────────
  // SEND_LOCATION Node (Store Pick Up Map Pin)
  // ─────────────────────────────────────────
  handleSendLocation: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`🏬 Executing SEND_LOCATION node: ${node.id}`)
    const options = node.options || {}
    const storeData = {
      storeName: options.storeName || options.name || 'Store Pick Up Location',
      address: options.address || node.content || 'Store Address',
      latitude: options.latitude ? Number(options.latitude) : 19.1136,
      longitude: options.longitude ? Number(options.longitude) : 72.8697
    }

    const activeOrderId = conversation.flowData?.activeOrderId
    if (activeOrderId) {
      await prisma.order.update({
        where: { id: activeOrderId },
        data: {
          deliveryType: 'STORE_PICKUP',
          deliveryName: storeData.storeName,
          deliveryAddress: storeData.address,
          status: 'CONFIRMED'
        }
      }).catch(err => console.error('Order update error:', err.message))
    }

    await flowEngine.sendStoreLocationPin(
      conversation.tenantId,
      contact.phone,
      storeData
    )

    await flowEngine.saveBotMessage(conversation.id, `${storeData.storeName}\n${storeData.address}`, {
      type: 'LOCATION'
    })

    if (node.nextNodeId) {
      const nextNode = await flowService.getNodeById(node.nextNodeId)
      if (nextNode) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: nextNode.id }
        })
        const updatedConversation = { ...conversation, currentNodeId: nextNode.id }
        await flowEngine.executeNode(nextNode, updatedConversation, contact, userMessage, isNewContact)
      }
    } else {
      const orderNumber = conversation.flowData?.orderNumber || 'your order'
      const pickupMsg = `🏬 *Order #${orderNumber} Confirmed for Store Pickup!*\n\nPlease visit ${storeData.storeName} with your Order ID to collect your items.`
      await flowEngine.sendBotTextMessage(conversation, contact, pickupMsg)
      await flowEngine.saveBotMessage(conversation.id, pickupMsg)
      await flowEngine.endFlow(conversation)
    }
  },

  // ─────────────────────────────────────────
// ASSIGN_AGENT Node
// Stop bot → assign to human agent
// ─────────────────────────────────────────
handleAssignAgent: async (node, conversation, contact) => {
  console.log('\n👤 Assigning to agent...')

  let agent = null
  let freshContact = null

  // ═══════════════════════════════════════════════════
  // Step 1: Check if contact has a previous agent
  // ═══════════════════════════════════════════════════
  freshContact = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: {
      assignedTo: true,
      assignedUser: {
        select: {
          id: true,
          name: true,
          isActive: true
        }
      }
    }
  })

  if (
    freshContact?.assignedTo &&
    freshContact?.assignedUser?.isActive
  ) {
    const isOnline = isUserOnline(
      conversation.tenantId,
      freshContact.assignedTo
    )

    if (isOnline) {
      // ✅ Previous agent is ONLINE → sticky assign
      agent = freshContact.assignedUser
      console.log(`✅ Sticky → ${agent.name} (online)`)

    } else {
      // ⚠️ Previous agent is OFFLINE
      console.log(
        `⚠️ Previous agent ${freshContact.assignedUser.name} is OFFLINE`
      )

      // Notify the offline agent
      emitToUser(freshContact.assignedTo, 'new_notification', {
        notification: {
          id: `offline_${conversation.id}_${Date.now()}`,
          type: 'contact_waiting',
          title: '💬 Contact is waiting for you',
          message: `${contact.name} is waiting. Please come online.`,
          isRead: false,
          createdAt: new Date(),
          metadata: {
            contactId: contact.id,
            conversationId: conversation.id
          }
        }
      })

      // Tell customer their agent is offline
      await flowEngine.sendBotTextMessage(
        conversation,
        freshContact,
        `⚠️ Your previous agent *${freshContact.assignedUser.name}* ` +
        `is currently offline.\n\n` +
        `We are finding the next available agent for you... ⏳`
      )

      await flowEngine.saveBotMessage(
        conversation.id,
        `⚠️ Your previous agent ${freshContact.assignedUser.name} ` +
        `is offline. Finding next available agent...`
      )

      // agent stays null → falls through to Round Robin
    }
  }

  // ═══════════════════════════════════════════════════
  // Step 2: No agent yet → Try tag-matched agent
  // ═══════════════════════════════════════════════════
  if (!agent) {

    const contactTags = await prisma.contactTagMapping.findMany({
      where: { contactId: contact.id },
      select: { tagId: true }
    })

    const contactTagIds = contactTags.map(ct => ct.tagId)
    console.log(`🏷️  Contact tags: ${contactTagIds.length}`)

    // ── Step 3: Tag matched online agents ──
    if (contactTagIds.length > 0) {

      const matchingAgents = await prisma.userTagMapping.findMany({
        where: {
          tenantId: conversation.tenantId,
          tagId: { in: contactTagIds }
        },
        include: { user: true }
      })

      const onlineTagAgents = matchingAgents
        .filter(m =>
          m.user.isActive &&
          isUserOnline(conversation.tenantId, m.user.id)
        )
        .map(m => m.user)
        .filter((user, index, self) =>
          index === self.findIndex(u => u.id === user.id)
        )

      console.log(`👥 Online tag-matched agents: ${onlineTagAgents.length}`)

      if (onlineTagAgents.length > 0) {
        // Pick least busy (Round Robin)
        const agentCounts = await Promise.all(
          onlineTagAgents.map(async (a) => {
            const count = await prisma.contact.count({
              where: {
                tenantId: conversation.tenantId,
                assignedTo: a.id
              }
            })
            return { agent: a, count }
          })
        )
        agentCounts.sort((a, b) => a.count - b.count)
        agent = agentCounts[0].agent
        console.log(
          `✅ Tag match → ${agent.name} ` +
          `(load: ${agentCounts[0].count})`
        )
      }
    }

    // ── Step 4: No tag match → any online agent (Round Robin) ──
    if (!agent) {
      console.log(
        '⚠️ No tag-matched agent. ' +
        'Falling back to any online agent...'
      )

      const allAgents = await prisma.user.findMany({
        where: {
          tenantId: conversation.tenantId,
          isActive: true
        }
      })

      const onlineAgents = allAgents.filter(a =>
        isUserOnline(conversation.tenantId, a.id)
      )

      console.log(`👥 Total online agents: ${onlineAgents.length}`)

      if (onlineAgents.length > 0) {
        // Pick least busy (Round Robin)
        const agentCounts = await Promise.all(
          onlineAgents.map(async (a) => {
            const count = await prisma.contact.count({
              where: {
                tenantId: conversation.tenantId,
                assignedTo: a.id
              }
            })
            return { agent: a, count }
          })
        )
        agentCounts.sort((a, b) => a.count - b.count)
        agent = agentCounts[0].agent
        console.log(
          `✅ Fallback → ${agent.name} ` +
          `(load: ${agentCounts[0].count})`
        )
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // Step 5: Agent found → ASSIGN + NOTIFY
  // ═══════════════════════════════════════════════════
  if (agent) {

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: 'AGENT',
        botPaused: true,
        assignedTo: agent.id,
        currentFlowId: null,
        currentNodeId: null
      }
    })

    // Update contact assignment only if changed
    const previousAgentId = freshContact?.assignedTo || null

    if (previousAgentId !== agent.id) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedTo: agent.id,
          assignedAt: new Date()
        }
      })
      console.log(`📝 Contact updated → assigned to ${agent.name}`)
    } else {
      console.log(`📝 Contact already assigned to ${agent.name} - no update needed`)
    }

    // Notify the assigned agent
    emitToUser(agent.id, 'new_assignment', {
      conversationId: conversation.id,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone
      },
      fromQueue: false
    })

    emitToUser(agent.id, 'new_notification', {
      notification: {
        id: `assign_${conversation.id}_${Date.now()}`,
        type: 'contact_assigned',
        title: '🎯 New chat assigned',
        message: `${contact.name} has been assigned to you`,
        isRead: false,
        createdAt: new Date(),
        metadata: {
          contactId: contact.id,
          conversationId: conversation.id
        }
      }
    })

       // Notify tenant dashboard
    emitToTenant(conversation.tenantId, 'conversation_assigned', {
      conversationId: conversation.id,
      agentId: agent.id,
      contact: {
        name: contact.name,
        phone: contact.phone
      },
      fromQueue: false
    })

    // ✅ ADD: Emit to USER so their Inbox refreshes
    emitToUser(agent.id, 'conversation_assigned', {
      conversationId: conversation.id,
      contactId:      contact.id,
      contactName:    contact.name,
      contactPhone:   contact.phone,
    })

    // ✅ ADD: Emit unread count to user
    const currentConv = await prisma.conversation.findUnique({
      where: { id: conversation.id }
    })

    if (currentConv && currentConv.unreadCount > 0) {
      emitToUser(agent.id, 'unread_count_update', {
        conversationId: currentConv.id,
        unreadCount:    currentConv.unreadCount,
        contactId:      contact.id,
        contactName:    contact.name,
      })
    }

    // ✅ ADD: Update tenant unassigned count (decrease)
    const unassignedCount = await prisma.contact.count({
      where: {
        tenantId:   conversation.tenantId,
        assignedTo: null,
        isActive:   true,
      }
    })

    emitToTenant(conversation.tenantId, 'unassigned_contact_update', {
      unassignedCount,
      isNew: false,
      contact: { id: contact.id, name: contact.name, phone: contact.phone },
      conversationId: conversation.id,
    })

    console.log(`✅ Final assignment: ${agent.name} (${agent.id})`)
    console.log(`📤 Emitted to user_${agent.id}: conversation_assigned, unread_count_update`)

    // Tell customer they are connected
    const assignmentText =
      `✅ You're connected with *${agent.name}*! ` +
      `They will assist you shortly. 💬`

    await flowEngine.sendBotTextMessage(
      conversation,
      contact,
      assignmentText
    )

    await flowEngine.saveBotMessage(
      conversation.id,
      assignmentText
    )

  } else {

    // ═══════════════════════════════════════════════════
    // Step 6: No agent online at all → QUEUE
    // ═══════════════════════════════════════════════════
    console.log('⚠️ No online agent available. Adding to queue...\n')

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: 'QUEUED',
        currentFlowId: null,
        currentNodeId: null
      }
    })

    const queueText =
      '⏳ All our agents are currently busy.\n\n' +
      'You are in the waiting queue.\n' +
      'We will respond as soon as an agent is available.'

    await flowEngine.sendBotTextMessage(
      conversation,
      contact,
      queueText
    )

    await flowEngine.saveBotMessage(
      conversation.id,
      queueText
    )
  }
},


  // ─────────────────────────────────────────
  // Check Session Timeout
  // ─────────────────────────────────────────
  checkSessionTimeout: async (conversation, timeoutHours = 24) => {
    try {

     const lastMessage = await prisma.message.findFirst({
  where: { 
    conversationId: conversation.id,
    direction: 'OUTBOUND'   // ✅ Only bot messages
  },
  orderBy: { createdAt: 'desc' }
})

        // ✅ ADD DEBUG LOG
    console.log(`\n🕐 TIMEOUT DEBUG:`)
    console.log(`   ConvID: ${conversation.id}`)
    console.log(`   Last msg ID: ${lastMessage?.id}`)
    console.log(`   Last msg text: "${lastMessage?.text}"`)
    console.log(`   Last msg createdAt: ${lastMessage?.createdAt}`)
    console.log(`   Current time: ${new Date()}`)

      if (!lastMessage) {
        console.log('⏰ No messages found. Fresh session.')
        return false
      }

      const diffHours =
        (new Date() - new Date(lastMessage.createdAt))
        / (1000 * 60 * 60)

      const currentNode = await flowService.getNodeById(
        conversation.currentNodeId
      )

      let timeout = timeoutHours

      if (currentNode?.type === 'INTERACTIVE_BUTTONS') {
        timeout = 1
      }

      if (currentNode?.type === 'ASK_QUESTION') {
        timeout = 24
      }

      console.log(
        `⏰ Node type     : ${currentNode?.type}\n` +
        `⏰ Elapsed       : ${diffHours.toFixed(2)} hours\n` +
        `⏰ Timeout limit : ${timeout} hours`
      )

      return diffHours > timeout

    } catch (error) {
      console.error('❌ checkSessionTimeout error:', error)
      return false
    }
  },

  // ─────────────────────────────────────────
  // End the flow
  // ─────────────────────────────────────────
  endFlow: async (conversation) => {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        currentFlowId: null,
        currentNodeId: null,
        // flowData: {},
        mode: 'BOT'
      }
    })
    console.log(`✅ Flow ended: ${conversation.id}`)
  },

  // ─────────────────────────────────────────
  // Notify agents (when mode = AGENT)
  // ─────────────────────────────────────────
  notifyAgents: async (conversation, contact, message) => {
    emitToTenant(
      conversation.tenantId,
      'new_message',
      {
        conversationId: conversation.id,
        message,
        contactName: contact.name,
        contactPhone: contact.phone,
        assignedTo: conversation.assignedTo
      }
    )
  },


  // ─────────────────────────────────────────
  // ─────────────────────────────────────────
// Send Media Message via WhatsApp, Messenger, or Instagram
// ─────────────────────────────────────────
sendBotMediaMessage: async (tenantId, phone, mediaData, conversation = null, contact = null) => {
  try {
    const channel = conversation?.channel || contact?.channel || 'WHATSAPP';
    if (channel === 'MESSENGER' || channel === 'INSTAGRAM') {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant?.facebookPageAccessToken) {
        console.error(`❌ Tenant Facebook/Instagram Page Access Token not configured for ${channel} bot media`);
        return null;
      }

      const { sendMetaMediaMessage, sendMetaMessage } = await import('../messages/messageService.js');
      const channelId = contact?.channelId || contact?.phone || phone;
      if (!channelId) {
        console.error(`❌ Cannot send ${channel} bot media: missing channelId`);
        return null;
      }

      const file = {
        path: mediaData.mediaUrl,
        originalname: mediaData.mediaName || 'media',
        mimetype: mediaData.mediaMimeType,
        size: mediaData.mediaSize,
      };

      const result = await sendMetaMediaMessage({
        tenant,
        channelId,
        file,
        mediaType: mediaData.mediaType,
        conversationId: conversation?.id,
        channel,
      });

      if (mediaData.caption && mediaData.caption.trim()) {
        try {
          await sendMetaMessage({
            tenant,
            channelId,
            messagePayload: mediaData.caption.trim(),
            conversationId: conversation?.id,
            channel,
          });
        } catch (capErr) {
          console.error(`⚠️ Failed to send bot media caption to ${channel}:`, capErr.message);
        }
      }

      return result;
    }

    if (process.env.MOCK_WHATSAPP === 'true') {
      console.log('\n╔══════════════════════════════════════╗')
      console.log('║  📱 MOCK WHATSAPP - MEDIA           ║')
      console.log('╠══════════════════════════════════════╣')
      console.log(`║  To     : ${phone}`)
      console.log(`║  Type   : ${mediaData.mediaType}`)
      console.log(`║  URL    : ${mediaData.mediaUrl}`)
      console.log(`║  Caption: ${mediaData.caption || '(none)'}`)
      console.log('╚══════════════════════════════════════╝\n')
      return { messages: [{ id: 'mock_media_' + Date.now() }] }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneId:     true,
        whatsappAccessToken: true,
      }
    })

    if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
      console.error('❌ Tenant WhatsApp credentials not configured')
      return
    }

    // Build "file" object expected by shared helper
    const file = {
      path:         mediaData.mediaUrl,
      originalname: mediaData.mediaName || 'media',
      mimetype:     mediaData.mediaMimeType,
      size:         mediaData.mediaSize,
    }

    const result = await sendWhatsAppMedia({
      tenant,
      contactPhone: phone,
      file,
      caption:      mediaData.caption,
      mediaType:    mediaData.mediaType,
    })

    console.log(`📤 Media sent: ${result.waMessageId}`)
    return result

  } catch (error) {
    console.error('❌ sendBotMediaMessage error:', error)
  }
},

// ─────────────────────────────────────────
// Save bot MEDIA message to DB (NEW)
// ─────────────────────────────────────────
saveBotMediaMessage: async (conversationId, mediaData) => {
  try {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderType:    'SYSTEM',
        direction:     'OUTBOUND',
        type:          mediaData.mediaType,        // IMAGE / VIDEO
        text:          mediaData.caption || null,
        caption:       mediaData.caption || null,
        mediaUrl:      mediaData.mediaUrl,
        mediaName:     mediaData.mediaName,
        mediaSize:     mediaData.mediaSize,
        mediaMimeType: mediaData.mediaMimeType,
        status:        'sent',
      },
      include: {
        conversation: {
          include: { contact: true }
        }
      }
    })

    const messagePayload = {
      conversationId: message.conversationId,
      message: {
        id:             message.id,
        type:           message.type,
        text:           message.text,
        caption:        message.caption,
        mediaUrl:       message.mediaUrl,
        mediaName:      message.mediaName,
        mediaSize:      message.mediaSize,
        mediaMimeType:  message.mediaMimeType,
        senderType:     message.senderType,
        isFromCustomer: false,
        createdAt:      message.createdAt,
      }
    }

    emitToTenant(message.conversation.tenantId, 'new_message', messagePayload)

    const assignedTo = message.conversation.assignedTo ||
                       message.conversation.contact?.assignedTo

    if (assignedTo) {
      emitToUser(assignedTo, 'new_message', messagePayload)
      console.log(`📤 Bot media emitted to user_${assignedTo}`)
    }

  } catch (error) {
    console.error('❌ saveBotMediaMessage error:', error)
  }
},


  // ─────────────────────────────────────────
  // Omnichannel Bot Text Message Dispatcher
  // Routes to Messenger / Instagram (Graph API) or WhatsApp
  // ─────────────────────────────────────────
  sendBotTextMessage: async (conversation, contact, text) => {
    try {
      const channel = conversation?.channel || contact?.channel || 'WHATSAPP';
      if (channel === 'MESSENGER' || channel === 'INSTAGRAM') {
        const tenant = await prisma.tenant.findUnique({
          where: { id: conversation.tenantId },
        });

        if (!tenant?.facebookPageAccessToken) {
          console.error(`❌ Tenant Facebook/Instagram Page Access Token not configured for ${channel} bot reply`);
          return null;
        }

        const { sendMetaMessage } = await import('../messages/messageService.js');
        const channelId = contact?.channelId || contact?.phone;
        if (!channelId) {
          console.error(`❌ Cannot send ${channel} bot reply: missing contact channelId / PSID`);
          return null;
        }

        console.log(`📤 Sending ${channel} Bot reply to ${channelId}...`);
        const result = await sendMetaMessage({
          tenant,
          channelId,
          messagePayload: text,
          conversationId: conversation?.id,
          channel,
        });

        console.log(`✅ ${channel} Bot reply sent successfully:`, result?.messageId);
        return result;
      }

      // Default to WhatsApp
      return await flowEngine.sendWhatsAppMessage(conversation.tenantId, contact?.phone, text);
    } catch (err) {
      console.error('❌ sendBotTextMessage error:', err.message);
      return null;
    }
  },

  // ─────────────────────────────────────────
  // Omnichannel Bot Interactive Buttons Dispatcher
  // Routes to Messenger / Instagram (Quick Replies) or WhatsApp
  // ─────────────────────────────────────────
  sendBotInteractiveButtons: async (conversation, contact, bodyText, buttons) => {
    try {
      const channel = conversation?.channel || contact?.channel || 'WHATSAPP';
      if (channel === 'MESSENGER' || channel === 'INSTAGRAM') {
        const tenant = await prisma.tenant.findUnique({
          where: { id: conversation.tenantId },
        });

        if (!tenant?.facebookPageAccessToken) {
          console.error(`❌ Tenant Facebook/Instagram Page Access Token not configured for ${channel} bot buttons`);
          return null;
        }

        const { sendMetaMessage } = await import('../messages/messageService.js');
        const channelId = contact?.channelId || contact?.phone;
        if (!channelId) {
          console.error(`❌ Cannot send ${channel} bot buttons: missing contact channelId`);
          return null;
        }

        const quick_replies = (buttons || []).slice(0, 13).map((b, idx) => ({
          content_type: 'text',
          title: (b.title || `Option ${idx + 1}`).slice(0, 20),
          payload: b.id || b.title,
        }));

        console.log(`📤 Sending ${channel} Bot Quick Replies to ${channelId}...`);
        const result = await sendMetaMessage({
          tenant,
          channelId,
          messagePayload: {
            text: bodyText || 'Please select an option below:',
            quick_replies: quick_replies.length > 0 ? quick_replies : undefined,
          },
          conversationId: conversation?.id,
          channel,
        });

        console.log(`✅ ${channel} Bot Quick Replies sent successfully:`, result?.messageId);
        return result;
      }

      // Default to WhatsApp
      return await flowEngine.sendWhatsAppInteractiveButtons(conversation.tenantId, contact?.phone, bodyText, buttons);
    } catch (err) {
      console.error('❌ sendBotInteractiveButtons error:', err.message);
      return null;
    }
  },

  // ─────────────────────────────────────────
  // Send WhatsApp Message via Meta API
  // ─────────────────────────────────────────
  sendWhatsAppMessage: async (tenantId, phone, text) => {
    try {
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP (Dev Mode)        ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To   : ${phone}`)
        console.log(`║  Text : ${text}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_' + Date.now() }] }
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return null
      }

      const token = decrypt(tenant.whatsappAccessToken)
      const url = `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text }
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          })

          const result = await response.json()
          if (result.messages?.[0]?.id) {
            console.log(`📤 WhatsApp sent: ${result.messages[0].id}`)
            return result
          } else {
            console.error(`❌ WhatsApp send failed (attempt ${attempt}):`, result)
          }
        } catch (fetchErr) {
          console.warn(`⚠️ WhatsApp send fetch error (attempt ${attempt}/2):`, fetchErr.message)
          if (attempt === 2) throw fetchErr
        }
      }

    } catch (error) {
      console.error('❌ sendWhatsAppMessage error:', error)
      return null
    }
  },

  // ─────────────────────────────────────────
  // Send Interactive Buttons via Meta API
  // ─────────────────────────────────────────
  sendWhatsAppInteractiveButtons: async (tenantId, phone, bodyText, buttons) => {
    try {
      const isListMode = buttons.length > 3

      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log(isListMode ? '║  📱 MOCK WHATSAPP - LIST (OPTIONS)   ║' : '║  📱 MOCK WHATSAPP - BUTTONS         ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To   : ${phone}`)
        console.log(`║  Body : ${bodyText}`)
        buttons.forEach((b, i) => {
          console.log(`║  ${isListMode ? 'Opt' : 'Btn'}${i + 1} : [${b.title}]`)
        })
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_btn_' + Date.now() }] }
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return null
      }

      const token = decrypt(tenant.whatsappAccessToken)
      const url = `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`

      let payload
      if (!isListMode) {
        // WhatsApp Quick Reply Buttons (1-3 buttons)
        payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText || 'Please choose an option:' },
            action: {
              buttons: buttons.slice(0, 3).map(btn => ({
                type: 'reply',
                reply: {
                  id: String(btn.id || '').slice(0, 256),
                  title: String(btn.title || '').slice(0, 20)
                }
              }))
            }
          }
        }
      } else {
        // WhatsApp Interactive List Message (4-10 options)
        payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: bodyText || 'Please select an option from the list:' },
            action: {
              button: 'Select Option',
              sections: [
                {
                  title: 'Options',
                  rows: buttons.slice(0, 10).map((btn, idx) => ({
                    id: String(btn.id || `btn_${idx + 1}`).slice(0, 200),
                    title: String(btn.title || `Option ${idx + 1}`).slice(0, 24),
                    ...(btn.description ? { description: String(btn.description).slice(0, 72) } : {})
                  }))
                }
              ]
            }
          }
        }
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          })

          const result = await response.json()
          if (result.messages?.[0]?.id) {
            console.log(`📤 Interactive message (${isListMode ? 'list' : 'buttons'}) sent: ${result.messages[0].id}`)
            return result
          } else {
            console.error(`❌ Interactive send failed (attempt ${attempt}):`, result)
          }
        } catch (fetchErr) {
          console.warn(`⚠️ Interactive send fetch error (attempt ${attempt}/2):`, fetchErr.message)
          if (attempt === 2) throw fetchErr
        }
      }

    } catch (error) {
      console.error('❌ sendWhatsAppInteractiveButtons error:', error)
      return null
    }
  },

  // ─────────────────────────────────────────
  // Send Catalog Message via Meta API
  // ─────────────────────────────────────────
  sendWhatsAppCatalogMessage: async (tenantId, phone, bodyText, footerText = null, thumbnailSku = null) => {
    try {
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP - CATALOG MESSAGE  ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To     : ${phone}`)
        console.log(`║  Body   : ${bodyText}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_cat_' + Date.now() }] }
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true,
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return null
      }

      const token = decrypt(tenant.whatsappAccessToken)
      const url = `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'catalog_message',
          body: { text: bodyText || 'Browse our product catalog below:' },
          ...(footerText ? { footer: { text: footerText } } : {}),
          action: {
            name: 'catalog_message',
            ...(thumbnailSku ? { parameters: { thumbnail_product_retailer_id: thumbnailSku } } : {})
          }
        }
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          })

          const result = await response.json()
          if (result.messages?.[0]?.id) {
            console.log(`📤 Catalog message sent: ${result.messages[0].id}`)
            return result
          } else {
            console.error(`❌ Catalog message send failed (attempt ${attempt}):`, result)
          }
        } catch (fetchErr) {
          console.warn(`⚠️ Catalog send fetch error (attempt ${attempt}/2):`, fetchErr.message)
          if (attempt === 2) throw fetchErr
        }
      }
    } catch (error) {
      console.error('❌ sendWhatsAppCatalogMessage error:', error)
      return null
    }
  },

  // ─────────────────────────────────────────
  // Send Location Request Message via Meta API
  // ─────────────────────────────────────────
  sendLocationRequestMessage: async (tenantId, phone, bodyText) => {
    try {
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP - LOCATION REQUEST ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To     : ${phone}`)
        console.log(`║  Body   : ${bodyText}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_loc_req_' + Date.now() }] }
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return null
      }

      const token = decrypt(tenant.whatsappAccessToken)
      const url = `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'location_request_message',
          body: { text: bodyText || 'Please share your delivery location so we can reach you accurately 🚚' },
          action: { name: 'send_location' }
        }
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          })

          const result = await response.json()
          if (result.messages?.[0]?.id) {
            console.log(`📤 Location Request sent: ${result.messages[0].id}`)
            return result
          } else {
            console.error(`❌ Location Request failed (attempt ${attempt}):`, result)
          }
        } catch (fetchErr) {
          console.warn(`⚠️ Location request fetch error (attempt ${attempt}/2):`, fetchErr.message)
          if (attempt === 2) throw fetchErr
        }
      }
    } catch (error) {
      console.error('❌ sendLocationRequestMessage error:', error)
      return null
    }
  },

  // ─────────────────────────────────────────
  // Send Store Location Pin via Meta API
  // ─────────────────────────────────────────
  sendStoreLocationPin: async (tenantId, phone, storeData) => {
    try {
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP - STORE PIN        ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To     : ${phone}`)
        console.log(`║  Name   : ${storeData.storeName}`)
        console.log(`║  Address: ${storeData.address}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_pin_' + Date.now() }] }
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return null
      }

      const token = decrypt(tenant.whatsappAccessToken)
      const url = `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'location',
        location: {
          latitude: storeData.latitude || 19.1136,
          longitude: storeData.longitude || 72.8697,
          name: storeData.storeName || 'Store Location',
          address: storeData.address || 'Store Address'
        }
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          })

          const result = await response.json()
          if (result.messages?.[0]?.id) {
            console.log(`📤 Store pin sent: ${result.messages[0].id}`)
            return result
          } else {
            console.error(`❌ Store pin send failed (attempt ${attempt}):`, result)
          }
        } catch (fetchErr) {
          console.warn(`⚠️ Store pin send fetch error (attempt ${attempt}/2):`, fetchErr.message)
          if (attempt === 2) throw fetchErr
        }
      }
    } catch (error) {
      console.error('❌ sendStoreLocationPin error:', error)
      return null
    }
  },

  // ─────────────────────────────────────────
  // Save bot message to DB
  // ─────────────────────────────────────────
  saveBotMessage: async (conversationId, text, extra = {}) => {
  try {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        direction:  'OUTBOUND',
        text,
        type:       extra.type    || 'TEXT',
        buttons:    extra.buttons || null
      },
      include: {
        conversation: {
          include: {
            contact: true
          }
        }
      }
    })

    const messagePayload = {
      conversationId: message.conversationId,
      message: {
        id:             message.id,
        text:           message.text,
        type:           message.type,
        buttons:        message.buttons,
        senderId:       message.senderId,
        isFromCustomer: false,
        createdAt:      message.createdAt
      }
    }

    // ✅ Emit to tenant (dashboard)
    emitToTenant(message.conversation.tenantId, 'new_message', messagePayload)

    // ✅ ADD: Also emit to assigned user (agent's inbox)
    const assignedTo = message.conversation.assignedTo || 
                       message.conversation.contact?.assignedTo

    if (assignedTo) {
      emitToUser(assignedTo, 'new_message', messagePayload)
      console.log(`📤 Bot message emitted to user_${assignedTo}`)
    }

  } catch (error) {
    console.error('❌ saveBotMessage error:', error)
  }
},

  // ─────────────────────────────────────────
  // PAYMENT Node
  // ─────────────────────────────────────────
  handlePaymentNode: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`💳 Executing PAYMENT node: ${node.id}`)
    try {
      const activeOrderId = conversation.flowData?.activeOrderId
      let order = null
      if (activeOrderId) {
        order = await prisma.order.findUnique({
          where: { id: activeOrderId }
        })
      }
      if (!order) {
        order = await prisma.order.findFirst({
          where: { conversationId: conversation.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' }
        })
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: conversation.tenantId },
        select: {
          id: true,
          enableOnlinePayment: true,
          enableCod: true,
          razorpayKeyId: true,
          razorpayKeySecret: true,
          defaultCurrency: true,
          paymentLinkExpiryMins: true,
        }
      })

      if (!order || !tenant) {
        console.warn('⚠️ No active order or tenant found for PAYMENT node. Ensure an order is created prior to the Payment node.')
        if (node.nextNodeId) {
          const nextNode = await flowService.getNodeById(node.nextNodeId)
          if (nextNode) return await flowEngine.executeNode(nextNode, conversation, contact, userMessage, isNewContact)
        }
        return await flowEngine.endFlow(conversation)
      }

      const { createOrderPaymentLink } = await import('../orders/orderPaymentService.js')
      const { paymentLink, fallbackCod } = await createOrderPaymentLink({
        order,
        tenant,
        contact
      })

      if (fallbackCod) {
        const codMsg = `🎉 *Order #${order.orderNumber} Placed!*\n\nTotal Amount: ${order.currency} ${Number(order.totalAmount).toFixed(2)} (Cash on Delivery)`
        await flowEngine.sendBotTextMessage(conversation, contact, codMsg)
        await flowEngine.saveBotMessage(conversation.id, codMsg)
        if (node.nextNodeId) {
          const nextNode = await flowService.getNodeById(node.nextNodeId)
          if (nextNode) return await flowEngine.executeNode(nextNode, conversation, contact, userMessage, isNewContact)
        }
        return await flowEngine.endFlow(conversation)
      }

      const payBody = node.content || `📦 *Payment for Order #${order.orderNumber}*\n\n💰 Total Amount: *${order.currency} ${Number(order.totalAmount).toFixed(2)}*\n\nPlease tap the button below to complete your payment securely:${tenant.enableCod ? '\n\n💡 _Prefer Cash on Delivery? Reply *COD*._' : ''}`

      let ctaResult = null;
      if (contact.phone) {
        ctaResult = await flowEngine.sendWhatsAppPaymentCTA(conversation.tenantId, contact.phone, {
          headerText: '💳 Complete Payment',
          bodyText: payBody,
          footerText: `Expires in ${tenant.paymentLinkExpiryMins || 30} mins`,
          buttonText: 'Pay Now',
          url: paymentLink.short_url,
        });
      }

      if (!ctaResult) {
        // Fallback for Instagram, Messenger, or missing WABA CTA support
        const fallbackPayMsg = `${payBody}\n\n👉 *Pay Here:* ${paymentLink.short_url}`;
        await flowEngine.sendBotTextMessage(conversation, contact, fallbackPayMsg);
      }

      await flowEngine.saveBotMessage(conversation.id, payBody, {
        type: 'TEXT',
        buttons: [{ id: 'pay_now', title: 'Pay Now', url: paymentLink.short_url }]
      });

      // Hold conversation at this PAYMENT node waiting for webhook
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT',
          flowData: {
            ...conversation.flowData,
            activeOrderId: order.id,
            paymentLinkId: paymentLink.id,
          }
        }
      })

      console.log(`⏸️ Conversation ${conversation.id} waiting for payment confirmation on node ${node.id}`)

    } catch (err) {
      console.error('❌ Failed in handlePaymentNode:', err.message)
      if (node.nextNodeId) {
        const nextNode = await flowService.getNodeById(node.nextNodeId)
        if (nextNode) return await flowEngine.executeNode(nextNode, conversation, contact, userMessage, isNewContact)
      }
      await flowEngine.endFlow(conversation)
    }
  },

  // ─────────────────────────────────────────
  // Resume Flow After Successful Payment
  // ─────────────────────────────────────────
  resumeFlowAfterPayment: async (order, paymentStatus) => {
    try {
      console.log(`▶️ [resumeFlowAfterPayment] Order #${order.orderNumber} paid. Resuming flow...`)

      let conversation = null
      if (order.conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: order.conversationId },
          include: { contact: true }
        })
      }

      if (!conversation && order.contactId) {
        conversation = await prisma.conversation.findFirst({
          where: { contactId: order.contactId, tenantId: order.tenantId },
          include: { contact: true }
        })
      }

      if (!conversation || !conversation.contact) {
        console.log(`⚠️ [resumeFlowAfterPayment] No conversation found for order ${order.orderNumber}`)
        return
      }

      const contact = conversation.contact

      // Send detailed payment receipt message (Order #, Amount & Transaction ID)
      const confirmMsg = `🎉 *Payment Received!*\n\nPayment for Order #${order.orderNumber} has been received successfully.\n\n💰 *Amount:* ${order.currency} ${Number(order.totalAmount).toFixed(2)}\n🔖 *Transaction ID:* ${order.razorpayPaymentId || 'N/A'}\n\nYour order is confirmed and our team has started processing it! 🚚`

      // 24-hour Meta messaging window check
      const lastActivity = conversation.updatedAt ? new Date(conversation.updatedAt).getTime() : 0
      const isWithin24Hours = (Date.now() - lastActivity) < (24 * 60 * 60 * 1000)

      if (isWithin24Hours) {
        await flowEngine.sendBotTextMessage(conversation, contact, confirmMsg)
        await flowEngine.saveBotMessage(conversation.id, confirmMsg)
      } else {
        console.warn(`⚠️ [resumeFlowAfterPayment] Outside 24h window for contact ${contact.phone}. Free-form message withheld.`)
        await flowEngine.saveBotMessage(conversation.id, confirmMsg)
      }

      // Check if conversation was paused on a PAYMENT node — if so, advance to next flow node
      if (conversation.currentNodeId) {
        const currentNode = await flowService.getNodeById(conversation.currentNodeId)
        if (currentNode && currentNode.type === 'PAYMENT' && currentNode.nextNodeId) {
          const nextNode = await flowService.getNodeById(currentNode.nextNodeId)
          if (nextNode) {
            console.log(`▶️ Advancing flow to next node: ${nextNode.id} (${nextNode.type})`)
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { currentNodeId: nextNode.id }
            })
            const updatedConv = { ...conversation, currentNodeId: nextNode.id }
            await flowEngine.executeNode(nextNode, updatedConv, contact)
            return
          }
        }
      }

      await flowEngine.endFlow(conversation)

    } catch (err) {
      console.error('❌ resumeFlowAfterPayment error:', err)
    }
  },

  // ─────────────────────────────────────────
  // Handle Payment Failed Alert
  // ─────────────────────────────────────────
  handlePaymentFailed: async (order, reason) => {
    try {
      let conversation = null
      if (order.conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: order.conversationId },
          include: { contact: true }
        })
      }

      if (!conversation || !conversation.contact) return

      const contact = conversation.contact
      const tenant = await prisma.tenant.findUnique({
        where: { id: order.tenantId },
        select: { enableCod: true }
      })

      const failMsg = `⚠️ *Payment Unsuccessful*\n\nYour payment for Order #${order.orderNumber} could not be processed (${reason || 'Payment failed'}).\n\nTap below to retry your payment${tenant?.enableCod ? ', or reply *COD* to switch to Cash on Delivery.' : '.'}`

      if (order.paymentLinkUrl) {
        await flowEngine.sendWhatsAppPaymentCTA(conversation.tenantId, contact.phone, {
          headerText: '⚠️ Payment Retry',
          bodyText: failMsg,
          buttonText: 'Retry Payment',
          url: order.paymentLinkUrl,
        })
      } else {
        await flowEngine.sendBotTextMessage(conversation, contact, failMsg)
      }

      await flowEngine.saveBotMessage(conversation.id, failMsg)
    } catch (err) {
      console.error('❌ handlePaymentFailed error:', err)
    }
  },

  // ─────────────────────────────────────────
  // Handle Payment Link Expired Alert
  // ─────────────────────────────────────────
  handlePaymentExpired: async (order) => {
    try {
      let conversation = null
      if (order.conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: order.conversationId },
          include: { contact: true }
        })
      }

      if (!conversation || !conversation.contact) return

      const contact = conversation.contact
      const tenant = await prisma.tenant.findUnique({
        where: { id: order.tenantId },
        select: { enableCod: true }
      })

      const expireMsg = `⏰ *Payment Link Expired*\n\nThe payment link for Order #${order.orderNumber} has expired.\n\nReply *PAY* to generate a fresh payment link${tenant?.enableCod ? ', or reply *COD* to pay on delivery.' : '.'}`

      await flowEngine.sendBotTextMessage(conversation, contact, expireMsg)
      await flowEngine.saveBotMessage(conversation.id, expireMsg)
    } catch (err) {
      console.error('❌ handlePaymentExpired error:', err)
    }
  },

  // ─────────────────────────────────────────
  // Send Interactive CTA URL (Payment Button)
  // ─────────────────────────────────────────
  sendWhatsAppPaymentCTA: async (tenantId, phone, { headerText, bodyText, footerText, buttonText, url }) => {
    try {
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP - PAYMENT CTA URL  ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To     : ${phone}`)
        console.log(`║  Header : ${headerText || 'Complete Payment'}`)
        console.log(`║  Body   : ${bodyText}`)
        console.log(`║  Button : [${buttonText || 'Pay Now'}] -> ${url}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_cta_' + Date.now() }] }
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true,
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return null
      }

      const token = decrypt(tenant.whatsappAccessToken)
      const apiUrl = `https://graph.facebook.com/v21.0/${tenant.whatsappPhoneId}/messages`

      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          ...(headerText ? { header: { type: 'text', text: headerText } } : {}),
          body: { text: bodyText },
          ...(footerText ? { footer: { text: footerText } } : {}),
          action: {
            name: 'cta_url',
            parameters: {
              display_text: (buttonText || 'Pay Now').slice(0, 20),
              url: url
            }
          }
        }
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          })

          const result = await response.json()
          if (result.messages?.[0]?.id) {
            console.log(`📤 WhatsApp Payment CTA sent: ${result.messages[0].id}`)
            return result
          } else {
            console.warn(`⚠️ Payment CTA send attempt ${attempt} failed:`, result)
            // If cta_url is not supported for this WABA or number, fall back to standard text message with link
            if (attempt === 2) {
              console.log('🔄 Falling back to standard text message with payment link')
              const fallbackText = `${headerText ? `*${headerText}*\n\n` : ''}${bodyText}\n\n👉 Pay here: ${url}`
              return await flowEngine.sendWhatsAppMessage(tenantId, phone, fallbackText)
            }
          }
        } catch (fetchErr) {
          console.warn(`⚠️ Payment CTA fetch error (attempt ${attempt}/2):`, fetchErr.message)
          if (attempt === 2) {
            const fallbackText = `${bodyText}\n\n👉 Pay here: ${url}`
            return await flowEngine.sendWhatsAppMessage(tenantId, phone, fallbackText)
          }
        }
      }
    } catch (error) {
      console.error('❌ sendWhatsAppPaymentCTA error:', error)
      return null
    }
  }

}

export default flowEngine