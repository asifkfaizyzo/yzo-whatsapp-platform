// src/pages/dashboard/Contacts.jsx

import React, { useState } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  UserPlus,
  Trash2,
  X
} from "lucide-react";

export default function Contacts() {
  const [contacts, setContacts] = useState([
    { id: 1, name: "Riya Patel", phone: "+91 98765 43210", email: "riya@example.com", date: "May 25, 2026", tag: "Interested in pricing", tagColor: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    { id: 2, name: "David Lee", phone: "+1 (555) 019-2834", email: "david@example.com", date: "May 24, 2026", tag: "Lead", tagColor: "bg-blue-50 text-blue-700 border-blue-100" },
    { id: 3, name: "Emma Johnson", phone: "+44 20 7946 0958", email: "emma@example.com", date: "May 20, 2026", tag: "Enterprise", tagColor: "bg-purple-50 text-purple-700 border-purple-100" },
    { id: 4, name: "Rahul Sharma", phone: "+91 91234 56789", email: "rahul@example.com", date: "May 18, 2026", tag: "Lead", tagColor: "bg-blue-50 text-blue-700 border-blue-100" },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  
  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    tag: "Lead",
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.phone.trim()) return;

    let tagColor = "bg-blue-50 text-blue-700 border-blue-100";
    if (newContact.tag === "Enterprise") {
      tagColor = "bg-purple-50 text-purple-700 border-purple-100";
    } else if (newContact.tag === "Interested in pricing") {
      tagColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
    }

    const created = {
      id: contacts.length + 1,
      name: newContact.name,
      phone: newContact.phone,
      email: newContact.email || "N/A",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      tag: newContact.tag,
      tagColor,
    };

    setContacts([...contacts, created]);
    setShowModal(false);
    setNewContact({ name: "", phone: "", email: "", tag: "Lead" });
  };

  const handleDelete = (id) => {
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-emerald-600" size={24} />
            <span>Contacts & Audience</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Build your WhatsApp subscriber database and segment them using tags.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <UserPlus size={16} />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Directory Grid */}
      <div className="card border border-slate-100 overflow-hidden">
        {/* Search/Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by name or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 py-1.5 text-xs bg-white"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100 bg-slate-50/20">
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">WhatsApp Number</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold">Subscribed Date</th>
                <th className="p-4 font-semibold">Segment Tag</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/40">
                  <td className="p-4">
                    <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                  </td>
                  <td className="p-4 font-mono text-slate-600 flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-400" />
                    <span>{c.phone}</span>
                  </td>
                  <td className="p-4 text-slate-500">{c.email}</td>
                  <td className="p-4 text-slate-500">{c.date}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${c.tagColor}`}>
                      {c.tag}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No contacts match search terms</p>
          )}
        </div>
      </div>

      {/* ── New Contact Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Add New WhatsApp Contact</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="label text-xs">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  required
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">WhatsApp Number (with country code)</label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  required
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs">Segment Tag</label>
                <select 
                  className="input text-xs"
                  value={newContact.tag}
                  onChange={(e) => setNewContact({ ...newContact, tag: e.target.value })}
                >
                  <option value="Lead">Lead</option>
                  <option value="Interested in pricing">Interested in pricing</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              {/* Actions */}
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
                  Save Subscriber
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
