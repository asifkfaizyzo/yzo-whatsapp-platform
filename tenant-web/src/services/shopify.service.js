import api from "./api";

export const getShopifyStatus = async () => {
  const response = await api.get("/shopify/status");
  return response.data;
};

export const connectShopify = async (data) => {
  const response = await api.post("/shopify/connect", data);
  return response.data;
};

export const getShopifyOAuthUrl = async (shop) => {
  const response = await api.get(`/shopify/oauth/url?shop=${encodeURIComponent(shop)}`);
  return response.data;
};

export const disconnectShopify = async () => {
  const response = await api.post("/shopify/disconnect");
  return response.data;
};

export const updateShopifyCartRecoverySettings = async (settings) => {
  const response = await api.put("/shopify/cart-recovery-settings", settings);
  return response.data;
};

export const saveShopifyConfig = connectShopify;

export const shopifyService = {
  getShopifyStatus,
  getShopifyOAuthUrl,
  connectShopify,
  disconnectShopify,
  updateShopifyCartRecoverySettings,
  saveShopifyConfig,
  getStatus: getShopifyStatus,
  connect: connectShopify,
  disconnect: disconnectShopify,
};

export default shopifyService;