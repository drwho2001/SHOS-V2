import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// ADDED — real ask: "getting version back to fixes already done" —
// package.json's version had never once been bumped since the initial
// commit (confirmed via git log), so the About screen's "Version" row
// showed the same "0.1.0" across dozens of real feature/fix commits —
// genuinely no way to tell which build was installed. A one-off manual
// bump would just go stale again the same way. The durable fix: bake
// the actual short commit SHA into the build automatically, no manual
// step to remember. CI sets GITHUB_SHA (a real, full commit SHA for
// the exact commit being built); falls back to asking git directly for
// local dev builds, and to "dev" if that fails for any reason (e.g. no
// git available) rather than letting the whole build fail over a
// cosmetic value.
function resolveBuildSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  define: {
    __BUILD_SHA__: JSON.stringify(resolveBuildSha()),
  },
});
