// src/pages/dashboard/Contacts.jsx

import React, { useEffect, useState } from "react";
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  UserPlus,
  Trash2,
  X,
  Edit2,
  Ban,
  Unlock,
  Upload
} from "lucide-react";
import { getContacts, createContact, deleteContact, updateContact, blockContact, unblockContact, importContacts } from "../../services/contact.service";
import Pagination from "../../components/Pagination";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [editingContact, setEditingContact] = useState(null);
  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    tag: "Lead",
    company: "",
    countryCode: "+91",
  });
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);

  useEffect(() => {
  const handler = setTimeout(() => {
    setDebouncedSearch(search);
    setPage(1); // Reset back to page 1 on new search terms
  }, 400);

  return () => clearTimeout(handler);
  }, [search]);

useEffect(() => {
  fetchContacts();
}, [page, limit, debouncedSearch]);

const fetchContacts = async () => {
  setLoading(true);
  const res = await getContacts(page, limit, debouncedSearch);
  if (res.success) {
    setContacts(res.data.contacts || []);
    setTotalPages(res.data.totalPages || 1);
    setTotalContacts(res.data.count || 0);
  } else {
    console.error(res.message);
  }
  setLoading(false);
};

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      alert("Please upload a valid CSV file.");
      e.target.value = "";
      return;
    }

    setImporting(true);
    const res = await importContacts(file);
    setImporting(false);
    e.target.value = "";

    if (res.success) {
      setImportSummary(res.data.summary || res.data);
      fetchContacts();
    } else {
      alert(res.message);
    }
  };


  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.phone.trim() || !newContact.countryCode.trim()) return;

    const cleanCountryCode = newContact.countryCode.replace(/\D/g, '');
    const cleanPhone = newContact.phone.replace(/\D/g, '');

    if (!cleanCountryCode) {
      alert("Please enter a valid country code.");
      return;
    }

    if (cleanPhone.length < 4) {
      alert("Please enter a valid phone number.");
      return;
    }

    const fullPhone = `+${cleanCountryCode}${cleanPhone}`;

    const payload = {
      name: newContact.name.trim(),
      phone: fullPhone,
      countryCode: `+${cleanCountryCode}`,
      email: newContact.email?.trim() || null,
      tags: [newContact.tag],
      company: newContact.company?.trim() || null,
    };

    let res;
    if (editingContact) {
      res = await updateContact(editingContact.id, payload);
    } else {
      res = await createContact(payload);
    }

    if (res.success) {
      fetchContacts();
      handleCloseModal();
    } else {
      alert(res.message);
    }
  };

    const handleCloseModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setNewContact({ name: "", phone: "", email: "", tag: "Lead", company: "", countryCode: "+91" });
  };

    const handleEditClick = (contact) => {
    setEditingContact(contact);
    
    // Extract local phone digits by stripping the countryCode prefix
    const cleanCC = (contact.countryCode || "").replace(/\D/g, '');
    const cleanPh = (contact.phone || "").replace(/\D/g, '');
    let local = cleanPh;
    if (cleanCC && cleanPh.startsWith(cleanCC)) {
      local = cleanPh.substring(cleanCC.length);
    }

    setNewContact({
      name: contact.name,
      phone: local,
      email: contact.email || "",
      tag: contact.tags && contact.tags.length > 0 ? contact.tags[0] : "Lead",
      company: contact.company || "",
      countryCode: contact.countryCode || "+91",
    });
    setShowModal(true);
  };

  const handleToggleBlock = async (contact) => {
    const action = contact.isBlocked ? "unblock" : "block";
    if (!window.confirm(`Are you sure you want to ${action} this contact?`)) return;

    const res = contact.isBlocked 
      ? await unblockContact(contact.id) 
      : await blockContact(contact.id);

    if (res.success) {
      // Update local state isBlocked value
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, isBlocked: !c.isBlocked } : c));
    } else {
      alert(res.message);
    }
  };


