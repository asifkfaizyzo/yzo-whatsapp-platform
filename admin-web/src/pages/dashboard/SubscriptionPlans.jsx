import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  Check,
  X,
  Users,
  Send,
  Zap,
  Megaphone,
  Globe,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Table2,
  Building2,
  Cloud,
  Star,
  PackageOpen,
  Layers,
  SlidersHorizontal,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import {
  getPlans,
  createPlan,
  updatePlan,
  togglePlanStatus,
  deletePlan,
  getFeatures,
  createFeature,
} from "../../lib/planService";

/* ────────────────────────────────────────────────────────────────
   Static config — presentation & icons
   ──────────────────────────────────────────────────────────────── */

const INTEGRATIONS = [
  "Shopify",
  "Razorpay",
  "Google Sheets",
  "Zoho CRM",
  "HubSpot",
  "Salesforce",
];

const INTEGRATION_ICON = {
  Shopify: ShoppingBag,
  Razorpay: CreditCard,
  "Google Sheets": Table2,
  "Zoho CRM": Building2,
  HubSpot: Users,
  Salesforce: Cloud,
};

const LIMIT_FIELDS = [
  { name: "maxAgents", label: "Agents", placeholder: "Max Agents *", icon: Users, helper: "Seats for your team", required: true },
  { name: "maxBroadcasts", label: "Broadcasts", placeholder: "Broadcasts / Month", icon: Send, helper: "Blank = unlimited" },
  { name: "maxAutomations", label: "Automations", placeholder: "Automation Triggers", icon: Zap, helper: "Blank = unlimited" },
  { name: "maxCampaigns", label: "Campaigns", placeholder: "Campaigns", icon: Megaphone, helper: "Blank = unlimited" },
  { name: "maxApiCalls", label: "API Calls", placeholder: "API Calls", icon: Globe, helper: "Blank = unlimited" },
  { name: "maxAiCredits", label: "AI Credits", placeholder: "AI Credits", icon: Sparkles, helper: "Blank = none" },
];

const defaultForm = {
  name: "",
  description: "",
  monthlyPrice: "",
  annualPrice: "",
  status: "ACTIVE",
  isPopular: false,
  maxAgents: "",
  maxBroadcasts: "",
  maxAutomations: "",
  maxCampaigns: "",
  maxApiCalls: "",
  maxAiCredits: "",
  featureIds: [],
  integrations: [],
};

const currency = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function formatLimit(value) {
  if (value === null || value === undefined || value === "") return "Unlimited";
  return Number(value).toLocaleString("en-IN");
}

/* ────────────────────────────────────────────────────────────────
   Presentational Components
   ──────────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, tone = "blue", hint }) {
  const tones = {
    blue: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };
  return (
    <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
          <span>{label}</span>
          <div className={`p-2 rounded-xl border shrink-0 ${tones[tone]}`}>
            <Icon size={18} />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-800 mt-3 tabular-nums">
          {value}
        </div>
      </div>
      {hint && <p className="text-[11px] text-slate-400 font-medium mt-3">{hint}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-hidden shadow-xs">
      <div className="animate-pulse space-y-4">
        <div className="flex justify-between">
          <div className="h-5 w-28 bg-slate-100 rounded-lg" />
          <div className="h-5 w-14 bg-slate-100 rounded-full" />
        </div>
        <div className="h-9 w-32 bg-slate-100 rounded-xl" />
        <div className="h-3 w-full bg-slate-100 rounded" />
        <div className="space-y-2 pt-2">
          <div className="h-3 w-3/4 bg-slate-100 rounded" />
          <div className="h-3 w-2/3 bg-slate-100 rounded" />
          <div className="h-3 w-1/2 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-full bg-slate-100 rounded-xl mt-4" />
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
          : "bg-rose-50 text-rose-700 border-rose-200/60"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* Dropdown menu for card-level actions */
