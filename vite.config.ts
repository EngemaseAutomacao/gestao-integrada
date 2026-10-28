import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";


// Read version from src/version.ts
function getAppVersion() {
  const content = fs.readFileSync(path.resolve(__dirname, "src/version.ts"), "utf-8");
  const match = content.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  return match ? match[1] : "0.0.0";
}

// Plugin to generate version.json in public/ at build time
function versionJsonPlugin() {
  const version = getAppVersion();
  return {
    name: "version-json",
    buildStart() {
      const versionData = JSON.stringify({ version, buildDate: new Date().toISOString() });
      fs.writeFileSync(path.resolve(__dirname, "public/version.json"), versionData);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "::",
    port: 8080,
    // Em desenvolvimento a API roda separada (npm run dev:api) na porta 3001.
    proxy: {
      "/api": { target: `http://localhost:${process.env.API_PORT || 3001}`, changeOrigin: false },
    },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: null, // registramos manualmente via wrapper guardado
      devOptions: { enabled: false }, // sem SW em dev/preview
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,json}"],
        globIgnores: ["**/version.json"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: false, // mantém manifest.json existente em /public
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("html5-qrcode")) return "qrcode";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("date-fns")) return "dates";
          if (id.includes("lucide-react")) return "icons";
          return undefined;
        },
      },
    },
  },
}));