const handleDelete = async (id) => {
  if (!window.confirm("Are you sure you want to delete this contact?")) return;
  const res = await deleteContact(id);
  if (res.success) {
    if (contacts.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      fetchContacts();
    }
  } else {
    alert(res.message);
  }
};


  const filtered = contacts.filter((c) =>
    (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const getTagColor = (tag) => {
  if (tag === "Enterprise") {
    return "bg-purple-50 text-purple-700 border-purple-100";
  }
  if (tag === "Interested in pricing") {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
  return "bg-blue-50 text-blue-700 border-blue-100";
};


  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-emerald-600" size={24} />
            <span>Contacts</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Build your WhatsApp subscriber database and segment them using tags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="csv-file-input"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
            disabled={importing}
          />
          <label
            htmlFor="csv-file-input"
            className={`btn-secondary flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer ${importing ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <Upload size={16} className={importing ? "animate-spin" : ""} />
            <span>{importing ? "Importing..." : "Import CSV"}</span>
          </label>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
            disabled={importing}
          >
            <UserPlus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
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
                {loading ? (
                  Array.from({ length: limit }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="p-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-36"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-40"></div></td>
                      <td className="p-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                      <td className="p-4"><div className="h-6 bg-slate-100 rounded-full w-16"></div></td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <div className="h-7 w-7 bg-slate-100 rounded-lg"></div>
                          <div className="h-7 w-7 bg-slate-100 rounded-lg"></div>
                          <div className="h-7 w-7 bg-slate-100 rounded-lg"></div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={32} className="text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-medium">No contacts found</p>
                        <p className="text-xs text-slate-400">Try adjusting your search terms or add a new contact.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => {
                    const primaryTag = c.tags && c.tags.length > 0 ? c.tags[0] : "Lead";
                    const displayPhone = c.phone.startsWith("+") ? c.phone : `${c.countryCode || ""} ${c.phone}`;
                    const displayDate = new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <tr key={c.id} className={`hover:bg-slate-50/40 ${c.isBlocked ? 'bg-red-50/20' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                            {c.isBlocked && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                                Blocked
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-slate-600 flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <span>{displayPhone}</span>
                        </td>
                        <td className="p-4 text-slate-500">{c.email || "N/A"}</td>
                        <td className="p-4 text-slate-500">{displayDate}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getTagColor(primaryTag)}`}>
                            {primaryTag}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditClick(c)}
                              className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition"
                              title="Edit Contact"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleBlock(c)}
                              className={`p-1.5 rounded-lg transition ${
                                c.isBlocked 
                                  ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' 
                                  : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                              }`}
                              title={c.isBlocked ? "Unblock Contact" : "Block Contact"}
                            >
                              {c.isBlocked ? <Unlock size={14} /> : <Ban size={14} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                              title="Delete Contact"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No contacts match search terms</p>
          )}
        </div>
        <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalContacts}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            itemName="contacts"
          />
      </div>

      {/* ── New Contact Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                {editingContact ? "Edit WhatsApp Contact" : "Add New WhatsApp Contact"}
              </h2>
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
                <label className="label text-xs">WhatsApp Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="+91"
                    required
                    value={newContact.countryCode}
                    onChange={(e) => setNewContact({ ...newContact, countryCode: e.target.value })}
                    className="input text-xs w-20 text-center"
                  />
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    required
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="input text-xs flex-1"
                  />
                </div>
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
                <label className="label text-xs">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newContact.company}
                  onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
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
                  onClick={() => handleCloseModal()}
                  className="btn-secondary py-2 px-3 text-[11px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-[11px] font-bold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV Import Summary Modal ── */}
      {importSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                CSV Import Summary
              </h2>
              <button 
                onClick={() => setImportSummary(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Created</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{importSummary.created || 0}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Duplicates</p>
                  <p className="text-2xl font-black text-amber-700 mt-1">{importSummary.duplicates || 0}</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-rose-800 tracking-wider">Errors</p>
                  <p className="text-2xl font-black text-rose-700 mt-1">{importSummary.errors || 0}</p>
                </div>
              </div>

              {/* Total Processed */}
              <div className="bg-slate-50 rounded-2xl px-4 py-3 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">Total Rows Processed</span>
                <span className="font-bold text-slate-800">{importSummary.total || 0}</span>
              </div>

              {/* Error Details */}
              {importSummary.errorDetails && importSummary.errorDetails.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700">Error Details</h3>
                  <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
                    {importSummary.errorDetails.map((err, i) => (
                      <div key={i} className="p-3 text-[11px] bg-slate-50/50">
                        <div className="flex justify-between items-center font-bold text-slate-700">
                          <span>{err.name || "Unknown"}</span>
                          <span className="font-mono text-slate-500">{err.phone || "No Phone"}</span>
                        </div>
                        <p className="text-rose-600 mt-1">{err.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="pt-4 flex items-center justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setImportSummary(null)}
                  className="btn-primary py-2 px-5 text-[11px] font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
