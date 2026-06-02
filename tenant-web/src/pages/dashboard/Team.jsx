// src/pages/dashboard/Team.jsx

import React, { useState } from "react";
import { 
  UserCheck, 
  Plus, 
  Mail, 
  Shield, 
  MessageSquare, 
  Trash2,
  X,
  CheckCircle2
} from "lucide-react";
import { createTenantUser } from "../../services/auth.service";

export default function Team() {
  const [agents, setAgents] = useState([
    { id: 1, name: "Demo Tenant", email: "tenant@company.com", role: "admin", status: "active", activeChats: 0, maxChats: 10 },
    { id: 2, name: "Sarah Connor", email: "sarah@company.com", role: "agent", status: "active", activeChats: 4, maxChats: 15 },
    { id: 3, name: "John Smith", email: "john@company.com", role: "agent", status: "away", activeChats: 2, maxChats: 15 },
    { id: 4, name: "Ravi Dev", email: "ravi@company.com", role: "agent", status: "offline", activeChats: 0, maxChats: 15 },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newAgent, setNewAgent] = useState({
  name: "",
  email: "",
  password: "", // Add password field
  role: "agent",
  maxChats: 15,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");


const handleInvite = async (e) => {
  e.preventDefault();
  if (!newAgent.name.trim() || !newAgent.email.trim() || !newAgent.password.trim()) return;
  setLoading(true);
  setError("");
  const result = await createTenantUser({
    name: newAgent.name,
    email: newAgent.email,
    password: newAgent.password
  });
  if (result.success) {
    const createdUser = result.data.user;
    
    // Add the new user to the local UI list
    setAgents(prev => [...prev, {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      role: "agent", // Users automatically default to agents
      status: "offline",
      activeChats: 0,
      maxChats: Number(newAgent.maxChats),
    }]);
    setShowModal(false);
    setNewAgent({ name: "", email: "", password: "", role: "agent", maxChats: 15 });
    
    // Show success feedback message
    setFeedback("Agent created successfully!");
    setTimeout(() => setFeedback(""), 3000);
  } else {
    setError(result.message);
  }
  setLoading(false);
};

  const handleDelete = (id) => {
    setAgents(agents.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="text-emerald-600" size={24} />
            <span>Agent & Team Management</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Invite teammates and configure access roles for chat console operations.
          </p>
        </div>
        
        {feedback && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold animate-bounce shrink-0">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        <button
          onClick={() => {
            setError("");
            setShowModal(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus size={16} />
          <span>Invite Agent</span>
        </button>
      </div>

      {/* Agents Grid List */}
      <div className="card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100 bg-slate-50/20">
                <th className="p-4 font-semibold">Teammate Info</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Live Load</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-slate-50/40">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200/50">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{agent.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                          <Mail size={10} />
                          <span>{agent.email}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-slate-700 capitalize flex items-center gap-1.5 mt-2">
                    <Shield size={12} className="text-slate-400" />
                    <span>{agent.role}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={13} className="text-slate-400" />
                      <span className="font-semibold text-slate-700">
                        {agent.activeChats} / {agent.maxChats}
                      </span>
                      <span className="text-[10px] text-slate-400">chats</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      agent.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : agent.status === "away"
                        ? "bg-amber-50 text-amber-700 border-amber-100"
                        : "bg-slate-50 text-slate-500 border-slate-150"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === "active"
                          ? "bg-emerald-500"
                          : agent.status === "away"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`} />
                      <span className="capitalize">{agent.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {/* Don't let deleting admin tenant themselves for safety in mock */}
                    {agent.id !== 1 ? (
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold italic">Owner</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invite Agent Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Invite New Agent</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {/* Error Message display */}
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-650">
                  {error}
                </div>
              )}

              <div>
                <label className="label text-xs">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  required
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. sarah@company.com"
                  required
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={newAgent.password}
                  onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* <div>
                  <label className="label text-xs">System Role</label>
                  <select 
                    className="input text-xs"
                    value={newAgent.role}
                    onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                  >
                    <option value="agent">Agent (Chat only)</option>
                    <option value="admin">Admin (Full access)</option>
                  </select>
                </div> */}
                {/* <div>
                  <label className="label text-xs">Max Sockets</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={newAgent.maxChats}
                    onChange={(e) => setNewAgent({ ...newAgent, maxChats: e.target.value })}
                    className="input text-xs"
                  />
                </div> */}
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary py-2 px-3 text-[11px] font-semibold"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-[11px] font-bold"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
