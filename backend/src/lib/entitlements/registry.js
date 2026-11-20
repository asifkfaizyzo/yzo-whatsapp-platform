// backend/src/lib/entitlements/registry.js (do not remove this comment)

export const ENTITLEMENT_REGISTRY = Object.freeze({
  // ── Team ──
  maxAgents: {
    category: "TEAM",
    type: "INT",
    usage: "STATIC",
    default: 1,
    unit: "seats",
    implemented: true,
    counterModel: "User",
    label: "Team Seats",
    description: "Maximum active user/agent accounts allowed"
  },

  // ── Audience ──
  maxContacts: {
    category: "AUDIENCE",
    type: "INT",
    usage: "STATIC",
    default: 1000,
    unit: "contacts",
    implemented: true,
    counterModel: "Contact",
    label: "Contacts Limit",
    description: "Maximum contacts in database"
  },
  maxTags: {
    category: "AUDIENCE",
    type: "INT",
    usage: "STATIC",
    default: 15,
    unit: "tags",
    implemented: true,
    counterModel: "Tag",
    label: "Tags Limit",
    description: "Maximum custom audience tags allowed"
  },
  maxAttributes: {
    category: "AUDIENCE",
    type: "INT",
    usage: "STATIC",
    default: 15,
    unit: "fields",
    implemented: true,
    counterModel: "SheetField",
    label: "Custom Attributes",
    description: "Maximum contact attributes / custom fields"
  },
  maxSegments: {
    category: "AUDIENCE",
    type: "INT",
    usage: "STATIC",
    default: 2,
    unit: "segments",
    implemented: false,
    label: "Audience Segments",
    description: "Maximum saved contact segments"
  },
  maxContactLists: {
    category: "AUDIENCE",
    type: "INT",
    usage: "STATIC",
    default: 10,
    unit: "lists",
    implemented: false,
    label: "Contact Lists",
    description: "Maximum saved contact lists"
  },

  // ── Automation ──
  maxAutomations: {
    category: "AUTOMATION",
    type: "INT",
    usage: "STATIC",
    default: 5,
    unit: "flows",
    implemented: true,
    counterModel: "Flow",
    label: "Active Flow Automations",
    description: "Maximum published automation workflows"
  },
  maxAutomationTriggers: {
    category: "AUTOMATION",
    type: "INT",
    usage: "METERED",
    default: 1000,
    unit: "runs/mo",
    implemented: false,
    label: "Automation Runs / Month",
    description: "Monthly limit on workflow executions"
  },

  // ── Messaging ──
  maxCampaigns: {
    category: "MESSAGING",
    type: "INT",
    usage: "METERED",
    default: 10,
    unit: "campaigns/mo",
    implemented: true,
    label: "Broadcast Campaigns / Month",
    description: "Maximum broadcast campaigns sent per month"
  },
  maxBroadcasts: {
    category: "MESSAGING",
    type: "INT",
    usage: "METERED",
    default: 5000,
    unit: "recipients/mo",
    implemented: true,
    label: "Broadcast Recipients / Month",
    description: "Total broadcast message recipients per month"
  },
  messagingSpeed: {
    category: "MESSAGING",
    type: "INT",
    usage: "CONFIG",
    default: 40,
    unit: "msg/sec",
    implemented: false,
    label: "Messaging Speed",
    description: "Maximum outbound message throughput rate"
  },
  maxStorageMb: {
    category: "STORAGE",
    type: "INT",
    usage: "STATIC",
    default: 1000,
    unit: "MB",
    implemented: false,
    label: "Storage Limit (MB)",
    description: "Total media upload storage space"
  },

  // ── API ──
  maxApiCalls: {
    category: "API",
    type: "INT",
    usage: "METERED",
    default: 10000,
    unit: "calls/mo",
    implemented: false,
    label: "API Calls / Month",
    description: "Monthly REST API call limit"
  },
  enableApiAccess: {
    category: "API",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "REST API Access",
    description: "Enable external REST API key generation"
  },
  enableWebhooks: {
    category: "API",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "Outbound Webhooks",
    description: "Enable outbound webhook subscriptions"
  },

  // ── AI ──
  enableAiAgent: {
    category: "AI",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "AI Bot Agent",
    description: "Enable AI auto-reply assistant"
  },
  maxAiCredits: {
    category: "AI",
    type: "INT",
    usage: "METERED",
    default: 500,
    unit: "credits/mo",
    implemented: false,
    label: "AI Credits / Month",
    description: "Monthly AI response generation credits"
  },
  enableAiVoice: {
    category: "AI",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "AI Voice Calling",
    description: "Enable AI conversational voice agent"
  },
  maxAiVoiceCredits: {
    category: "AI",
    type: "INT",
    usage: "METERED",
    default: 0,
    unit: "credits/mo",
    implemented: false,
    label: "AI Voice Credits / Month",
    description: "Monthly AI voice call minutes/credits"
  },

  // ── Calling ──
  enableWhatsappCalling: {
    category: "CALLING",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: true,
    label: "WhatsApp Calling",
    description: "Enable WhatsApp audio calling feature"
  },

  // ── Channels ──
  allowedChannels: {
    category: "CHANNELS",
    type: "STRING_ARRAY",
    usage: "STATIC",
    default: ["WHATSAPP"],
    unit: null,
    implemented: false,
    label: "Allowed Channels",
    description: "Supported messaging platform channels"
  },
  maxChannels: {
    category: "CHANNELS",
    type: "INT",
    usage: "STATIC",
    default: 1,
    unit: "connections",
    implemented: false,
    label: "Connected Channels Limit",
    description: "Maximum active channel connections allowed"
  },

  // ── Integrations ──
  allowedIntegrations: {
    category: "INTEGRATIONS",
    type: "STRING_ARRAY",
    usage: "STATIC",
    default: [],
    unit: null,
    implemented: false,
    label: "Allowed Integrations",
    description: "Supported third-party app integrations"
  },
  maxIntegrations: {
    category: "INTEGRATIONS",
    type: "INT",
    usage: "STATIC",
    default: 1,
    unit: "connections",
    implemented: false,
    label: "Connected Integrations Limit",
    description: "Maximum active integration connections"
  },

  // ── Features ──
  enableCampaignScheduler: {
    category: "FEATURES",
    type: "BOOLEAN",
    usage: "STATIC",
    default: true,
    unit: null,
    implemented: true,
    label: "Broadcast Campaign Scheduler",
    description: "Schedule broadcast campaigns for future execution"
  },
  enableClickTracking: {
    category: "FEATURES",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "Link Click Tracking",
    description: "Track link clicks in WhatsApp messages"
  },
  enableAutoRetry: {
    category: "FEATURES",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "Failed Message Auto-Retry",
    description: "Automatically retry failed message deliveries"
  },
  enableCatalog: {
    category: "FEATURES",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "E-Commerce Catalog Sync",
    description: "Sync and display interactive product catalogs"
  },
  enableCustomRoles: {
    category: "FEATURES",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "Custom Granular Roles",
    description: "Create custom team member roles and permission sets"
  },
  enablePrioritySupport: {
    category: "FEATURES",
    type: "BOOLEAN",
    usage: "STATIC",
    default: false,
    unit: null,
    implemented: false,
    label: "Priority Customer Support",
    description: "Fast-tracked ticket support routing"
  }
});

