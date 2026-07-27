import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../lib/axios";

const CONFIG_ID = "1063577526237503";

export default function WhatsAppConnect({ onSuccess, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [availableWabas, setAvailableWabas] = useState([]);
  const [availableBusinesses, setAvailableBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [showBusinessSelector, setShowBusinessSelector] = useState(false);
  const [apiRawResponse, setApiRawResponse] = useState(null);

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

  const [connectedDetails, setConnectedDetails] = useState(null);

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
        setConnectedDetails(response.data);
        setIsConnected(true);
        setShowBusinessSelector(false);
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

  // ── Fetch Available WABAs via System User Token ──────────────────────────
  const fetchWabas = async () => {
    try {
      console.log("[WhatsApp] Fetching WABAs via System User Token...");
      setIsLoading(true);
      setError(null);

      const resWabas = await api.get("/whatsapp/my-wabas");
      const wabasWithPhones = (resWabas.data?.wabas || []).filter(
        (w) => w.phones?.length > 0
      );
      setAvailableWabas(wabasWithPhones);
      setShowBusinessSelector(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching WABAs:", err);
      setError(
        err.response?.data?.message || "Failed to load WhatsApp accounts."
      );
      setIsLoading(false);
    }
  };

  // ── Launch WhatsApp Connect ───────────────────────────────────────────
  const launchEmbeddedSignup = useCallback(() => {
    fetchWabas();
  }, []);

  // ── Fallback: save phone & WABA via system token ─────────────────────
  const handleSetup = async (phoneNumberId, wabaId) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      console.log("[WhatsApp] Calling /setup:", { phoneNumberId, wabaId });
      setIsLoading(true);

      const response = await api.post("/whatsapp/setup", {
        phoneNumberId,
        wabaId,
      });

      if (response.data.success) {
        console.log("[WhatsApp] ✅ Connected successfully", response.data);
        setConnectedDetails(response.data);
        setIsConnected(true);
        setShowBusinessSelector(false);
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

  // ── Success Screen ───────────────────────────────────────────────────
  if (isConnected) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            WhatsApp Connected! 🎉
          </h2>
          <p className="text-gray-500 text-xs mb-5">
            Your WhatsApp Business account is active and connected to Sudoreply.
          </p>

          {connectedDetails && (
            <div className="bg-gray-50 rounded-xl p-4 text-left border border-gray-200 mb-6 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-500 font-medium">Display Number:</span>
                <span className="font-bold text-gray-900">{connectedDetails.displayPhoneNumber || "Connected"}</span>
              </div>
              {connectedDetails.verifiedName && (
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Verified Name:</span>
                  <span className="font-semibold text-gray-800">{connectedDetails.verifiedName}</span>
                </div>
              )}
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-500 font-medium">Phone Number ID:</span>
                <span className="font-mono font-bold text-gray-800">{connectedDetails.phoneNumberId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">WABA ID:</span>
                <span className="font-mono font-bold text-gray-800">{connectedDetails.wabaId}</span>
              </div>
            </div>
          )}

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

  // ── WABA & Phone Number Selector Screen ──────────────────────────────
  if (showBusinessSelector) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <span className="text-xs bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-md">
                Meta System User Token Active
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-2">
                Select WhatsApp Business Account
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 font-bold"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            Select an available WhatsApp Business Account and Phone Number to connect your tenant.
          </p>

          {/* Available WABAs */}
          {availableWabas.length > 0 ? (
            <div className="space-y-4">
              {availableWabas.map((waba) => (
                <div key={waba.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{waba.name}</h4>
                      <p className="text-xs font-mono text-gray-500 mt-0.5">
                        WABA ID: <span className="font-semibold text-gray-700">{waba.id}</span>
                      </p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">
                      Meta WABA
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Available Phone Numbers:
                    </label>
                    {waba.phones.map((phone) => (
                      <div
                        key={phone.id}
                        className="p-3.5 bg-white border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/50 transition flex items-center justify-between shadow-sm"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-gray-900 text-sm">
                            {phone.display_phone_number}
                          </div>
                          <div className="text-xs text-gray-600 font-medium">
                            {phone.verified_name || "Verified WhatsApp Number"}
                          </div>
                          <div className="text-[11px] font-mono text-gray-400">
                            Phone Number ID: <span className="text-gray-600 font-semibold">{phone.id}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSetup(phone.id, waba.id)}
                          className="text-xs font-bold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 transition shadow-sm"
                        >
                          Connect Number →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              No WhatsApp accounts found for this system user token.
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}
          <button
            onClick={() => {
              setShowBusinessSelector(false);
              setAvailableWabas([]);
            }}
            className="mt-4 w-full text-gray-600 py-2 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Screen ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl">💬</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Connecting WhatsApp...
          </h2>
          <p className="text-gray-500 mb-6">
            Please complete the setup in the Meta window. Do not close this
            page.
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full animate-pulse w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────
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

        {/* Step 1 */}
        {step === 1 && (
          <div className="p-6">
            <p className="text-gray-500 mb-6">
              Choose how you want to connect your WhatsApp number.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div
                onClick={() => setSelectedType("existing")}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                  selectedType === "existing"
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📱</span>
                  <h3 className="font-bold text-gray-900">
                    Existing WA Business Number
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Use your current WhatsApp Business App number
                </p>
                <div className="space-y-2">
                  {[
                    "No new number needed",
                    "Continue using WhatsApp Business App",
                    "Messages sync between Sudoreply & app",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5 flex-shrink-0 text-xs">
                        ✓
                      </span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                  {[
                    "Slower broadcast speeds",
                    "WA Business App v2.24.4+ required",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5 flex-shrink-0 text-xs">
                        ⚠
                      </span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
                {selectedType === "existing" && (
                  <p className="mt-3 text-xs font-semibold text-green-600">
                    ✓ Selected
                  </p>
                )}
              </div>

              <div
                onClick={() => setSelectedType("new")}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                  selectedType === "new"
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🆕</span>
                  <div>
                    <h3 className="font-bold text-gray-900">New Number</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      Recommended
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Fresh number not registered on WhatsApp
                </p>
                <div className="space-y-2">
                  {[
                    "Faster broadcast speeds",
                    "Full API control via Sudoreply",
                    "Business name shown to all customers",
                    "WhatsApp calling available",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5 flex-shrink-0 text-xs">
                        ✓
                      </span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                  {["Cannot use WhatsApp Business App"].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5 flex-shrink-0 text-xs">
                        ✗
                      </span>
                      <span className="text-xs text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
                {selectedType === "new" && (
                  <p className="mt-3 text-xs font-semibold text-green-600">
                    ✓ Selected
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() => {
                if (!selectedType) {
                  setError("Please select a setup type to continue.");
                  return;
                }
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
            <p className="text-gray-500 mb-6">
              Make sure you have everything ready before connecting.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">Requirements</h3>
              <div className="space-y-2">
                {(selectedType === "existing"
                  ? [
                      "WhatsApp Business App version 2.24.4 or higher",
                      "Facebook/Meta account with admin access",
                      "Active website or GST Certificate for verification",
                      "Phone number on WhatsApp Business App",
                    ]
                  : [
                      "Fresh number not on WhatsApp Personal or Business",
                      "Able to receive OTP via call or SMS",
                      "Facebook/Meta account with admin access",
                      "Active website or GST Certificate for verification",
                    ]
                ).map((req, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5 flex-shrink-0 text-sm">
                      ✓
                    </span>
                    <span className="text-sm text-gray-600">{req}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                What happens next
              </h3>
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
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:border-gray-300 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={launchEmbeddedSignup}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>💬</span>
                Connect with Meta
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              🔒 Secured by Meta — Sudoreply never stores your Facebook
              credentials
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
