import api from "./api";

export const getShopifyStatus = async () => {
  const response = await api.get("/shopify/status");
  return response.data;
};

export const connectShopify = async (data) => {
  const response = await api.post("/shopify/connect", data);
  return response.data;
};

export const disconnectShopify = async () => {
  const response = await api.post("/shopify/disconnect");
  return response.data;
};

export const saveShopifyConfig = connectShopify;

export const shopifyService = {
  getShopifyStatus,
  connectShopify,
  disconnectShopify,
  saveShopifyConfig,
  getStatus: getShopifyStatus,
  connect: connectShopify,
  disconnect: disconnectShopify,
};

export default shopifyService;