export const ENTITLEMENT_MAP = ENTITLEMENT_REGISTRY;
export const ENTITLEMENT_ARRAY = Object.freeze(Object.keys(ENTITLEMENT_REGISTRY));

export const INTEGRATION_CATALOG = Object.freeze([
  "SHOPIFY",
  "WOOCOMMERCE",
  "ZOHO",
  "GOOGLE_SHEETS",
  "RAZORPAY"
]);

export const CHANNEL_CATALOG = Object.freeze([
  "WHATSAPP",
  "INSTAGRAM",
  "MESSENGER"
]);

export function getEntitlementMeta(key) {
  return ENTITLEMENT_REGISTRY[key] || null;
}

export function getDefaultEntitlements() {
  const defaults = {};
  for (const [key, meta] of Object.entries(ENTITLEMENT_REGISTRY)) {
    defaults[key] = meta.default;
  }
  return defaults;
}

export function validateEntitlementsObject(input = {}) {
  const sanitized = {};
  for (const [key, meta] of Object.entries(ENTITLEMENT_REGISTRY)) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const val = input[key];
      if (meta.type === "INT") {
        const parsed = parseInt(val, 10);
        sanitized[key] = isNaN(parsed) ? meta.default : parsed;
      } else if (meta.type === "BOOLEAN") {
        sanitized[key] = Boolean(val);
      } else if (meta.type === "STRING_ARRAY") {
        sanitized[key] = Array.isArray(val) ? val.map(String) : meta.default;
      }
    } else {
      sanitized[key] = meta.default;
    }
  }
  return sanitized;
}