function ActionsMenu({ plan, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        title="Actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 w-48 bg-white rounded-2xl border border-slate-200
                     shadow-xl py-2 z-30 origin-top-right animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Plan Options
          </div>
          <button
            onClick={() => { setOpen(false); onEdit(plan); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Pencil size={14} className="text-indigo-600" /> Edit Plan Details
          </button>
          <button
            onClick={() => { setOpen(false); onToggle(plan.id); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Power size={14} className={plan.status === "ACTIVE" ? "text-amber-500" : "text-emerald-500"} />
            {plan.status === "ACTIVE" ? "Deactivate Plan" : "Activate Plan"}
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => { setOpen(false); onDelete(plan.id, plan.name); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 size={14} /> Delete Plan
          </button>
        </div>
      )}
    </div>
  );
}

/* Full plan card — used in grid view */
function PlanCard({ plan, popular, onEdit, onToggle, onDelete }) {
  const active = plan.status === "ACTIVE";
  const featureNames = plan.features.map((pf) => pf.feature.name);
  const visibleFeatures = featureNames.slice(0, 6);
  const extraCount = featureNames.length - visibleFeatures.length;
  const savings =
    plan.annualPrice && plan.monthlyPrice
      ? Math.round((1 - plan.annualPrice / plan.monthlyPrice) * 100)
      : null;

  return (
    <div
      className={`relative flex flex-col bg-white rounded-2xl border p-6 transition-all duration-300
                 hover:-translate-y-1 hover:shadow-xl
                 ${popular ? "border-indigo-300 shadow-indigo-500/10 shadow-lg ring-2 ring-indigo-500/20" : "border-slate-100 shadow-sm"}
                 ${!active ? "opacity-75" : ""}`}
    >
      {/* Popular Badge */}
      {popular && (
        <span
          className="absolute -top-3.5 left-6 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600
                     text-white text-xs font-bold px-3.5 py-1 rounded-full shadow-md"
        >
          <Star size={12} fill="white" /> Most Popular Tier
        </span>
      )}

      {/* Header */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
          {plan.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{plan.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <StatusPill status={plan.status} />
          <ActionsMenu plan={plan} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
        </div>
      </div>

      {/* Pricing */}
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {currency(plan.monthlyPrice)}
        </span>
        <span className="text-slate-400 text-xs font-medium">/month</span>
      </div>
      {plan.annualPrice ? (
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-xs text-indigo-600 font-semibold">
            {currency(plan.annualPrice)}/mo billed annually
          </p>
          {savings > 0 && (
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
              Save {savings}%
            </span>
          )}
        </div>
      ) : (
        <div className="h-5" />
      )}

      {/* Features checklist */}
      {featureNames.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Included Features</p>
          {visibleFeatures.map((name) => (
            <div key={name} className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Check size={10} strokeWidth={3} />
              </span>
              {name}
            </div>
          ))}
          {extraCount > 0 && (
            <p className="text-xs text-slate-400 font-medium pl-6">+{extraCount} additional features</p>
          )}
        </div>
      )}

      {/* Limits Grid */}
      <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
        <LimitRow icon={Users} label="Agents" value={formatLimit(plan.maxAgents)} />
        <LimitRow icon={Send} label="Broadcasts" value={formatLimit(plan.maxBroadcasts)} />
        <LimitRow icon={Zap} label="Automations" value={formatLimit(plan.maxAutomations)} />
        <LimitRow icon={Megaphone} label="Campaigns" value={formatLimit(plan.maxCampaigns)} />
        <LimitRow icon={Globe} label="API Calls" value={formatLimit(plan.maxApiCalls)} />
        <LimitRow icon={Sparkles} label="AI Credits" value={plan.maxAiCredits ? formatLimit(plan.maxAiCredits) : "None"} />
      </div>

      {/* Integrations */}
      {plan.integrations.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
          {plan.integrations.map((i) => {
            const Icon = INTEGRATION_ICON[i.name] || Building2;
            return (
              <span
                key={i.id}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600
                           bg-slate-50 border border-slate-100 pl-2 pr-2.5 py-1 rounded-full shadow-xs"
              >
                <Icon size={11} className="text-indigo-500" /> {i.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer subscriber meta */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-400">
        <span className="flex items-center gap-1 text-slate-500">
          <Building2 size={13} className="text-slate-400" />
          {plan._count?.tenants ?? 0} active subscribers
        </span>
      </div>
    </div>
  );
}

function LimitRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      <Icon size={13} className="text-slate-400 shrink-0" />
      <span className="text-slate-500 text-[11px] font-medium">{label}:</span>
      <span className="ml-auto font-bold text-slate-800 text-xs">{value}</span>
    </div>
  );
}

/* Compact row — used in list view */
function PlanRow({ plan, popular, onEdit, onToggle, onDelete }) {
  return (
    <div
      className="flex items-center justify-between gap-4 bg-white border border-slate-100 rounded-2xl px-6 py-4
                 hover:shadow-md transition-all duration-200"
    >
      <div className="min-w-[180px] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
          {plan.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-800 text-sm">{plan.name}</p>
            {popular && <Star size={13} className="text-indigo-600" fill="#4F46E5" />}
          </div>
          <StatusPill status={plan.status} />
        </div>
      </div>

      <div className="text-sm font-extrabold text-slate-800 w-32">
        {currency(plan.monthlyPrice)}
        <span className="text-slate-400 font-medium text-xs"> /mo</span>
      </div>

      <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 flex-1">
        {plan.features.slice(0, 4).map((pf) => (
          <span key={pf.id} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-indigo-100">
            {pf.feature.name}
          </span>
        ))}
        {plan.features.length > 4 && (
          <span className="text-xs text-slate-400 font-semibold">+{plan.features.length - 4} more</span>
        )}
      </div>

      <div className="hidden sm:block text-xs font-semibold text-slate-500 w-28 text-center">
        {plan._count?.tenants ?? 0} Tenants
      </div>

      <ActionsMenu plan={plan} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────────── */

export default function SubscriptionPlans() {
  const confirm = useConfirm();
  const toast = useToast();

  const [plans, setPlans] = useState([]);
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const [newFeatureName, setNewFeatureName] = useState("");
  const [addingFeature, setAddingFeature] = useState(false);
  const [featureError, setFeatureError] = useState("");

  // Toolbar View State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState("grid");
  const [featureSearch, setFeatureSearch] = useState("");

  // Stats
  const activePlans = plans.filter((p) => p.status === "ACTIVE").length;
  const inactivePlans = plans.filter((p) => p.status === "INACTIVE").length;
  const avgMonthly = plans.length
    ? Math.round(plans.reduce((sum, p) => sum + Number(p.monthlyPrice || 0), 0) / plans.length)
    : 0;
  const totalTenants = plans.reduce((sum, p) => sum + (p._count?.tenants ?? 0), 0);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    const [plansRes, featuresRes] = await Promise.all([
      getPlans(),
      getFeatures(),
    ]);
    if (plansRes.success) setPlans(plansRes.data);
    if (featuresRes.success) setAvailableFeatures(featuresRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & sorted plans
  const visiblePlans = useMemo(() => {
    let list = [...plans];
    if (statusFilter !== "ALL") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "price-asc") list.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    else if (sortBy === "price-desc") list.sort((a, b) => b.monthlyPrice - a.monthlyPrice);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [plans, statusFilter, searchQuery, sortBy]);

  const popularPlanId = useMemo(() => {
    const popular = plans.find((p) => p.isPopular === true);
    return popular ? popular.id : null;
  }, [plans]);

  const filteredFeatures = useMemo(() => {
    if (!featureSearch.trim()) return availableFeatures;
    const q = featureSearch.trim().toLowerCase();
    return availableFeatures.filter((f) => f.name.toLowerCase().includes(q));
  }, [availableFeatures, featureSearch]);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(defaultForm);
    setError("");
    setFeatureError("");
    setFeatureSearch("");
    setShowModal(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice || "",
      status: plan.status,
      isPopular: Boolean(plan.isPopular),
      maxAgents: plan.maxAgents,
      maxBroadcasts: plan.maxBroadcasts || "",
      maxAutomations: plan.maxAutomations || "",
      maxCampaigns: plan.maxCampaigns || "",
      maxApiCalls: plan.maxApiCalls || "",
      maxAiCredits: plan.maxAiCredits || "",
      featureIds: plan.features.map((pf) => pf.feature.id),
      integrations: plan.integrations.map((i) => i.name),
    });
    setError("");
    setFeatureError("");
    setFeatureSearch("");
    setShowModal(true);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleFeature = (featureId) => {
    setForm((prev) => ({
      ...prev,
      featureIds: prev.featureIds.includes(featureId)
        ? prev.featureIds.filter((id) => id !== featureId)
        : [...prev.featureIds, featureId],
    }));
  };

  const toggleIntegration = (name) => {
    setForm((prev) => ({
      ...prev,
      integrations: prev.integrations.includes(name)
        ? prev.integrations.filter((i) => i !== name)
        : [...prev.integrations, name],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.monthlyPrice || !form.maxAgents) {
      setError("Plan name, monthly price, and max agents are required.");
      return;
    }
    if (form.featureIds.length === 0) {
      setError("Select at least one feature.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      isPopular: Boolean(form.isPopular),
      monthlyPrice: parseFloat(form.monthlyPrice),
      annualPrice: form.annualPrice ? parseFloat(form.annualPrice) : null,
      maxAgents: parseInt(form.maxAgents),
      maxBroadcasts: form.maxBroadcasts ? parseInt(form.maxBroadcasts) : null,
      maxAutomations: form.maxAutomations ? parseInt(form.maxAutomations) : null,
      maxCampaigns: form.maxCampaigns ? parseInt(form.maxCampaigns) : null,
      maxApiCalls: form.maxApiCalls ? parseInt(form.maxApiCalls) : null,
      maxAiCredits: form.maxAiCredits ? parseInt(form.maxAiCredits) : null,
    };

    const res = editingPlan
      ? await updatePlan(editingPlan.id, payload)
      : await createPlan(payload);

    if (res.success) {
      toast.success(editingPlan ? "Plan updated successfully!" : "Plan created successfully!");
      await loadData();
      setShowModal(false);
    } else {
      setError(res.message || "Something went wrong.");
    }

    setSaving(false);
  };

  const handleToggleStatus = async (id) => {
    const res = await togglePlanStatus(id);
    if (res.success) {
      toast.success("Plan status updated.");
      await loadData();
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      type: "danger",
      title: "Delete Plan?",
      message: `Permanently delete "${name}"?`,
      detail: "All tenants on this plan will need to be migrated. This cannot be undone.",
      confirmLabel: "Delete Plan",
    });
    if (!ok) return;
    const res = await deletePlan(id);
    if (res.success) {
      toast.success(`Plan "${name}" deleted.`);
      await loadData();
    } else {
      toast.error(res.message);
    }
  };

  const handleAddFeature = async () => {
    if (!newFeatureName.trim()) return;
    setAddingFeature(true);
    setFeatureError("");

    const res = await createFeature(newFeatureName.trim());

    if (res.success) {
      setAvailableFeatures((prev) => [...prev, res.data]);
      setForm((prev) => ({
        ...prev,
        featureIds: [...prev.featureIds, res.data.id],
      }));
      setNewFeatureName("");
      toast.success("Feature added successfully!");
    } else {
      setFeatureError(res.message || "Failed to add feature.");
    }

    setAddingFeature(false);
  };

  const previewSavings =
    form.annualPrice && form.monthlyPrice
      ? Math.round((1 - Number(form.annualPrice) / Number(form.monthlyPrice)) * 100)
      : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
            <Layers size={16} />
            <span>Product & Tier Catalog</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Subscription Plans & Limits
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Configure customer tier packages, feature flags, usage limits (Agents, Broadcasts, AI Credits), and annual discount pricing.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 active:scale-[0.98] self-start md:self-auto"
        >
          <Plus size={16} />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={PackageOpen} label="Total Plan Tiers" value={plans.length} tone="blue" />
        <StatCard icon={Power} label="Active Tiers" value={activePlans} tone="emerald" />
        <StatCard icon={X} label="Inactive Tiers" value={inactivePlans} tone="rose" />
        <StatCard
          icon={Users}
          label="Total Subscribers"
          value={totalTenants}
          tone="amber"
          hint={plans.length ? `Avg. ${currency(avgMonthly)}/mo per plan` : undefined}
        />
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plan name or features..."
            className="w-full text-xs rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition bg-slate-50/50 focus:bg-white"
          />
        </div>

        {/* Filters & View Switcher */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <SlidersHorizontal size={14} />
            <span>Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none bg-white text-slate-700 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs font-semibold rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none bg-white text-slate-700 focus:border-indigo-500 transition shadow-sm"
          >
            <option value="name">Sort by Name</option>
            <option value="price-asc">Price (Low → High)</option>
            <option value="price-desc">Price (High → Low)</option>
          </select>

          <div className="inline-flex bg-slate-100 rounded-xl p-1 border border-slate-200 ml-auto md:ml-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition ${
                viewMode === "grid" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition ${
                viewMode === "list" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400 hover:text-slate-700"
              }`}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Plan Grid / List Display */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <PackageOpen size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Subscription Plans Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Set up pricing tiers, agent seats, and feature access flags for your customers.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md"
          >
            <Plus size={15} /> Create First Plan
          </button>
        </div>
      ) : visiblePlans.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-100">
          <p className="text-slate-400 text-xs font-medium">No plans match your current search query or status filter.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visiblePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              popular={plan.id === popularPlanId || Boolean(plan.isPopular)}
              onEdit={openEdit}
              onToggle={handleToggleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePlans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              popular={plan.id === popularPlanId || Boolean(plan.isPopular)}
              onEdit={openEdit}
              onToggle={handleToggleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Plan Modal via React Portal ── */}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">

              {/* Modal Header */}
              <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <PackageOpen size={20} className="text-indigo-600" />
                    <span>{editingPlan ? `Edit Tier — ${editingPlan.name}` : "Create Subscription Plan"}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure pricing, limit quotas, feature flags, and integrations for this tier.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Split Form + Live Preview */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid lg:grid-cols-[1fr_320px]">

                  {/* Left Column: Form Controls */}
                  <div className="p-6 space-y-7 border-r border-slate-100">
                    {error && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs px-4 py-3 rounded-xl font-medium flex items-center gap-2">
                        <XCircle size={16} />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* Section 1: Basic Info */}
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                        <PackageOpen size={14} />
                        <span>1. General Tier Info</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Plan Name (e.g. Professional) *"
                          className="border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                        />
                        <select
                          name="status"
                          value={form.status}
                          onChange={handleChange}
                          className="border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold bg-white"
                        >
                          <option value="ACTIVE">Status: Active</option>
                          <option value="INACTIVE">Status: Inactive</option>
                        </select>
                        <textarea
                          name="description"
                          value={form.description}
                          onChange={handleChange}
                          placeholder="Plan summary / description..."
                          rows={2}
                          className="border border-slate-200 rounded-xl p-3 text-xs sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        
                        {/* Manual Popularity Selector */}
                        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 cursor-pointer bg-slate-50/50 hover:bg-slate-100/50 transition text-xs font-semibold text-slate-700 sm:col-span-2">
                          <input
                            type="checkbox"
                            name="isPopular"
                            checked={form.isPopular}
                            onChange={(e) => setForm((prev) => ({ ...prev, isPopular: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <Star size={14} className="text-amber-500" fill="#F59E0B" />
                          <span>Mark as "Most Popular / Recommended" Tier</span>
                        </label>
                      </div>
                    </section>

                    {/* Section 2: Pricing */}
                    <section className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                        <CreditCard size={14} />
                        <span>2. Pricing & Discounts</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          name="monthlyPrice"
                          value={form.monthlyPrice}
                          onChange={handleChange}
                          placeholder="Monthly Price (₹) *"
                          type="number"
                          className="border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800"
                        />
                        <input
                          name="annualPrice"
                          value={form.annualPrice}
                          onChange={handleChange}
                          placeholder="Annual Price / Month (₹)"
                          type="number"
                          className="border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800"
                        />
                      </div>
                      {previewSavings !== null && (
                        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-indigo-100">
                          <Sparkles size={14} />
                          {previewSavings > 0 ? (
                            <span>Annual billing saves clients <b>{previewSavings}%</b> compared to monthly.</span>
                          ) : (
                            <span>Annual price must be lower than monthly to calculate savings.</span>
                          )}
                        </div>
                      )}
                    </section>

                    {/* Section 3: Usage Limits */}
                    <section className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                          <Zap size={14} />
                          <span>3. Quotas & Limits</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Leave empty = Unlimited</span>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {LIMIT_FIELDS.map(({ name, icon: Icon, placeholder, helper }) => (
                          <div
                            key={name}
                            className="border border-slate-200 rounded-xl p-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 bg-slate-50/50"
                          >
                            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                              <Icon size={13} />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{placeholder.replace(" *", "")}</span>
                            </div>
                            <input
                              name={name}
                              value={form[name]}
                              onChange={handleChange}
                              type="number"
                              placeholder="Unlimited"
                              className="w-full text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                            />
                            <p className="text-[10px] text-slate-400 mt-0.5">{helper}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Section 4: Features */}
                    <section className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                          <ShieldCheck size={14} />
                          <span>4. Included Features ({form.featureIds.length} Selected)</span>
                        </div>
                      </div>

                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                        <input
                          value={featureSearch}
                          onChange={(e) => setFeatureSearch(e.target.value)}
                          placeholder="Search system feature list..."
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {filteredFeatures.map((feature) => {
                          const selected = form.featureIds.includes(feature.id);
                          return (
                            <button
                              key={feature.id}
                              type="button"
                              onClick={() => toggleFeature(feature.id)}
                              className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border text-left transition ${
                                selected
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <span>{feature.name}</span>
                              {selected && (
                                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {filteredFeatures.length === 0 && (
                          <p className="text-xs text-slate-400 col-span-2 py-3 text-center">No matching features found.</p>
                        )}
                      </div>

                      {/* Add Custom Feature */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 space-y-2 mt-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          + Add Custom Feature Flag to Platform
                        </p>
                        {featureError && <p className="text-rose-500 text-xs font-medium">{featureError}</p>}
                        <div className="flex gap-2">
                          <input
                            value={newFeatureName}
                            onChange={(e) => setNewFeatureName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddFeature()}
                            placeholder="e.g. Webhook API Triggers"
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddFeature}
                            disabled={addingFeature}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl text-xs font-bold transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {addingFeature ? "Adding..." : "+ Create"}
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* Section 5: Integrations */}
                    <section className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                        <ShoppingBag size={14} />
                        <span>5. Integrations & Connectors</span>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2.5">
                        {INTEGRATIONS.map((item) => {
                          const checked = form.integrations.includes(item);
                          const Icon = INTEGRATION_ICON[item] || Building2;
                          return (
                            <button
                              type="button"
                              key={item}
                              onClick={() => toggleIntegration(item)}
                              className={`flex items-center gap-2 p-2.5 rounded-xl border transition text-left ${
                                checked
                                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-xs"
                                  : "border-slate-200 hover:border-slate-300 text-slate-600"
                              }`}
                            >
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${checked ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                                <Icon size={13} />
                              </span>
                              <span className="text-xs font-semibold">{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Live Plan Preview Card */}
                  <div className="bg-slate-50/80 p-6 border-l border-slate-100">
                    <div className="sticky top-6 space-y-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <span>Live Card Preview</span>
                        <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Real-time</span>
                      </div>

                      <div className={`bg-white rounded-2xl border p-5 space-y-4 transition ${form.isPopular ? "border-indigo-300 shadow-lg ring-2 ring-indigo-500/20" : "border-slate-200 shadow-md"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            {form.isPopular && (
                              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs mb-1">
                                <Star size={10} fill="white" /> Most Popular
                              </span>
                            )}
                            <h4 className="font-bold text-slate-800 text-base">{form.name || "Plan Title"}</h4>
                          </div>
                          <StatusPill status={form.status} />
                        </div>
                        {form.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{form.description}</p>
                        )}

                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-slate-900">
                            {form.monthlyPrice ? currency(form.monthlyPrice) : "₹0"}
                          </span>
                          <span className="text-slate-400 text-xs font-medium">/month</span>
                        </div>

                        {form.annualPrice && (
                          <p className="text-xs text-indigo-600 font-semibold">
                            {currency(form.annualPrice)}/mo billed annually
                          </p>
                        )}

                        {form.featureIds.length > 0 && (
                          <div className="space-y-1.5 border-t border-slate-100 pt-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Included Features</p>
                            {form.featureIds.slice(0, 5).map((id) => {
                              const feat = availableFeatures.find((f) => f.id === id);
                              if (!feat) return null;
                              return (
                                <div key={id} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                                  <span className="w-3.5 h-3.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                    <Check size={9} strokeWidth={3} />
                                  </span>
                                  {feat.name}
                                </div>
                              );
                            })}
                            {form.featureIds.length > 5 && (
                              <p className="text-[11px] text-slate-400 font-medium pl-5">+{form.featureIds.length - 5} more features</p>
                            )}
                          </div>
                        )}

                        {form.integrations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                            {form.integrations.map((name) => (
                              <span key={name} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3 shrink-0 bg-white">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-md shadow-indigo-600/20"
                >
                  {saving ? "Saving Tier..." : editingPlan ? "Save Tier Changes" : "Create Subscription Plan"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}