#!/usr/bin/env node
// Builds .vercel/output (Build Output API v3) from the Vite/TanStack Start
// build in `dist/`. This project doesn't use a Nitro preset, so we wire the
// SSR `fetch` handler from dist/server/server.js into a single Node.js
// Vercel Function and serve dist/client as static assets.
//
// Usage: this is run automatically as the Vercel build command:
//   "buildCommand": "npm run build && node scripts/vercel-build.mjs"

import { mkdir, cp, writeFile, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { builtinModules } from "node:module";

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

const root = process.cwd();
const distClient = path.join(root, "dist", "client");
const distServer = path.join(root, "dist", "server");
const outDir = path.join(root, ".vercel", "output");
const staticDir = path.join(outDir, "static");
const funcDir = path.join(outDir, "functions", "index.func");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(distClient)) || !(await exists(distServer))) {
    throw new Error('dist/client or dist/server not found — run "vite build" first.');
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(staticDir, { recursive: true });
  await mkdir(funcDir, { recursive: true });

  // 1. Static client assets (JS chunks, icons, manifest, etc.)
  await cp(distClient, staticDir, { recursive: true });

  // 2. Bundle the SSR server entry + all route chunks + npm deps into a
  // single self-contained file (Node builtins stay external).
  await build({
    entryPoints: [path.join(distServer, "server.js")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: path.join(funcDir, "server.cjs"),
    packages: "bundle",
    external: nodeBuiltins,
    logLevel: "warning",
  });

  // 3. Function entrypoint: re-exports the `fetch` handler as the Web
  // Standard `fetch` export, which the Node.js runtime invokes directly.
  const entry = `import mod from "./server.cjs";

const server = mod.default ?? mod;

export const fetch = (request, env, ctx) => server.fetch(request, env, ctx);
`;
  await writeFile(path.join(funcDir, "index.mjs"), entry, "utf8");

  // 4. Function package.json so Node treats this directory as ESM.
  await writeFile(
    path.join(funcDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2),
    "utf8",
  );

  // 5. .vc-config.json — Node.js serverless function pointing at index.mjs
  await writeFile(
    path.join(funcDir, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: "nodejs22.x",
        handler: "index.mjs",
        launcherType: "Nodejs",
        shouldAddHelpers: false,
        supportsResponseStreaming: true,
      },
      null,
      2,
    ),
    "utf8",
  );

  // 6. Top-level config: send everything that isn't a static asset to the
  // function. Static files are matched first automatically by Vercel.
  await writeFile(
    path.join(outDir, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/index" },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const assetCount = (await readdir(staticDir)).length;
  console.log(`Vercel build output written to ${path.relative(root, outDir)}`);
  console.log(`  static: ${assetCount} top-level entries from dist/client`);
  console.log(`  function: ${path.relative(root, funcDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
