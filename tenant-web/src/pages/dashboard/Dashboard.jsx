import React, { useEffect, useState } from "react";
import WhatsAppConnect from "../../components/whatsapp/WhatsAppConnect";
import {
  Send,
  CheckCircle2,
  Eye,
  MessageSquare,
  ArrowUpRight,
  Plus,
  TrendingUp,
  Clock,
  ThumbsUp,
  ArrowRight,
  Smartphone
} from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { getWhatsappStatus } from "../../services/tenant.service";

export default function Dashboard() {
  const { tenantStatus } = useOutletContext();
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState("admin");
  const [agentStatus, setAgentStatus] = useState("active");
  const [showConnect, setShowConnect] = useState(false);
  const [waStatus, setWaStatus] = useState({
    isConnected: false,
    loading: true,
    phoneNumberId: null,
    wabaId: null,
  });

  const fetchWaStatus = async () => {
    const res = await getWhatsappStatus();
    if (res.success && res.data) {
      setWaStatus({
        isConnected: !!res.data.isConnected,
        loading: false,
        phoneNumberId: res.data.phoneNumberId || null,
        wabaId: res.data.wabaId || null,
      });
    } else {
      setWaStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "Admin");
        setUserRole(parsed.type === "TENANT" ? "admin" : "agent");
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (userRole === "admin") {
      fetchWaStatus();
    }
  }, [userRole]);


  const stats = [
    {
      label: "Total Sent",
      value: "48,290",
      change: "+12% this week",
      icon: <Send size={22} className="text-[#125EF2]" />,
      bg: "bg-[#EAF2FE] border-[#CFE0FD]",
    },
    {
      label: "Delivery Rate",
      value: "99.4%",
      change: "+0.2% vs last week",
      icon: <CheckCircle2 size={22} className="text-blue-600" />,
      bg: "bg-blue-50 border-blue-100",
    },
    {
      label: "Read Rate",
      value: "82.7%",
      change: "-1.1% vs last week",
      icon: <Eye size={22} className="text-purple-600" />,
      bg: "bg-purple-50 border-purple-100",
    },
    {
      label: "Active Chats",
      value: "34",
      change: "+8 active agents live",
      icon: <MessageSquare size={22} className="text-amber-600" />,
      bg: "bg-amber-50 border-amber-100",
    },
  ];

  const recentBroadcasts = [
    { name: "Summer Promo Campaign", date: "May 29, 2026", sent: "12,500", delivered: "99.1%", read: "84.2%" },
    { name: "Monthly Newsletter Update", date: "May 15, 2026", sent: "10,800", delivered: "99.8%", read: "81.9%" },
    { name: "Feedback Survey Alert", date: "May 08, 2026", sent: "5,400", delivered: "98.9%", read: "79.5%" },
  ];

  // Agent Dashboard Stats
  const agentStats = [
    {
      label: "Assigned Chats",
      value: "4",
      change: "2 unread messages",
      icon: <MessageSquare size={22} className="text-[#125EF2]" />,
      bg: "bg-[#EAF2FE] border-[#CFE0FD]",
    },
    {
      label: "Closed Today",
      value: "18",
      change: "+4 since yesterday",
      icon: <CheckCircle2 size={22} className="text-blue-600" />,
      bg: "bg-blue-50 border-blue-100",
    },
    {
      label: "Avg. Response Time",
      value: "2.4 min",
      change: "-30s faster reply",
      icon: <Clock size={22} className="text-purple-600" />,
      bg: "bg-purple-50 border-purple-100",
    },
    {
      label: "Customer Rating",
      value: "4.8/5",
      change: "From 12 customer reviews",
      icon: <ThumbsUp size={22} className="text-amber-600" />,
      bg: "bg-amber-50 border-amber-100",
    },
  ];

  const assignedChats = [
    { name: "Riya Patel", phone: "+91 98765 43210", lastMessage: "Great. Can I book a quick demo?", time: "11:45 AM", tag: "Interested in pricing", tagColor: "bg-[#EAF2FE] text-[#125EF2] border-[#CFE0FD]" },
    { name: "David Lee", phone: "+1 (555) 019-2834", lastMessage: "Thanks, looking into it now.", time: "10:12 AM", tag: "Lead", tagColor: "bg-blue-50 text-blue-700 border-blue-100" },
  ];

  // ── Render 1: Admin Dashboard View ──
  const renderAdminDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* WhatsApp Connect Modal */}
      {showConnect && (
        <WhatsAppConnect
          onSuccess={(data) => {
            console.log("Connected successfully:", data);
            setShowConnect(false);
            fetchWaStatus();
          }}
          onClose={() => setShowConnect(false)}
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Welcome back, {userName}!
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted)] font-medium">
            Here's what is happening with your WhatsApp campaigns today.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            to="/dashboard/broadcasts"
            className="btn-primary flex items-center gap-2 text-sm shadow-sm"
          >
            <Plus size={16} />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* Connect WhatsApp / Connected Banner */}
      {waStatus.isConnected ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          {/* Decorative blobs */}
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
            to="/dashboard/settings"
            className="relative z-10 shrink-0 flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 transition-all duration-200 shadow-sm"
          >
            <span>Manage Settings</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[#CFE0FD] bg-gradient-to-r from-[#EAF2FE] via-white to-blue-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          {/* Decorative blobs */}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.386a.75.75 0 0 0 .92.918l5.655-1.484A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.201-1.442l-.373-.22-3.856 1.012 1.03-3.75-.243-.386A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            <span>Connect WhatsApp</span>
          </button>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="card p-5 border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">{item.label}</span>
              <div className={`p-2.5 rounded-xl border ${item.bg}`}>
                {item.icon}
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-slate-800">{item.value}</span>
              <p className="mt-1 text-xs text-[#125EF2] font-semibold flex items-center gap-1">
                <TrendingUp size={12} />
                <span>{item.change}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Insights Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Broadcasts */}
        <div className="card border border-slate-100 p-6 lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Recent Broadcasts</h2>
              <p className="text-xs text-[color:var(--muted)] font-medium">Overview of your last 3 message campaigns</p>
            </div>
            <Link to="/dashboard/broadcasts" className="text-xs font-semibold text-[#125EF2] hover:text-[#125EF2] flex items-center gap-0.5">
              <span>View All</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100">
                  <th className="pb-3 font-semibold">Campaign Name</th>
                  <th className="pb-3 font-semibold">Sent Date</th>
                  <th className="pb-3 font-semibold text-right">Recipients</th>
                  <th className="pb-3 font-semibold text-right">Delivered</th>
                  <th className="pb-3 font-semibold text-right">Read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {recentBroadcasts.map((b) => (
                  <tr key={b.name} className="hover:bg-slate-50/50">
                    <td className="py-3.5 font-semibold text-slate-700">{b.name}</td>
                    <td className="py-3.5 text-slate-500">{b.date}</td>
                    <td className="py-3.5 text-right font-semibold text-slate-800">{b.sent}</td>
                    <td className="py-3.5 text-right text-[#125EF2] font-semibold">{b.delivered}</td>
                    <td className="py-3.5 text-right text-blue-600 font-semibold">{b.read}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Config Tips / Platform health */}
        <div className="card border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">API Gateway Status</h2>
            <p className="text-xs text-[color:var(--muted)] font-medium">WhatsApp Cloud API details</p>
            
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Webhook Status</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Real-time chat handler</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#EAF2FE] border border-[#CFE0FD] px-2 py-0.5 text-xs font-semibold text-[#125EF2]">
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Message Rate Limit</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Tier 1 Cloud API Account</p>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  80 msg/sec
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Useful Next Steps</h3>
            <div className="mt-3 space-y-2.5 text-sm">
              <Link to="/dashboard/templates" className="flex items-center justify-between text-slate-600 hover:text-[#125EF2] font-semibold transition">
                <span>• Submit new template for approval</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link to="/dashboard/team" className="flex items-center justify-between text-slate-600 hover:text-[#125EF2] font-semibold transition">
                <span>• Invite support agents</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Render 2: Agent Dashboard View ──
  const renderAgentDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Friendly Welcome & Status Control Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Hello, {userName}!
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted)] font-medium">
            Welcome to your support console. Respond to clients and manage your availability.
          </p>
        </div>
        
        {/* Availability Toggle */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl shrink-0">
          <span className="text-xs font-bold text-slate-500">My Status:</span>
          <div className="flex gap-1 bg-white border border-slate-150 p-1 rounded-xl shadow-inner">
            {["active", "away", "offline"].map((status) => (
              <button
                key={status}
                onClick={() => setAgentStatus(status)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition duration-150 flex items-center gap-1.5 ${
                  agentStatus === status
                    ? status === "active"
                      ? "bg-[#125EF2] text-white shadow-sm"
                      : status === "away"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-slate-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  agentStatus === status 
                    ? "bg-white" 
                    : status === "active"
                    ? "bg-[#125EF2]"
                    : status === "away"
                    ? "bg-amber-500"
                    : "bg-slate-400"
                }`} />
                <span>{status}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Stats Rows */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {agentStats.map((item) => (
          <div key={item.label} className="card p-5 border border-slate-100 flex flex-col justify-between bg-white">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">{item.label}</span>
              <div className={`p-2.5 rounded-xl border ${item.bg}`}>
                {item.icon}
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-slate-800">{item.value}</span>
              <p className="mt-1 text-xs text-slate-400 font-semibold">
                {item.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Agent Content Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assigned Conversations */}
        <div className="card border border-slate-100 p-6 lg:col-span-2 bg-white">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800">My Assigned Chats</h2>
              <p className="text-xs text-[color:var(--muted)] font-medium">Your most recent active support sessions</p>
            </div>
            <Link to="/dashboard/inbox" className="text-xs font-semibold text-[#125EF2] hover:text-[#125EF2] flex items-center gap-0.5">
              <span>Open Inbox</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100">
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Last Message</th>
                  <th className="pb-3 font-semibold text-right">Time</th>
                  <th className="pb-3 font-semibold text-right">Segment</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {assignedChats.map((chat) => (
                  <tr key={chat.name} className="hover:bg-slate-50/50">
                    <td className="py-3.5">
                      <div className="font-semibold text-slate-700">{chat.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{chat.phone}</div>
                    </td>
                    <td className="py-3.5 text-slate-500 max-w-[180px] truncate">{chat.lastMessage}</td>
                    <td className="py-3.5 text-right font-medium text-slate-800">{chat.time}</td>
                    <td className="py-3.5 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${chat.tagColor}`}>
                        {chat.tag}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link 
                        to="/dashboard/inbox"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#EAF2FE] border border-[#CFE0FD] hover:bg-[#CFE0FD] text-[#125EF2] text-xs font-semibold rounded-lg transition duration-150"
                      >
                        <span>Chat</span>
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Help & Shortcuts Panel */}
        <div className="card border border-slate-100 p-6 flex flex-col justify-between bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Support Resources</h2>
            <p className="text-xs text-[color:var(--muted)] font-medium">Quick links to assist you in resolved conversations</p>
            
            <div className="mt-5 space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-xs font-bold text-slate-700">Need help with template rules?</p>
                <p className="text-[10px] text-slate-500 mt-1">Contact your system administrator to request template edits.</p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-xs font-bold text-slate-700">Quick Tips</p>
                <p className="text-[10px] text-slate-500 mt-1">Remember to tag customers in the Inbox panel to group them correctly in the Audience lists.</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
            <div className="mt-3 space-y-2.5 text-sm">
              <Link to="/dashboard/contacts" className="flex items-center justify-between text-slate-600 hover:text-[#125EF2] font-semibold transition">
                <span>• Manage Contacts & Tags</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link to="/dashboard/settings" className="flex items-center justify-between text-slate-600 hover:text-[#125EF2] font-semibold transition">
                <span>• Edit My Profile Settings</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

    const renderPendingDashboard = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Account Under Review
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            Welcome to yzo, {userName}!
          </h1>
          <p className="text-sm text-slate-600 max-w-xl font-medium leading-relaxed">
            Your tenant account has been registered successfully and is currently awaiting approval from a super administrator.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-white/80 backdrop-blur-sm border border-amber-200/50 rounded-2xl shrink-0 text-center shadow-inner">
          <Clock className="w-10 h-10 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="mt-2 text-xs font-bold text-slate-700">Estimated response:</span>
          <span className="text-[10px] text-slate-500 font-semibold">Within 24 hours</span>
        </div>
      </div>

      {/* Progress / Timeline Card */}
      <div className="card p-6 sm:p-8 border border-slate-100 bg-white">
        <h2 className="text-lg font-bold text-slate-800">Onboarding Status</h2>
        <p className="text-xs text-slate-400 font-medium">Follow your account verification and setup progress</p>

        {/* Timeline */}
        <div className="mt-8 relative flex flex-col md:flex-row md:justify-between gap-8 md:gap-4 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 md:before:left-2 md:before:right-2 md:before:top-4 md:before:h-0.5 md:before:w-auto">
          {/* Step 1 */}
          <div className="relative flex items-start md:flex-col gap-4 md:gap-2.5 md:flex-1">
            <div className="z-10 w-9 h-9 rounded-full bg-[#125EF2] border-4 border-[#CFE0FD] text-white flex items-center justify-center shadow-sm">
              <CheckCircle2 size={16} />
            </div>
            <div className="md:mt-1">
              <p className="text-sm font-bold text-slate-800">Register Account</p>
              <p className="text-xs text-slate-500 mt-0.5">Tenant profile created successfully.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex items-start md:flex-col gap-4 md:gap-2.5 md:flex-1">
            <div className="z-10 w-9 h-9 rounded-full bg-amber-500 border-4 border-amber-100 text-white flex items-center justify-center shadow-sm animate-pulse">
              <Clock size={16} />
            </div>
            <div className="md:mt-1">
              <p className="text-sm font-bold text-slate-800">Super Admin Review</p>
              <p className="text-xs text-slate-500 mt-0.5">Reviewing business details & compliance.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex items-start md:flex-col gap-4 md:gap-2.5 md:flex-1">
            <div className="z-10 w-9 h-9 rounded-full bg-slate-100 border-4 border-slate-50 text-slate-400 flex items-center justify-center">
              <Plus size={16} />
            </div>
            <div className="md:mt-1">
              <p className="text-sm font-bold text-slate-400">Connect WABA</p>
              <p className="text-xs text-slate-400 mt-0.5">Hook up your WhatsApp Business API profile.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Docs / Information Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card p-6 border border-slate-100 bg-white flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-800">What can you do right now?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Explore your profile and settings. Make sure your account information is up to date in the Settings panel so the approval process goes smoothly.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <Link to="/dashboard/settings" className="inline-flex items-center gap-1 text-xs font-bold text-[#125EF2] hover:text-[#125EF2] transition">
              <span>Go to Settings</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="card p-6 border border-slate-100 bg-white flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-slate-800">Need immediate assistance?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Do you have a custom deployment model, or need to expedite account approval? Send an email to our support team and we will get back to you.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <a href="mailto:support@yzo.com" className="inline-flex items-center gap-1 text-xs font-bold text-[#125EF2] hover:text-[#125EF2] transition">
              <span>Contact Support</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  // Return Dashboard View based on user status/role
  if (tenantStatus === "PENDING") {
    return renderPendingDashboard();
  }
  if (userRole === "agent") {
    return renderAgentDashboard();
  }
  return renderAdminDashboard();
}
