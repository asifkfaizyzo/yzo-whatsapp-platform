// src/components/settings/GoogleSheetsSettings.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Unlink,
  ShieldCheck,
  Zap,
  Save,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Layers,
  Lock,
  Loader2,
  ExternalLink,
  Download,
  FileSpreadsheet,
  Wrench,
} from "lucide-react";
import GoogleSheetsLogo from "./GoogleSheetsLogo";
import { useToast } from "../../context/ToastContext";
import {
  getGoogleSheetsStatus,
  getGoogleSheetsAuthUrl,
  disconnectGoogleSheets,
  getGoogleSheetsFields,
  addGoogleSheetsField,
  updateGoogleSheetsField,
  reorderGoogleSheetsFields,
  toggleGoogleSheetsField,
  deleteGoogleSheetsField,
  syncFields,
} from "../../services/googleSheets.service";

export default function GoogleSheetsSettings({ onBack } = {}) {
  const toast = useToast();

  // ── Connection State ──
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [connection, setConnection] = useState({
    isConnected: false,
    connectedAt: null,
    connectedBy: null,
    spreadsheetId: null,
    spreadsheetUrl: null,
  });

  // ── Fields State ──
  const [sheetFields, setSheetFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [savingField, setSavingField] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    fieldName: "",
    fieldType: "text",
    options: "",
    defaultValue: "",
    isRequired: false,
  });

  // ── Fetch Connection Status ──
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getGoogleSheetsStatus();
      if (res.success && res.data) {
        const isConnected = res.data.isConnected || res.data.status === "active";
        setConnection({
          isConnected,
          connectedAt: res.data.connectedAt || null,
          connectedBy: res.data.connectedBy || null,
          spreadsheetId: res.data.spreadsheetId || null,
          spreadsheetUrl: res.data.spreadsheetUrl || null,
        });
        if (isConnected) fetchFields();
      } else {
        setConnection({
          isConnected: false,
          connectedAt: null,
          connectedBy: null,
          spreadsheetId: null,
          spreadsheetUrl: null,
        });
      }
    } catch (err) {
      console.error("Fetch Google Sheets status error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // OAuth callback feedback (backend redirects with ?app=google-sheets&sheet=connected|error)
    const params = new URLSearchParams(window.location.search);
    if (params.get("sheet") === "connected") {
      toast.success("🎉 Google Sheets connected successfully!");
      cleanUrlParams();
    } else if (params.get("sheet") === "error") {
      toast.error("Failed to connect Google Sheets. Please try again.");
      cleanUrlParams();
    }
  }, []);

  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("sheet");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  };

  // ── Connect / Disconnect ──
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await getGoogleSheetsAuthUrl();
      if (res.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.message || "Failed to start Google Sheets connection");
        setConnecting(false);
      }
    } catch (err) {
      toast.error("Failed to start Google Sheets connection");
      setConnecting(false);
    }
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const res = await disconnectGoogleSheets();
      if (res.success) {
        toast.success("Google Sheets disconnected successfully.");
        setShowDisconnectModal(false);
        setSheetFields([]);
        fetchStatus();
      } else {
        toast.error(res.message || "Failed to disconnect Google Sheets");
      }
    } catch (err) {
      toast.error("Failed to disconnect Google Sheets");
    }
    setDisconnecting(false);
  };

  // ── Repair Sheet Structure ──
  const handleRepairSheet = async () => {
    setIsRepairing(true);
    try {
      const res = await syncFields();
      if (res?.success) {
        toast.success(res.message || "Sheet structure repaired successfully!");
      } else {
        toast.error(res?.message || "Failed to repair sheet structure");
      }
    } catch (err) {
      console.error("Repair Error:", err);
      toast.error(err?.message || "Failed to repair sheet structure");
    } finally {
      setIsRepairing(false);
    }
  };

  // ── Fields CRUD ──
  const fetchFields = async () => {
    setFieldsLoading(true);
    try {
      const res = await getGoogleSheetsFields();
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.fields || [];
        setSheetFields(list);
      }
    } catch (err) {
      console.error("Error fetching fields:", err);
    } finally {
      setFieldsLoading(false);
    }
  };

  const handleSaveField = async (e) => {
    e.preventDefault();
    if (!fieldForm.fieldName.trim()) {
      toast.error("Field name is required");
      return;
    }

    let optionsArray = null;
    if (fieldForm.fieldType === "dropdown" && fieldForm.options) {
      optionsArray =
        typeof fieldForm.options === "string"
          ? fieldForm.options
              .split(/[,\n]/)
              .map((opt) => opt.trim())
              .filter((opt) => opt.length > 0)
          : fieldForm.options;
    }

    const payload = {
      fieldName: fieldForm.fieldName.trim(),
      fieldType: fieldForm.fieldType,
      defaultValue: fieldForm.defaultValue || null,
      isRequired: Boolean(fieldForm.isRequired),
      options: optionsArray,
    };

    setSavingField(true);
    try {
      let res;
      if (editingField && editingField.id) {
        res = await updateGoogleSheetsField(editingField.id, payload);
      } else {
        res = await addGoogleSheetsField(payload);
      }

      if (res.success) {
        toast.success(editingField ? "Column updated successfully!" : "Column added successfully!");
        setShowFieldModal(false);
        setEditingField(null);
        setFieldForm({ fieldName: "", fieldType: "text", options: "", defaultValue: "", isRequired: false });
        fetchFields();
      } else {
        toast.error(res.message || "Failed to save column");
      }
    } catch (err) {
      console.error("Save field error:", err);
      toast.error(err.response?.data?.message || "Error saving column");
    }
    setSavingField(false);
  };

  const handleToggleField = async (fieldId, currentStatus) => {
    try {
      setSheetFields((prev) =>
        prev.map((f) => (f.id === fieldId ? { ...f, isActive: !currentStatus } : f))
      );
      const res = await toggleGoogleSheetsField(fieldId, !currentStatus);
      if (res.success) {
        toast.success("Field status updated!");
        fetchFields();
      } else {
        toast.error(res.message || "Failed to toggle");
        fetchFields();
      }
    } catch (err) {
      toast.error("Error toggling field");
      fetchFields();
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!window.confirm("Delete this custom field?")) return;
    try {
      const res = await deleteGoogleSheetsField(fieldId);
      if (res.success) {
        toast.success("Field deleted");
        fetchFields();
      } else {
        toast.error(res.message || "Failed to delete");
      }
    } catch (err) {
      toast.error("Error deleting field");
    }
  };

  const handleMoveField = async (index, direction) => {
    const newFields = [...sheetFields];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newFields.length) return;

    const temp = newFields[index];
    newFields[index] = newFields[targetIdx];
    newFields[targetIdx] = temp;

    const fieldOrders = newFields.map((field, idx) => ({
      fieldId: field.id,
      columnOrder: idx + 1,
    }));

    setSheetFields(newFields);

    try {
      const res = await reorderGoogleSheetsFields(fieldOrders);
      if (!res.success) {
        toast.error("Failed to reorder");
        fetchFields();
      }
    } catch (err) {
      toast.error("Error reordering");
      fetchFields();
    }
  };

  const isConnected = connection.isConnected;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="animate-spin text-[#0F9D58]" size={24} />
        <p className="text-xs text-slate-500 font-medium">Loading Google Sheets integration...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Back to Integrations Breadcrumb */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition mb-1"
        >
          <ArrowLeft size={14} />
          <span>Back to Integrations</span>
        </button>
      )}

      {/* Integration Header Card (Full Width) */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs shrink-0">
            <GoogleSheetsLogo className="w-9 h-9" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">Google Sheets</h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active & Syncing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Automatically export confirmed leads, orders, and payment statuses from WhatsApp directly to your Google Workspace spreadsheet in real time.
            </p>
          </div>
        </div>

                {/* Top Header Action - Show Disconnect ONLY when connected */}
        {isConnected && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowDisconnectModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition flex items-center gap-1.5"
            >
              <Unlink size={13} />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────── */}
      {/* 2-COLUMN BALANCED DESKTOP GRID */}
      {/* ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {isConnected ? (
            /* STATE 1: ALREADY CONNECTED */
            <>
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Your Google Account is Linked</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Real-time syncing active — confirmed contacts & payments are automatically logged to your spreadsheet.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Spreadsheet Quick Actions */}
                <div className="pt-2 p-4 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Your Connected Spreadsheet</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Access or download your live status records anytime.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${connection.spreadsheetId || ""}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors flex-1 sm:flex-none"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                      Open Sheet
                    </a>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${connection.spreadsheetId || ""}/export?format=csv`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors flex-1 sm:flex-none"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      CSV
                    </a>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${connection.spreadsheetId || ""}/export?format=xlsx`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors flex-1 sm:flex-none"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      Excel
                    </a>
                  </div>
                </div>

                <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                  Every confirmed WhatsApp lead, order, and payment status change is instantly appended as a new row — <strong>no manual data entry needed</strong>.
                </p>
              </div>

              {/* ── CONFIGURE SHEET COLUMNS CARD ── */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Layers size={15} className="text-[#0F9D58]" />
                      <span>Configure Sheet Columns</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Toggle defaults, add custom fields, and reorder columns for your business needs.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRepairSheet}
                      disabled={isRepairing}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                      title="Rebuild sheet headers if they get out of sync"
                    >
                      {isRepairing ? (
                        <RefreshCw size={13} className="animate-spin text-[#0F9D58]" />
                      ) : (
                        <Wrench size={13} />
                      )}
                      <span>{isRepairing ? "Repairing..." : "Repair Sheet Structure"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingField(null);
                        setFieldForm({ fieldName: "", fieldType: "text", options: "", defaultValue: "", isRequired: false });
                        setShowFieldModal(true);
                      }}
                      className="px-3.5 py-2 bg-[#0F9D58] hover:bg-[#0C7C45] text-white text-xs font-bold rounded-xl flex items-center gap-1 transition shadow-xs"
                    >
                      <Plus size={14} />
                      <span>Add Field</span>
                    </button>
                  </div>
                </div>

                {fieldsLoading ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 size={24} className="animate-spin text-[#0F9D58]" />
                    <span className="text-xs font-semibold">Loading fields...</span>
                  </div>
                ) : sheetFields.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-xs text-slate-400 italic">
                      No fields found. Try reconnecting your Google account.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                          <th className="p-3 text-center w-12">#</th>
                          <th className="p-3">Field Name</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Category</th>
                          <th className="p-3 text-center w-20">Active</th>
                          <th className="p-3 text-center w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sheetFields.map((field, index) => (
                          <tr key={field.id} className="hover:bg-slate-50/30 transition">
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(index, "up")}
                                  disabled={index === 0}
                                  className="p-0.5 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-20"
                                  title="Move Up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <span className="text-[10px] font-bold text-slate-600">{index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(index, "down")}
                                  disabled={index === sheetFields.length - 1}
                                  className="p-0.5 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-20"
                                  title="Move Down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-slate-800">
                              <span>{field.fieldName}</span>
                              {field.isRequired && <span className="text-rose-500 font-bold ml-1">*</span>}
                              <span className="block font-mono text-[9px] text-slate-400 mt-0.5 font-normal">
                                key: {field.fieldKey}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 capitalize">
                              <span>{field.fieldType === "yesno" ? "Yes/No" : field.fieldType}</span>
                              {field.fieldType === "dropdown" && field.options && (
                                <span
                                  className="block text-[9px] text-slate-400 mt-0.5 truncate max-w-[150px]"
                                  title={Array.isArray(field.options) ? field.options.join(", ") : field.options}
                                >
                                  {Array.isArray(field.options) ? field.options.join(", ") : field.options}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 font-bold text-[9px] uppercase ${
                                  field.fieldCategory === "system"
                                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                                    : field.fieldCategory === "default"
                                      ? "bg-slate-100 text-slate-600 border border-slate-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                }`}
                              >
                                {field.fieldCategory}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {field.fieldCategory === "system" ? (
                                <Lock size={12} className="inline text-slate-400" />
                              ) : (
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.isActive}
                                    onChange={() => handleToggleField(field.id, field.isActive)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500" />
                                </label>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {field.fieldCategory === "system" ? (
                                <span className="text-[10px] text-slate-400 italic">Locked</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingField(field);
                                      setFieldForm({
                                        fieldName: field.fieldName,
                                        fieldType: field.fieldType,
                                        options: Array.isArray(field.options)
                                          ? field.options.join("\n")
                                          : field.options || "",
                                        defaultValue: field.defaultValue || "",
                                        isRequired: field.isRequired || false,
                                      });
                                      setShowFieldModal(true);
                                    }}
                                    className="p-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg"
                                    title="Edit"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  {field.fieldCategory === "custom" && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteField(field.id)}
                                      className="p-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg"
                                      title="Delete"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                  <AlertCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Changes made here automatically update your live Google Sheet. Use{" "}
                    <button
                      type="button"
                      onClick={handleRepairSheet}
                      disabled={isRepairing}
                      className="font-bold text-blue-700 underline hover:text-blue-900 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Repair Sheet Structure
                    </button>{" "}
                    if headers ever get out of sync due to manual edits in Google Sheets.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* STATE 2: NOT CONNECTED */
            <div className="space-y-6">
              {/* Hero Action Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 sm:p-8 text-center space-y-6 shadow-2xs">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto">
                    <GoogleSheetsLogo className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Auto-Export Leads to Google Sheets
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Connect your Google account to automatically log every confirmed lead, order, and payment status into a live spreadsheet — zero manual data entry.
                  </p>
                </div>

                {/* Connect CTA */}
                <div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-8 py-3.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#0F9D58] to-[#34A853] text-white hover:opacity-95 transition inline-flex items-center gap-2.5 shadow-md hover:shadow-lg disabled:opacity-60"
                  >
                    {connecting ? (
                      <RefreshCw size={16} className="animate-spin text-white" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    <span>{connecting ? "Redirecting to Google..." : "Connect Google Account"}</span>
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2">
                    You will be redirected to Google to sign in and grant spreadsheet access.
                  </p>
                </div>

                {/* 3 Key Client Benefits */}
                <div className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                      <Zap size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Real-Time Sync</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Every lead and order status appears in your sheet instantly.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0C83FD] flex items-center justify-center mb-2.5">
                      <Layers size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Custom Columns</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Add, rename, and reorder columns to match your business workflow.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Your Data, Your Sheet</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Data goes to your own Google Workspace — export CSV/Excel anytime.
                    </p>
                  </div>
                </div>
              </div>

              {/* How It Works (Simple 3 Steps) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                  How it works
                </h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Connect Google</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Sign in with Google and approve spreadsheet access.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Sheet Auto-Created</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        A tracker spreadsheet is created with your configured columns.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Data Flows In</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Leads, orders, and payment updates are logged automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Sheet Preview & Highlights (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Live Sheet Preview Mockup */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-800">Live Sheet Preview</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Google Sheets
              </span>
            </div>

            {/* Simulated Spreadsheet */}
            <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-inner">
              <div className="bg-[#0F9D58] px-3 py-2 flex items-center gap-2">
                <FileSpreadsheet size={13} className="text-white" />
                <span className="text-[10px] font-bold text-white truncate">Lead & Order Tracker</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-1.5 text-[9px] font-bold text-slate-600 border-r border-slate-200">Name</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold text-slate-600 border-r border-slate-200">Phone</th>
                    <th className="px-2 py-1.5 text-[9px] font-bold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-[9px] text-slate-700 border-r border-slate-100">Rahul S.</td>
                    <td className="px-2 py-1.5 text-[9px] text-slate-500 font-mono border-r border-slate-100">+91 98•••</td>
                    <td className="px-2 py-1.5">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">PAID</span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-[9px] text-slate-700 border-r border-slate-100">Priya M.</td>
                    <td className="px-2 py-1.5 text-[9px] text-slate-500 font-mono border-r border-slate-100">+91 87•••</td>
                    <td className="px-2 py-1.5">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">PENDING</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-[9px] text-slate-700 border-r border-slate-100">Arjun K.</td>
                    <td className="px-2 py-1.5 text-[9px] text-slate-500 font-mono border-r border-slate-100">+91 76•••</td>
                    <td className="px-2 py-1.5">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">NEW LEAD</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed">
              Rows are appended automatically as customers interact on WhatsApp.
            </p>
          </div>

          {/* Integration Highlights Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3.5 text-left">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Integration Highlights
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sync Type</span>
                <span className="font-bold text-emerald-600">Real-Time Automatic</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Data Logged</span>
                <span className="font-semibold text-slate-800">Leads, Orders, Payments</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Column Layout</span>
                <span className="font-semibold text-slate-800">Fully Customizable</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Export Formats</span>
                <span className="font-semibold text-slate-800">CSV, Excel (.xlsx)</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Security</span>
                <span className="font-semibold text-slate-800">Google OAuth 2.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

           {/* ── Add/Edit Field Modal ── */}
      {showFieldModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative z-10 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingField ? `Edit Column (${editingField.fieldName})` : "Add Custom Column"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowFieldModal(false);
                  setEditingField(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Column Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={editingField?.fieldCategory === "system"}
                  placeholder="e.g. Delivery Method, Priority, Doctor"
                  value={fieldForm.fieldName}
                  onChange={(e) => setFieldForm({ ...fieldForm, fieldName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Type
                </label>
                <select
                  value={fieldForm.fieldType}
                  disabled={editingField?.fieldCategory === "system"}
                  onChange={(e) => setFieldForm({ ...fieldForm, fieldType: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 bg-white"
                >
                  <option value="text">Text (General string)</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown (Select list)</option>
                  <option value="phone">Phone Number</option>
                  <option value="email">Email Address</option>
                  <option value="boolean">Boolean (Yes/No)</option>
                </select>
              </div>

              {fieldForm.fieldType === "dropdown" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dropdown Options (Comma-separated) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. Standard Delivery, Express 24h, Store Pickup"
                    value={fieldForm.options}
                    onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Value (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard Delivery"
                  value={fieldForm.defaultValue}
                  onChange={(e) => setFieldForm({ ...fieldForm, defaultValue: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isRequiredCheckbox"
                  checked={fieldForm.isRequired || false}
                  onChange={(e) => setFieldForm({ ...fieldForm, isRequired: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="isRequiredCheckbox" className="text-xs text-slate-700">
                  Required field (cannot be empty)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowFieldModal(false);
                    setEditingField(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingField}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F9D58] hover:bg-[#0C7C45] rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingField && <RefreshCw size={12} className="animate-spin" />}
                  <span>{editingField ? "Update Column" : "Create Column"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Disconnect Modal ── */}
      {showDisconnectModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 relative z-10 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800">Disconnect Google Sheets?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Disconnecting will stop automatic lead & order syncing to your spreadsheet. Your existing sheet data will not be deleted. You can reconnect anytime.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={disconnecting}
                onClick={() => setShowDisconnectModal(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disconnecting}
                onClick={handleDisconnectConfirm}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {disconnecting && <RefreshCw size={13} className="animate-spin" />}
                <span>{disconnecting ? "Disconnecting..." : "Yes, Disconnect"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}