// backend/src/modules/orders/orderController.js
import prisma from '../../config/prisma.js';
import { resendOrderPaymentLink, initiateRefund, cancelOrderPaymentLink } from './orderPaymentService.js';
import flowEngine from '../automation/flowEngineService.js';

export const getOrders = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { page = 1, limit = 20, status, paymentStatus, search } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = { tenantId };
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: { id: true, name: true, phone: true }
          },
          items: true,
        }
      }),
      prisma.order.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        contact: true,
        items: true,
        conversation: true,
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resendPaymentLinkHandler = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { orderId } = req.params;

    const result = await resendOrderPaymentLink({ orderId, tenantId });

    // Send WhatsApp interactive payment CTA to customer if contact phone exists
    if (result.order?.contact?.phone) {
      const payBody = `💳 *Payment Link for Order #${result.order.orderNumber}*\n\n💰 Total Amount: *${result.order.currency} ${Number(result.order.totalAmount).toFixed(2)}*\n\nPlease tap the button below to complete your payment:`;
      await flowEngine.sendWhatsAppPaymentCTA(tenantId, result.order.contact.phone, {
        headerText: '💳 Complete Payment',
        bodyText: payBody,
        buttonText: 'Pay Now',
        url: result.paymentLink.short_url,
      });

      if (result.order.conversationId) {
        await flowEngine.saveBotMessage(result.order.conversationId, payBody, {
          type: 'TEXT',
          buttons: [{ id: 'pay_now', title: 'Pay Now', url: result.paymentLink.short_url }]
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment link generated and sent to customer',
      data: result
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const refundOrderHandler = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { orderId } = req.params;
    const { amount, reason } = req.body;

    const result = await initiateRefund(orderId, tenantId, { amount, reason });

    return res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: result
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const cancelOrderPaymentLinkHandler = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { orderId } = req.params;

    const result = await cancelOrderPaymentLink({ orderId, tenantId });

    return res.status(200).json({
      success: true,
      message: 'Payment link cancelled successfully',
      data: result
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
