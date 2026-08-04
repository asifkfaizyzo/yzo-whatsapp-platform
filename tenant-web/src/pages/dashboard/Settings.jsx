// src/pages/dashboard/Settings.jsx

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Settings,
  User,
  Smartphone,
  Code,
  Key,
  Save,
  Copy,
  CheckCircle2,
  Tag,
  Plus,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  Unplug,
  Trash2,
  MessageSquare,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { getTags, createTag } from "../../services/tag.service";
import { useToast } from "../../context/ToastContext";
import {
  getAutoReopenConfig,
  updateAutoReopenConfig,
  getTenantProfile,
  updateTenantProfile,
  updateTenantPassword,
  getWhatsappConfig,
  updateWhatsappConfig,
  getWhatsappStatus,
  disconnectWhatsapp,
  uploadTenantLogo,
  deleteTenantLogo,
} from "../../services/tenant.service";
import {
  getUserProfile,
  updateUserPassword,
} from "../../services/user.service";
import WhatsAppConnect from "../../components/whatsapp/WhatsAppConnect";

// 🆕 API base URL for logo display
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// 🆕 DROPDOWN OPTIONS
const INDUSTRY_OPTIONS = [
  { value: "", label: "Select industry..." },
  { value: "ecommerce", label: "E-commerce & Retail" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "finance", label: "Finance & Banking" },
  { value: "real_estate", label: "Real Estate" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "food", label: "Food & Beverage" },
  { value: "technology", label: "Technology & IT" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "consulting", label: "Consulting & Services" },
  { value: "media", label: "Media & Entertainment" },
  { value: "logistics", label: "Logistics & Transportation" },
  { value: "beauty", label: "Beauty & Wellness" },
  { value: "automotive", label: "Automotive" },
  { value: "nonprofit", label: "Non-Profit" },
  { value: "other", label: "Other" },
];

const COMPANY_SIZE_OPTIONS = [
  { value: "", label: "Select company size..." },
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

const COUNTRY_OPTIONS = [
  { value: "", label: "Select country..." },
  { value: "IN", label: "🇮🇳 India" },
  { value: "US", label: "🇺🇸 United States" },
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "AE", label: "🇦🇪 United Arab Emirates" },
  { value: "SG", label: "🇸🇬 Singapore" },
  { value: "AU", label: "🇦🇺 Australia" },
  { value: "CA", label: "🇨🇦 Canada" },
  { value: "DE", label: "🇩🇪 Germany" },
  { value: "FR", label: "🇫🇷 France" },
  { value: "JP", label: "🇯🇵 Japan" },
  { value: "BR", label: "🇧🇷 Brazil" },
  { value: "MX", label: "🇲🇽 Mexico" },
  { value: "ZA", label: "🇿🇦 South Africa" },
  { value: "SA", label: "🇸🇦 Saudi Arabia" },
  { value: "ID", label: "🇮🇩 Indonesia" },
  { value: "MY", label: "🇲🇾 Malaysia" },
  { value: "PH", label: "🇵🇭 Philippines" },
  { value: "TH", label: "🇹🇭 Thailand" },
  { value: "VN", label: "🇻🇳 Vietnam" },
  { value: "OTHER", label: "🌍 Other" },
];

