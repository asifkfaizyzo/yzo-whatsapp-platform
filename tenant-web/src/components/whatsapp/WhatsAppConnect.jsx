import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../lib/axios";

const CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID;

export default function WhatsAppConnect({ onSuccess, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [availableWabas, setAvailableWabas] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Waiting for Meta...");
  const [showManualOption, setShowManualOption] = useState(false);
  const [manualPhoneId, setManualPhoneId] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");

  const timeoutRef = useRef(null);
  const sessionInfoReceivedRef = useRef(false);
  const userTokenRef = useRef(null);

  useEffect(() => {
    console.log("[WhatsAppConnect] CONFIG_ID:", CONFIG_ID);
    if (!CONFIG_ID) {
      console.error("[WhatsAppConnect] ❌ VITE_META_CONFIG_ID not set!");
    }
  }, []);

  // ✅ Listen for FINISH event
  useEffect(() => {
    const handleMessage = (event) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) return;

      try {
        if (typeof event.data !== "string" || !event.data.trim().startsWith("{")) return;
        const data = JSON.parse(event.data);
        console.log("[EmbeddedSignup] Message:", data);

        if (data.type === "WA_EMBEDDED_SIGNUP") {
          if (
            data.event === "FINISH" ||
            data.event === "FINISH_ONLY_WABA" ||
            data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
          ) {
            const { phone_number_id, waba_id } = data.data;
            console.log("[EmbeddedSignup] ✅ FINISH:", { phone_number_id, waba_id });

            sessionInfoReceivedRef.current = true;

            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }

            setLoadingMessage("Connecting your WhatsApp...");
            handleSignupComplete(phone_number_id, waba_id);

          } else if (data.event === "CANCEL") {
            console.log("[EmbeddedSignup] Cancelled");
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setError("Setup was cancelled. Please try again.");
            setIsLoading(false);

          } else if (data.event === "ERROR") {
            console.log("[EmbeddedSignup] Error:", data.data);
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setError("An error occurred. Please try again.");
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.error("[EmbeddedSignup] Parse error:", e);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const doLogin = useCallback(() => {
    FB.login(
      (response) => {
        console.log("[FB.login] Response:", response);

        if (response.status === "connected") {
          console.log("[FB.login] Connected — waiting for FINISH event...");
          setLoadingMessage(
            "Please complete all steps in the Meta window. Do not close it."
          );

          timeoutRef.current = setTimeout(() => {
            if (!sessionInfoReceivedRef.current) {
              console.log("[FB.login] No FINISH after 30s — showing manual option");
              setIsLoading(false);
              setShowManualOption(true);
            }
          }, 30000);

        } else if (response.status === "not_authorized") {
          setError("Please authorize the app to continue.");
          setIsLoading(false);
        } else {
          setError("Login cancelled. Please try again.");
          setIsLoading(false);
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
        },
      }
    );
  }, []);

  const launchEmbeddedSignup = useCallback(() => {
    if (!CONFIG_ID) {
      setError("Configuration error: Meta Config ID is missing.");
      return;
    }
    if (typeof FB === "undefined") {
      setError("Meta SDK not loaded. Please refresh and try again.");
      return;
    }

    console.log("[EmbeddedSignup] 🚀 Launching...");
    setIsLoading(true);
    setLoadingMessage("Opening Meta window...");
    setError(null);
    setShowManualOption(false);
    sessionInfoReceivedRef.current = false;
    userTokenRef.current = null;

    // ✅ Always logout first → forces fresh Embedded Signup → FINISH fires
    FB.getLoginStatus((statusResponse) => {
      console.log("[FB] Current status:", statusResponse.status);

      if (statusResponse.status === "connected") {
        console.log("[FB] Logging out first for fresh signup...");
        FB.logout(() => {
          console.log("[FB] Logged out ✅ Starting fresh login...");
          doLogin();
        });
      } else {
        doLogin();
      }
    });
  }, [doLogin]);

  const handleSignupComplete = async (phoneNumberId, wabaId) => {
    try {
      console.log("[WhatsApp] Saving:", { phoneNumberId, wabaId });
      setIsLoading(true);
      setLoadingMessage("Saving your WhatsApp connection...");

      const response = await api.post("/whatsapp/setup", {
        phoneNumberId,
        wabaId,
      });

      const data = response.data;

      if (data.success) {
        console.log("[WhatsApp] ✅ Connected:", data);
        setIsConnected(true);
        setIsLoading(false);
        setShowSelector(false);
        setShowManualOption(false);
        if (onSuccess) onSuccess(data);
      } else {
        setError(data.message || "Setup failed. Please try again.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("[WhatsApp] Error:", err);
      setError(err.response?.data?.message || "Server error. Please try again.");
      setIsLoading(false);
    }
  };

  const handleManualWabaSelect = async (phoneId, wabaId) => {
    await handleSignupComplete(phoneId, wabaId);
  };

  // ── Success Screen ──
  if (isConnected) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp Connected! 🎉</h2>
          <p className="text-gray-500 mb-6">
            Your WhatsApp Business account has been successfully connected to Sudoreply.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── Manual Option Screen ──
  if (showManualOption) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
            Already Connected to Meta
          </h2>
          <p className="text-gray-500 text-sm mb-6 text-center">
            Your Meta account is already linked. Enter your WhatsApp Business
            details below to connect to Sudoreply.
          </p>

          <button
            onClick={() => {
              setShowManualOption(false);
              setError(null);
              launchEmbeddedSignup();
            }}
            className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors mb-4"
          >
            🔄 Try Again (Fresh Login)
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-400">or enter manually</span>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number ID
              </label>
              <input
                type="text"
                value={manualPhoneId}
                onChange={(e) => setManualPhoneId(e.target.value.trim())}
                placeholder="e.g. 1214136355109540"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Business Account ID
              </label>
              <input
                type="text"
                value={manualWabaId}
                onChange={(e) => setManualWabaId(e.target.value.trim())}
                placeholder="e.g. 1309651157196821"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-700">
            <p className="font-semibold mb-1">📍 Where to find these IDs:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to <strong>business.facebook.com</strong></li>
              <li>Click <strong>Settings → WhatsApp Accounts</strong></li>
              <li>Click your WhatsApp account</li>
              <li>Copy the <strong>Account ID (WABA ID)</strong></li>
              <li>Click <strong>Phone Numbers</strong> → copy <strong>Phone Number ID</strong></li>
            </ol>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={async () => {
              if (!manualPhoneId || !manualWabaId) {
                setError("Please enter both Phone Number ID and WABA ID.");
                return;
              }
              setError(null);
              setShowManualOption(false);
              await handleSignupComplete(manualPhoneId, manualWabaId);
            }}
            disabled={!manualPhoneId || !manualWabaId || isLoading}
            className="w-full bg-gray-800 text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Connect Manually →
          </button>

          <button
            onClick={onClose}
            className="mt-3 w-full text-gray-500 py-2 hover:text-gray-700 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── WABA Selector ──
  if (showSelector && availableWabas.length > 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Select WhatsApp Account</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-500 mb-6 text-sm">Choose which WhatsApp Business number to connect:</p>
          <div className="space-y-4">
            {availableWabas.map((waba) => (
              <div key={waba.id} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{waba.name}</h3>
                <div className="space-y-2">
                  {waba.phones.map((phone) => (
                    <button
                      key={phone.id}
                      onClick={() => handleManualWabaSelect(phone.id, waba.id)}
                      disabled={isLoading}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50"
                    >
                      <div className="font-medium text-gray-900">{phone.display_phone_number}</div>
                      <div className="text-sm text-gray-500">{phone.verified_name || "Not verified"}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}
          <button
            onClick={() => { setShowSelector(false); setAvailableWabas([]); setError(null); }}
            className="mt-4 w-full text-gray-600 py-2 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Screen ──
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">💬</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connecting WhatsApp...</h2>
          <p className="text-gray-500 mb-6 text-sm">{loadingMessage}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full animate-pulse w-3/4"></div>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            ⏳ This may take a few minutes. Please do not close this page.
          </p>
        </div>
      </div>
    );
  }

  // ── Main Flow ──
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <p className="text-sm text-green-600 font-semibold mb-1">
              {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
            </p>
            <h2 className="text-xl font-bold text-gray-900">
              {step === 1 ? "Choose Your Setup Type" : "Connect with Meta"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="p-6">
            <p className="text-gray-500 mb-6">Choose how you want to connect your WhatsApp number.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Existing Number */}
              <div
                onClick={() => setSelectedType("existing")}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                  selectedType === "existing" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📱</span>
                  <h3 className="font-bold text-gray-900">Existing WA Business Number</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Use your current WhatsApp Business App number</p>
                <div className="space-y-2">
                  {["No new number needed", "Continue using WhatsApp Business App", "Messages sync between Sudoreply & app"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5 flex-shrink-0 text-xs">✓</span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                  {["Slower broadcast speeds", "WA Business App v2.24.4+ required"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5 flex-shrink-0 text-xs">⚠</span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
                {selectedType === "existing" && <p className="mt-3 text-xs font-semibold text-green-600">✓ Selected</p>}
              </div>

              {/* New Number */}
              <div
                onClick={() => setSelectedType("new")}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                  selectedType === "new" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🆕</span>
                  <div>
                    <h3 className="font-bold text-gray-900">New Number</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Recommended</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-4">Fresh number not registered on WhatsApp</p>
                <div className="space-y-2">
                  {["Faster broadcast speeds", "Full API control via Sudoreply", "Business name shown to all customers", "WhatsApp calling available"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5 flex-shrink-0 text-xs">✓</span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                  {["Cannot use WhatsApp Business App"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0 text-xs">✗</span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
                {selectedType === "new" && <p className="mt-3 text-xs font-semibold text-green-600">✓ Selected</p>}
              </div>
            </div>

            {!CONFIG_ID && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                ⚠️ <strong>Developer Warning:</strong> VITE_META_CONFIG_ID is not set.
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
            )}

            <button
              onClick={() => {
                if (!selectedType) { setError("Please select a setup type to continue."); return; }
                setError(null);
                setStep(2);
              }}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="p-6">
            <p className="text-gray-500 mb-6">Make sure you have everything ready before connecting.</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">Requirements</h3>
              <div className="space-y-2">
                {(selectedType === "existing"
                  ? ["WhatsApp Business App version 2.24.4 or higher", "Facebook/Meta account with admin access", "Active website or GST Certificate for verification", "Phone number on WhatsApp Business App"]
                  : ["Fresh number not on WhatsApp Personal or Business", "Able to receive OTP via call or SMS", "Facebook/Meta account with admin access", "Active website or GST Certificate for verification"]
                ).map((req, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 flex-shrink-0 text-sm">✓</span>
                    <span className="text-sm text-gray-600">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What happens next</h3>
              <div className="space-y-2">
                {[
                  "A Meta window will open for you to login",
                  "Select or create your Business Portfolio",
                  "Select or create your WhatsApp Business Account",
                  "Add and verify your phone number",
                  "Your account will be connected to Sudoreply",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setError(null); }}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:border-gray-300 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={launchEmbeddedSignup}
                disabled={!CONFIG_ID}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>💬</span>
                Connect with Meta
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              🔒 Secured by Meta — Sudoreply never stores your Facebook credentials
            </p>
          </div>
        )}
      </div>
    </div>
  );
}