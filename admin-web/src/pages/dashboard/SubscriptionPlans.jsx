import { useState, useEffect } from "react";
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

const INTEGRATIONS = [
  "Shopify",
  "Razorpay",
  "Google Sheets",
  "Zoho CRM",
  "HubSpot",
  "Salesforce",
];

const defaultForm = {
  name: "",
  description: "",
  monthlyPrice: "",
  annualPrice: "",
  status: "ACTIVE",
  maxAgents: "",
  maxBroadcasts: "",
  maxAutomations: "",
  maxCampaigns: "",
  maxApiCalls: "",
  maxAiCredits: "",
  featureIds: [],
  integrations: [],
};

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

  // ── Stats ──
  const activePlans = plans.filter((p) => p.status === "ACTIVE").length;
  const inactivePlans = plans.filter((p) => p.status === "INACTIVE").length;

  // ── Load plans + features ──
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

  // ── Open create modal ──
  const openCreate = () => {
    setEditingPlan(null);
    setForm(defaultForm);
    setError("");
    setFeatureError("");
    setShowModal(true);
  };

  // ── Open edit modal ──
  const openEdit = (plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice || "",
      status: plan.status,
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
    setShowModal(true);
  };

  // ── Form field change ──
  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── Feature toggle ──
  const toggleFeature = (featureId) => {
    setForm((prev) => ({
      ...prev,
      featureIds: prev.featureIds.includes(featureId)
        ? prev.featureIds.filter((id) => id !== featureId)
        : [...prev.featureIds, featureId],
    }));
  };

  // ── Integration toggle ──
  const toggleIntegration = (name) => {
    setForm((prev) => ({
      ...prev,
      integrations: prev.integrations.includes(name)
        ? prev.integrations.filter((i) => i !== name)
        : [...prev.integrations, name],
    }));
  };

  // ── Save plan (create or update) ──
  const handleSave = async () => {
    if (!form.name || !form.monthlyPrice || !form.maxAgents) {
      setError("Plan name, monthly price, and agent count are required.");
      return;
    }
    if (form.featureIds.length === 0) {
      setError("Select at least one feature.");
      return;
    }

    setSaving(true);
    setError("");

    // Convert number fields
    const payload = {
      ...form,
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
      await loadData();
      setShowModal(false);
    } else {
      setError(res.message || "Something went wrong.");
    }

    setSaving(false);
  };

  // ── Toggle status ──
  const handleToggleStatus = async (id) => {
    const res = await togglePlanStatus(id);
    if (res.success) await loadData();
  };

  // ── Delete plan ──
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

  // ── Add new feature to DB ──
  const handleAddFeature = async () => {
    if (!newFeatureName.trim()) return;
    setAddingFeature(true);
    setFeatureError("");

    const res = await createFeature(newFeatureName.trim());

    if (res.success) {
      setAvailableFeatures((prev) => [...prev, res.data]);
      // Auto select the newly created feature
      setForm((prev) => ({
        ...prev,
        featureIds: [...prev.featureIds, res.data.id],
      }));
      setNewFeatureName("");
    } else {
      setFeatureError(res.message || "Failed to add feature.");
    }

    setAddingFeature(false);
  };

  // ── Render ──
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Subscription Plans
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage subscription plans and pricing.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#125EF2] hover:bg-[#0F4FCC] text-white
                     px-5 py-2 rounded-lg text-sm font-semibold
                     transition shadow-sm"
        >
          + Create Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm text-gray-500">Total Plans</h3>
          <p className="text-2xl font-bold text-slate-800">
            {plans.length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm text-gray-500">Active Plans</h3>
          <p className="text-2xl font-bold text-green-600">{activePlans}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm text-gray-500">Inactive Plans</h3>
          <p className="text-2xl font-bold text-red-500">{inactivePlans}</p>
        </div>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400 text-sm">Loading plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-gray-400 text-sm">No plans found.</p>
          <button
            onClick={openCreate}
            className="mt-4 text-[#125EF2] text-sm font-medium hover:underline"
          >
            Create your first plan
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              {/* Plan Header */}
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-800">
                  {plan.name}
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    plan.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {plan.status}
                </span>
              </div>

              {/* Price */}
              <p className="text-3xl font-bold mt-4 text-slate-800">
                ₹{plan.monthlyPrice.toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">per month</p>

              {plan.annualPrice && (
                <p className="text-xs text-[#125EF2] mt-1 font-medium">
                  ₹{plan.annualPrice.toLocaleString()}/mo billed annually
                </p>
              )}

              {/* Description */}
              {plan.description && (
                <p className="text-xs text-gray-400 mt-2">
                  {plan.description}
                </p>
              )}

              {/* Limits */}
              <div className="mt-4 space-y-1.5 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Agents:</span>{" "}
                  {plan.maxAgents}
                </p>
                <p>
                  <span className="font-medium">Broadcasts:</span>{" "}
                  {plan.maxBroadcasts
                    ? plan.maxBroadcasts.toLocaleString()
                    : "Unlimited"}
                </p>
                <p>
                  <span className="font-medium">Automations:</span>{" "}
                  {plan.maxAutomations
                    ? plan.maxAutomations.toLocaleString()
                    : "Unlimited"}
                </p>
                <p>
                  <span className="font-medium">Campaigns:</span>{" "}
                  {plan.maxCampaigns
                    ? plan.maxCampaigns.toLocaleString()
                    : "Unlimited"}
                </p>
                <p>
                  <span className="font-medium">API Calls:</span>{" "}
                  {plan.maxApiCalls
                    ? plan.maxApiCalls.toLocaleString()
                    : "Unlimited"}
                </p>
                <p>
                  <span className="font-medium">AI Credits:</span>{" "}
                  {plan.maxAiCredits || "None"}
                </p>
                <p>
                  <span className="font-medium">Tenants on plan:</span>{" "}
                  {plan._count?.tenants ?? 0}
                </p>
              </div>

              {/* Features */}
              {plan.features.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Features
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.features.map((pf) => (
                      <span
                        key={pf.id}
                        className="text-[10px] bg-[#EAF2FE] text-[#125EF2]
                                   px-2 py-0.5 rounded-full font-medium"
                      >
                        {pf.feature.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Integrations */}
              {plan.integrations.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Integrations
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.integrations.map((i) => (
                      <span
                        key={i.id}
                        className="text-[10px] bg-gray-100 text-gray-600
                                   px-2 py-0.5 rounded-full font-medium"
                      >
                        {i.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => openEdit(plan)}
                  className="flex-1 border border-gray-200 rounded-lg py-2
                             text-sm font-medium hover:bg-gray-50 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleStatus(plan.id)}
                  className={`flex-1 rounded-lg py-2 text-white text-sm
                             font-medium transition ${
                               plan.status === "ACTIVE"
                                 ? "bg-red-500 hover:bg-red-600"
                                 : "bg-green-500 hover:bg-green-600"
                             }`}
                >
                  {plan.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => handleDelete(plan.id, plan.name)}
                  className="px-3 rounded-lg border border-red-100
                             text-red-400 hover:bg-red-50 hover:text-red-600
                             transition text-sm"
                  title="Delete plan"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-slate-800">
                {editingPlan ? `Edit — ${editingPlan.name}` : "Create Subscription Plan"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-medium w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-8">

              {/* Error Banner */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              {/* Basic Details */}
              <section>
                <h3 className="font-semibold text-slate-800 mb-4">
                  Basic Details
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Plan Name *"
                    className="border border-gray-200 rounded-lg p-3 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20
                               focus:border-[#125EF2]"
                  />
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="border border-gray-200 rounded-lg p-3 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20
                               focus:border-[#125EF2]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  <input
                    name="monthlyPrice"
                    value={form.monthlyPrice}
                    onChange={handleChange}
                    placeholder="Monthly Price (₹) *"
                    type="number"
                    className="border border-gray-200 rounded-lg p-3 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20
                               focus:border-[#125EF2]"
                  />
                  <input
                    name="annualPrice"
                    value={form.annualPrice}
                    onChange={handleChange}
                    placeholder="Annual Price / Month (₹)"
                    type="number"
                    className="border border-gray-200 rounded-lg p-3 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20
                               focus:border-[#125EF2]"
                  />
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Description"
                    rows={2}
                    className="border border-gray-200 rounded-lg p-3 text-sm
                               md:col-span-2 focus:outline-none focus:ring-2
                               focus:ring-[#125EF2]/20 focus:border-[#125EF2]"
                  />
                </div>
              </section>

              {/* Usage Limits */}
              <section>
                <h3 className="font-semibold text-slate-800 mb-1">
                  Usage Limits
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Leave blank for unlimited
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { name: "maxAgents", placeholder: "Max Agents *" },
                    { name: "maxBroadcasts", placeholder: "Broadcasts / Month" },
                    { name: "maxAutomations", placeholder: "Automation Triggers" },
                    { name: "maxCampaigns", placeholder: "Campaigns" },
                    { name: "maxApiCalls", placeholder: "API Calls" },
                    { name: "maxAiCredits", placeholder: "AI Credits" },
                  ].map((field) => (
                    <input
                      key={field.name}
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      type="number"
                      className="border border-gray-200 rounded-lg p-3 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20
                                 focus:border-[#125EF2]"
                    />
                  ))}
                </div>
              </section>

              {/* Features */}
              <section>
                <h3 className="font-semibold text-slate-800 mb-4">
                  Plan Features
                  <span className="text-xs text-gray-400 font-normal ml-2">
                    ({form.featureIds.length} selected)
                  </span>
                </h3>

                {/* Feature toggle buttons */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {availableFeatures.map((feature) => {
                    const selected = form.featureIds.includes(feature.id);
                    return (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() => toggleFeature(feature.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold
                                   border transition ${
                                     selected
                                       ? "bg-[#125EF2] text-white border-[#125EF2]"
                                       : "bg-white text-gray-600 border-gray-200 hover:border-[#125EF2] hover:text-[#125EF2]"
                                   }`}
                      >
                        {selected ? "✓ " : "+ "}
                        {feature.name}
                      </button>
                    );
                  })}
                </div>

                {/* Add new feature */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Add New Feature to System
                  </p>
                  {featureError && (
                    <p className="text-red-500 text-xs mb-2">{featureError}</p>
                  )}
                  <div className="flex gap-3">
                    <input
                      value={newFeatureName}
                      onChange={(e) => setNewFeatureName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddFeature()
                      }
                      placeholder="Enter new feature name"
                      className="flex-1 border border-gray-200 rounded-lg p-3 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20
                                 focus:border-[#125EF2]"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      disabled={addingFeature}
                      className="bg-green-500 hover:bg-green-600 text-white
                                 px-4 rounded-lg text-sm font-medium
                                 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {addingFeature ? "Adding..." : "+ Add Feature"}
                    </button>
                  </div>
                </div>
              </section>

              {/* Integrations */}
              <section>
                <h3 className="font-semibold text-slate-800 mb-4">
                  Integrations
                </h3>
                <div className="grid md:grid-cols-3 gap-3">
                  {INTEGRATIONS.map((item) => {
                    const checked = form.integrations.includes(item);
                    return (
                      <label
                        key={item}
                        className={`flex items-center gap-2.5 p-3 rounded-lg
                                   border cursor-pointer transition ${
                                     checked
                                       ? "border-[#125EF2] bg-[#EAF2FE]"
                                       : "border-gray-200 hover:border-gray-300"
                                   }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleIntegration(item)}
                          className="accent-[#125EF2]"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {item}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="border border-gray-200 px-5 py-2 rounded-lg
                           text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#125EF2] hover:bg-[#0F4FCC] text-white
                           px-6 py-2 rounded-lg text-sm font-semibold
                           transition disabled:opacity-50 shadow-sm"
              >
                {saving
                  ? "Saving..."
                  : editingPlan
                  ? "Save Changes"
                  : "Create Plan"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}