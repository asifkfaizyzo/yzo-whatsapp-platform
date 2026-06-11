import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  Plus, 
  Mail, 
  Shield, 
  MessageSquare, 
  Trash2,
  X,
  CheckCircle2,
  Edit2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { 
  createTenantUser, 
  getTenantUsers, 
  updateTenantUser, 
  deleteTenantUser, 
  deactivateTenantUser, 
  reactivateTenantUser 
} from "../../services/auth.service";
import { useFormHandler } from "../../hooks/useFormHandler";
import { createUserSchema, updateUserSchema } from "../../validations/user.validation";
import FormError from "../../components/FormError";

export default function Team() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Active Action State
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // We still keep editingAgent.id to track which user we are editing
  const [editingAgent, setEditingAgent] = useState({ id: "", name: "", email: "" });

  // 1. Hook for Inviting New Agent
  const inviteForm = useFormHandler({
    schema: createUserSchema,
    defaultValues: { name: "", email: "", password: "" },
    onSubmitService: createTenantUser,
    onSuccess: () => {
      setShowInviteModal(false);
      inviteForm.reset(); // Clear form fields
      triggerFeedback("Agent created successfully!");
      fetchTeam();
    },
  });

  // 2. Hook for Editing Existing Agent
  const editForm = useFormHandler({
    schema: updateUserSchema,
    defaultValues: { name: "", email: "" },
    onSubmitService: (data) => updateTenantUser(editingAgent.id, data),
    onSuccess: () => {
      setShowEditModal(false);
      triggerFeedback("Teammate updated successfully!");
      fetchTeam();
    },
  });

  // Fetch team members from backend & combine with local owner details
  const fetchTeam = async () => {
    setLoading(true);
    setError("");
    try {
      // 1️⃣ Determine Owner Info from localStorage
      const storedUserStr = localStorage.getItem("user");
      let ownerInfo = null;
      if (storedUserStr) {
        try {
          const storedUser = JSON.parse(storedUserStr);
          if (storedUser.type === "TENANT") {
            ownerInfo = {
              id: "owner-admin",
              name: storedUser.name || "Company Admin",
              email: storedUser.email,
              role: "admin",
              status: "active",
              activeChats: 0,
              maxChats: 10,
              isOwner: true,
            };
          }
        } catch (e) {
          console.error("Failed to parse local storage user:", e);
        }
      }

      // 2️⃣ Fetch actual User records from backend
      const res = await getTenantUsers();
      if (res.success && res.data?.users) {
        const fetchedAgents = res.data.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: "agent", // Users automatically default to support agents
          status: u.isActive ? "active" : "offline",
          isActive: u.isActive,
          activeChats: 0,
          maxChats: 15,
        }));

        // Combine owner row on top
        setAgents(ownerInfo ? [ownerInfo, ...fetchedAgents] : fetchedAgents);
      } else {
        setError(res.message || "Failed to retrieve team members.");
      }
    } catch (err) {
      console.error(err);
      setError("Error connecting to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const triggerFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 4500);
  };

  // Invite Agent Handler
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!newAgent.name.trim() || !newAgent.email.trim() || !newAgent.password.trim()) return;
    
    setModalLoading(true);
    setModalError("");
    
    const result = await createTenantUser({
      name: newAgent.name,
      email: newAgent.email,
      password: newAgent.password
    });
    
    if (result.success) {
      setShowInviteModal(false);
      setNewAgent({ name: "", email: "", password: "" });
      triggerFeedback("Agent created successfully!");
      fetchTeam(); // Reload
    } else {
      setModalError(result.message);
    }
    setModalLoading(false);
  };

  // Edit Agent Handler
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingAgent.name.trim() || !editingAgent.email.trim()) return;

    setModalLoading(true);
    setModalError("");

    const result = await updateTenantUser(editingAgent.id, {
      name: editingAgent.name,
      email: editingAgent.email,
    });

    if (result.success) {
      setShowEditModal(false);
      setEditingAgent({ id: "", name: "", email: "" });
      triggerFeedback("Teammate updated successfully!");
      fetchTeam();
    } else {
      setModalError(result.message);
    }
    setModalLoading(false);
  };

  // Toggle user activation state (Deactivate / Reactivate)
  const handleToggleActivation = async (agentId, isActive, name) => {
    const action = isActive ? "deactivate" : "reactivate";
    if (window.confirm(`Are you sure you want to ${action} agent "${name}"?`)) {
      try {
        const res = isActive 
          ? await deactivateTenantUser(agentId)
          : await reactivateTenantUser(agentId);

        if (res.success) {
          triggerFeedback(`Agent "${name}" has been successfully ${isActive ? "deactivated" : "reactivated"}.`);
          fetchTeam();
        } else {
          alert(res.message || `Failed to ${action} user.`);
        }
      } catch (err) {
        console.error(err);
        alert(`Error executing user ${action}.`);
      }
    }
  };

  // Delete Agent Handler
  const handleDelete = async (agentId, name) => {
    if (window.confirm(`Are you sure you want to permanently delete agent "${name}"? This action cannot be undone.`)) {
      try {
        const res = await deleteTenantUser(agentId);
        if (res.success) {
          triggerFeedback(`Agent "${name}" removed successfully.`);
          fetchTeam();
        } else {
          alert(res.message || "Failed to delete agent.");
        }
      } catch (err) {
        console.error(err);
        alert("Error executing delete action.");
      }
    }
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
        
        <div className="flex items-center gap-2.5 shrink-0">
          {feedback && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold animate-bounce">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}

          <button
            onClick={fetchTeam}
            className="btn-secondary flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs shadow-sm hover:shadow transition"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Sync Team</span>
          </button>

          <button
            onClick={() => {
              setModalError("");
              setShowInviteModal(true);
            }}
            className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Plus size={16} />
            <span>Invite Agent</span>
          </button>
        </div>
      </div>

      {/* Agents Grid List */}
      <div className="card border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
              <p className="text-xs text-slate-400 font-semibold">Loading team members...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="mx-auto w-10 h-10 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Failed to load team</p>
              <p className="text-xs text-rose-500 mt-1">{error}</p>
              <button onClick={fetchTeam} className="mt-4 btn-secondary py-1.5 px-3 rounded-lg text-xs">
                Try Again
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100 bg-slate-50/20">
                  <th className="p-4 font-semibold">Teammate Info</th>
                  <th className="p-4 font-semibold">Role</th>
                  <th className="p-4 font-semibold">Live Load</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/40 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200/50">
                          {agent.name.charAt(0).toUpperCase()}
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
                    <td className="p-4 font-semibold text-slate-700 capitalize">
                      <span className="flex items-center gap-1.5">
                        <Shield size={12} className="text-slate-400" />
                        <span>{agent.role}</span>
                      </span>
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
                    <td className="p-4 text-right pr-6">
                      {/* Don't allow editing or deleting the owner admin block */}
                      {!agent.isOwner ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleToggleActivation(agent.id, agent.isActive, agent.name)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition ${
                              agent.isActive
                                ? "bg-white hover:bg-amber-50 border-gray-200 text-amber-600 hover:border-amber-200"
                                : "bg-white hover:bg-emerald-50 border-gray-200 text-emerald-700 hover:border-emerald-200"
                            }`}
                          >
                            {agent.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                          
                          <button
                            onClick={() => {
                              setEditingAgent(agent);
                              editForm.reset({
                                name: agent.name,
                                email: agent.email,
                              });
                              setShowEditModal(true);
                            }}
                            className="text-slate-400 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-150 transition"
                            title="Edit Agent Details"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={() => handleDelete(agent.id, agent.name)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-150 transition"
                            title="Delete Agent"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold italic">Account Owner</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Invite Agent Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Invite New Agent</h2>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={inviteForm.onSubmit} className="p-6 space-y-4">
              {inviteForm.generalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-650 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{inviteForm.generalError}</span>
                </div>
              )}

              <div>
                <label className="label text-xs">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  className={`input text-xs ${inviteForm.formState.errors.name ? "border-red-500" : ""}`}
                  {...inviteForm.register("name")}
                />
                <FormError message={inviteForm.formState.errors.name?.message} />
              </div>

              <div>
                <label className="label text-xs">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. sarah@company.com"
                  className={`input text-xs ${inviteForm.formState.errors.email ? "border-red-500" : ""}`}
                  {...inviteForm.register("email")}
                />
                <FormError message={inviteForm.formState.errors.email?.message} />
              </div>

              <div>
                <label className="label text-xs">Password *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className={`input text-xs ${inviteForm.formState.errors.password ? "border-red-500" : ""}`}
                  {...inviteForm.register("password")}
                />
                <FormError message={inviteForm.formState.errors.password?.message} />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn-secondary py-2 px-3 text-[11px] font-semibold"
                  disabled={inviteForm.formState.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-[11px] font-bold"
                  disabled={inviteForm.formState.isSubmitting}
                >
                  {inviteForm.formState.isSubmitting ? "Creating..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Agent Modal ── */}
      {showEditModal && editingAgent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Edit Agent Details</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={editForm.onSubmit} className="p-6 space-y-4">
              {editForm.generalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-650 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{editForm.generalError}</span>
                </div>
              )}

              <div>
                <label className="label text-xs">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  className={`input text-xs ${editForm.formState.errors.name ? "border-red-500" : ""}`}
                  {...editForm.register("name")}
                />
                <FormError message={editForm.formState.errors.name?.message} />
              </div>

              <div>
                <label className="label text-xs">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. sarah@company.com"
                  className={`input text-xs ${editForm.formState.errors.email ? "border-red-500" : ""}`}
                  {...editForm.register("email")}
                />
                <FormError message={editForm.formState.errors.email?.message} />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary py-2 px-3 text-[11px] font-semibold"
                  disabled={editForm.formState.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-[11px] font-bold"
                  disabled={editForm.formState.isSubmitting}
                >
                  {editForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
