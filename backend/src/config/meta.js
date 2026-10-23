// backend/src/config/meta.js

export const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0';
export const GRAPH_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
