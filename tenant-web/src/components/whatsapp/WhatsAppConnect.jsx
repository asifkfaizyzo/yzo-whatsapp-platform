import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../../lib/axios";
import { WhatsAppLoader } from "../CustomLoader";

const CONFIG_ID = "1063577526237503";

export default function WhatsAppConnect({ onSuccess, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [availableWabas, setAvailableWabas] = useState([]);
  const [showSelector, setShowSelector] = useState(false);

  // Refs to track state across async operations
  const timeoutRef = useRef(null);
  const sessionInfoReceivedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const sessionDataRef = useRef(null);
  const pendingCodeRef = useRef(null);

  // ── Listen for Meta FINISH postMessage ──────────────────────────────
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.origin || !event.origin.endsWith("facebook.com")) return;
      try {
        if (
          typeof event.data !== "string" ||
          !event.data.trim().startsWith("{")
        )
          return;

        const data = JSON.parse(event.data);
        console.log("[WA Message]", data);

        if (data.type !== "WA_EMBEDDED_SIGNUP") return;

        if (
          data.event === "FINISH" ||
          data.event === "FINISH_ONLY_WABA" ||
          data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
        ) {
          sessionInfoReceivedRef.current = true;
          sessionDataRef.current = data.data;
          console.log("[WA FINISH] session data:", data.data);

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          // If code already arrived from FB.login callback, exchange now
          if (pendingCodeRef.current) {
            doExchange(
              pendingCodeRef.current,
              data.data?.phone_number_id || null,
              data.data?.waba_id || null,
            );
          }
          // else: FB.login callback will fire next and pick up sessionDataRef
        } else if (data.event === "CANCEL") {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setError("Setup was cancelled. Please try again.");
          setIsLoading(false);
        } else if (data.event === "ERROR") {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setError("Something went wrong. Please try again.");
          setIsLoading(false);
        }
      } catch (e) {
        console.error("Error parsing FB message:", e);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // ── Primary path: exchange code for customer token ───────────────────
  const doExchange = async (code, phoneNumberId, wabaId) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      console.log("[WhatsApp] Exchanging code:", { phoneNumberId, wabaId });
      setIsLoading(true);

      const response = await api.post("/whatsapp/exchange-token", {
        code,
        phoneNumberId,
        wabaId,
      });

      if (response.data.success) {
        console.log("[WhatsApp] ✅ Connected:", response.data);
        setIsConnected(true);
        setShowSelector(false);
        if (onSuccess) onSuccess(response.data);
      } else {
        setError(
          response.data.message || "Connection failed. Please try again.",
        );
      }
    } catch (err) {
      console.error("[WhatsApp] Exchange error:", err);
      setError(
        err.response?.data?.message || "Failed to connect. Please try again.",
      );
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  // ── Launch Embedded Signup ───────────────────────────────────────────
  const launchEmbeddedSignup = useCallback(() => {
    setIsLoading(true);
    setError(null);
    sessionInfoReceivedRef.current = false;
    isProcessingRef.current = false;
    sessionDataRef.current = null;
    pendingCodeRef.current = null;

    FB.login(
      (response) => {
        console.log("[FB.login] Response:", response);

        if (response.authResponse?.code) {
          const code = response.authResponse.code;
          console.log(
            "[FB.login] Code received:",
            code.substring(0, 20) + "...",
          );
          pendingCodeRef.current = code;

          // Read whatever session data arrived so far
          const phoneId = sessionDataRef.current?.phone_number_id || null;
          const wabaId = sessionDataRef.current?.waba_id || null;

          // Exchange immediately — do not wait
          // Code expires in 30s, don't waste time
          doExchange(code, phoneId, wabaId);
        } else if (response.status === "not_authorized") {
          setError("Please authorize the app to continue.");
          setIsLoading(false);
        } else {
          setTimeout(() => {
            if (!sessionInfoReceivedRef.current && !isProcessingRef.current) {
              setError("Login cancelled. Please try again.");
              setIsLoading(false);
            }
          }, 1000);
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "", // add this
          sessionInfoVersion: "3",
        },
      },
    );
  }, []);

  // ── Fallback: fetch WABAs via system token (WABA selector only) ──────
  // Only used when showing the multi-WABA selector UI
  const handleSetup = async (phoneNumberId, wabaId) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      console.log("[WhatsApp] Calling /setup (fallback):", {
        phoneNumberId,
        wabaId,
      });
      setIsLoading(true);

      const response = await api.post("/whatsapp/setup", {
        phoneNumberId,
        wabaId,
      });

      if (response.data.success) {
        console.log("[WhatsApp] ✅ Connected via fallback");
        setIsConnected(true);
        setShowSelector(false);
        if (onSuccess) onSuccess(response.data);
      } else {
        setError(response.data.message || "Setup failed. Please try again.");
      }
    } catch (err) {
      console.error("[WhatsApp] Setup error:", err);
      setError(
        err.response?.data?.message || "Server error. Please try again.",
      );
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  // ── Custom Loader (shown while connecting) ──────────────────────────
  // Rendered as a portal overlay; does not block other UI returns below.

  // ── Success Screen ───────────────────────────────────────────────────
  if (isConnected) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            WhatsApp Connected! 🎉
          </h2>
          <p className="text-gray-500 mb-6">
            Your WhatsApp Business account has been successfully connected to
            Sudoreply.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ── WABA Selector ────────────────────────────────────────────────────
  if (showSelector && availableWabas.length > 0) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Select WhatsApp Account
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-gray-500 mb-6 text-sm">
            Choose which WhatsApp Business number to connect:
          </p>
          <div className="space-y-4">
            {availableWabas.map((waba) => (
              <div key={waba.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {waba.name}
                </h3>
                <div className="space-y-2">
                  {waba.phones.map((phone) => (
                    <button
                      key={phone.id}
                      onClick={() => handleSetup(phone.id, waba.id)}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        {phone.display_phone_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {phone.verified_name || "Not verified"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          { error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
  <button
    onClick={() => {
      setShowSelector(false);
      setAvailableWabas([]);
    }}
    className="mt-4 w-full text-gray-600 py-2 hover:text-gray-800"
  >
    Cancel
  </button>
        </div>
      </div>,
    document.body
    );
}

// ── Loading Screen (custom animated loader) ─────────────────────────
if (isLoading) {
  return <WhatsAppLoader visible={true} />;
}

// ── Main UI ──────────────────────────────────────────────────────────
return createPortal(
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-sm text-green-600 font-semibold mb-1">
                Official API Integration
              </p>
              <h2 className="text-xl font-bold text-gray-900">
                Connect WhatsApp API
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <p className="text-gray-600 mb-6 font-medium">
              Please read Meta's official guidelines before connecting a phone number:
            </p>

            <div className="space-y-4 mb-6">
              <div className="border border-green-200 bg-green-50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🌟</span>
                  <h3 className="font-bold text-green-900">
                    Option A: Use a Fresh Phone Number (Recommended)
                  </h3>
                </div>
                <ul className="text-sm text-green-800 space-y-2 ml-9 list-disc">
                  <li>Best for a clean, fast setup.</li>
                  <li>The number must not be currently registered on any personal or business WhatsApp app.</li>
                </ul>
              </div>

              <div className="border border-orange-200 bg-orange-50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <h3 className="font-bold text-orange-900">
                    Option B: Use an Existing WhatsApp Number
                  </h3>
                </div>
                <ul className="text-sm text-orange-800 space-y-2 ml-9 list-disc">
                  <li>Meta does not allow a number to be on the mobile app and the Cloud API at the same time.</li>
                  <li>You <span className="font-bold">MUST</span> delete the WhatsApp account from your mobile app (Settings &gt; Account &gt; Delete Account) before proceeding.</li>
                  <li>You will no longer be able to use the WhatsApp mobile app. All messages will be handled exclusively inside Sudo Reply.</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={launchEmbeddedSignup}
              className="w-full bg-[#1877F2] text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-[#166FE5] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Facebook / Meta
            </button>
            <p className="text-center text-xs text-gray-400 mt-4">
              🔒 Secured by Meta — Sudoreply never stores your Facebook credentials
            </p>
          </div>
        </div>
      </div>,
      document.body
      );
}