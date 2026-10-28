import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.test.ts"],
    // Os testes são de funções puras; o Prisma só conecta na primeira consulta.
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