export default function SettingsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "profile");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab("profile");
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "profile") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: tabId }, { replace: true });
    }
  };
  const [copiedKey, setCopiedKey] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false); // 🆕 NEW

  // 🔧 FIXED: Removed duplicate `timezone` key
  const [profile, setProfile] = useState({
    name: "Admin Member",
    companyName: "WhatsApp Tenant Corp",
    email: "tenant@company.com",
    phone: "",
    address: "",
    authProvider: "LOCAL",
    hasPassword: true,
    firstName: "",
    lastName: "",
    websiteUrl: "",
    industry: "",
    companySize: "",
    country: "",
    logo: "",
    timezone: "Asia/Kolkata", // ✅ Only ONE timezone key now
    tenantName: "", // 🆕 For AGENT view - shows tenant info
    tenantLogo: "",
  });

  const fetchTenantProfile = async () => {
    if (userRole !== "admin") return;
    const res = await getTenantProfile();

    console.log("📥 Profile from backend:", res);
    console.log("📥 Logo value from backend:", res.data?.logo);

    if (res.success) {
      setProfile((prev) => ({
        ...prev,
        name: res.data.tenantName,
        companyName: res.data.tenantName,
        email: res.data.email,
        phone: res.data.phone || "",
        address: res.data.address || "",
        authProvider: res.data.authProvider || "LOCAL",
        hasPassword: res.data.hasPassword ?? true,
        firstName: res.data.firstName || "",
        lastName: res.data.lastName || "",
        websiteUrl: res.data.websiteUrl || "",
        industry: res.data.industry || "",
        companySize: res.data.companySize || "",
        country: res.data.country || "",
        logo: res.data.logo || "",
        timezone: res.data.timezone || "Asia/Kolkata",
      }));
    }
  };

  // 🆕 Fetch user profile (for AGENT role)
  const fetchUserProfile = async () => {
    if (userRole !== "agent") return;

    const res = await getUserProfile();
    console.log("📥 User profile:", res);

    if (res.success) {
      setProfile((prev) => ({
        ...prev,
        name: res.data.name || "",
        email: res.data.email || "",
        tenantName: res.data.tenant?.tenantName || "",
        tenantLogo: res.data.tenant?.logo || "",
      }));
    }
  };

  useEffect(() => {
    if (activeTab === "profile") {
      if (userRole === "admin") {
        fetchTenantProfile();
      } else if (userRole === "agent") {
        fetchUserProfile();
      }
    }
  }, [activeTab, userRole]);

  const [whatsapp, setWhatsapp] = useState({
    phoneId: "",
    wabaId: "",
    accessToken: "",
  });

  const [whatsappStatus, setWhatsappStatus] = useState({
    isConnected: false,
    phoneNumberId: null,
    wabaId: null,
  });
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState(null);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const [webhook, setWebhook] = useState({
    url: "https://api.sudoreply.com/webhooks/whatsapp",
    token: "yzo_verification_token_secure_2026",
    apiKey: "yzo_live_api_key_8x90a2b1cd34ef5678",
  });

  const [passwordState, setPasswordState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagError, setTagError] = useState("");
  const [newTag, setNewTag] = useState({
    name: "",
    priority: 3,
    description: "",
  });

  const [reopenConfig, setReopenConfig] = useState({
    enabled: true,
    reopenWindowHours: 72,
    maxReopenCount: 5,
    smartFilterEnabled: true,
    assignmentStrategy: "original_agent",
  });
  const [loadingReopen, setLoadingReopen] = useState(false);
  const [reopenError, setReopenError] = useState("");

  const fetchWhatsappConfig = async () => {
    if (userRole !== "admin") return;
    const res = await getWhatsappConfig();
    if (res.success && res.data) {
      setWhatsapp({
        phoneId: res.data.whatsappPhoneId || "",
        wabaId: res.data.whatsappWabaId || "",
        accessToken: res.data.whatsappAccessToken || "",
      });
      setWebhook((prev) => ({
        ...prev,
        token: res.data.whatsappVerifyToken || prev.token,
      }));
    }
  };

  const fetchWhatsappStatusData = async () => {
    if (userRole !== "admin") return;
    setLoadingStatus(true);
    const res = await getWhatsappStatus();
    if (res.success && res.data) {
      setWhatsappStatus({
        isConnected: !!res.data.isConnected,
        phoneNumberId: res.data.phoneNumberId || null,
        wabaId: res.data.wabaId || null,
      });
      if (res.data.phoneNumberId || res.data.wabaId) {
        setWhatsapp((prev) => ({
          ...prev,
          phoneId: res.data.phoneNumberId || prev.phoneId,
          wabaId: res.data.wabaId || prev.wabaId,
        }));
      }
    }
    setLoadingStatus(false);
  };

  const handleDisconnectWhatsApp = async () => {
    setDisconnecting(true);
    setDisconnectError(null);
    const res = await disconnectWhatsapp();
    if (res.success) {
      setWhatsappStatus({
        isConnected: false,
        phoneNumberId: null,
        wabaId: null,
      });
      setWhatsapp({
        phoneId: "",
        wabaId: "",
        accessToken: "",
      });
      setShowConfirmDisconnect(false);
      toast.success("WhatsApp disconnected successfully!");
    } else {
      setDisconnectError(res.message || "Failed to disconnect WhatsApp.");
    }
    setDisconnecting(false);
  };

  useEffect(() => {
    if (activeTab === "whatsapp" && userRole === "admin") {
      fetchWhatsappConfig();
      fetchWhatsappStatusData();
    }
  }, [activeTab]);

  const fetchReopenConfig = async () => {
    setLoadingReopen(true);
    setReopenError("");
    const res = await getAutoReopenConfig();
    if (res.success) {
      setReopenConfig(res.data);
    } else {
      setReopenError(res.message);
    }
    setLoadingReopen(false);
  };

  const handleReopenSave = async (e) => {
    e.preventDefault();
    setReopenError("");
    const res = await updateAutoReopenConfig({
      enabled: reopenConfig.enabled,
      reopenWindowHours: parseInt(reopenConfig.reopenWindowHours, 10),
      maxReopenCount: parseInt(reopenConfig.maxReopenCount, 10),
      smartFilterEnabled: reopenConfig.smartFilterEnabled,
      assignmentStrategy: reopenConfig.assignmentStrategy,
    });
    if (res.success) {
      toast.success("Auto-reopen rules updated successfully!");
      setReopenConfig(res.data);
    } else {
      setReopenError(res.message);
    }
  };

  useEffect(() => {
    if (activeTab === "reopen" && userRole === "admin") {
      fetchReopenConfig();
    }
  }, [activeTab]);

  const fetchTags = async () => {
    setLoadingTags(true);
    setTagError("");
    const res = await getTags();
    if (res.success) {
      setTags(res.data || []);
    } else {
      setTagError(res.message);
    }
    setLoadingTags(false);
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    setTagError("");
    if (!newTag.name.trim()) return;

    const res = await createTag({
      name: newTag.name.trim(),
      priority: parseInt(newTag.priority, 10),
      description: newTag.description.trim() || null,
    });

    if (res.success) {
      setNewTag({ name: "", priority: 3, description: "" });
      toast.success("Priority tag created!");
      fetchTags();
    } else {
      setTagError(res.message);
    }
  };

  useEffect(() => {
    if (activeTab === "tags" && userRole === "admin") {
      fetchTags();
    }
  }, [activeTab]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setProfile((prev) => ({
          ...prev,
          name: parsed.name || parsed.tenantName || prev.name,
          companyName:
            parsed.companyName || parsed.tenantName || prev.companyName,
          email: parsed.email || prev.email,
        }));
        setUserRole(parsed.type === "TENANT" ? "admin" : "agent");
      } catch (e) {}
    }
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") {
      toast.success("Profile configurations updated!");
      return;
    }
    const res = await updateTenantProfile({
      tenantName: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      firstName: profile.firstName,
      lastName: profile.lastName,
      websiteUrl: profile.websiteUrl,
      industry: profile.industry,
      companySize: profile.companySize,
      country: profile.country,
      logo: profile.logo,
      timezone: profile.timezone,
    });

    if (res.success) {
      toast.success("Profile configurations updated!");
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.tenantName = res.data.tenantName;
          parsed.name = res.data.tenantName;
          parsed.email = res.data.email;
          localStorage.setItem("user", JSON.stringify(parsed));
        } catch (err) {}
      }
    } else {
      toast.error("Failed to update profile: " + res.message);
    }
  };

  // 🆕 ═══════════════════════════════════════════════════════
  // 🆕 LOGO UPLOAD HANDLERS
  // 🆕 ═══════════════════════════════════════════════════════
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      e.target.value = "";
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, or WEBP images are allowed");
      e.target.value = "";
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await uploadTenantLogo(formData);

      if (res.success) {
        setProfile({ ...profile, logo: res.data.logoUrl });
        toast.success("Logo uploaded successfully!");
        // 🆕 Notify TopNavBar to update logo instantly
        window.dispatchEvent(
          new CustomEvent("tenant_logo_updated", {
            detail: { logo: res.data.logoUrl },
          }),
        );
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    }

    setUploadingLogo(false);
    e.target.value = "";
  };

  const handleLogoDelete = async () => {
    if (!window.confirm("Remove your company logo?")) return;

    const res = await deleteTenantLogo();
    if (res.success) {
      setProfile({ ...profile, logo: "" });
      toast.success("Logo removed");

      // 🆕 Notify TopNavBar to remove logo instantly
      window.dispatchEvent(
        new CustomEvent("tenant_logo_updated", {
          detail: { logo: null },
        }),
      );
    } else {
      toast.error(res.message);
    }
  };
  // 🆕 ═══════════════════════════════════════════════════════

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordFeedback("");

    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    // 🆕 Use correct API based on role
    const passwordAPI =
      userRole === "agent" ? updateUserPassword : updateTenantPassword;

    const res = await passwordAPI({
      currentPassword:
        profile.hasPassword !== false ? passwordState.currentPassword : "",
      newPassword: passwordState.newPassword,
      confirmPassword: passwordState.confirmPassword,
    });

    if (res.success) {
      setPasswordFeedback("Password changed successfully!");
      setPasswordState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      // Refresh profile
      if (userRole === "admin") fetchTenantProfile();
      setTimeout(() => setPasswordFeedback(""), 3500);
    } else {
      setPasswordError(res.message);
    }
  };

  const handleWhatsappSave = async (e) => {
    e.preventDefault();
    const res = await updateWhatsappConfig({
      phoneId: whatsapp.phoneId,
      wabaId: whatsapp.wabaId,
      accessToken: whatsapp.accessToken,
      verifyToken: webhook.token,
    });
    if (res.success) {
      toast.success("WhatsApp Cloud API details verified & synced!");
    } else {
      toast.error("Failed to save WhatsApp config: " + res.message);
    }
  };

  const handleWebhookSave = async (e) => {
    e.preventDefault();
    const res = await updateWhatsappConfig({
      phoneId: whatsapp.phoneId,
      wabaId: whatsapp.wabaId,
      accessToken: whatsapp.accessToken,
      verifyToken: webhook.token,
    });
    if (res.success) {
      toast.success("Webhook API triggers saved!");
    } else {
      toast.error("Failed to save Webhook config: " + res.message);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(webhook.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-[#125EF2]" size={24} />
            <span>
              {userRole === "agent" ? "My Settings" : "Channel Settings"}
            </span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            {userRole === "agent"
              ? "Manage your personal profile and account security."
              : "Configure profile metadata, WhatsApp Cloud integrations, and developer webhooks."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 items-start">
        {/* Navigation Tabs */}
        <div className="card border border-slate-100 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto shrink-0">
          {[
            {
              id: "profile",
              label:
                userRole === "agent"
                  ? "My Profile Settings"
                  : "Business Profile",
              icon: <User size={15} />,
              adminOnly: false,
            },
            {
              id: "tags",
              label: "Tags & Routing",
              icon: <Tag size={15} />,
              adminOnly: true,
            },
            {
              id: "reopen",
              label: "Auto-Reopen Rules",
              icon: <RefreshCw size={15} />,
              adminOnly: true,
            },
            {
              id: "whatsapp",
              label: "WhatsApp API",
              icon: <Smartphone size={15} />,
              adminOnly: true,
            },
            {
              id: "developer",
              label: "Webhooks & Sockets",
              icon: <Code size={15} />,
              adminOnly: true,
            },
          ]
            .filter((t) => !t.adminOnly || userRole === "admin")
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition w-full whitespace-nowrap text-left ${
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-800"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
        </div>

        {/* Configurations Form Panel */}
        <div className="card border border-slate-100 p-6 md:col-span-3 bg-white">
          {/* Tab 1: Profile */}
          {activeTab === "profile" && (
            <>
              <form onSubmit={handleProfileSave} className="space-y-5">
                <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">
                  {userRole === "agent"
                    ? "My Profile Settings"
                    : "Business Profile Settings"}
                </h2>

                {/* 🆕 ─── LOGO SECTION ─── */}
                {userRole === "admin" ? (
                  /* ADMIN: Can upload/change/remove logo */
                  <div className="pb-5 border-b border-slate-50">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                      Company Logo
                    </h3>
                    <div className="flex items-center gap-4">
                      {/* Logo Preview */}
                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0 relative">
                        {uploadingLogo ? (
                          <Loader2
                            size={24}
                            className="text-[#125EF2] animate-spin"
                          />
                        ) : profile.logo ? (
                          <img
                            src={
                              profile.logo.startsWith("http")
                                ? profile.logo
                                : `${API_BASE}${profile.logo}`
                            }
                            alt="Logo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={28} className="text-slate-300" />
                        )}
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition font-semibold">
                            <Upload size={13} />
                            <span>
                              {profile.logo ? "Change Logo" : "Upload Logo"}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp"
                              onChange={handleLogoUpload}
                              className="hidden"
                              disabled={uploadingLogo}
                            />
                          </label>

                          {profile.logo && (
                            <button
                              type="button"
                              onClick={handleLogoDelete}
                              className="text-xs px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition flex items-center gap-1.5 font-semibold"
                              disabled={uploadingLogo}
                            >
                              <X size={13} />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          JPG, PNG or WEBP • Max 2MB
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AGENT: Read-only tenant info */
                  <div className="pb-5 border-b border-slate-50">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <span>Organization</span>
                    </h3>
                    <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                      {/* Tenant Logo (Read-only) */}
                      <div className="w-16 h-16 rounded-2xl border border-slate-200 flex items-center justify-center bg-white overflow-hidden shrink-0">
                        {profile.tenantLogo ? (
                          <img
                            src={
                              profile.tenantLogo.startsWith("http")
                                ? profile.tenantLogo
                                : `${API_BASE}${profile.tenantLogo}`
                            }
                            alt="Company Logo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon size={24} className="text-slate-300" />
                        )}
                      </div>

                      {/* Tenant Name */}
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Company
                        </p>
                        <p className="text-base font-bold text-slate-800 mt-0.5">
                          {profile.tenantName || "Loading..."}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          🔒 Managed by your admin
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── SECTION 1: Owner Information (Admin Only) ─── */}
                {userRole === "admin" && (
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Owner Information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label text-xs">First Name</label>
                        <input
                          type="text"
                          value={profile.firstName}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              firstName: e.target.value,
                            })
                          }
                          className="input text-xs"
                          placeholder="First Name"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Last Name</label>
                        <input
                          type="text"
                          value={profile.lastName}
                          onChange={(e) =>
                            setProfile({ ...profile, lastName: e.target.value })
                          }
                          className="input text-xs"
                          placeholder="Last Name"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── SECTION 2: Company Details ─── */}
                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Company Details
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label text-xs">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                        className="input text-xs"
                        required
                        disabled={userRole !== "admin"}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Email Address *</label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                        className="input text-xs"
                        required
                        disabled={userRole !== "admin"}
                      />
                    </div>
                  </div>

                  {userRole === "admin" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="label text-xs">Phone Number</label>
                          <input
                            type="text"
                            value={profile.phone}
                            onChange={(e) =>
                              setProfile({ ...profile, phone: e.target.value })
                            }
                            className="input text-xs"
                            placeholder="e.g. +919876543210"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Website URL</label>
                          <input
                            type="url"
                            value={profile.websiteUrl}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                websiteUrl: e.target.value,
                              })
                            }
                            className="input text-xs"
                            placeholder="e.g. https://acme.com"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="label text-xs">Industry</label>
                          <select
                            value={profile.industry}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                industry: e.target.value,
                              })
                            }
                            className="input text-xs bg-white font-medium"
                          >
                            {INDUSTRY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Company Size</label>
                          <select
                            value={profile.companySize}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                companySize: e.target.value,
                              })
                            }
                            className="input text-xs bg-white font-medium"
                          >
                            {COMPANY_SIZE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ─── SECTION 3: Location ─── */}
                {userRole === "admin" && (
                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Location
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label text-xs">Country</label>
                        <select
                          value={profile.country}
                          onChange={(e) =>
                            setProfile({ ...profile, country: e.target.value })
                          }
                          className="input text-xs bg-white font-medium"
                        >
                          {COUNTRY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label text-xs">Timezone</label>
                        <select
                          value={profile.timezone}
                          onChange={(e) =>
                            setProfile({ ...profile, timezone: e.target.value })
                          }
                          className="input text-xs bg-white font-medium"
                        >
                          <option value="Asia/Kolkata">
                            🇮🇳 Asia/Kolkata (IST) UTC+5:30
                          </option>
                          <option value="America/New_York">
                            🇺🇸 America/New_York (EST) UTC-5
                          </option>
                          <option value="America/Los_Angeles">
                            🇺🇸 America/Los_Angeles (PST) UTC-8
                          </option>
                          <option value="Europe/London">
                            🇬🇧 Europe/London (GMT) UTC+0
                          </option>
                          <option value="Europe/Berlin">
                            🇩🇪 Europe/Berlin (CET) UTC+1
                          </option>
                          <option value="Asia/Dubai">
                            🇦🇪 Asia/Dubai (GST) UTC+4
                          </option>
                          <option value="Asia/Singapore">
                            🇸🇬 Asia/Singapore (SGT) UTC+8
                          </option>
                          <option value="Asia/Tokyo">
                            🇯🇵 Asia/Tokyo (JST) UTC+9
                          </option>
                          <option value="Australia/Sydney">
                            🇦🇺 Australia/Sydney (AEDT) UTC+11
                          </option>
                          <option value="UTC">
                            🌍 UTC (Coordinated Universal Time)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label text-xs">Company Address</label>
                      <input
                        type="text"
                        className="input text-xs"
                        value={profile.address}
                        onChange={(e) =>
                          setProfile({ ...profile, address: e.target.value })
                        }
                        placeholder="e.g. 123 Business Road, City"
                      />
                    </div>
                  </div>
                )}

                {/* Save Button */}
                {/* Save Button (only for admin) */}
                {userRole === "admin" && (
                  <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                    <button
                      type="submit"
                      className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      <span>Save Profile</span>
                    </button>
                  </div>
                )}

                {/* 🆕 Info banner for agents */}
                {userRole === "agent" && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                    <AlertCircle
                      size={16}
                      className="text-blue-600 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-bold text-blue-900">
                        Need to update your profile?
                      </p>
                      <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                        Your name and email are managed by your workspace admin.
                        Please contact them to make changes. You can change your
                        password in the Security tab.
                      </p>
                    </div>
                  </div>
                )}
              </form>

              {/* Password Section - Available for BOTH admin and agent */}
              <form
                onSubmit={handlePasswordSave}
                className="space-y-4 mt-8 pt-8 border-t border-slate-100"
              >
                <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50 flex items-center gap-2">
                  <Key className="text-[#125EF2]" size={18} />
                  <span>Change Password</span>
                </h2>

                {/* Only show for admin with Google auth */}
                {userRole === "admin" &&
                  profile.authProvider === "GOOGLE" &&
                  !profile.hasPassword && (
                    <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs font-medium">
                      This account is signed up with Google. Setting a password
                      will allow you to log in with either Google or your email
                      and password.
                    </div>
                  )}

                {passwordFeedback && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold">
                    {passwordFeedback}
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-rose-500 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Current password (always required for agents, conditional for admin) */}
                  {(userRole === "agent" || profile.hasPassword) && (
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Current Password</label>
                      <div className="relative">
                        <input
                          type={
                            showPasswordFields.current ? "text" : "password"
                          }
                          value={passwordState.currentPassword}
                          onChange={(e) =>
                            setPasswordState({
                              ...passwordState,
                              currentPassword: e.target.value,
                            })
                          }
                          className="input text-xs pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswordFields({
                              ...showPasswordFields,
                              current: !showPasswordFields.current,
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                          {showPasswordFields.current ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label text-xs">New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswordFields.new ? "text" : "password"}
                        value={passwordState.newPassword}
                        onChange={(e) =>
                          setPasswordState({
                            ...passwordState,
                            newPassword: e.target.value,
                          })
                        }
                        className="input text-xs pr-10"
                        required
                        placeholder="At least 8 chars, 1 uppercase, 1 num, 1 special"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswordFields({
                            ...showPasswordFields,
                            new: !showPasswordFields.new,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showPasswordFields.new ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordFields.confirm ? "text" : "password"}
                        value={passwordState.confirmPassword}
                        onChange={(e) =>
                          setPasswordState({
                            ...passwordState,
                            confirmPassword: e.target.value,
                          })
                        }
                        className="input text-xs pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswordFields({
                            ...showPasswordFields,
                            confirm: !showPasswordFields.confirm,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      >
                        {showPasswordFields.confirm ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end">
                  <button
                    type="submit"
                    className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 bg-[#125EF2] text-white rounded-xl hover:bg-[#0f4fcb] transition"
                  >
                    <Save size={14} />
                    <span>
                      {userRole === "admin" && !profile.hasPassword
                        ? "Set Password"
                        : "Update Password"}
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Tab 2: WhatsApp Settings - UNCHANGED */}
          {activeTab === "whatsapp" && (
            <div className="space-y-6">
              {loadingStatus ? (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 text-xs text-slate-400">
                  <RefreshCw
                    size={14}
                    className="animate-spin text-[#125EF2]"
                  />
                  <span>Checking WhatsApp connection status...</span>
                </div>
              ) : whatsappStatus.isConnected ? (
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                          <span>WhatsApp Connected</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-900">
                            ACTIVE
                          </span>
                        </h3>
                        <p className="text-xs text-emerald-800/80 font-medium">
                          Your WhatsApp Business Cloud API integration is active
                          and receiving messages.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-emerald-200/60 pt-3 grid sm:grid-cols-2 gap-3 text-xs font-medium text-emerald-900">
                    <div className="flex items-center justify-between bg-white/80 px-3 py-2 rounded-xl border border-emerald-100">
                      <span className="text-emerald-700 font-semibold">
                        Phone Number ID:
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {whatsappStatus.phoneNumberId || whatsapp.phoneId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white/80 px-3 py-2 rounded-xl border border-emerald-100">
                      <span className="text-emerald-700 font-semibold">
                        WABA ID:
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {whatsappStatus.wabaId || whatsapp.wabaId}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-amber-50/60 via-slate-50 to-emerald-50/40 border border-slate-200 rounded-2xl p-5 shadow-sm sm:flex sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3.5 mb-4 sm:mb-0">
                    <div className="w-11 h-11 bg-slate-100 border border-slate-200 text-slate-600 rounded-2xl flex items-center justify-center shrink-0">
                      <Smartphone size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        WhatsApp Not Connected
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Connect your Meta WhatsApp Business account via Embedded
                        Signup or configure API keys.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(true)}
                    className="shrink-0 px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <MessageSquare size={14} />
                    <span>Connect WhatsApp</span>
                  </button>
                </div>
              )}

              <form
                onSubmit={handleWhatsappSave}
                className="space-y-4 pt-2 border-t border-slate-100"
              >
                <h2 className="text-base font-bold text-slate-800 pb-2 border-b border-slate-50">
                  Meta Cloud API Credentials
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label text-xs">Phone Number ID</label>
                    <input
                      type="text"
                      value={whatsapp.phoneId}
                      onChange={(e) =>
                        setWhatsapp({ ...whatsapp, phoneId: e.target.value })
                      }
                      className="input text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="label text-xs">
                      WhatsApp Business Account ID (WABA)
                    </label>
                    <input
                      type="text"
                      value={whatsapp.wabaId}
                      onChange={(e) =>
                        setWhatsapp({ ...whatsapp, wabaId: e.target.value })
                      }
                      className="input text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs">
                    Permanent System Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showAccessToken ? "text" : "password"}
                      value={whatsapp.accessToken}
                      onChange={(e) =>
                        setWhatsapp({
                          ...whatsapp,
                          accessToken: e.target.value,
                        })
                      }
                      className="input text-xs font-mono pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition"
                    >
                      {showAccessToken ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    Obtained from Meta App Developer portal under WhatsApp
                    Settings.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end">
                  <button
                    type="submit"
                    className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>Verify & Sync Credentials</span>
                  </button>
                </div>
              </form>

              <div className="border border-rose-200 bg-rose-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={18} />
                  <h4 className="font-bold text-sm">Danger Zone</h4>
                </div>
                <p className="text-xs text-rose-900/80 font-medium leading-relaxed">
                  Disconnecting will remove your WhatsApp integration
                  credentials, delete synced message templates, and stop message
                  sending and receiving. You can reconnect anytime.
                </p>

                {!showConfirmDisconnect ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDisconnectError(null);
                      setShowConfirmDisconnect(true);
                    }}
                    className="px-4 py-2 border-2 border-rose-500 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition duration-150 flex items-center gap-1.5"
                  >
                    <Unplug size={14} />
                    <span>Disconnect WhatsApp</span>
                  </button>
                ) : (
                  <div className="p-4 bg-white border border-rose-200 rounded-xl space-y-3 shadow-sm">
                    <p className="text-xs font-bold text-rose-900">
                      Are you sure you want to disconnect WhatsApp?
                    </p>
                    <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside font-medium">
                      <li>
                        Remove WhatsApp credentials and system access token
                      </li>
                      <li>Delete synced message templates from database</li>
                      <li>
                        Stop automated message sending & webhook receiving
                      </li>
                      <li>You can reconnect your account anytime later</li>
                    </ul>

                    {disconnectError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        <span>{disconnectError}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDisconnectWhatsApp}
                        disabled={disconnecting}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {disconnecting ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Disconnecting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={13} />
                            <span>Yes, Disconnect</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmDisconnect(false)}
                        disabled={disconnecting}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Developer Settings - UNCHANGED */}
          {activeTab === "developer" && (
            <form onSubmit={handleWebhookSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">
                Webhook Web Hooks & Client API Keys
              </h2>

              <div>
                <label className="label text-xs">Callback Webhook URL</label>
                <input
                  type="url"
                  value={webhook.url}
                  onChange={(e) =>
                    setWebhook({ ...webhook, url: e.target.value })
                  }
                  className="input text-xs font-mono"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  We post raw incoming WhatsApp event objects to this URL.
                </p>
              </div>

              <div>
                <label className="label text-xs">Verify Webhook Token</label>
                <div className="relative">
                  <input
                    type={showVerifyToken ? "text" : "password"}
                    value={webhook.token}
                    onChange={(e) =>
                      setWebhook({ ...webhook, token: e.target.value })
                    }
                    className="input text-xs font-mono pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyToken(!showVerifyToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition"
                  >
                    {showVerifyToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label text-xs">System API Private Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhook.apiKey}
                    readOnly
                    className="input text-xs font-mono bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={copyApiKey}
                    className="btn-secondary px-3 flex items-center justify-center shrink-0"
                    title="Copy API Key"
                  >
                    {copiedKey ? (
                      <CheckCircle2 size={15} className="text-[#125EF2]" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>Save Integration Webhooks</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 4: Tags Management - UNCHANGED */}
          {activeTab === "tags" && (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Tag & Auto-Routing Settings
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Define customer tags and priority values for automatic agent
                    assignment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchTags}
                  className="btn-secondary py-1.5 px-3 text-[10px] flex items-center gap-1 shadow-sm hover:shadow"
                  disabled={loadingTags}
                >
                  <RefreshCw
                    size={12}
                    className={loadingTags ? "animate-spin" : ""}
                  />
                  <span>Refresh Tags</span>
                </button>
              </div>

              {tagError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-650 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{tagError}</span>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Plus size={14} className="text-[#125EF2]" />
                    <span>Create New Segment Tag</span>
                  </h3>

                  <form onSubmit={handleCreateTag} className="space-y-3">
                    <div>
                      <label className="label text-[10px] uppercase font-bold text-slate-400">
                        Tag Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. VIP, Hot Lead, Support"
                        value={newTag.name}
                        onChange={(e) =>
                          setNewTag({ ...newTag, name: e.target.value })
                        }
                        className="input text-xs bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] uppercase font-bold text-slate-400">
                        Routing Priority *
                      </label>
                      <select
                        value={newTag.priority}
                        onChange={(e) =>
                          setNewTag({ ...newTag, priority: e.target.value })
                        }
                        className="input text-xs bg-white font-medium"
                      >
                        <option value={1}>
                          1 (Highest Priority - e.g. VIP)
                        </option>
                        <option value={2}>
                          2 (High Priority - e.g. Hot Lead)
                        </option>
                        <option value={3}>
                          3 (Medium Priority - e.g. General Support)
                        </option>
                        <option value={4}>
                          4 (Low Priority - e.g. Feedback)
                        </option>
                        <option value={5}>
                          5 (Lowest Priority - e.g. Spam)
                        </option>
                      </select>
                      <p className="text-[9px] text-slate-400 mt-1 font-medium leading-normal">
                        Contacts matching higher priority tags are assigned
                        first.
                      </p>
                    </div>

                    <div>
                      <label className="label text-[10px] uppercase font-bold text-slate-400">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Optional description..."
                        value={newTag.description}
                        onChange={(e) =>
                          setNewTag({ ...newTag, description: e.target.value })
                        }
                        className="input text-xs bg-white resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingTags}
                      className="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Plus size={13} />
                      <span>Add Priority Tag</span>
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700">
                    Existing Priority Tags
                  </h3>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-450">
                            <th className="p-3">Tag Name</th>
                            <th className="p-3 text-center">Priority</th>
                            <th className="p-3">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {loadingTags ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="p-8 text-center text-slate-400"
                              >
                                Loading tags...
                              </td>
                            </tr>
                          ) : tags.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="p-8 text-center text-slate-450 italic"
                              >
                                No tags created yet. Add one on the left!
                              </td>
                            </tr>
                          ) : (
                            tags.map((tag) => {
                              const getBadgeColor = (p) => {
                                if (p === 1)
                                  return "bg-rose-50 border border-rose-100 text-rose-700";
                                if (p === 2)
                                  return "bg-amber-50 border border-amber-100 text-amber-700";
                                if (p === 3)
                                  return "bg-blue-50 border border-blue-100 text-blue-700";
                                return "bg-slate-50 border border-slate-100 text-slate-600";
                              };

                              return (
                                <tr
                                  key={tag.id}
                                  className="hover:bg-slate-50/30 transition"
                                >
                                  <td className="p-3">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 font-bold ${getBadgeColor(tag.priority)}`}
                                    >
                                      {tag.name}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center font-bold text-slate-800">
                                    {tag.priority}
                                  </td>
                                  <td
                                    className="p-3 text-slate-500 font-medium max-w-[200px] truncate"
                                    title={tag.description}
                                  >
                                    {tag.description || "N/A"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Auto-Reopen Rules - UNCHANGED */}
          {activeTab === "reopen" && (
            <form onSubmit={handleReopenSave} className="space-y-6">
              <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Auto-Reopen Rules & Policies
                  </h2>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Configure rules for when closed/resolved customer chats
                    receive new replies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchReopenConfig}
                  className="btn-secondary py-1.5 px-3 text-[10px] flex items-center gap-1 shadow-sm hover:shadow"
                  disabled={loadingReopen}
                >
                  <RefreshCw
                    size={12}
                    className={loadingReopen ? "animate-spin" : ""}
                  />
                  <span>Refresh Settings</span>
                </button>
              </div>

              {reopenError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-655 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{reopenError}</span>
                </div>
              )}

              {loadingReopen ? (
                <div className="text-center text-xs text-slate-400 py-12">
                  Loading configurations...
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={reopenConfig.enabled}
                      onChange={(e) =>
                        setReopenConfig({
                          ...reopenConfig,
                          enabled: e.target.checked,
                        })
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#125EF2] focus:ring-[#125EF2] cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="enabled"
                        className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                      >
                        Enable Conversation Auto-Reopen
                      </label>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                        When checked, incoming customer messages will
                        automatically reopen resolved or closed conversations
                        within the defined reopen window.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label text-xs font-bold text-slate-750">
                        Reopen Window (Hours)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={720}
                        value={reopenConfig.reopenWindowHours}
                        onChange={(e) =>
                          setReopenConfig({
                            ...reopenConfig,
                            reopenWindowHours: e.target.value,
                          })
                        }
                        className="input text-xs mt-1"
                        required
                        disabled={!reopenConfig.enabled}
                      />
                      <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                        Time window (in hours) after resolution where a customer
                        reply reopens the ticket. Suggestion: 72 hours (3 days).
                      </p>
                    </div>

                    <div>
                      <label className="label text-xs font-bold text-slate-750">
                        Max Reopen Count
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={reopenConfig.maxReopenCount}
                        onChange={(e) =>
                          setReopenConfig({
                            ...reopenConfig,
                            maxReopenCount: e.target.value,
                          })
                        }
                        className="input text-xs mt-1"
                        required
                        disabled={!reopenConfig.enabled}
                      />
                      <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                        Maximum number of times a single conversation is allowed
                        to reopen automatically to prevent endless loops.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                    <input
                      type="checkbox"
                      id="smartFilterEnabled"
                      checked={reopenConfig.smartFilterEnabled}
                      onChange={(e) =>
                        setReopenConfig({
                          ...reopenConfig,
                          smartFilterEnabled: e.target.checked,
                        })
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#125EF2] focus:ring-[#125EF2] cursor-pointer"
                      disabled={!reopenConfig.enabled}
                    />
                    <div>
                      <label
                        htmlFor="smartFilterEnabled"
                        className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                      >
                        Enable Smart Junk Message Filtering
                      </label>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                        When active, simple polite words (e.g. "thanks", "thank
                        you", "ok", "thumbs up") will be ignored and will not
                        reopen closed conversations.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-bold text-slate-750">
                      Reassignment Strategy
                    </label>
                    <select
                      value={reopenConfig.assignmentStrategy}
                      onChange={(e) =>
                        setReopenConfig({
                          ...reopenConfig,
                          assignmentStrategy: e.target.value,
                        })
                      }
                      className="input text-xs mt-1 font-medium bg-white"
                      disabled={!reopenConfig.enabled}
                    >
                      <option value="original_agent">
                        Assign back to Original Agent (Default)
                      </option>
                      <option value="unassigned_pool">
                        Move to Unassigned Conversations Pool
                      </option>
                    </select>
                    <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                      <strong>Original Agent:</strong> Assigns the reopened chat
                      directly back to the last operator who resolved it.
                      <br />
                      <strong>Unassigned Pool:</strong> Resets assignment,
                      allowing any online team member to assign the chat to
                      themselves.
                    </p>
                  </div>

                  <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                    <button
                      type="submit"
                      className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      <span>Save Rules & Policies</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {showConnectModal && (
        <WhatsAppConnect
          onSuccess={(data) => {
            setShowConnectModal(false);
            fetchWhatsappStatusData();
            fetchWhatsappConfig();
            toast.success("WhatsApp connected successfully!");
          }}
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </div>
  );
}
