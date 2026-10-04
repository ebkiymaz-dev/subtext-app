import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
const outdir = "browser-extension/dist";
await mkdir(outdir, { recursive: true });
await build({ entryPoints: ["browser-extension/content.ts", "browser-extension/background.ts", "browser-extension/panel.tsx"], outdir, bundle: true, minify: true, platform: "browser", target: "chrome120", format: "iife", define: { "process.env.NODE_ENV": '"production"' } });
for (const file of ["manifest.json", "panel.html"]) await copyFile(`browser-extension/${file}`, `${outdir}/${file}`);
await copyFile("public/icon-192.png", `${outdir}/icon-128.png`);
console.log(`Subtext extension built: ${outdir}`);
