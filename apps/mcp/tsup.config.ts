import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node18",
    bundle: true,
    noExternal: ["@repo/api-sdk"],
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist",
  },
  {
    entry: { index: "src/index.ts", http: "src/http.ts" },
    format: ["esm"],
    target: "node18",
    bundle: true,
    noExternal: ["@repo/api-sdk"],
    outDir: "dist",
  },
]);
