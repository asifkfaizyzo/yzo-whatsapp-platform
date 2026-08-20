// src/pages/dashboard/Automation.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Layers,
  Star,
  X,
  Hash,
  Loader2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import flowService from "../../services/flow.service";
import { getWhatsappStatus } from "../../services/tenant.service";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import WhatsAppRequiredModal from "../../components/whatsapp/WhatsAppRequiredModal";
import WhatsAppConnect from "../../components/whatsapp/WhatsAppConnect";

// ─────────────────────────────────────────────
// Create Flow Modal (unchanged)
// ─────────────────────────────────────────────
function CreateFlowModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter a flow name");
      return;
    }

    try {
      setCreating(true);
      const res = await flowService.createFlow({ name: name.trim() });
      onCreated(res.data.id);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create flow");
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#EAF2FE]">
              <Bot size={14} className="text-[#125EF2]" />
            </div>
            <p className="text-sm font-bold text-slate-800">Create New Flow</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              Flow Name
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Order Flow, Support Flow..."
              autoFocus
              className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none transition
                ${error ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-[#125EF2]"}`}
            />
            {error && <p className="text-xs text-red-500 mt-1.5">⚠️ {error}</p>}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              💡 You can add keywords and configure nodes after creating the
              flow.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#125EF2] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
            {creating ? "Creating..." : "Create & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Keyword Modal (unchanged — keep your existing code)
// ─────────────────────────────────────────────
function KeywordModal({ flow, onClose, onRefresh }) {
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadKeywords();
  }, [flow.id]);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      const res = await flowService.getKeywords(flow.id);
      setKeywords(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    setError("");
    const raw = input.trim();
    if (!raw) return;

    const list = raw
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);
    if (list.length === 0) return;

    const existing = keywords.map((k) => k.keyword.toLowerCase());
    const duplicates = list.filter((k) => existing.includes(k));
    if (duplicates.length > 0) {
      setError(`Already exists: ${duplicates.join(", ")}`);
      return;
    }

    try {
      setAdding(true);
      await flowService.addKeywords(
        flow.id,
        list.map((k) => ({
          keyword: k,
          category: category.trim().toLowerCase() || null,
        })),
      );
      setInput("");
      await loadKeywords();
      onRefresh();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add keywords");
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAdd();
  };

  const handleRemove = async (keywordId) => {
    try {
      setRemovingId(keywordId);
      await flowService.removeKeyword(keywordId);
      await loadKeywords();
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingId(null);
    }
  };

  const groupedKeywords = keywords.reduce((acc, k) => {
    const cat = k.category || "uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(k);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[420px] mx-4 flex flex-col overflow-hidden max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-[#EAF2FE]">
              <Hash size={12} className="text-[#125EF2]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-800 leading-tight">
                Manage Keywords
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {flow.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 transition"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 flex-1 overflow-y-auto space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              💡 Messages matching a keyword will trigger this flow. Separate
              multiple keywords with commas.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Category{" "}
              <span className="text-slate-400 font-normal ml-1">
                (optional)
              </span>
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value.toLowerCase())}
              placeholder="e.g. greeting, support, order"
              className="w-full text-[13px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#125EF2] transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Add Keywords
            </label>
            <div className="flex gap-1.5">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g. order, my order, track"
                className={`flex-1 text-[13px] border rounded-lg px-3 py-2 focus:outline-none transition
                  ${error ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-[#125EF2]"}`}
              />
              <button
                onClick={handleAdd}
                disabled={adding || !input.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-[#125EF2] text-white text-[12px] font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                Add
              </button>
            </div>

            {category && input && (
              <p className="text-[10px] text-slate-400 mt-1">
                → adding under{" "}
                <span className="font-semibold text-[#125EF2] ml-1">
                  {category}
                </span>
              </p>
            )}
            {error && (
              <p className="text-[11px] text-red-500 mt-1">⚠️ {error}</p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-600">
                Current Keywords
              </label>
              <span className="text-[10px] text-slate-400">
                {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin text-slate-300" />
              </div>
            )}

            {!loading && keywords.length === 0 && (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
                <Hash size={18} className="mx-auto text-slate-300 mb-1" />
                <p className="text-[11px] text-slate-400">No keywords yet</p>
              </div>
            )}

            {!loading && keywords.length > 0 && (
              <div className="space-y-2.5">
                {Object.entries(groupedKeywords).map(([cat, kws]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {cat}
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[9px] text-slate-400">
                        {kws.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {kws.map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-slate-100 border border-slate-200 rounded-md group hover:border-red-200 hover:bg-red-50 transition"
                        >
                          <span className="text-[11px] font-medium text-slate-600 group-hover:text-red-600 transition">
                            {k.keyword}
                          </span>
                          <button
                            onClick={() => handleRemove(k.id)}
                            disabled={removingId === k.id}
                            className="p-0.5 text-slate-400 hover:text-red-500 transition disabled:opacity-50"
                          >
                            {removingId === k.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <X size={10} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-[12px] font-semibold rounded-lg hover:bg-slate-100 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Automation Page
// ─────────────────────────────────────────────
export default function Automation() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keywordFlow, setKeywordFlow] = useState(null);

  // ✅ WhatsApp connection states (mirrors Broadcasts.jsx)
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [flowsRes, statusRes] = await Promise.all([
        flowService.getAllFlows(),
        getWhatsappStatus(),
      ]);
      setFlows(flowsRes.data || []);
      if (statusRes.success) {
        setIsWhatsAppConnected(!!statusRes.data?.isConnected);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load flows')
    } finally {
      setLoading(false);
    }
  };

  // ✅ Guarded create — checks WhatsApp before allowing new flow
  const handleNewFlowClick = () => {
    if (!isWhatsAppConnected) {
      setShowConnectModal(true);
      return;
    }
    setShowCreateModal(true);
  };

  const handleCreated = (flowId) => {
    navigate(`/dashboard/automation/builder/${flowId}`);
  };

  // ✅ Guarded edit — block navigation to builder if not connected
  const handleEditFlow = (flowId) => {
    if (!isWhatsAppConnected) {
      setShowConnectModal(true);
      return;
    }
    navigate(`/dashboard/automation/builder/${flowId}`);
  };

  // ✅ Guarded: Open keywords modal
  const handleOpenKeywords = (flow) => {
    if (!isWhatsAppConnected) {
      setShowConnectModal(true);
      return;
    }
    setKeywordFlow(flow);
  };

 // Delete node from config panel
const handleDeleteNode = async () => {
  const ok = await confirm({
    type: 'danger',
    title: 'Delete Node',
    message: 'Are you sure you want to delete this node?',
    detail: 'Any connections to this node will also be removed.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  });

  if (!ok) return;

  deleteElements({ nodes: [{ id: node.id }] });
  toast.success("Node deleted successfully");
  onClose();
};

  const handleToggle = async (flowId, isActive) => {
    if (!isWhatsAppConnected) {
      setShowConnectModal(true);
      return;
    }
    try {
      await flowService.toggleFlow(flowId, !isActive);
      toast.success(isActive ? "Flow deactivated" : "Flow activated");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update flow status");
    }
  };

  const handleSetDefault = async (flowId) => {
    if (!isWhatsAppConnected) {
      setShowConnectModal(true);
      return;
    }
    try {
      await flowService.setDefault(flowId);
      toast.success("Flow set as default");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to set default flow");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Create Flow Modal */}
      {showCreateModal && (
        <CreateFlowModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Keyword Modal */}
      {keywordFlow && (
        <KeywordModal
          flow={keywordFlow}
          onClose={() => setKeywordFlow(null)}
          onRefresh={loadData}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Automation Flows
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create chatbot flows triggered by keywords
          </p>
        </div>
        <button
          onClick={handleNewFlowClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#125EF2] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          New Flow
        </button>
      </div>

      {/* ✅ WhatsApp Disconnected Warning Banner (same style as Broadcasts) */}
      {!isWhatsAppConnected && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                WhatsApp Account Not Connected
              </h4>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Connect your WhatsApp Business Number in Settings to create and
                run automation flows for incoming messages.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowWhatsAppSetup(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap self-start sm:self-auto shrink-0"
          >
            Connect WhatsApp
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && flows.length === 0 && (
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-2xl">
          <Bot size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-semibold">No flows yet</p>
          <p className="text-slate-400 text-sm mt-1">
            {isWhatsAppConnected
              ? "Create your first automation flow"
              : "Connect WhatsApp first to create automation flows"}
          </p>
          <button
            onClick={handleNewFlowClick}
            className="mt-4 px-4 py-2 bg-[#125EF2] text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            + Create Flow
          </button>
        </div>
      )}

      {/* ── Flow List ── */}
      {!loading && flows.length > 0 && (
        <div className="space-y-3">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between hover:shadow-sm transition"
            >
              {/* Left: Info */}
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#EAF2FE] border border-[#CFE0FD]">
                  <Bot size={20} className="text-[#125EF2]" />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-slate-800">{flow.name}</h2>

                    {flow.isDefault && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full">
                        <Star size={10} />
                        Default
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                        flow.isActive
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      {flow.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Clickable Keywords */}
                  <button
                    onClick={() => handleOpenKeywords(flow)}
                    className="flex items-center gap-1.5 mt-1.5 flex-wrap group text-left"
                  >
                    <Tag
                      size={12}
                      className="text-slate-400 group-hover:text-[#125EF2] transition shrink-0"
                    />
                    {flow.keywords && flow.keywords.length > 0 ? (
                      <>
                        {flow.keywords.slice(0, 4).map((k) => (
                          <span
                            key={k.id}
                            className="px-2 py-0.5 bg-slate-100 text-slate-600
                              text-xs rounded-full group-hover:bg-[#EAF2FE]
                              group-hover:text-[#125EF2] transition"
                          >
                            {k.keyword}
                          </span>
                        ))}
                        {flow.keywords.length > 4 && (
                          <span className="text-xs text-slate-400">
                            +{flow.keywords.length - 4} more
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 group-hover:text-[#125EF2] transition">
                        + Add keywords
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1 mt-1">
                    <Layers size={11} className="text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {flow._count?.nodes || 0} nodes
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenKeywords(flow)}
                  className="flex items-center gap-1.5 px-3 py-1.5
                    bg-slate-50 border border-slate-200 text-slate-500
                    text-xs font-semibold rounded-lg
                    hover:bg-[#EAF2FE] hover:border-[#CFE0FD]
                    hover:text-[#125EF2] transition"
                >
                  <Hash size={13} />
                  Keywords
                </button>

                {!flow.isDefault && (
                  <button
                    onClick={() => handleSetDefault(flow.id)}
                    title="Set as default"
                    className="p-2 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition"
                  >
                    <Star size={16} />
                  </button>
                )}

                <button
                  onClick={() => handleToggle(flow.id, flow.isActive)}
                  title={flow.isActive ? "Deactivate" : "Activate"}
                  className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-[#125EF2] transition"
                >
                  {flow.isActive ? (
                    <ToggleRight size={20} className="text-[#125EF2]" />
                  ) : (
                    <ToggleLeft size={20} />
                  )}
                </button>

                <button
                  onClick={() => handleEditFlow(flow.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF2FE] border border-[#CFE0FD] text-[#125EF2] text-xs font-semibold rounded-lg hover:bg-[#CFE0FD] transition"
                >
                  <Pencil size={13} />
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(flow)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-100 transition"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ WhatsApp Connection Required Modal */}
      <WhatsAppRequiredModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={() => setShowWhatsAppSetup(true)}
        title="WhatsApp Number Required"
        description="To create and run automation flows, you need to connect your official WhatsApp Business Number first."
        feature="Automation Flows"
      />

      {/* ✅ WhatsApp Setup / Connect Modal */}
      {showWhatsAppSetup && (
        <WhatsAppConnect
          onSuccess={() => {
            setShowWhatsAppSetup(false);
            setIsWhatsAppConnected(true);
            loadData();
            toast.success("WhatsApp connected successfully!");
          }}
          onClose={() => setShowWhatsAppSetup(false)}
        />
      )}
    </div>
  );
}
