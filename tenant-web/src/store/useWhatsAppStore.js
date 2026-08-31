import { create } from "zustand";
import { getWhatsappStatus } from "../services/tenant.service";
import { getSocket } from "../lib/socket";

export const useWhatsAppStore = create((set, get) => ({
  // null = state is unknown / currently loading (CRITICAL to prevent flicker)
  isConnected: null,
  loading: true,
  phoneNumberId: null,
  wabaId: null,
  phoneNumber: null,
  businessName: null,
  qualityRating: null,
  messagingTier: null,
  webhookStatus: "active",
  health: null,
  lastFetchedAt: null,
  _socketBound: false,

  setConnected: (payload = {}) =>
    set({
      isConnected: true,
      loading: false,
      phoneNumberId: payload.phoneNumberId ?? get().phoneNumberId,
      wabaId: payload.wabaId ?? get().wabaId,
      phoneNumber: payload.displayPhoneNumber ?? payload.phoneNumber ?? get().phoneNumber,
      businessName: payload.verifiedName ?? payload.businessName ?? get().businessName,
      webhookStatus: payload.webhookStatus ?? "active",
      lastFetchedAt: Date.now(),
    }),

  setDisconnected: () =>
    set({
      isConnected: false,
      loading: false,
      phoneNumberId: null,
      wabaId: null,
      phoneNumber: null,
      businessName: null,
      qualityRating: null,
      messagingTier: null,
      webhookStatus: "active",
      health: null,
      lastFetchedAt: Date.now(),
    }),

  fetchStatus: async ({ force = false } = {}) => {
    const state = get();
    const isFresh = state.lastFetchedAt && Date.now() - state.lastFetchedAt < 30000; // 30s cache

    if (!force && isFresh && state.isConnected !== null) {
      return state;
    }

    // Keep previous state if known, only set loading if state is completely unknown
    set({ loading: state.isConnected === null });

    try {
      const res = await getWhatsappStatus();

      if (!res.success) {
        if (get().isConnected === null) {
          set({ isConnected: false, loading: false, lastFetchedAt: Date.now() });
        } else {
          set({ loading: false });
        }
        return get();
      }

      const body = res.data || {};
      const connected = !!body.isConnected;
      const health = body.health || {};

      if (connected) {
        set({
          isConnected: true,
          loading: false,
          phoneNumberId: body.phoneNumberId || null,
          wabaId: body.wabaId || null,
          phoneNumber: health.displayPhoneNumber || body.displayPhoneNumber || null,
          businessName: health.verifiedName || body.verifiedName || null,
          qualityRating: health.qualityRating || null,
          messagingTier: health.tierName || health.messagingLimitTier || null,
          webhookStatus: body.webhookStatus || "active",
          health,
          lastFetchedAt: Date.now(),
        });
      } else {
        set({
          isConnected: false,
          loading: false,
          phoneNumberId: null,
          wabaId: null,
          phoneNumber: null,
          businessName: null,
          qualityRating: null,
          messagingTier: null,
          webhookStatus: "active",
          health: null,
          lastFetchedAt: Date.now(),
        });
      }
    } catch (e) {
      if (get().isConnected === null) {
        set({ isConnected: false, loading: false, lastFetchedAt: Date.now() });
      } else {
        set({ loading: false });
      }
    }

    return get();
  },

  bindSocket: () => {
    if (get()._socketBound) return;

    const socket = getSocket();
    if (!socket) return;

    const onStatusChanged = (payload = {}) => {
      if (payload.isConnected) {
        get().setConnected(payload);
      } else {
        get().setDisconnected();
      }
    };

    socket.on("whatsapp_status_changed", onStatusChanged);
    set({ _socketBound: true });
  },

  reset: () =>
    set({
      isConnected: null,
      loading: true,
      phoneNumberId: null,
      wabaId: null,
      phoneNumber: null,
      businessName: null,
      qualityRating: null,
      messagingTier: null,
      webhookStatus: "active",
      health: null,
      lastFetchedAt: null,
      _socketBound: false,
    }),
}));