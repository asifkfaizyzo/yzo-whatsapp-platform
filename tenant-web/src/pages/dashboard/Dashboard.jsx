// src/pages/dashboard/Dashboard.jsx

import React, { useEffect, useState } from "react";
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
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState("admin");
  const [agentStatus, setAgentStatus] = useState("active");

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

  const stats = [
    {
      label: "Total Sent",
      value: "48,290",
      change: "+12% this week",
      icon: <Send size={22} className="text-emerald-600" />,
      bg: "bg-emerald-50 border-emerald-100",
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
      icon: <MessageSquare size={22} className="text-emerald-600" />,
      bg: "bg-emerald-50 border-emerald-100",
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
    { name: "Riya Patel", phone: "+91 98765 43210", lastMessage: "Great. Can I book a quick demo?", time: "11:45 AM", tag: "Interested in pricing", tagColor: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    { name: "David Lee", phone: "+1 (555) 019-2834", lastMessage: "Thanks, looking into it now.", time: "10:12 AM", tag: "Lead", tagColor: "bg-blue-50 text-blue-700 border-blue-100" },
  ];

  // ── Render 1: Admin Dashboard View ──
  const renderAdminDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-200">
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
              <p className="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">
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
            <Link to="/dashboard/broadcasts" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
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
                    <td className="py-3.5 text-right text-emerald-600 font-semibold">{b.delivered}</td>
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
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
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
              <Link to="/dashboard/templates" className="flex items-center justify-between text-slate-600 hover:text-emerald-600 font-semibold transition">
                <span>• Submit new template for approval</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link to="/dashboard/team" className="flex items-center justify-between text-slate-600 hover:text-emerald-600 font-semibold transition">
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
                      ? "bg-emerald-500 text-white shadow-sm"
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
                    ? "bg-emerald-500"
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
            <Link to="/dashboard/inbox" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
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
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition duration-150"
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
              <Link to="/dashboard/contacts" className="flex items-center justify-between text-slate-600 hover:text-[#10b981] font-semibold transition">
                <span>• Manage Contacts & Tags</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link to="/dashboard/settings" className="flex items-center justify-between text-slate-600 hover:text-[#10b981] font-semibold transition">
                <span>• Edit My Profile Settings</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Return Dashboard View based on user role
  if (userRole === "agent") {
    return renderAgentDashboard();
  }
  return renderAdminDashboard();
}
