import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, Building, Mail, Phone, Calendar, Users, ListFilter, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import api from "../../lib/axios";

export default function EnterpriseLeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);

  const fetchLead = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/admin/enterprise-leads/${id}`);
      if (response.data.success) {
        setLead(response.data.data);
        setNotes(response.data.data.internalNotes || "");
      } else {
        setError(response.data.message || "Failed to load lead details.");
      }
    } catch (err) {
      console.error("Error loading lead:", err);
      setError(err.response?.data?.message || "Failed to load lead details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const response = await api.patch(`/admin/enterprise-leads/${id}/status`, { status: newStatus });
      if (response.data.success) {
        // Refresh details to sync history
        await fetchLead();
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert(err.response?.data?.message || "Failed to update status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleNotesSave = async () => {
    setSavingNotes(true);
    try {
      const response = await api.patch(`/admin/enterprise-leads/${id}/notes`, { internal_notes: notes });
      if (response.data.success) {
        alert("Internal notes saved successfully!");
      }
    } catch (err) {
      console.error("Error saving notes:", err);
      alert(err.response?.data?.message || "Failed to save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleActivate = async () => {
    setUpdating(true);
    try {
      const response = await api.post(`/admin/enterprise-leads/${id}/activate`);
      if (response.data.success) {
        setShowActivateModal(false);
        await fetchLead();
        alert("Account activated and email notification sent to tenant!");
      }
    } catch (err) {
      console.error("Error activating account:", err);
      alert(err.response?.data?.message || "Failed to activate account.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await api.delete(`/admin/enterprise-leads/${id}`);
      if (response.data.success) {
        navigate("/dashboard/enterprise-leads");
      }
    } catch (err) {
      console.error("Error deleting lead:", err);
      alert(err.response?.data?.message || "Failed to delete lead.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
        <span className="text-sm">Loading lead details...</span>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <span className="text-4xl">⚠️</span>
        <h3 className="text-lg font-bold text-slate-700">Failed to load</h3>
        <p className="text-sm text-slate-500">{error || "Lead not found."}</p>
        <Link to="/dashboard/enterprise-leads" className="inline-block bg-[#125EF2] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 transition">
          Back to Leads
        </Link>
      </div>
    );
  }

  const getTimelineLabel = (timelineVal) => {
    if (timelineVal === "urgent") return "Urgent";
    if (timelineVal === "1-3months") return "1-3 Months";
    if (timelineVal === "exploring") return "Just Exploring";
    return timelineVal;
  };

  const getPreferredContactLabel = (val) => {
    if (val === "email") return "Email";
    if (val === "phone") return "Phone Call";
    if (val === "video_call") return "Video Call";
    return val;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Header back link */}
      <div className="flex items-center justify-between">
        <Link to="/dashboard/enterprise-leads" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 font-medium">
          <ArrowLeft size={16} />
          <span>Back to Leads</span>
        </Link>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Section 1: Lead Information (Left / Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Enterprise Request</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">{lead.companyName}</h2>
              <p className="text-sm text-slate-500 mt-1">
                Submitted on {new Date(lead.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })} at {new Date(lead.createdAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
              </p>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6 text-sm">
              <div className="flex gap-3">
                <User size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Contact Name</p>
                  <p className="text-slate-800 font-bold mt-0.5">{lead.contactName}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Mail size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Email Address</p>
                  <p className="text-slate-800 font-bold mt-0.5">
                    <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Phone size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Phone Number</p>
                  <p className="text-slate-800 font-bold mt-0.5">{lead.phone || <span className="text-slate-400 italic font-normal">Not provided</span>}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Building size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Role / Job Title</p>
                  <p className="text-slate-800 font-bold mt-0.5">{lead.role || <span className="text-slate-400 italic font-normal">Not provided</span>}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Company Size</p>
                  <p className="text-slate-800 font-bold mt-0.5">{lead.companySize} employees</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Estimated Users</p>
                  <p className="text-slate-800 font-bold mt-0.5">{lead.estimatedUsers || <span className="text-slate-400 italic font-normal">Not specified</span>}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Calendar size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Project Timeline</p>
                  <p className="text-slate-800 font-bold mt-0.5">{getTimelineLabel(lead.timeline)}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <ListFilter size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-slate-400 font-medium">Preferred Contact Method</p>
                  <p className="text-slate-800 font-bold mt-0.5">{getPreferredContactLabel(lead.preferredContact)}</p>
                </div>
              </div>
            </div>

            {/* Custom requirements */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Key Features Interested In</span>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {lead.requirements || <span className="text-slate-400 italic font-normal">No specific requirements mentioned.</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Sales Management (Right / Spans 1 col) */}
        <div className="space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Sales Actions</h3>
            
            {/* Quick Status Buttons */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                disabled={updating || lead.status === "contacted" || lead.status === "converted"}
                onClick={() => handleStatusChange("contacted")}
                className="px-3 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-semibold transition disabled:opacity-50"
              >
                Mark Contacted
              </button>
              <button
                disabled={updating || lead.status === "negotiating" || lead.status === "converted"}
                onClick={() => handleStatusChange("negotiating")}
                className="px-3 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl font-semibold transition disabled:opacity-50"
              >
                Mark Negotiating
              </button>
            </div>

            {/* Activate Button (The most important action) */}
            <button
              disabled={updating || lead.status === "converted"}
              onClick={() => setShowActivateModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} />
              <span>{lead.status === "converted" ? "Account Activated" : "Activate Account"}</span>
            </button>

            {/* Reject & Delete */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
              <button
                disabled={updating || lead.status === "rejected" || lead.status === "converted"}
                onClick={() => handleStatusChange("rejected")}
                className="px-3 py-2.5 border border-red-100 hover:bg-red-50 text-red-600 rounded-xl font-semibold transition disabled:opacity-50"
              >
                Reject Lead
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-2.5 bg-slate-50 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl font-semibold transition"
              >
                Delete Lead
              </button>
            </div>
          </div>

          {/* Current Status & Notes */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Internal Status & Notes</h3>
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold uppercase">Status Dropdown</label>
              <select
                disabled={updating || lead.status === "converted"}
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="negotiating">Negotiating</option>
                <option value="converted">Converted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs text-slate-400 font-bold uppercase flex justify-between">
                <span>Internal Notes</span>
                {savingNotes && <span className="text-blue-600 lowercase font-normal">saving...</span>}
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write log notes here..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 resize-none"
              />
              <button
                onClick={handleNotesSave}
                disabled={savingNotes}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                Save Notes
              </button>
            </div>
          </div>

          {/* History log */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Contact History Log</h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {Array.isArray(lead.history) && lead.history.length > 0 ? (
                  lead.history.map((log, logIdx) => (
                    <li key={logIdx}>
                      <div className="relative pb-8">
                        {logIdx !== lead.history.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              log.status === "converted" ? "bg-green-500 text-white" :
                              log.status === "rejected" ? "bg-red-500 text-white" :
                              log.status === "negotiating" ? "bg-purple-500 text-white" :
                              log.status === "contacted" ? "bg-blue-500 text-white" : "bg-slate-400 text-white"
                            }`}>
                              ●
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5">
                            <p className="text-xs font-bold text-slate-800">
                              Status: <span className="capitalize">{log.status}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              By {log.adminName} on {new Date(log.timestamp).toLocaleDateString(undefined, { dateStyle: "short" })} at {new Date(log.timestamp).toLocaleTimeString(undefined, { timeStyle: "short" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No history log found.</p>
                )}
              </ul>
            </div>

            {/* Activated at / By */}
            {lead.status === "converted" && (
              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">Activated At:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {lead.activatedAt ? new Date(lead.activatedAt).toLocaleString() : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Activated By:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {lead.activatedByAdmin?.name || "Admin"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Activation Confirmation Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 md:p-8 max-w-md w-full text-center space-y-6">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Activate Enterprise Account?</h3>
              <p className="text-sm text-slate-500 mt-2">
                This will activate the custom Enterprise Plan for <strong>{lead.companyName}</strong>. An email notification will be sent to the administrator at <strong>{lead.email}</strong>.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowActivateModal(false)}
                disabled={updating}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={updating}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition shadow-lg disabled:opacity-50"
              >
                {updating ? "Activating..." : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Lead Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 md:p-8 max-w-md w-full text-center space-y-6">
            <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Lead Record?</h3>
              <p className="text-sm text-slate-500 mt-2">
                Are you sure you want to delete the lead record for <strong>{lead.companyName}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition shadow-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
