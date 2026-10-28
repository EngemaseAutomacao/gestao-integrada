// Prefetches the most-used route chunks during idle time to eliminate
// the brief "old layout" flicker users see when navigating to a page
// whose JS chunk hasn't loaded yet.
let prefetched = false;

export function prefetchMainRoutes() {
  if (prefetched) return;
  prefetched = true;

  const run = () => {
    // Most-used authenticated pages
    void import("@/pages/Dashboard");
    void import("@/pages/ToolDetail");
    void import("@/pages/Checkout");
    void import("@/pages/Checkin");
    void import("@/pages/vehicles/VehicleDashboard");
    void import("@/pages/vehicles/VehicleDetail");
    void import("@/pages/vehicles/VehicleCheckout");
    void import("@/pages/vehicles/VehicleCheckin");
    void import("@/pages/Historico");
    void import("@/pages/FerramentasMenu");
    void import("@/pages/VeiculosMenu");
  };

  if (typeof window === "undefined") return;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 1500);
  }
}
