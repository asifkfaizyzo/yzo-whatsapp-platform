import api from "./api";

export const getWooCommerceStatus = async () => {
  const response = await api.get("/woocommerce/status");
  return response.data;
};

export const connectWooCommerce = async (data) => {
  const response = await api.post("/woocommerce/connect", data);
  return response.data;
};

export const disconnectWooCommerce = async () => {
  const response = await api.post("/woocommerce/disconnect");
  return response.data;
};

export const saveWooCommerceTrackingUrlTemplates = async (templates) => {
  const response = await api.put("/woocommerce/tracking-url-templates", { templates });
  return response.data;
};

export const updateWooCommerceAlertSettings = async (settings) => {
  const response = await api.put("/woocommerce/alert-settings", settings);
  return response.data;
};

export const getWooCommerceCartRecoveryWebhookConfig = async () => {
  const response = await api.get("/woocommerce/cart-recovery-webhook-config");
  return response.data;
};

export const updateWooCommerceCartRecoverySettings = async (settings) => {
  const response = await api.put("/woocommerce/cart-recovery-settings", settings);
  return response.data;
};

// 👇 1-Click OAuth
export const getWooCommerceOAuthUrl = async (storeUrl) => {
  const res = await api.get(
    `/woocommerce/oauth/url?storeUrl=${encodeURIComponent(storeUrl)}`
  );

  return res.data;
};


export const saveWooCommerceConfig = connectWooCommerce;

export const wooCommerceService = {
  getWooCommerceStatus,
  connectWooCommerce,
  disconnectWooCommerce,
  saveWooCommerceTrackingUrlTemplates,
  updateWooCommerceAlertSettings,
  getWooCommerceCartRecoveryWebhookConfig,
  updateWooCommerceCartRecoverySettings,
  saveWooCommerceConfig,
  getStatus: getWooCommerceStatus,
  connect: connectWooCommerce,
  disconnect: disconnectWooCommerce,
};

export const woocommerceService = wooCommerceService;

export default wooCommerceService;