// tenant-web/src/pages/Inbox/comps/hooks/useInboxCalls.js (do not remove this comment)

import { useState, useEffect, useCallback } from "react";
import api from "../../../../api/axios";
import { useAuthStore } from "../../../../store/useAuthStore";
import { useCallStore } from "../../../../store/useCallStore";
import { useToast } from "../../../../context/ToastContext";
import * as webrtcService from "../../../../lib/webrtcService";

/**
 * Manages WhatsApp call lifecycle: permission checks, call initiation
 * via WebRTC, loading call history for the active conversation.
 *
 * @param {object} opts
 * @param {string} opts.activeChatId
 */
export const useInboxCalls = ({ activeChatId }) => {
  const toast = useToast();
  const { user } = useAuthStore();
  const setCall = useCallStore((s) => s.setCall);
  const globalActiveCall = useCallStore((s) => s.activeCall);

  const [activeChatCalls, setActiveChatCalls] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [showCallPermissionModal, setShowCallPermissionModal] =
    useState(false);
  const [showInitiateCallConfirmModal, setShowInitiateCallConfirmModal] =
    useState(false);
  const [pendingCallContact, setPendingCallContact] = useState(null);

  // ── Load Calls for Active Conversation ──
  const loadConversationCalls = useCallback(async (convId) => {
    if (!convId) {
      setActiveChatCalls([]);
      return;
    }
    setLoadingCalls(true);
    try {
      const res = await api.get(
        `/whatsapp/calls/conversation/${convId}`,
      );
      if (res.data?.success) {
        setActiveChatCalls(res.data.data || []);
      }
    } catch (err) {
      console.warn("Failed to load calls for conversation:", err);
    } finally {
      setLoadingCalls(false);
    }
  }, []);

  useEffect(() => {
    if (activeChatId) {
      loadConversationCalls(activeChatId);
    } else {
      setActiveChatCalls([]);
    }
  }, [activeChatId, loadConversationCalls]);

  // ── Request Call Permission ──
  const handleRequestCallPermission = async (contact) => {
    try {
      const res = await api.post("/whatsapp/calls/permissions/request", {
        contactId: contact.id,
      });
      if (res.data?.success) {
        toast.success("Call permission request sent to user!");
      } else {
        toast.error("Failed to send permission request.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        typeof err.response?.data?.error === "object"
          ? JSON.stringify(err.response.data.error)
          : err.response?.data?.error ||
              err.message ||
              "Error sending permission request.",
      );
    }
  };

  // ── Initiate Call (WebRTC) ──
  const handleInitiateCall = async (contact) => {
    if (globalActiveCall)
      return toast.error("A call is already in progress.");
    try {
      const sdpOffer = await webrtcService.initiateOutboundCall();
      const res = await api.post("/whatsapp/calls/initiate", {
        contactId: contact.id,
        conversationId: activeChatId,
        sdpOffer,
      });
      if (res.data?.success) {
        const callId =
          res.data?.callId ||
          res.data?.data?.calls?.[0]?.id ||
          res.data?.data?.id;
        const callData = {
          wacid: callId || "temp_" + Date.now(),
          status: "DIALING",
          direction: "BUSINESS_INITIATED",
          contactId: contact.id,
          fromNumber: contact.phone || null,
        };
        setCall(callData);
        setActiveChatCalls((prev) => [
          ...prev.filter((c) => c.wacid !== callData.wacid),
          {
            ...callData,
            createdAt: new Date().toISOString(),
            duration: 0,
            recordings: [],
            transcripts: [],
          },
        ]);
      } else {
        toast.error("Failed to start call: Invalid response from Meta.");
        webrtcService.endCall();
      }
    } catch (err) {
      webrtcService.endCall();
      if (
        err.name === "NotAllowedError" ||
        err.message?.toLowerCase().includes("permission denied")
      ) {
        toast.error(
          "Microphone access was denied. Please allow microphone permissions in your browser to make calls.",
        );
      } else if (err.response?.data?.error === "NO_CALL_PERMISSION") {
        setPendingCallContact(contact);
        setShowCallPermissionModal(true);
      } else {
        toast.error(
          err.response?.data?.message ||
            err.message ||
            "Failed to initiate call.",
        );
      }
    }
  };

  // ── Smart Call Click (permission check first) ──
  const handleSmartCallClick = async (contact) => {
    if (globalActiveCall)
      return toast.error("A call is already in progress.");
    if (!contact?.id) return;
    try {
      const res = await api.get(
        `/whatsapp/calls/permissions/check/${contact.id}`,
      );
      if (res.data?.hasPermission) {
        setPendingCallContact(contact);
        setShowInitiateCallConfirmModal(true);
      } else {
        setPendingCallContact(contact);
        setShowCallPermissionModal(true);
      }
    } catch {
      setPendingCallContact(contact);
      setShowInitiateCallConfirmModal(true);
    }
  };

  return {
    activeChatCalls,
    setActiveChatCalls,
    loadingCalls,
    showCallPermissionModal,
    setShowCallPermissionModal,
    showInitiateCallConfirmModal,
    setShowInitiateCallConfirmModal,
    pendingCallContact,
    setPendingCallContact,
    loadConversationCalls,
    handleRequestCallPermission,
    handleInitiateCall,
    handleSmartCallClick,
  };
};