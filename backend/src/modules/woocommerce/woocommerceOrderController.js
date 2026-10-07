import prisma from '../../config/prisma.js';

// GET /api2/woocommerce/orders?phone=+91xxxxxxxxx
export const getCustomerOrders = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const orders = await prisma.ecommerceOrder.findMany({
      where: {
        tenantId,
        customerPhone: phone,
        source: 'WOOCOMMERCE'
      },
      orderBy: { createdAt: 'desc' },
      take: 10 // Show last 10 orders in the inbox sidebar
    });

    return res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};