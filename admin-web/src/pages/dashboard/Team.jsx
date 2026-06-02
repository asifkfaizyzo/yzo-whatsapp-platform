// admin-web/src/pages/dashboard/Team.jsx

import React, { useState } from "react";
import {
  UserCheck,
  Plus,
  Mail,
  Shield,
  Trash2,
  X,
  CheckCircle2
} from "lucide-react";

export default function Team() {
  const [admins, setAdmins] = useState([
    { id: 1, name: "Master Operator", email: "admin@yzo.com", role: "Primary SuperAdmin", status: "Active" },
    { id: 2, name: "Marcus Vance", email: "marcus@yzo.com", role: "SuperAdmin", status: "Active" },
    { id: 3, name: "Elena Rostova", email: "elena@yzo.com", role: "Billing Operator", status: "Away" },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    role: "SuperAdmin",
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!newAdmin.name.trim() || !newAdmin.email.trim()) return;

    const created = {
      id: Date.now(),
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      status: "Active",
    };

    setAdmins([...admins, created]);
    setShowModal(false);
    setNewAdmin({ name: "", email: "", role: "SuperAdmin" });

    setFeedback(`Admin "${created.name}" invited successfully!`);
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to revoke admin rights for "${name}"?`)) {
      setAdmins(admins.filter((a) => a.id !== id));
      setFeedback(`Access revoked for "${name}".`);
      setTimeout(() => setFeedback(""), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="text-emerald-600" size={24} />
            <span>Platform Operators & Administrators</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure system administration access levels and invite SaaS operators.
          </p>
        </div>

        {feedback && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold animate-bounce shrink-0">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus size={16} />
          <span>Invite Admin</span>
        </button>
      </div>

      {/* Admins list table */}
      <div className="card border border-slate-100 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-400 font-bold border-b border-slate-100 bg-slate-50/20">
                <th className="p-4 font-semibold">Operator Info</th>
                <th className="p-4 font-semibold">Permission Tier</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/40">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200/50">
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{admin.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                          <Mail size={10} />
                          <span>{admin.email}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-slate-700 capitalize flex items-center gap-1.5 mt-2">
                    <Shield size={12} className="text-slate-400" />
                    <span>{admin.role}</span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      admin.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        admin.status === "Active" ? "bg-emerald-500" : "bg-amber-500"
                      }`} />
                      <span>{admin.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {admin.id !== 1 ? (
                      <button
                        onClick={() => handleDelete(admin.id, admin.name)}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold italic">Primary Owner</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Invite SaaS Operator</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="label text-xs">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  required
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. john@yzo.com"
                  required
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">Operator Role</label>
                <select
                  className="input text-xs"
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                >
                  <option value="SuperAdmin">SuperAdmin (Full control)</option>
                  <option value="Billing Operator">Billing Operator (Manage plans)</option>
                  <option value="Support Engineer">Support Engineer (Read-only status)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary py-2 px-3 text-[11px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-[11px] font-bold"
                >
                  Create Operator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
