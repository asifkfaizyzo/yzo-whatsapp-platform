import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Mail, Trash2, Calendar, User, Tag, FileText, Check } from "lucide-react";
import api from "../../lib/axios";

export default function EnquiryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchEnquiry = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/admin/enquiries/${id}`);
      if (response.data.success) {
        setEnquiry(response.data.data);
      } else {
        setError(response.data.message || "Failed to load enquiry details.");
      }
    } catch (err) {
      console.error("Error loading enquiry details:", err);
      setError(err.response?.data?.message || "Failed to load enquiry details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiry();
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const response = await api.patch(`/admin/enquiries/${id}/status`, { status: newStatus });
      if (response.data.success) {
        setEnquiry(response.data.data);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert(err.response?.data?.message || "Failed to update status.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await api.delete(`/admin/enquiries/${id}`);
      if (response.data.success) {
        navigate("/dashboard/enquiries");
      }
    } catch (err) {
      console.error("Error deleting enquiry:", err);
      alert(err.response?.data?.message || "Failed to delete enquiry.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
        <span className="text-sm">Loading enquiry details...</span>
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <span className="text-4xl">⚠️</span>
        <h3 className="text-lg font-bold text-slate-700">Failed to load</h3>
        <p className="text-sm text-slate-500">{error || "Enquiry not found."}</p>
        <Link to="/dashboard/enquiries" className="inline-block bg-[#125EF2] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-600 transition">
          Back to Enquiries
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Back link */}
      <div>
        <Link to="/dashboard/enquiries" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 font-medium">
          <ArrowLeft size={16} />
          <span>Back to Enquiries</span>
        </Link>
      </div>

      {/* Detail Card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        
        {/* Left Side: Summary & Actions */}
        <div className="p-6 md:p-8 space-y-6 md:col-span-1">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Enquiry Meta</span>
            <div className="mt-4 space-y-4">
              {/* Date */}
              <div className="flex gap-3 text-sm">
                <Calendar size={18} className="text-slate-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">Date Submitted</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(enquiry.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="flex gap-3 text-sm">
                <Tag size={18} className="text-slate-400 shrink-0" />
                <div className="w-full">
                  <p className="font-semibold text-slate-800">Current Status</p>
                  <div className="mt-2 w-full">
                    <select
                      disabled={updating}
                      value={enquiry.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="new">New</option>
                      <option value="read">Read</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
            {/* Reply Button */}
            <a
              href={`mailto:${enquiry.email}?subject=${encodeURIComponent(
                enquiry.subject ? `Re: ${enquiry.subject}` : "Response from SudoReply"
              )}`}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#125EF2] hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition shadow-md hover:shadow-lg"
            >
              <Mail size={16} />
              <span>Reply via Email</span>
            </a>

            {/* Delete Button */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition"
            >
              <Trash2 size={16} />
              <span>Delete Enquiry</span>
            </button>
          </div>
        </div>

        {/* Right Side: Message Details */}
        <div className="p-6 md:p-8 space-y-6 md:col-span-2 bg-slate-50/20">
          {/* Header Info */}
          <div className="border-b border-slate-100 pb-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                {enquiry.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{enquiry.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  <a href={`mailto:${enquiry.email}`} className="hover:underline text-blue-600">{enquiry.email}</a>
                </p>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subject</span>
            <p className="text-base font-bold text-slate-800">
              {enquiry.subject || <span className="text-slate-400 italic font-normal">No subject provided</span>}
            </p>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Message</span>
            <div className="bg-white border border-slate-100 rounded-xl p-5 text-sm text-slate-700 leading-relaxed min-h-[180px] shadow-sm whitespace-pre-wrap">
              {enquiry.message}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 md:p-8 max-w-md w-full text-center space-y-6">
            <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Enquiry?</h3>
              <p className="text-sm text-slate-500 mt-2">
                Are you sure you want to delete this enquiry from <strong>{enquiry.name}</strong>? This action cannot be undone.
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
