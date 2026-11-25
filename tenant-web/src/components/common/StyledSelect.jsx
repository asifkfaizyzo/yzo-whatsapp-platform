// tenant-web/src/pages/auth/Signup/comps/StyledSelect.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

/**
 * Custom dropdown select matching SudoReply auth styling.
 * Uses a portal so the dropdown is never clipped by overflow parents.
 *
 * Props:
 *   value        – currently selected option value
 *   onChange     – (value) => void
 *   options      – [{ value: string, label: string }]
 *   placeholder  – text when nothing selected
 *   icon         – optional Lucide icon element for the left side
 *   label        – field label text
 *   error        – error message string (shows red state)
 *   disabled     – disables interaction
 */
const StyledSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  icon,
  error,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const DROPDOWN_MAX_HEIGHT = 220;
    const MARGIN = 6;

    const spaceBelow = viewportHeight - rect.bottom - MARGIN;
    const spaceAbove = rect.top - MARGIN;
    const openUpward =
      spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;

    const dropdownWidth = Math.max(rect.width, 180);
    const clampedLeft = Math.min(
      rect.left,
      viewportWidth - dropdownWidth - 8,
    );

    setDropdownPosition({
      width: dropdownWidth,
      left: clampedLeft,
      ...(openUpward
        ? {
            bottom: viewportHeight - rect.top + MARGIN,
            top: "auto",
            openUpward: true,
          }
        : {
            top: rect.bottom + MARGIN,
            bottom: "auto",
            openUpward: false,
          }),
      maxHeight: openUpward
        ? Math.min(spaceAbove, DROPDOWN_MAX_HEIGHT)
        : Math.min(spaceBelow, DROPDOWN_MAX_HEIGHT),
    });
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) updatePosition();
    setIsOpen((prev) => !prev);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on scroll / resize
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target))
        return;
      setIsOpen(false);
    };
    const handleResize = () => updatePosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, updatePosition]);

  const selectedOption = options.find((opt) => opt.value === value);
  const isActive = Boolean(value);

  const dropdown =
    isOpen && dropdownPosition
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(15,23,42,0.15)] flex flex-col overflow-hidden sr-animate-fade-in-slide"
            style={{
              top: dropdownPosition.openUpward
                ? "auto"
                : dropdownPosition.top,
              bottom: dropdownPosition.openUpward
                ? dropdownPosition.bottom
                : "auto",
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight,
            }}
          >
            <div className="overflow-y-auto overscroll-contain flex-1 py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm text-left flex items-center justify-between transition-colors ${
                    value === option.value
                      ? "bg-[rgba(18,95,226,0.08)] text-[#125fe2] font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check
                      size={14}
                      className="text-[#125fe2] flex-shrink-0 ml-2"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-600">
          {label}
        </label>
      )}

      {/* Trigger Button — matches sr-input dimensions */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`sr-input flex items-center justify-between gap-2 text-left
                   ${icon ? "pl-10" : "pl-3.5"} pr-3.5
                   ${
                     error
                       ? "sr-input-error"
                       : isActive
                         ? "!border-[#125fe2] !bg-[rgba(18,95,226,0.04)]"
                         : ""
                   }
                   ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                   ${isOpen ? "!border-[#125fe2] !shadow-[0_0_0_4px_rgba(18,95,226,0.16)]" : ""}`}
      >
        {/* Left icon (absolute positioned inside relative wrapper) */}
        {icon && (
          <span className="absolute left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}

        <span
          className={`flex-1 truncate text-[0.9375rem] ${
            selectedOption ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {selectedOption?.label || placeholder}
        </span>

        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${isActive ? "text-[#125fe2]" : "text-slate-400"}`}
        />
      </button>

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}

      {dropdown}
    </div>
  );
};

export default StyledSelect;