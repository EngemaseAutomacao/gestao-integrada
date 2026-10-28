import { Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardSkeleton } from "@/components/PageSkeleton";

const AdminAnalytics = lazy(() => import("./AdminAnalytics"));

export default function AdminAnalyticsHub() {
  const { profile } = useAuth();

  if (!profile || profile.role !== "admin") {
    return <Navigate to="/" />;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminAnalytics />
    </Suspense>
  );
}
