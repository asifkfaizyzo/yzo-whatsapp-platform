import React, { useEffect, useRef } from 'react';
import {
  Zap,
  FileText,
  Image as ImageIcon,
  Check,
  Sparkles,
} from 'lucide-react';

/**
 * QuickReplyPopover
 * Floating, accessible autocomplete menu shown when an agent types '/' in the message input.
 */
export default function QuickReplyPopover({
  quickReplies = [],
  selectedIndex = 0,
  onSelect,
  onClose,
  contact,
  user,
}) {
  const popoverRef = useRef(null);
  const activeItemRef = useRef(null);

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!quickReplies.length) return null;

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
    <div
      ref={popoverRef}
      role="listbox"
      aria-label="Canned responses"
      className="absolute bottom-full left-0 right-0 mb-2.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-emerald-100 bg-white shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-3 py-1.5 backdrop-blur-xs">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <Zap size={13} className="text-[#075E54] fill-[#075E54]" />
          <span>Quick Replies</span>
          <span className="text-[10px] text-slate-400 font-normal">
            ({quickReplies.length} match{quickReplies.length > 1 ? 'es' : ''})
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200 shadow-2xs font-mono">↑</kbd>{' '}
          <kbd className="rounded bg-white px-1 py-0.5 border border-slate-200 shadow-2xs font-mono">↓</kbd> to navigate,{' '}
          <kbd className="rounded bg-white px-1.5 py-0.5 border border-slate-200 shadow-2xs font-mono">Enter</kbd> to insert
        </span>
      </div>

      <div className="p-1">
        {quickReplies.map((reply, idx) => {
          const isSelected = idx === selectedIndex;
          const hasMedia = Boolean(reply.mediaUrl);
          const isPersonal = reply.scope === 'PERSONAL';
          const previewText = previewInterpolated(reply.content);

          return (
            <div
              key={reply.id}
              ref={isSelected ? activeItemRef : null}
              id={`qr-option-${reply.id}`}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(reply)}
              className={`group flex items-start gap-3 rounded-xl p-2.5 cursor-pointer transition select-none ${
                isSelected
                  ? 'bg-emerald-50/80 border border-emerald-200/80 shadow-xs'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                  isSelected
                    ? 'bg-[#075E54] text-white'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-[#075E54]/10 group-hover:text-[#075E54]'
                }`}
              >
                <span className="font-mono text-xs font-bold">/</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#075E54]">
                    /{reply.shortcut}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-800">
                    {reply.title}
                  </span>

                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {hasMedia && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        title={reply.mediaName || 'Attached Media'}
                      >
                        {reply.mediaType === 'IMAGE' ? (
                          <ImageIcon size={11} className="text-emerald-600" />
                        ) : (
                          <FileText size={11} className="text-blue-600" />
                        )}
                        <span className="max-w-[80px] truncate text-[9px]">
                          {reply.mediaName?.split('.').pop()?.toUpperCase() || 'MEDIA'}
                        </span>
                      </span>
                    )}

                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                        isPersonal
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {reply.scope}
                    </span>
                  </div>
                </div>

                <p className="mt-0.5 truncate text-[11px] text-slate-500 leading-snug">
                  {previewText}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
