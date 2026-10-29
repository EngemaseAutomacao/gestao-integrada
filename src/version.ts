// Version is auto-incremented. Update PATCH for fixes, MINOR for features, MAJOR for breaking changes.
export const APP_VERSION = "3.0.2";

// Injected by Vite at build time via define in vite.config.ts
declare const __BUILD_DATE__: string;
export const BUILD_DATE: string = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : new Date().toISOString();
