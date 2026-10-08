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

// 👇 NEW — 1-Click OAuth
export const getWooCommerceOAuthUrl = async (storeUrl) => {
  const apiBase = import.meta.env.VITE_API_URL || "/api2";

  const oauthPath = apiBase.endsWith("/api2")
    ? "/woocommerce/oauth/url"
    : "/api2/woocommerce/oauth/url";

  const res = await api.get(
    `${oauthPath}?storeUrl=${encodeURIComponent(storeUrl)}`
  );

  return res.data;
};

export const saveWooCommerceConfig = connectWooCommerce;

export const wooCommerceService = {
  getWooCommerceStatus,
  connectWooCommerce,
  disconnectWooCommerce,
  saveWooCommerceTrackingUrlTemplates,
  saveWooCommerceConfig,
  getStatus: getWooCommerceStatus,
  connect: connectWooCommerce,
  disconnect: disconnectWooCommerce,
};

export const woocommerceService = wooCommerceService;

export default wooCommerceService;