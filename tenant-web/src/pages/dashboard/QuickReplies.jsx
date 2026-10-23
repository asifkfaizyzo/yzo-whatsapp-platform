import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Search,
  Plus,
  Filter,
  Copy,
  Check,
  Edit2,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  X,
  Eye,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Sparkles,
  Users,
  User,
  Clock,
  Loader2,
  UploadCloud,
  ChevronRight,
  Globe,
} from 'lucide-react';
import {
  getQuickReplies,
  getQuickReplyCategories,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
} from '../../services/quickReply.service';
import { getTenantUsers } from '../../services/auth.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const RESERVED_SHORTCUTS = ['help', 'menu', 'start', 'stop', 'list', 'cancel', 'optout'];

const VARIABLE_PILLS = [
  { label: 'Customer Name', token: '{{contactName}}' },
  { label: 'Customer Phone', token: '{{contactPhone}}' },
  { label: 'Agent Name', token: '{{agentName}}' },
  { label: 'Company Name', token: '{{companyName}}' },
  { label: 'Current Date', token: '{{date}}' },
  { label: 'Current Time', token: '{{time}}' },
];

export default function QuickReplies({ embedded = false }) {
  const { user } = useAuthStore();
  const toast = useToast();
  const confirm = useConfirm();
  const isTenantAdmin = user?.type === 'TENANT';

  // ── States ──
  const [quickReplies, setQuickReplies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedScope, setSelectedScope] = useState('ALL');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [teamAgents, setTeamAgents] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  // ── Modal State ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [saving, setSaving] = useState(false);

  // ── Form State ──
  const [formData, setFormData] = useState({
    shortcut: '',
    title: '',
    content: '',
    category: 'General',
    customCategory: '',
    scope: isTenantAdmin ? 'GLOBAL' : 'PERSONAL',
    isActive: true,
    removeMedia: false,
  });
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const contentInputRef = useRef(null);

  // ── Load Data ──
  const loadData = async () => {
    setLoading(true);
    try {
      const [qrRes, catRes] = await Promise.all([
        getQuickReplies({
          search: searchQuery || undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          scope: selectedScope,
          agentId: selectedAgentId || undefined,
          includeInactive: true,
          limit: 100,
        }),
        getQuickReplyCategories(),
      ]);

      if (qrRes.success) {
        setQuickReplies(qrRes.data || []);
      }
      if (catRes.success) {
        setCategories(catRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load quick replies:', err);
      toast.error('Failed to load canned responses');
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch Team Members for Tenant Admin Filter ──
  useEffect(() => {
    if (isTenantAdmin) {
      getTenantUsers()
        .then((res) => {
          if (res?.success && res.data) {
            const list = res.data.users || (Array.isArray(res.data) ? res.data : []);
            setTeamAgents(list);
          }
        })
        .catch(() => {});
    }
  }, [isTenantAdmin]);

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedCategory, selectedScope, selectedAgentId]);

  // ── Analytics Metrics ──
  const metrics = useMemo(() => {
    const total = quickReplies.length;
    const totalUsage = quickReplies.reduce((acc, curr) => acc + (curr.usageCount || 0), 0);
    const topUsed = [...quickReplies].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0];
    return {
      total,
      totalUsage,
      topShortcut: topUsed?.shortcut ? `/${topUsed.shortcut}` : 'N/A',
      topTitle: topUsed?.title || 'None yet',
    };
  }, [quickReplies]);

  // ── Copy Shortcut to Clipboard ──
  const handleCopy = (shortcut, id) => {
    navigator.clipboard.writeText(`/${shortcut}`);
    setCopiedId(id);
    toast.success(`Copied /${shortcut} to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Open Create / Edit Modal ──
  const handleOpenModal = (reply = null) => {
    if (reply) {
      setEditingReply(reply);
      setFormData({
        shortcut: reply.shortcut,
        title: reply.title,
        content: reply.content,
        category: categories.includes(reply.category) ? reply.category : 'Custom',
        customCategory: categories.includes(reply.category) ? '' : reply.category,
        scope: reply.scope,
        isActive: reply.isActive,
        removeMedia: false,
      });
      setAttachmentFile(null);
      setAttachmentPreview(
        reply.mediaUrl
          ? {
              url: `${import.meta.env.VITE_BACKEND_URL}/${reply.mediaUrl}`,
              name: reply.mediaName || 'Attached Media',
              type: reply.mediaType,
            }
          : null
      );
    } else {
      setEditingReply(null);
      setFormData({
        shortcut: '',
        title: '',
        content: '',
        category: 'General',
        customCategory: '',
        scope: isTenantAdmin ? 'GLOBAL' : 'PERSONAL',
        isActive: true,
        removeMedia: false,
      });
      setAttachmentFile(null);
      setAttachmentPreview(null);
    }
    setIsModalOpen(true);
  };

  // ── Variable Pill Insertion ──
  const insertVariable = (token) => {
    const textarea = contentInputRef.current;
    if (!textarea) {
      setFormData((prev) => ({ ...prev, content: prev.content + token }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const newText = text.substring(0, start) + token + text.substring(end);

    setFormData((prev) => ({ ...prev, content: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // ── File Selection ──
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds 20MB limit');
      return;
    }

    setAttachmentFile(file);
    setFormData((prev) => ({ ...prev, removeMedia: false }));

    if (file.type.startsWith('image/')) {
      setAttachmentPreview({
        url: URL.createObjectURL(file),
        name: file.name,
        type: 'IMAGE',
      });
    } else {
      setAttachmentPreview({
        url: null,
        name: file.name,
        type: file.type.includes('pdf') ? 'DOCUMENT' : 'FILE',
      });
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setFormData((prev) => ({ ...prev, removeMedia: true }));
  };

  // ── Has Attachment Check for Dynamic Counter ──
  const hasAttachment = Boolean(
    attachmentFile || (editingReply?.mediaUrl && !formData.removeMedia)
  );
  const maxContentLength = hasAttachment ? 1024 : 4096;
  const isContentOverLimit = formData.content.length > maxContentLength;

  // ── Form Submission ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanShortcut = formData.shortcut
      .trim()
      .replace(/^\/+/, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');

    if (cleanShortcut.length < 2) {
      toast.error('Shortcut must be at least 2 characters');
      return;
    }

    if (RESERVED_SHORTCUTS.includes(cleanShortcut)) {
      toast.error(`"${cleanShortcut}" is a reserved system keyword`);
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Message content is required');
      return;
    }

    if (isContentOverLimit) {
      toast.error(
        hasAttachment
          ? 'Content cannot exceed 1,024 characters when an attachment is included.'
          : 'Content cannot exceed 4,096 characters.'
      );
      return;
    }

    const finalCategory =
      formData.category === 'Custom'
        ? formData.customCategory.trim() || 'General'
        : formData.category;

    const payload = new FormData();
    payload.append('shortcut', cleanShortcut);
    payload.append('title', formData.title.trim());
    payload.append('content', formData.content.trim());
    payload.append('category', finalCategory);
    payload.append('scope', formData.scope);
    payload.append('isActive', formData.isActive);

    if (attachmentFile) {
      payload.append('attachment', attachmentFile);
    }
    if (formData.removeMedia) {
      payload.append('removeMedia', 'true');
    }

    setSaving(true);
    try {
      let res;
      if (editingReply) {
        res = await updateQuickReply(editingReply.id, payload);
      } else {
        res = await createQuickReply(payload);
      }

      if (res.success) {
        toast.success(res.message);
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(res.message || 'Operation failed');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Confirmation ──
  const handleDelete = async (id, title) => {
    const ok = await confirm({
      type: 'danger',
      title: 'Delete Canned Response?',
      message: `Are you sure you want to delete "${title}"? This cannot be undone.`,
      confirmLabel: 'Delete Response',
    });

    if (!ok) return;

    const res = await deleteQuickReply(id);
    if (res.success) {
      toast.success('Quick reply deleted successfully');
      loadData();
    } else {
      toast.error(res.message || 'Failed to delete');
    }
  };

  // ── Toggle Active Status (Optimistic In-Place Update) ──
  const handleToggleActive = async (reply) => {
    const nextStatus = !reply.isActive;

    // 1. Optimistically update state in place immediately (no page reload/spinner flash)
    setQuickReplies((prev) =>
      prev.map((item) =>
        item.id === reply.id ? { ...item, isActive: nextStatus } : item
      )
    );

    try {
      const payload = new FormData();
      payload.append('isActive', nextStatus);

      const res = await updateQuickReply(reply.id, payload);
      if (res.success) {
        toast.success(
          `/${reply.shortcut} is now ${nextStatus ? 'Active' : 'Disabled'}`
        );
      } else {
        // Revert on failure
        setQuickReplies((prev) =>
          prev.map((item) =>
            item.id === reply.id ? { ...item, isActive: reply.isActive } : item
          )
        );
        toast.error(res.message || 'Failed to update status');
      }
    } catch (err) {
      // Revert on error
      setQuickReplies((prev) =>
        prev.map((item) =>
          item.id === reply.id ? { ...item, isActive: reply.isActive } : item
        )
      );
      toast.error('Failed to update status');
    }
  };

  // ── Promote Personal Reply to Global (Tenant Admin Only) ──
  const handlePromoteToGlobal = async (reply) => {
    const ok = await confirm({
      type: 'info',
      title: `Promote /${reply.shortcut} to Global?`,
      message: `This will make "${reply.title}" accessible to ALL agents across your workspace in chat. It will no longer be limited to ${reply.user?.name || 'this agent'}.`,
      confirmLabel: 'Promote to Global',
    });

    if (!ok) return;

    const payload = new FormData();
    payload.append('scope', 'GLOBAL');

    const res = await updateQuickReply(reply.id, payload);
    if (res.success) {
      toast.success(`/${reply.shortcut} is now available company-wide!`);
      loadData();
    } else {
      toast.error(res.message || 'Failed to promote quick reply');
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8"}>
      {/* ── Page Header ── */}
      <div
        className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
          embedded ? "pb-4 border-b border-slate-100" : "mb-6"
        }`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#075E54]/10 text-[#075E54]">
              <Zap size={20} className="fill-[#075E54]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 sm:text-lg">
                Canned Responses / Quick Replies
              </h2>
              <p className="text-xs text-slate-500">
                Shortcut snippets (e.g. <span className="font-semibold text-[#075E54]">/pricing</span>) to instantly populate rich text & media in chat.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#075E54] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#064e46] transition duration-150 active:scale-95"
        >
          <Plus size={16} />
          <span>New Quick Reply</span>
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Snippets</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <MessageSquare size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
            <span className="text-xs text-slate-400">responses created</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Most Popular Shortcut</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#075E54]">
              {metrics.topShortcut}
            </span>
            <span className="truncate text-xs text-slate-500">({metrics.topTitle})</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Times Inserted</span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Zap size={18} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{metrics.totalUsage}</span>
            <span className="text-xs text-slate-400">inquiries resolved faster</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by shortcut, title or content keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-[#075E54] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#075E54]/20 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#075E54] focus:outline-none"
          >
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Scope Filter */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              onClick={() => setSelectedScope('ALL')}
              className={`rounded-lg px-3 py-1.5 transition ${
                selectedScope === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedScope('GLOBAL')}
              className={`rounded-lg px-3 py-1.5 transition ${
                selectedScope === 'GLOBAL'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              🌐 Global {isTenantAdmin && '(Company)'}
            </button>
            <button
              onClick={() => setSelectedScope('PERSONAL')}
              className={`rounded-lg px-3 py-1.5 transition ${
                selectedScope === 'PERSONAL'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              👤 Personal {isTenantAdmin ? '(Team)' : '(My)'}
            </button>
          </div>

          {/* Team Member Filter for Tenant Admin */}
          {isTenantAdmin && teamAgents.length > 0 && selectedScope !== 'GLOBAL' && (
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#075E54] focus:outline-none"
            >
              <option value="">All Team Members</option>
              {teamAgents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  👤 {ag.name || ag.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Quick Replies List / Grid ── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 size={28} className="animate-spin text-[#075E54]" />
        </div>
      ) : quickReplies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Zap size={28} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-800">No canned responses found</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Create your first shortcut snippet to help your team reply in seconds.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#075E54] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#064e46]"
          >
            <Plus size={16} />
            <span>Create Quick Reply</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickReplies.map((reply) => {
            const hasMedia = Boolean(reply.mediaUrl);
            const isPersonal = reply.scope === 'PERSONAL';

            return (
              <div
                key={reply.id}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                  reply.isActive ? 'border-slate-200/90' : 'border-slate-200/60 opacity-60'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#075E54] bg-[#075E54]/10 px-2.5 py-1 rounded-lg">
                        /{reply.shortcut}
                      </span>
                      <button
                        onClick={() => handleCopy(reply.shortcut, reply.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Copy shortcut"
                      >
                        {copiedId === reply.id ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          isPersonal
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        }`}
                      >
                        {isPersonal ? (
                          isTenantAdmin ? (
                            `👤 Personal · ${reply.user?.name || reply.createdByName || 'Agent'}`
                          ) : reply.userId === user?.id ? (
                            '👤 Personal · You'
                          ) : (
                            `👤 Personal · ${reply.user?.name || 'Agent'}`
                          )
                        ) : (
                          '🌐 Global'
                        )}
                      </span>

                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {reply.category}
                      </span>
                    </div>
                  </div>

                  {/* Creator / Scope Info */}
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                    {isPersonal ? (
                      <span className="text-slate-500 truncate">
                        <span className="text-slate-400">Created by: </span>
                        <strong className="text-slate-700 font-semibold">
                          {isTenantAdmin
                            ? reply.user?.name || reply.createdByName || 'Agent'
                            : reply.userId === user?.id
                            ? 'You (Personal Shortcut)'
                            : reply.user?.name || 'Agent'}
                        </strong>
                        {isTenantAdmin && reply.user?.email && (
                          <span className="text-slate-400 font-normal"> ({reply.user.email})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <Globe size={11} className="text-emerald-600" />
                        <span>Company-Wide (All Agents)</span>
                        {reply.createdByName && (
                          <span className="text-slate-400 font-normal">· by {reply.createdByName}</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Title & Content */}
                  <h4 className="mt-3 text-sm font-bold text-slate-900">{reply.title}</h4>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {reply.content}
                  </p>

                  {/* Attachment Tag */}
                  {hasMedia && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-700">
                      {reply.mediaType === 'IMAGE' ? (
                        <ImageIcon size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <FileText size={14} className="text-blue-600 shrink-0" />
                      )}
                      <span className="truncate text-[11px] font-medium">
                        {reply.mediaName || 'Attached Media'}
                      </span>
                      {reply.mediaSize && (
                        <span className="text-[10px] text-slate-400 font-mono ml-auto">
                          {(reply.mediaSize / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={13} />
                    <span>Used {reply.usageCount || 0} times</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {/* Promote to Global (Tenant Admin Only on Personal replies) */}
                    {isTenantAdmin && isPersonal && (
                      <button
                        type="button"
                        onClick={() => handlePromoteToGlobal(reply)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 px-2 py-1 text-[11px] font-semibold transition"
                        title="Promote to Global (make available to all team members)"
                      >
                        <Globe size={12} />
                        <span>Promote</span>
                      </button>
                    )}

                    {/* Active / Disabled Toggle Switch */}
                    <div
                      className="flex items-center gap-1.5 mr-1"
                      title={reply.isActive ? 'Active — click to disable' : 'Disabled — click to enable'}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={reply.isActive}
                        onClick={() => handleToggleActive(reply)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#075E54]/20 ${
                          reply.isActive ? 'bg-[#075E54]' : 'bg-slate-300'
                        }`}
                      >
                        <span className="sr-only">{reply.isActive ? 'Active' : 'Disabled'}</span>
                        <span
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                            reply.isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[10px] font-medium select-none ${
                          reply.isActive ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {reply.isActive ? 'Active' : 'Off'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenModal(reply)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      title="Edit response"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() => handleDelete(reply.id, reply.title)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Delete response"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Drawer Modal ── */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-100 p-6 sm:p-7 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#075E54]/10 text-[#075E54]">
                  <Zap size={18} className="fill-[#075E54]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingReply ? 'Edit Canned Response' : 'Create Canned Response'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Shortcut populates text and optional attachments in chat.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Shortcut & Title Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Shortcut Trigger <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[#075E54]">
                      /
                    </span>
                    <input
                      type="text"
                      placeholder="pricing"
                      value={formData.shortcut}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          shortcut: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 font-mono placeholder-slate-400 focus:border-[#075E54] focus:outline-none focus:ring-2 focus:ring-[#075E54]/20 transition"
                      required
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Type in chat composer: e.g. <span className="font-mono">/pricing</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Title / Purpose <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Standard Pricing Guide"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#075E54] focus:outline-none focus:ring-2 focus:ring-[#075E54]/20 transition"
                    required
                  />
                </div>
              </div>

              {/* Category & Scope Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#075E54] focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Sales">Sales</option>
                    <option value="Support">Support</option>
                    <option value="Billing">Billing</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="Custom">+ Custom Category</option>
                  </select>

                  {formData.category === 'Custom' && (
                    <input
                      type="text"
                      placeholder="Enter new category name..."
                      value={formData.customCategory}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, customCategory: e.target.value }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#075E54] focus:outline-none"
                      autoFocus
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Visibility Scope
                  </label>
                  <div className="mt-1 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="GLOBAL"
                        disabled={!isTenantAdmin}
                        checked={formData.scope === 'GLOBAL'}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scope: e.target.value }))
                        }
                        className="text-[#075E54] focus:ring-[#075E54]"
                      />
                      <span className="font-medium text-slate-800">
                        Global <span className="text-slate-400">(All Team)</span>
                      </span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="PERSONAL"
                        checked={formData.scope === 'PERSONAL'}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, scope: e.target.value }))
                        }
                        className="text-[#075E54] focus:ring-[#075E54]"
                      />
                      <span className="font-medium text-slate-800">
                        Personal <span className="text-slate-400">({isTenantAdmin ? 'Personal Shortcut' : 'Only Me'})</span>
                      </span>
                    </label>
                  </div>
                  {!isTenantAdmin && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      🔒 As an agent, this reply is saved to your personal library and is only visible in your chat composer.
                    </p>
                  )}
                  {isTenantAdmin && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formData.scope === 'GLOBAL'
                        ? '🌐 Global: Available to all team members in live chat.'
                        : '👤 Personal: Only visible to you in chat.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Message Content & Dynamic Placeholders */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Message Content <span className="text-red-500">*</span>
                  </label>

                  {/* Dynamic Character Counter */}
                  <span
                    className={`text-xs font-mono font-medium ${
                      isContentOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {formData.content.length} / {maxContentLength}
                    {hasAttachment && (
                      <span className="ml-1 text-[10px] text-amber-600 font-sans">
                        (WhatsApp caption limit)
                      </span>
                    )}
                  </span>
                </div>

                {/* Variable Quick-Insert Pills */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                    Insert:
                  </span>
                  {VARIABLE_PILLS.map((p) => (
                    <button
                      key={p.token}
                      type="button"
                      onClick={() => insertVariable(p.token)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-[#075E54] hover:text-[#075E54] transition active:scale-95 shadow-2xs"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={contentInputRef}
                  rows={4}
                  placeholder="Hi {{contactName}}, thank you for reaching out! Our pricing plans start at $29/mo..."
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, content: e.target.value }))
                  }
                  className={`mt-2 w-full rounded-xl border p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                    isContentOverLimit
                      ? 'border-red-500 focus:ring-red-200'
                      : 'border-slate-200 focus:border-[#075E54] focus:ring-[#075E54]/20'
                  }`}
                  required
                />

                {isContentOverLimit && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle size={14} />
                    <span>
                      Content exceeds the {maxContentLength} character limit for{' '}
                      {hasAttachment ? 'messages with media' : 'text messages'}.
                    </span>
                  </div>
                )}
              </div>

              {/* Attachment Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Media Attachment (Image, PDF, Document)
                </label>

                {attachmentPreview ? (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-3 truncate">
                      {attachmentPreview.url && attachmentPreview.type === 'IMAGE' ? (
                        <img
                          src={attachmentPreview.url}
                          alt="Preview"
                          className="h-10 w-10 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <FileText size={20} />
                        </div>
                      )}
                      <div className="truncate">
                        <p className="truncate text-xs font-semibold text-slate-800">
                          {attachmentPreview.name}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase">
                          Attached Media
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Remove attachment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center hover:bg-slate-50 transition">
                    <UploadCloud size={24} className="text-slate-400" />
                    <span className="mt-1 text-xs font-medium text-slate-700">
                      Click to upload image, PDF, or document
                    </span>
                    <span className="text-[10px] text-slate-400">
                      PNG, JPG, WEBP, PDF, DOCX up to 20MB
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                  </label>
                )}
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Enable Shortcut</p>
                  <p className="text-[10px] text-slate-400">
                    Active shortcuts appear in autocomplete when typing /
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#075E54] peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || isContentOverLimit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#075E54] px-5 py-2 text-xs font-semibold text-white shadow hover:bg-[#064e46] transition disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingReply ? 'Save Changes' : 'Create Response'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
