// tenant-web/src/components/facebook/FacebookConnect.jsx (do not remove this comment)
import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../../api/axios";
import { WhatsAppLoader } from "../CustomLoader";

const FACEBOOK_CONFIG_ID = "1468812597911286";

export default function FacebookConnect({ onSuccess, onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [availablePages, setAvailablePages] = useState([]);
  const [showSelector, setShowSelector] = useState(false);

  const isProcessingRef = useRef(false);

  // ── Exchange code → save connection ──────────────────────────────────
  const doExchange = async (code) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      console.log("[Facebook] Exchanging code...");
      setIsLoading(true);
      setError(null);

      const response = await api.post("/facebook/exchange-token", { code });

      if (response.data.requiresSelection) {
        setAvailablePages(response.data.pages);
        setShowSelector(true);
        setIsLoading(false);
        isProcessingRef.current = false;
        return;
      }

      if (response.data.success) {
        console.log("[Facebook] Connected:", response.data);
        setIsConnected(true);
        if (onSuccess) onSuccess(response.data);
      } else {
        setError(
          response.data.message || "Connection failed. Please try again.",
        );
      }
    } catch (err) {
      console.error("[Facebook] Exchange error:", err);
      setError(
        err.response?.data?.message || "Failed to connect. Please try again.",
      );
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  // ── Select a Page (multi-page case) ─────────────────────────────────
  const handleSelectPage = async (pageId) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      setIsLoading(true);
      setShowSelector(false);
      setError(null);

      const response = await api.post("/facebook/select-page", { pageId });

      if (response.data.success) {
        console.log("[Facebook] Page connected:", response.data);
        setIsConnected(true);
        if (onSuccess) onSuccess(response.data);
      } else {
        setError(response.data.message || "Failed to select page.");
      }
    } catch (err) {
      console.error("[Facebook] Select page error:", err);
      setError(
        err.response?.data?.message || "Failed to connect page.",
      );
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  // ── Launch Facebook Login for Business ──────────────────────────────
  const launchFacebookLogin = useCallback(() => {
    setIsLoading(true);
    setError(null);
    isProcessingRef.current = false;

    FB.login(
      (response) => {
        console.log("[FB.login] Response:", response);

        if (response.authResponse?.code) {
          const code = response.authResponse.code;
          console.log(
            "[FB.login] Code received:",
            code.substring(0, 20) + "...",
          );
          doExchange(code);
        } else if (response.status === "not_authorized") {
          setError("Please authorize the app to continue.");
          setIsLoading(false);
        } else {
          setTimeout(() => {
            if (!isProcessingRef.current) {
              setError("Login cancelled. Please try again.");
              setIsLoading(false);
            }
          }, 1000);
        }
      },
      {
        config_id: FACEBOOK_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
        },
      },
    );
  }, []);

  // ── Success Screen ──────────────────────────────────────────────────
  if (isConnected) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        style={{ zIndex: 99999 }}
      >
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
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
            Facebook & Instagram Connected! 🎉
          </h2>
          <p className="text-gray-500 mb-6">
            Your Facebook Page and Instagram account have been successfully
            connected to SudoReply.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-[#1877F2] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#166FE5] transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Page Selector (multi-page case) ─────────────────────────────────
  if (showSelector && availablePages.length > 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        style={{ zIndex: 99999 }}
      >
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Select Facebook Page
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
            Choose which Facebook Page to connect:
          </p>
          <div className="space-y-3">
            {availablePages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleSelectPage(page.id)}
                className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="font-semibold text-gray-900">
                  {page.name}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {page.instagramUsername
                    ? `Instagram: @${page.instagramUsername}`
                    : "No Instagram linked"}
                </div>
              </button>
            ))}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={() => {
              setShowSelector(false);
              setAvailablePages([]);
            }}
            className="mt-4 w-full text-gray-600 py-2 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────
  if (isLoading) {
    return <WhatsAppLoader visible={true} />;
  }

  // ── Main UI ─────────────────────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm text-blue-600 font-semibold mb-1">
              Official Meta Integration
            </p>
            <h2 className="text-xl font-bold text-gray-900">
              Connect Facebook & Instagram
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
            One click connects your Facebook Page and linked Instagram
            account:
          </p>

          <div className="space-y-4 mb-6">
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📘</span>
                <h3 className="font-bold text-blue-900">What You Need</h3>
              </div>
              <ul className="text-sm text-blue-800 space-y-2 ml-9 list-disc">
                <li>A Facebook Page that you manage.</li>
                <li>
                  Your Instagram account (if any) linked to that Page as
                  a Professional account.
                </li>
              </ul>
            </div>

            <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">✨</span>
                <h3 className="font-bold text-emerald-900">
                  One Click — Both Connected
                </h3>
              </div>
              <ul className="text-sm text-emerald-800 space-y-2 ml-9 list-disc">
                <li>Select your Facebook Page in the Meta popup.</li>
                <li>
                  Instagram is automatically detected if linked to your
                  Page.
                </li>
                <li>No tokens to paste — everything is automatic.</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={launchFacebookLogin}
            className="w-full bg-[#1877F2] text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-[#166FE5] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook / Meta
          </button>
          <p className="text-center text-xs text-gray-400 mt-4">
            🔒 Secured by Meta — SudoReply never stores your Facebook
            credentials
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}