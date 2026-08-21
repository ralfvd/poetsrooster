import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

function localRevision(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "lokaal";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_REVISION__: JSON.stringify(process.env.APP_REVISION || localRevision()),
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  test: {
    environment: "node",
  },
});
