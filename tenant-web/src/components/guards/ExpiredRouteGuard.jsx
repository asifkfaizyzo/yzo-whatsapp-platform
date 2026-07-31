import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../../lib/axios";
import ExpiredSubscriptionBanner from "../billing/ExpiredSubscriptionBanner";
import CancelAtPeriodEndBanner from "../billing/CancelAtPeriodEndBanner";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

const ALLOWED_ROUTES = [
  '/settings/billing',
  '/dashboard/billing',
  '/plans',
  '/account',
  '/support'
];

export default function ExpiredRouteGuard({ children }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [subStatus, setSubStatus] = useState(null);
  const [planEnd, setPlanEnd] = useState(null);
  const [deletionDate, setDeletionDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const fetchStatus = async () => {
    try {
      const res = await api.get("/billing");
      const { subscriptionStatus, planPeriodEnd, dataDeletionDate } = res.data.data;
      setSubStatus(subscriptionStatus);
      setPlanEnd(planPeriodEnd);
      setDeletionDate(dataDeletionDate);
    } catch (err) {
      console.error("Error fetching subscription status in guard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [location.pathname]);

  const handleReactivateInGuard = async () => {
    const ok = await confirm({
      type: "info",
      title: "Reactivate Subscription?",
      message: "This will cancel your scheduled termination and keep your plan active.",
      confirmLabel: "Reactivate",
    });
    if (!ok) return;
    try {
      const res = await api.post("/billing/reactivate");
      if (res.data.success) {
        fetchStatus();
      }
    } catch (err) {
      toast.error("Error reactivating subscription");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  const currentPath = location.pathname;

  if (subStatus === 'paused') {
    return <Navigate to="/support" replace />;
  }

  if (subStatus === 'expired') {
    const isAllowed = ALLOWED_ROUTES.some(route => currentPath.startsWith(route));
    if (!isAllowed) {
      return <Navigate to="/plans" replace />;
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {subStatus === 'expired' && planEnd && (
        <ExpiredSubscriptionBanner expiredDate={planEnd} dataDeletionDate={deletionDate} />
      )}
      <div className="flex-1">
        {subStatus === 'cancel_at_period_end' && currentPath === '/dashboard' && (
          <CancelAtPeriodEndBanner periodEndDate={planEnd} onReactivate={handleReactivateInGuard} />
        )}
        {children}
      </div>
    </div>
  );
}