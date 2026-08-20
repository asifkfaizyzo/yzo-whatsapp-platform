import React, { useEffect, useState } from "react";
import WhatsAppConnect from "../../components/whatsapp/WhatsAppConnect";
import {
  Users,
  FileText,
  UserCog,
  Megaphone,
  MessageSquare,
  CheckCircle2,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Check,
  RefreshCw,
  Activity,
  Info,
  Clock,
  Ticket,
} from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { getWhatsappStatus, getTenantUsers } from "../../services/tenant.service";
import { getContacts } from "../../services/contact.service";
import { getTemplates } from "../../services/template.service";
import { getBroadcasts } from "../../services/broadcast.service";
import { getAssignedConversations } from "../../services/conversation.service";
import { useAuthStore } from "../../store/useAuthStore";
import { getSocket } from "../../lib/socket";
import api from "../../lib/axios";

export default function Dashboard() {
  const { user: authUser } = useAuthStore();
  const { tenantStatus } = useOutletContext();
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState(null);
  const [showConnect, setShowConnect] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newAssignmentBadge, setNewAssignmentBadge] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const [waStatus, setWaStatus] = useState({
    isConnected: false,
    loading: true,
    phoneNumberId: null,
    wabaId: null,
    phoneNumber: null,
    businessName: null,
    qualityRating: null,
    messagingTier: null,
    webhookStatus: null,
  });

  const [adminCounts, setAdminCounts] = useState({
    contacts: 0,
    templates: 0,
    templatesPending: 0,
    team: 0,
    broadcasts: 0,
    loading: true,
  });

  const [agentData, setAgentData] = useState({
    assignedChats: 0,
    openChats: 0,
    resolvedChats: 0,
    conversations: [],
    loading: true,
  });

  // ═════════════════════════════════════════════════════════
  // FETCH: WhatsApp Status
  // ═════════════════════════════════════════════════════════
  const fetchWaStatus = async () => {
    try {
      const res = await getWhatsappStatus();
      if (res.success && res.data) {
        const health = res.data.health || {};
        setWaStatus({
          isConnected: !!res.data.isConnected,
          loading: false,
          phoneNumberId: res.data.phoneNumberId || null,
          wabaId: res.data.wabaId || null,
          phoneNumber: health.displayPhoneNumber || res.data.phoneNumber || res.data.displayPhoneNumber || null,
          businessName: health.verifiedName || res.data.businessName || res.data.verifiedName || null,
          qualityRating: health.qualityRating || res.data.qualityRating || null,
          messagingTier: health.tierName || health.messagingLimitTier || res.data.messagingTier || null,
          webhookStatus: res.data.webhookStatus || "active",
          sentLast24h: health.sentLast24h || 0,
          remaining24h: health.remaining24h ?? 1000,
          messagingLimitNumber: health.messagingLimitNumber || 1000,
        });
      } else {
        setWaStatus((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      setWaStatus((prev) => ({ ...prev, loading: false }));
    }
  };

    // 🚧 TEMPORARY MOCK — REMOVE BEFORE PRODUCTION
    // setTimeout(() => {
    //   setWaStatus({
    //     isConnected: true,
    //     loading: false,
    //     phoneNumberId: "123456789012345",
    //     wabaId: "987654321098765",
    //     phoneNumber: "+91 98765 43210",
    //     businessName: "Acme Corp",
    //     qualityRating: "GREEN",
    //     messagingTier: "TIER_1000 (1,000 msgs/day)",
    //     webhookStatus: "active",
    //   });
    // }, 500);
  };

  // ═════════════════════════════════════════════════════════
  // FETCH: Admin Counts
  // ═════════════════════════════════════════════════════════
  const fetchAdminCounts = async () => {
    setAdminCounts((prev) => ({ ...prev, loading: true }));

    let contactsCount = 0;
    let templatesCount = 0;
    let templatesPending = 0;
    let teamCount = 0;
    let broadcastsCount = 0;

    try {
      const r = await getContacts(1, 1, "", "all");
      if (r.success) contactsCount = r.data?.count ?? 0;
    } catch {}

    try {
      const r = await getTemplates();
      if (r.success && Array.isArray(r.data)) {
        templatesCount = r.data.length;
        templatesPending = r.data.filter(
          (t) => (t.status || "").toUpperCase() === "PENDING"
        ).length;
      }
    } catch {}

    try {
      const r = await getTenantUsers();
      if (r.success && Array.isArray(r.data)) teamCount = r.data.length;
    } catch {}

    try {
      const r = await getBroadcasts();
      if (r.success && Array.isArray(r.data)) broadcastsCount = r.data.length;
    } catch {}

    try {
      const r = await getAssignedConversations(1, 100, "all");
      if (r.success && r.data?.conversations) {
        const queuedCount = r.data.conversations.filter(
          (c) => (c.mode || "").toUpperCase() === "QUEUED"
        ).length;
        setQueueCount(queuedCount);
      }
    } catch {}

    try {
  const r = await api.get(
   `${import.meta.env.VITE_BACKEND_URL}/api2/unassigned-contacts`
  );
  if (r.data?.success) {
    setUnassignedCount(r.data.data?.count || 0);
  }
} catch {}

    setAdminCounts({
      contacts: contactsCount,
      templates: templatesCount,
      templatesPending,
      team: teamCount,
      broadcasts: broadcastsCount,
      loading: false,
    });
  };

  const fetchAgentData = async () => {
    setAgentData((prev) => ({ ...prev, loading: true }));

    let assignedChats = 0;
    let openChats = 0;
    let resolvedChats = 0;
    let conversations = [];

    try {
      const r = await getAssignedConversations(1, 100, "all");
      const list = r?.data?.conversations || [];

      if (Array.isArray(list) && list.length > 0) {
        assignedChats = list.length;
        openChats = list.filter(
          (c) => (c.status || "").toUpperCase() === "OPEN"
        ).length;
        resolvedChats = list.filter(
          (c) => (c.status || "").toUpperCase() === "RESOLVED"
        ).length;

        conversations = list
          .filter((c) => (c.status || "").toUpperCase() === "OPEN")
          .sort((a, b) => {
            const dateA = new Date(a.lastMessageAt || a.updatedAt || 0);
            const dateB = new Date(b.lastMessageAt || b.updatedAt || 0);
            return dateB - dateA;
          })
          .slice(0, 5);
      }
    } catch (err) {
      console.error("❌ Failed to fetch conversations:", err);
    }

    setAgentData({
      assignedChats,
      openChats,
      resolvedChats,
      conversations,
      loading: false,
    });
  };

  // ═════════════════════════════════════════════════════════
  // Refresh Handler
  // ═════════════════════════════════════════════════════════
  const handleRefresh = async () => {
    setRefreshing(true);
    if (userRole === "admin") {
      await Promise.all([fetchWaStatus(), fetchAdminCounts()]);
    } else {
      await fetchAgentData();
    }
    setRefreshing(false);
  };

  // ═════════════════════════════════════════════════════════
  // Effects
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "User");
        setUserRole(parsed.type === "TENANT" ? "admin" : "agent");
      } catch (e) {
        setUserRole("agent");
      }
    } else {
      setUserRole("agent");
    }
  }, []);

  useEffect(() => {
    if (!userRole) return;
    if (tenantStatus === "PENDING") return;

    if (userRole === "admin") {
      fetchWaStatus();
      fetchAdminCounts();
    } else if (userRole === "agent") {
      fetchAgentData();
    }
  }, [userRole, tenantStatus]);

  // ═════════════════════════════════════════════════════════
  // 🆕 CHUNK 4: Socket Listener for Assignments & Queue
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
  if (!authUser || !userRole) {
    return;
  }

  const tenantId = authUser?.type === "TENANT" ? authUser?.id : authUser?.tenantId;
  const userId = authUser?.type === "USER" ? authUser?.id : null;

  if (!tenantId) {
    return;
  }

  const socket = getSocket();

  // ─── AGENT LISTENERS ───
  if (userRole === "agent") {
    socket.on("new_assignment", (data) => {
      fetchAgentData();
      setNewAssignmentBadge((prev) => prev + 1);

      if ("Notification" in window && Notification.permission === "granted") {
        const title = data.fromQueue
          ? "🎯 Queued chat assigned to you!"
          : "🆕 New chat assigned!";
        new Notification(title, {
          body: `${data.contact?.name || "Customer"} needs your help`,
          icon: "/vite.svg",
          tag: data.conversationId,
        });
      }
    });

    socket.on("conversation_assigned", (data) => {
      if (data.agentId === userId) {
        fetchAgentData();
      }
    });
  }

  // ─── TENANT LISTENERS ───
  // ─── TENANT LISTENERS ───
