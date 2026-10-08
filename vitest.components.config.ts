// Losse config voor rendertests van componenten: de app-config laadt TanStack Start-plugins die React in tests dubbel laden.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }, dedupe: ["react", "react-dom"] },
  test: { include: ["src/components/**/__tests__/*.test.tsx"], environment: "jsdom" },
});
