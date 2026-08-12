import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  Upload,
  MessageSquare,
} from "lucide-react";
import {
  getContacts,
  createContact,
  deleteContact,
  updateContact,
  blockContact,
  unblockContact,
  importContacts,
} from "../../services/contact.service";
import Pagination from "../../components/Pagination";
import { useFormHandler } from "../../hooks/useFormHandler";
import { contactFormSchema } from "../../validations/contact.validation";
import FormError from "../../components/FormError";
import { createConversation } from "../../services/conversation.service";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { getTags } from "../../services/tag.service";
import {
  getTenantUsers,
  assignContact,
  reassignContact,
  unassignContact,
  assignMultipleContacts,
} from "../../services/tenant.service";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

export default function Contacts() {
  const confirm = useConfirm();
  const toast = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.type === "TENANT";
  const [contacts, setContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [bulkAgentId, setBulkAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [editingContact, setEditingContact] = useState(null);
  const [agents, setAgents] = useState([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter") || "all";
  
  // Dynamic tags list
  const [systemTags, setSystemTags] = useState([]);

  useEffect(() => {
    const fetchTags = async () => {
      const res = await getTags();
      if (res.success) {
        setSystemTags(res.data || []);
      }
    };
    fetchTags();
  }, []);
  
  // Setup hook for adding/editing contacts
  const contactForm = useFormHandler({
    schema: contactFormSchema,
    defaultValues: {
      name: "",
      countryCode: "+91",
      phone: "",
      email: "",
      company: "",
      tag: "Lead",
    },
    onSubmitService: async (data) => {
      // Clean formatting inputs
      const cleanCC = data.countryCode.replace(/\D/g, "");
      const cleanPhone = data.phone.replace(/\D/g, "");
      const fullPhone = `+${cleanCC}${cleanPhone}`;

      const payload = {
        name: data.name.trim(),
        phone: fullPhone,
        countryCode: `+${cleanCC}`,
        email: data.email?.trim() || null,
        tags: data.tag ? [data.tag] : [],
        company: data.company?.trim() || null,
      };

      if (editingContact) {
        return await updateContact(editingContact.id, payload);
      } else {
        return await createContact(payload);
      }
    },
    onSuccess: () => {
      fetchContacts();
      handleCloseModal();
      toast.success(editingContact ? "Contact updated successfully!" : "Contact created successfully!");
    },
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
  }, [page, limit, debouncedSearch, filter]);

  const fetchContacts = async () => {
    setLoading(true);
    const res = await getContacts(page, limit, debouncedSearch, filter);
    if (res.success) {
      setContacts(res.data.contacts || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalContacts(res.data.count || 0);
      setSelectedContactIds([]); // Clear any bulk selection
    } else {
      console.error(res.message);
    }
    setLoading(false);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file.");
      e.target.value = "";
      return;
    }

    setImporting(true);
    const res = await importContacts(file);
    setImporting(false);
    e.target.value = "";

    if (res.success) {
      setImportSummary(res.data.summary || res.data);
      toast.success("Contacts imported successfully!");
      fetchContacts();
    } else {
      toast.error(res.message);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (
      !newContact.name.trim() ||
      !newContact.phone.trim() ||
      !newContact.countryCode.trim()
    )
      return;

    const cleanCountryCode = newContact.countryCode.replace(/\D/g, "");
    const cleanPhone = newContact.phone.replace(/\D/g, "");

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
      toast.success(editingContact ? "Contact updated successfully!" : "Contact created successfully!");
      fetchContacts();
      handleCloseModal();
    } else {
      toast.error(res.message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContact(null);
    contactForm.reset();
  };

  const handleEditClick = (contact) => {
    setEditingContact(contact);

    const cleanCC = (contact.countryCode || "").replace(/\D/g, "");
    const cleanPh = (contact.phone || "").replace(/\D/g, "");
    let local = cleanPh;
    if (cleanCC && cleanPh.startsWith(cleanCC)) {
      local = cleanPh.substring(cleanCC.length);
    }

    contactForm.reset({
      name: contact.name,
      phone: local,
      email: contact.email || "",
      tag: contact.contactTags && contact.contactTags.length > 0 ? contact.contactTags[0].tag.name : "",
      company: contact.company || "",
      countryCode: contact.countryCode || "+91",
    });
    setShowModal(true);
  };

  const handleToggleBlock = async (contact) => {
    const action = contact.isBlocked ? "unblock" : "block";
    const ok = await confirm({
      type: contact.isBlocked ? "info" : "warning",
      title: contact.isBlocked ? "Unblock Contact?" : "Block Contact?",
      message: `Are you sure you want to ${action} this contact?`,
      confirmLabel: contact.isBlocked ? "Unblock" : "Block",
    });
    if (!ok) return;

    const res = contact.isBlocked
      ? await unblockContact(contact.id)
      : await blockContact(contact.id);

    if (res.success) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id ? { ...c, isBlocked: !c.isBlocked } : c,
        ),
      );
      toast.success(contact.isBlocked ? "Contact unblocked successfully." : "Contact blocked successfully.");
    } else {
      toast.error(res.message);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      type: "danger",
      title: "Delete Contact?",
      message: "Permanently delete this contact? This action cannot be undone.",
      confirmLabel: "Delete Contact",
    });
    if (!ok) return;
    const res = await deleteContact(id);
    if (res.success) {
      toast.success("Contact deleted successfully.");
      if (contacts.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        fetchContacts();
      }
    } else {
      toast.error(res.message);
    }
  };

  const filtered = contacts.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()),
  );

  const getTagColor = (tag) => {
    if (tag === "Enterprise") {
      return "bg-purple-50 text-purple-700 border-purple-100";
    }
    if (tag === "Interested in pricing") {
      return "bg-[#EAF2FE] text-[#125EF2] border-[#CFE0FD]";
    }
    if (tag === "VIP") {
      return "bg-rose-50 text-rose-700 border-rose-100";
    }
    return "bg-blue-50 text-blue-700 border-blue-100";
  };

  const handleAssignmentChange = async (
    contactId,
    currentUserId,
    newUserId,
  ) => {
    let res;

    if (!newUserId) {
      // 1. Unassign contact
      res = await unassignContact(contactId);
    } else if (!currentUserId) {
      // 2. Fresh assignment
      res = await assignContact(contactId, newUserId);
    } else {
      // 3. Re-assignment
      res = await reassignContact(contactId, newUserId);
    }

    if (res.success) {
      // Update local contacts array state directly instead of re-fetching
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId ? { ...c, assignedTo: newUserId || null } : c,
        ),
      );
      toast.success(newUserId ? "Agent assigned successfully!" : "Contact unassigned successfully!");
    } else {
      toast.error(res.message);
    }
  };

  const handleStartChat = async (contact) => {
    const res = await createConversation(contact.id);
    if (res.success) {
      // Navigate to the inbox page passing the conversation ID in query string
      navigate(`/dashboard/inbox?conversationId=${res.data.id}`);
    } else {
      toast.error(res.message);
    }
  };

  const handleBulkAssignSubmit = async () => {
    if (!bulkAgentId) {
      toast.warning("Please select an agent.");
      return;
    }
    if (selectedContactIds.length === 0) {
      toast.warning("Please select at least one contact.");
      return;
    }

    const res = await assignMultipleContacts(selectedContactIds, bulkAgentId);
    
    if (res.success) {
      toast.success(res.message || "Contacts assigned successfully!");
      setSelectedContactIds([]);
      setBulkAgentId("");
      fetchContacts(); // Reload contacts list
    } else {
      toast.error(res.message);
    }
  };

  useEffect(() => {
    const fetchAgents = async () => {
      if (!isAdmin) return;
      const res = await getTenantUsers();
      if (res.success) {
        setAgents(res.data || []);
      }
    };
    fetchAgents();
  }, [isAdmin]);

  const activeContacts = contacts.filter((c) => !c.isBlocked);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-[#125EF2]" size={24} />
            <span>Contacts</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Build your WhatsApp subscriber database and segment them using tags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
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
            </>
          )}
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
            <Search
              className="absolute left-3 top-2.5 text-slate-400"
              size={15}
            />
            <input
              type="text"
              placeholder="Search by name or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 py-1.5 text-xs bg-white"
            />
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {isAdmin && selectedContactIds.length > 0 && (
          <div className="p-4 bg-[#EAF2FE]/60 border-b border-slate-100 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <span className="text-xs font-semibold text-[#0D47A1]">
              {selectedContactIds.length} contact(s) selected
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkAgentId}
                onChange={(e) => setBulkAgentId(e.target.value)}
                className="input text-xs py-1.5 px-2 border border-slate-200 rounded-lg bg-white w-48"
              >
                <option value="">-- Assign to Agent --</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssignSubmit}
                disabled={!bulkAgentId}
                className="btn-primary py-1.5 px-3.5 text-xs shadow-sm hover:shadow transition"
              >
                Assign Selected
              </button>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100 bg-slate-50/20">
                {isAdmin && (
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={activeContacts.length > 0 && activeContacts.every((c) => selectedContactIds.includes(c.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContactIds(activeContacts.map((c) => c.id));
                        } else {
                          setSelectedContactIds([]);
                        }
                      }}
                      className="rounded border-slate-350 text-[#125EF2] focus:ring-[#125EF2] cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">WhatsApp Number</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold">Subscribed Date</th>
                <th className="p-4 font-semibold">Segment Tag</th>
                {isAdmin && (
                  <th className="p-4 font-semibold">Assigned Agent</th>
                )}
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {loading ? (
                Array.from({ length: limit }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    {isAdmin && (
                      <td className="p-4 w-12 text-center">
                        <div className="h-4 bg-slate-100 rounded w-4 mx-auto"></div>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="h-4 bg-slate-200 rounded w-28"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-36"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-40"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-24"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-6 bg-slate-100 rounded-full w-16"></div>
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        <div className="h-8 bg-slate-100 rounded-lg w-40"></div>
                      </td>
                    )}
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
                  <td
                    colSpan={isAdmin ? 8 : 6}
                    className="text-center py-12 text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users
                        size={32}
                        className="text-slate-300 stroke-[1.5]"
                      />
                      <p className="text-sm font-medium">No contacts found</p>
                      <p className="text-xs text-slate-400">
                        Try adjusting your search terms or add a new contact.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const contactTagsList = c.contactTags ? c.contactTags.map(ct => ct.tag) : [];
                  const displayPhone = c.phone.startsWith("+")
                    ? c.phone
                    : `${c.countryCode || ""} ${c.phone}`;
                  const displayDate = new Date(c.createdAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  );

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/40 ${c.isBlocked ? "bg-red-50/20" : ""}`}
                    >
                      {isAdmin && (
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            disabled={c.isBlocked}
                            checked={selectedContactIds.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContactIds((prev) => [...prev, c.id]);
                              } else {
                                setSelectedContactIds((prev) => prev.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded border-slate-350 text-[#125EF2] focus:ring-[#125EF2] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={c.isBlocked ? "Blocked contacts cannot be assigned" : ""}
                          />
                        </td>
                      )}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 text-sm">
                            {c.name}
                          </p>
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
                        <div className="flex flex-wrap gap-1">
                          {contactTagsList.map(tag => (
                            <span
                              key={tag.id}
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getTagColor(tag.name)}`}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {contactTagsList.length === 0 && (
                            <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="p-4">
                          <select
                            disabled={c.isBlocked}
                            value={c.assignedTo || ""}
                            onChange={(e) =>
                              handleAssignmentChange(
                                c.id,
                                c.assignedTo,
                                e.target.value,
                              )
                            }
                            className="input text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white w-40 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={c.isBlocked ? "Blocked contacts cannot be assigned" : ""}
                          >
                            <option value="">-- Unassigned --</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
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

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleBlock(c)}
                              className={`p-1.5 rounded-lg transition ${
                                c.isBlocked
                                  ? "text-[#125EF2] hover:text-[#125EF2] hover:bg-[#EAF2FE]"
                                  : "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                              }`}
                              title={
                                c.isBlocked ? "Unblock Contact" : "Block Contact"
                              }
                            >
                              {c.isBlocked ? (
                                <Unlock size={14} />
                              ) : (
                                <Ban size={14} />
                              )}
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                              title="Delete Contact"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartChat(c)}
                            className="text-slate-400 hover:text-[#125EF2] p-1.5 rounded-lg hover:bg-[#EAF2FE] transition"
                            title="Chat with Contact"
                          >
                            <MessageSquare size={14} />
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
            <p className="text-xs text-slate-400 text-center py-8">
              No contacts match search terms
            </p>
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
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                {editingContact
                  ? "Edit WhatsApp Contact"
                  : "Add New WhatsApp Contact"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={contactForm.onSubmit} className="p-6 space-y-4">
              {contactForm.generalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-650 font-semibold">
                  {contactForm.generalError}
                </div>
              )}

              <div>
                <label className="label text-xs">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  className={`input text-xs ${contactForm.formState.errors.name ? "border-red-500" : ""}`}
                  {...contactForm.register("name")}
                />
                <FormError
                  message={contactForm.formState.errors.name?.message}
                />
              </div>

              <div>
                <label className="label text-xs">WhatsApp Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="+91"
                    className={`input text-xs w-20 text-center ${contactForm.formState.errors.countryCode ? "border-red-500" : ""}`}
                    {...contactForm.register("countryCode")}
                  />
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    className={`input text-xs flex-1 ${contactForm.formState.errors.phone ? "border-red-500" : ""}`}
                    {...contactForm.register("phone")}
                  />
                </div>
                <FormError
                  message={
                    contactForm.formState.errors.countryCode?.message ||
                    contactForm.formState.errors.phone?.message
                  }
                />
              </div>

              <div>
                <label className="label text-xs">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  className={`input text-xs ${contactForm.formState.errors.email ? "border-red-500" : ""}`}
                  {...contactForm.register("email")}
                />
                <FormError
                  message={contactForm.formState.errors.email?.message}
                />
              </div>

              <div>
                <label className="label text-xs">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  className={`input text-xs ${contactForm.formState.errors.company ? "border-red-500" : ""}`}
                  {...contactForm.register("company")}
                />
                <FormError
                  message={contactForm.formState.errors.company?.message}
                />
              </div>

              <div>
                <label className="label text-xs">Segment Tag</label>
                <select
                  className="input text-xs"
                  {...contactForm.register("tag")}
                >
                  <option value="">-- No Tag --</option>
                  {systemTags.map((tag) => (
                    <option key={tag.id} value={tag.name}>
                      {tag.name} (Priority {tag.priority})
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleCloseModal()}
                  className="btn-secondary py-2 px-3 text-[11px] font-semibold"
                  disabled={contactForm.formState.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-[11px] font-bold"
                  disabled={contactForm.formState.isSubmitting}
                >
                  {contactForm.formState.isSubmitting
                    ? "Saving..."
                    : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── CSV Import Summary Modal ── */}
      {importSummary && createPortal(
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
                <div className="bg-[#EAF2FE] border border-[#CFE0FD] rounded-2xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-[#0D47A1] tracking-wider">
                    Created
                  </p>
                  <p className="text-2xl font-black text-[#125EF2] mt-1">
                    {importSummary.created || 0}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                    Duplicates
                  </p>
                  <p className="text-2xl font-black text-amber-700 mt-1">
                    {importSummary.duplicates || 0}
                  </p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-rose-800 tracking-wider">
                    Errors
                  </p>
                  <p className="text-2xl font-black text-rose-700 mt-1">
                    {importSummary.errors || 0}
                  </p>
                </div>
              </div>

              {/* Total Processed */}
              <div className="bg-slate-50 rounded-2xl px-4 py-3 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">
                  Total Rows Processed
                </span>
                <span className="font-bold text-slate-800">
                  {importSummary.total || 0}
                </span>
              </div>

              {/* Error Details */}
              {importSummary.errorDetails &&
                importSummary.errorDetails.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700">
                      Error Details
                    </h3>
                    <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
                      {importSummary.errorDetails.map((err, i) => (
                        <div key={i} className="p-3 text-[11px] bg-slate-50/50">
                          <div className="flex justify-between items-center font-bold text-slate-700">
                            <span>{err.name || "Unknown"}</span>
                            <span className="font-mono text-slate-500">
                              {err.phone || "No Phone"}
                            </span>
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
        </div>,
        document.body
      )}
    </div>
  );
}
