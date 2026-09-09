import React, { useState, useMemo } from 'react';
import {
  Zap,
  Search,
  X,
  FileText,
  Image as ImageIcon,
  ArrowRight,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QuickReplyModal({
  isOpen,
  onClose,
  quickReplies = [],
  onSelectReply,
  contact,
  user,
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set(quickReplies.map((q) => q.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [quickReplies]);

  const filteredReplies = useMemo(() => {
    return quickReplies.filter((qr) => {
      const matchesCategory = category === 'All' || qr.category === category;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        qr.shortcut?.toLowerCase().includes(q) ||
        qr.title?.toLowerCase().includes(q) ||
        qr.content?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch && qr.isActive;
    });
  }, [quickReplies, search, category]);

  if (!isOpen) return null;

  // Helper to preview interpolated text
  const previewInterpolated = (raw) => {
    if (!raw) return '';
    return raw
      .replace(/{{contactName}}/gi, contact?.name || 'Customer')
      .replace(/{{contactPhone}}/gi, contact?.phone || '')
      .replace(/{{agentName}}/gi, user?.name || 'Agent')
      .replace(/{{companyName}}/gi, user?.tenantName || 'Our Company')
      .replace(/{{date}}/gi, new Date().toLocaleDateString())
      .replace(
        /{{time}}/gi,
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#075E54]/10 text-[#075E54]">
              <Zap size={18} className="fill-[#075E54]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Insert Canned Response
              </h3>
              <p className="text-xs text-slate-500">
                Choose a pre-saved reply to populate into your message box.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/settings?tab=quick-replies"
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#075E54] hover:underline"
            >
              <span>Manage Snippets</span>
              <ExternalLink size={12} />
            </Link>

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by shortcut, title, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#075E54] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#075E54]/20 transition"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  category === cat
                    ? 'bg-[#075E54] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Replies List */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Zap size={32} className="opacity-40" />
              <p className="mt-2 text-xs font-semibold text-slate-600">
                No matching quick replies found
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Try a different search or create one in the management console.
              </p>
            </div>
          ) : (
            filteredReplies.map((reply) => {
              const hasMedia = Boolean(reply.mediaUrl);
              const previewText = previewInterpolated(reply.content);

              return (
                <div
                  key={reply.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#075E54] bg-[#075E54]/10 px-2 py-0.5 rounded-md">
                          /{reply.shortcut}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {reply.title}
                        </span>
                        <span className="rounded bg-slate-200/80 px-1.5 py-0.2 text-[9px] font-medium text-slate-600 uppercase">
                          {reply.category}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                        {previewText}
                      </p>

                      {hasMedia && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#075E54] font-medium">
                          {reply.mediaType === 'IMAGE' ? (
                            <ImageIcon size={13} />
                          ) : (
                            <FileText size={13} />
                          )}
                          <span>Attachment: {reply.mediaName || 'Media'}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        onSelectReply(reply);
                        onClose();
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[#075E54] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#064e46] transition active:scale-95"
                    >
                      <span>Insert</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