if (userRole === "admin") {
  socket.on("queue_updated", (data) => {
    setQueueCount(data.queueCount || 0);

    if (data.newlyQueued && "Notification" in window && Notification.permission === "granted") {
      new Notification("⚠️ Customer in queue", {
        body: `${data.newlyQueued.contactName} is waiting for an agent`,
        icon: "/vite.svg",
      });
    }
  });

  socket.on("new_message", () => {
    fetchAdminCounts();
  });

  // ✅ ADD THIS NEW LISTENER
  socket.on("unassigned_contact_update", (data) => {
    console.log("🎯 UNASSIGNED UPDATE RECEIVED:", data);
    setUnassignedCount(data.unassignedCount || 0);

    if (data.isNew && "Notification" in window && Notification.permission === "granted") {
      new Notification("👤 New contact waiting", {
        body: `${data.contact?.name} needs to be assigned`,
        icon: "/vite.svg",
      });
    }
  });
}

  return () => {
    socket.off("new_assignment");
    socket.off("conversation_assigned");
    socket.off("queue_updated");
    socket.off("new_message");
    socket.off("unassigned_contact_update");
  };
}, [authUser, userRole]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const clearAssignmentBadge = () => {
    setNewAssignmentBadge(0);
  };

  // ═════════════════════════════════════════════════════════
  // Helpers
  // ═════════════════════════════════════════════════════════
  const copyToClipboard = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const maskId = (id) => {
    if (!id) return "—";
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getOverallHealth = () => {
    if (!waStatus.isConnected) {
      return { status: "disconnected", label: "Not Connected", color: "slate" };
    }
    const quality = (waStatus.qualityRating || "").toUpperCase();
    const webhook = (waStatus.webhookStatus || "").toLowerCase();

    if (quality === "RED" || webhook === "down" || webhook === "error") {
      return { status: "critical", label: "Action Required", color: "red" };
    }
    if (quality === "YELLOW") {
      return { status: "warning", label: "Attention Needed", color: "amber" };
    }
    return { status: "healthy", label: "All Systems Operational", color: "emerald" };
  };

  // ═════════════════════════════════════════════════════════
  // Card Configs
  // ═════════════════════════════════════════════════════════
  const adminResourceCards = [
    {
      label: "Contacts",
      value: adminCounts.contacts,
      subtext: adminCounts.contacts === 0 ? "Import to get started" : `${adminCounts.contacts} total`,
      icon: <Users size={22} className="text-[#125EF2]" />,
      bg: "bg-[#EAF2FE] border-[#CFE0FD]",
      link: "/dashboard/contacts",
    },
    {
      label: "Templates",
      value: adminCounts.templates,
      subtext:
        adminCounts.templatesPending > 0
          ? `${adminCounts.templatesPending} pending approval`
          : adminCounts.templates === 0
          ? "Create your first template"
          : "All approved",
      icon: <FileText size={22} className="text-blue-600" />,
      bg: "bg-blue-50 border-blue-100",
      link: "/dashboard/templates",
    },
    {
      label: "Team",
      value: adminCounts.team,
      subtext: adminCounts.team === 0 ? "Invite team members" : `${adminCounts.team} members`,
      icon: <UserCog size={22} className="text-purple-600" />,
      bg: "bg-purple-50 border-purple-100",
      link: "/dashboard/team",
    },
    {
      label: "Broadcasts",
      value: adminCounts.broadcasts,
      subtext: adminCounts.broadcasts === 0 ? "Start your first campaign" : `${adminCounts.broadcasts} total`,
      icon: <Megaphone size={22} className="text-amber-600" />,
      bg: "bg-amber-50 border-amber-100",
      link: "/dashboard/broadcasts",
    },
  ];

  // 🆕 CHUNK 6: Queue card (only shows when count > 0)
  const queueCard = queueCount > 0 ? {
    label: "Queue",
    value: queueCount,
    subtext: `⚠️ ${queueCount} waiting for agent`,
    icon: <Clock size={22} className="text-red-600" />,
    bg: "bg-red-50 border-red-100",
    link: "/dashboard/inbox",
    hasBadge: true,
    badgeCount: queueCount,
  } : null;

  const unassignedCard = unassignedCount > 0 ? {
  label:      "Unassigned",
  value:      unassignedCount,
  subtext:    `⚠️ ${unassignedCount} waiting for assignment`,
  icon:       <Users size={22} className="text-red-600" />,
  bg:         "bg-red-50 border-red-100",
  link:       "/dashboard/contacts?filter=unassigned",
  hasBadge:   true,
  badgeCount: unassignedCount,
} : null;

  // 🆕 CHUNK 5: Agent cards with badge fields
  const agentResourceCards = [
    {
      label: "Assigned",
      value: agentData.assignedChats,
      subtext:
        newAssignmentBadge > 0
          ? `🆕 ${newAssignmentBadge} new!`
          : agentData.assignedChats === 0
          ? "No chats yet"
          : "Total chats",
      icon: <MessageSquare size={22} className="text-[#125EF2]" />,
      bg: "bg-[#EAF2FE] border-[#CFE0FD]",
      link: "/dashboard/inbox",
      hasBadge: newAssignmentBadge > 0,
      badgeCount: newAssignmentBadge,
      onClick: clearAssignmentBadge,
    },
    {
      label: "Open",
      value: agentData.openChats,
      subtext: agentData.openChats === 0 ? "All caught up" : "Awaiting reply",
      icon: <MessageSquare size={22} className="text-blue-600" />,
      bg: "bg-blue-50 border-blue-100",
      link: "/dashboard/inbox",
    },
    {
      label: "Resolved",
      value: agentData.resolvedChats,
      subtext: agentData.resolvedChats === 0 ? "Get started" : "Completed",
      icon: <CheckCircle2 size={22} className="text-emerald-600" />,
      bg: "bg-emerald-50 border-emerald-100",
      link: "/dashboard/inbox",
    },
    {
      label: "Tickets",
      value: 0,
      subtext: "No open tickets",
      icon: <Ticket size={22} className="text-amber-600" />,
      bg: "bg-amber-50 border-amber-100",
      link: "/dashboard/tickets",
    },
  ];

  // ═════════════════════════════════════════════════════════
  // RENDER: ADMIN DASHBOARD
  // ═════════════════════════════════════════════════════════
  const renderAdminDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-200">
      {showConnect && (
        <WhatsAppConnect
          onSuccess={() => {
            setShowConnect(false);
            fetchWaStatus();
          }}
          onClose={() => setShowConnect(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Welcome back, {userName}!
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted)] font-medium">
            Here's your workspace overview.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            title="Refresh data"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <Link
            to="/dashboard/broadcasts"
            className="btn-primary flex items-center gap-2 text-sm shadow-sm"
          >
            <Plus size={16} />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* WhatsApp Banner */}
      {waStatus.isConnected ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-emerald-500/5 pointer-events-none" />
          <div className="absolute bottom-0 left-24 w-20 h-20 rounded-full bg-emerald-100/40 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 rounded-2xl bg-emerald-500 shadow-md shrink-0 text-white">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-emerald-950">WhatsApp Connected</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-900">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-emerald-800/80 font-medium mt-0.5 max-w-md leading-relaxed">
                Your WhatsApp Business Cloud API account is active. Message routing and campaign broadcasts are ready.
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/settings?tab=whatsapp"
            className="relative z-10 shrink-0 flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 transition-all duration-200 shadow-sm"
          >
            <span>Manage Settings</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[#CFE0FD] bg-gradient-to-r from-[#EAF2FE] via-white to-blue-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-[#125EF2]/5 pointer-events-none" />
          <div className="absolute bottom-0 left-24 w-20 h-20 rounded-full bg-blue-100/40 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 rounded-2xl bg-[#25D366] shadow-md shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.386a.75.75 0 0 0 .92.918l5.655-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.201-1.442l-.373-.22-3.856 1.012 1.03-3.75-.243-.386A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Connect Your WhatsApp Business Number</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-sm leading-relaxed">
                Link your WhatsApp Business account via Meta to start sending campaigns, managing inboxes, and handling customer conversations.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowConnect(true)}
            className="relative z-10 shrink-0 flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <span>Connect WhatsApp</span>
          </button>
        </div>
      )}

      {/* 🆕 CHUNK 7: Resource Cards WITH Queue Card */}
      <div className={`grid gap-6 sm:grid-cols-2 ${
  (queueCard && unassignedCard) ? 'lg:grid-cols-6' : 
  (queueCard || unassignedCard) ? 'lg:grid-cols-5' : 
  'lg:grid-cols-4'
}`}>
        {/* Queue Card (only if count > 0) — appears FIRST for attention */}
        {queueCard && (
          <Link
            key={queueCard.label}
            to={queueCard.link}
            className="card p-5 border-2 border-red-200 flex flex-col justify-between hover:shadow-md transition-all duration-200 group bg-red-50/30 relative"
          >
            <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md animate-pulse z-10">
              {queueCard.badgeCount}
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-red-600">{queueCard.label}</span>
              <div className={`p-2.5 rounded-xl border ${queueCard.bg}`}>{queueCard.icon}</div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-red-700">{queueCard.value}</span>
              <p className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
                <span>{queueCard.subtext}</span>
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
              </p>
            </div>
          </Link>
        )}

                {/* ✅ ADD: Unassigned Card (only if count > 0) */}
        {unassignedCard && (
          <Link
            key={unassignedCard.label}
            to={unassignedCard.link}
            className="card p-5 border-2 border-red-200 flex flex-col justify-between hover:shadow-md transition-all duration-200 group bg-red-50/30 relative"
          >
            <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md animate-pulse z-10">
              {unassignedCard.badgeCount}
            </span>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-red-600">{unassignedCard.label}</span>
              <div className={`p-2.5 rounded-xl border ${unassignedCard.bg}`}>
                {unassignedCard.icon}
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-red-700">{unassignedCard.value}</span>
              <p className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
                <span>{unassignedCard.subtext}</span>
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
              </p>
            </div>
          </Link>
        )}

        {/* Regular admin cards */}
        {adminResourceCards.map((item) => (
          <Link
            key={item.label}
            to={item.link}
            className="card p-5 border border-slate-100 flex flex-col justify-between hover:border-[#CFE0FD] hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">{item.label}</span>
              <div className={`p-2.5 rounded-xl border ${item.bg}`}>{item.icon}</div>
            </div>
            <div className="mt-4">
              {adminCounts.loading ? (
                <div className="h-9 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <span className="text-3xl font-bold text-slate-800">{item.value}</span>
              )}
              <p className="mt-1 text-xs text-slate-500 font-semibold flex items-center gap-1 group-hover:text-[#125EF2] transition">
                <span>{item.subtext}</span>
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Account Info + System Health (TENANT ONLY) */}
      {waStatus.isConnected && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card border border-slate-100 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={18} className="text-[#125EF2]" />
                  Account Info
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  WhatsApp Business API details
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3.5">
              <InfoRow label="Business Name" value={waStatus.businessName || "—"} />
              <InfoRow label="Phone Number" value={waStatus.phoneNumber || "—"} />
              <InfoRow
                label="Phone ID"
                value={maskId(waStatus.phoneNumberId)}
                fullValue={waStatus.phoneNumberId}
                copyable
                copiedField={copiedField}
                fieldKey="phoneId"
                onCopy={copyToClipboard}
              />
              <InfoRow
                label="WABA ID"
                value={maskId(waStatus.wabaId)}
                fullValue={waStatus.wabaId}
                copyable
                copiedField={copiedField}
                fieldKey="wabaId"
                onCopy={copyToClipboard}
              />
            </div>
          </div>

          {(() => {
            const health = getOverallHealth();
            return (
              <div className="card border border-slate-100 p-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Activity size={18} className={`text-${health.color}-600`} />
                      System Health
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Real-time account status
                    </p>
                  </div>
                </div>
                <div className={`mt-5 p-4 rounded-xl border ${
                  health.color === "emerald" ? "bg-emerald-50 border-emerald-100" :
                  health.color === "amber" ? "bg-amber-50 border-amber-100" :
                  health.color === "red" ? "bg-red-50 border-red-100" :
                  "bg-slate-50 border-slate-100"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      health.color === "emerald" ? "bg-emerald-500" :
                      health.color === "amber" ? "bg-amber-500" :
                      health.color === "red" ? "bg-red-500" :
                      "bg-slate-400"
                    } ${health.status === "healthy" ? "animate-pulse" : ""}`} />
                    <span className={`text-sm font-bold ${
                      health.color === "emerald" ? "text-emerald-800" :
                      health.color === "amber" ? "text-amber-800" :
                      health.color === "red" ? "text-red-800" :
                      "text-slate-700"
                    }`}>
                      {health.label}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <HealthRow label="Connection" value="Active" status="healthy" />
                  <HealthRow
                    label="Webhook"
                    value={waStatus.webhookStatus === "down" || waStatus.webhookStatus === "error" ? "Down" : "Operational"}
                    status={waStatus.webhookStatus === "down" || waStatus.webhookStatus === "error" ? "critical" : "healthy"}
                  />
                  <HealthRow
                    label="Quality Rating"
                    value={
                      waStatus.qualityRating === "GREEN"
                        ? "High Quality (GREEN)"
                        : waStatus.qualityRating === "YELLOW"
                        ? "Medium Quality (YELLOW)"
                        : waStatus.qualityRating === "RED"
                        ? "Low Quality (RED)"
                        : waStatus.qualityRating || "High Quality (GREEN)"
                    }
                    status={
                      !waStatus.qualityRating ? "healthy" :
                      ["GREEN", "HIGH"].includes(waStatus.qualityRating.toUpperCase()) ? "healthy" :
                      ["YELLOW", "MEDIUM"].includes(waStatus.qualityRating.toUpperCase()) ? "warning" :
                      "critical"
                    }
                  />
                  <HealthRow
                    label="Messaging Tier"
                    value={waStatus.messagingTier || "Tier 1K (1,000 / 24 hrs)"}
                    status={waStatus.messagingTier ? "healthy" : "healthy"}
                  />
                </div>
                {!waStatus.qualityRating && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-start gap-2">
                    <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Quality rating and tier data will appear after your first outgoing message.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Test Mode Notice */}
      {adminCounts.broadcasts === 0 && !adminCounts.loading && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-100 shrink-0 mt-0.5">
            <Info size={14} className="text-[#125EF2]" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              Your workspace is ready — analytics coming soon
            </p>
            <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
              Delivery rates, read rates, and campaign performance metrics will appear here automatically once you send your first broadcast.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // ═════════════════════════════════════════════════════════
  // RENDER: AGENT DASHBOARD
  // ═════════════════════════════════════════════════════════
  const renderAgentDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Hello, {userName}!
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted)] font-medium">
            Welcome to your support console.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
            title="Refresh data"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <Link
            to="/dashboard/inbox"
            className="btn-primary flex items-center gap-2 text-sm shadow-sm"
          >
            <MessageSquare size={16} />
            <span>Open Inbox</span>
          </Link>
        </div>
      </div>

      {/* 🆕 CHUNK 8: Agent Cards WITH Badge */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {agentResourceCards.map((item) => (
          <Link
            key={item.label}
            to={item.link}
            onClick={item.onClick}
            className="card p-5 border border-slate-100 flex flex-col justify-between hover:border-[#CFE0FD] hover:shadow-md transition-all duration-200 group bg-white relative"
          >
            {item.hasBadge && (
              <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md animate-pulse z-10">
                {item.badgeCount}
              </span>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">{item.label}</span>
              <div className={`p-2.5 rounded-xl border ${item.bg}`}>{item.icon}</div>
            </div>
            <div className="mt-4">
              {agentData.loading ? (
                <div className="h-9 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <span className="text-3xl font-bold text-slate-800">{item.value}</span>
              )}
              <p className={`mt-1 text-xs font-semibold flex items-center gap-1 group-hover:text-[#125EF2] transition ${
                item.hasBadge ? "text-red-600" : "text-slate-500"
              }`}>
                <span>{item.subtext}</span>
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Open Conversations */}
      <div className="card border border-slate-100 p-6 bg-white">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare size={18} className="text-[#125EF2]" />
              My Open Conversations
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Your most recent active support sessions
            </p>
          </div>
          <Link
            to="/dashboard/inbox"
            className="text-xs font-bold text-[#125EF2] hover:underline flex items-center gap-1"
          >
            <span>Open Inbox</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="mt-4">
          {agentData.loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : agentData.conversations.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                <MessageSquare size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-700">No open conversations</p>
              <p className="text-xs text-slate-500 font-medium mt-1">
                New chats will appear here as they're assigned to you.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {agentData.conversations.map((conv, idx) => {
                const contactName = conv.contact?.name || "Unknown";
                const contactPhone = conv.contact?.phone || "";
                const messages = Array.isArray(conv.messages) ? conv.messages : [];
                const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                const lastMessage =
                  lastMsg?.text || lastMsg?.body || lastMsg?.content || lastMsg?.message || "No messages yet";
                const time = conv.lastMessageAt || conv.updatedAt || conv.createdAt;
                const hasUnread = conv.unreadCount > 0;

                return (
                  <Link
                    key={conv.id || idx}
                    to="/dashboard/inbox"
                    className="flex items-center gap-4 py-4 hover:bg-slate-50/50 transition rounded-lg px-2 -mx-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EAF2FE] to-blue-100 flex items-center justify-center shrink-0 border border-[#CFE0FD]">
                      <span className="text-sm font-bold text-[#125EF2]">
                        {contactName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">{contactName}</p>
                        {hasUnread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{lastMessage}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-400 font-semibold">{formatRelativeTime(time)}</p>
                      {contactPhone && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{contactPhone}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {agentData.assignedChats === 0 && !agentData.loading && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-100 shrink-0 mt-0.5">
            <Info size={14} className="text-[#125EF2]" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Your inbox is ready — performance stats coming soon</p>
            <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
              Response times, resolution rates, and customer ratings will appear here once you start handling conversations.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // ═════════════════════════════════════════════════════════
  // RENDER: PENDING TENANT
  // ═════════════════════════════════════════════════════════
  const renderPendingDashboard = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Account Under Review
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            Welcome to Sudoreply, {userName}!
          </h1>
          <p className="text-sm text-slate-600 max-w-xl font-medium leading-relaxed">
            Your tenant account has been registered successfully and is currently awaiting approval from a super administrator.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-white/80 backdrop-blur-sm border border-amber-200/50 rounded-2xl shrink-0 text-center shadow-inner">
          <Clock className="w-10 h-10 text-amber-500 animate-spin" style={{ animationDuration: "6s" }} />
          <span className="mt-2 text-xs font-bold text-slate-700">Estimated response:</span>
          <span className="text-[10px] text-slate-500 font-semibold">Within 24 hours</span>
        </div>
      </div>
    </div>
  );

  if (!userRole) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-slate-100 rounded" />
        <div className="h-24 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (tenantStatus === "PENDING") return renderPendingDashboard();
  if (userRole === "agent") return renderAgentDashboard();
  return renderAdminDashboard();
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════
const InfoRow = ({ label, value, fullValue, copyable, copiedField, fieldKey, onCopy }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-slate-500">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-slate-800 font-mono">{value}</span>
      {copyable && fullValue && (
        <button
          onClick={() => onCopy(fullValue, fieldKey)}
          className="p-1 rounded-md hover:bg-slate-100 transition"
          title="Copy"
        >
          {copiedField === fieldKey ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} className="text-slate-400" />
          )}
        </button>
      )}
    </div>
  </div>
);

const HealthRow = ({ label, value, status }) => {
  const statusConfig = {
    healthy: { dot: "bg-emerald-500", text: "text-emerald-700" },
    warning: { dot: "bg-amber-500", text: "text-amber-700" },
    critical: { dot: "bg-red-500", text: "text-red-700" },
    pending: { dot: "bg-slate-300", text: "text-slate-500" },
  };
  const cfg = statusConfig[status] || statusConfig.pending;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        <span className={`text-xs font-bold ${cfg.text}`}>{value}</span>
      </div>
    </div>
  );
};