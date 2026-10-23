// src/modules/zoho/zohoProductService.js

import prisma from '../../config/prisma.js';
import { zohoRequest } from './zohoClient.js';
import { hasZohoFeature } from './zohoPlanService.js';

/**
 * Fetch active products from Zoho CRM.
 * Supports searching and pagination.
 */
export async function getZohoProducts(tenantId, options = {}) {
  const { search = '', page = 1, limit = 20 } = options;

  try {
    const canRead = await hasZohoFeature(tenantId, 'deals'); // Available on Standard+
    if (!canRead) {
      return { products: [], total: 0, message: 'Products module not available on this plan' };
    }

    let url = `/crm/v7/Products?page=${page}&per_page=${limit}`;
    if (search && search.trim()) {
      url = `/crm/v7/Products/search?word=${encodeURIComponent(search.trim())}`;
    }

    const response = await zohoRequest(tenantId, {
      method: 'GET',
      url,
    });

    const items = response?.data || [];

    const products = items.map((p) => ({
      id: p.id,
      productCode: p.Product_Code || null,
      productName: p.Product_Name || 'Unnamed Product',
      unitPrice: Number(p.Unit_Price) || 0,
      qtyInStock: Number(p.Qty_in_Stock) || 0,
      description: p.Description || null,
      category: p.Product_Category || null,
      isActive: p.Product_Active !== false,
    }));

    return {
      products,
      count: products.length,
      page,
      limit,
    };
  } catch (error) {
    console.error(`❌ [ZohoProduct] Failed to fetch products for tenant ${tenantId}:`, error.response?.data || error.message);
    return { products: [], count: 0, error: error.message };
  }
}