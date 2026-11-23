// Inventory of style values used in client/src (non-test files). Usage: node inventory.mjs <client/src>
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) && !/setupTests|reportWebVitals|index\.js$/.test(entry.name)) files.push(full);
  }
})(root);

const tally = {};
const add = (kind, value, file) => {
  tally[kind] ??= {};
  tally[kind][value] ??= { count: 0, files: new Set() };
  tally[kind][value].count++;
  tally[kind][value].files.add(path.relative(root, file).replace(/\\/g, "/"));
};
const emojiRe = /\p{Extended_Pictographic}/gu;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) add("hex colours", m[0].toLowerCase(), file);
  for (const m of src.matchAll(/rgba?\([^)]*\)/g)) add("rgba colours", m[0].replace(/\s+/g, ""), file);
  for (const m of src.matchAll(/var\(--[\w-]+\)/g)) add("css variables", m[0], file);
  for (const m of src.matchAll(/\btext-(xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])/g)) add("tailwind font sizes", m[0], file);
  for (const m of src.matchAll(/fontSize:\s*("[^"]+"|'[^']+'|[\d.]+)/g)) add("inline font sizes", m[1].replace(/['"]/g, ""), file);
  for (const m of src.matchAll(/font-size:\s*([^;]+);/g)) add("css font sizes", m[1].trim(), file);
  for (const m of src.matchAll(/\bfont-(light|normal|medium|semibold|bold|extrabold|black)\b/g)) add("font weights (tw)", m[0], file);
  for (const m of src.matchAll(/fontWeight:\s*(\d+)/g)) add("font weights (inline)", m[1], file);
  for (const m of src.matchAll(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-y|space-x)-(\d+(?:\.5)?|\[[^\]]+\])/g)) add("tailwind spacing", m[0].replace(/^.*?-(?=[\d[])/, ""), file);
  for (const m of src.matchAll(/\b(?:padding|margin|gap|marginTop|marginBottom):\s*("[^"]+"|[\d.]+)/g)) add("inline spacing", m[1].replace(/"/g, ""), file);
  for (const m of src.matchAll(/\brounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?\b/g)) add("radii (tw)", m[0], file);
  for (const m of src.matchAll(/borderRadius:\s*("[^"]+"|[\d.]+)/g)) add("radii (inline)", m[1].replace(/"/g, ""), file);
  for (const m of src.matchAll(/(?:box-shadow|boxShadow):\s*("[^"]+"|[^;,\n}]+)/g)) add("shadows", m[1].replace(/"/g, "").trim().slice(0, 60), file);
  for (const m of src.matchAll(/backdrop-filter|backdropFilter/g)) add("glass effects", "backdrop-filter", file);
  for (const m of src.matchAll(/linear-gradient|radial-gradient|conic-gradient/g)) add("gradients", m[0], file);
  for (const m of src.matchAll(/\b(glass(?:-dark)?|btn-primary|btn-ghost|input-glass|skill-pill|progress-track|progress-fill|gradient-text(?:-warm)?|fade-up(?:-\d)?)\b/g)) add("index.css classes", m[0], file);
  for (const m of src.matchAll(/Instrument Serif|Plus Jakarta Sans|Georgia|Times/g)) add("font families", m[0], file);
  for (const m of src.matchAll(emojiRe)) add("emoji", m[0], file);
  for (const m of src.matchAll(/\b(?:uppercase|tracking-\w+|letterSpacing)/g)) add("uppercase / tracking", m[0], file);
}

const out = [];
for (const [kind, values] of Object.entries(tally)) {
  const rows = Object.entries(values).sort((a, b) => b[1].count - a[1].count);
  out.push(`### ${kind} (${rows.length} distinct, ${rows.reduce((s, r) => s + r[1].count, 0)} uses)`);
  for (const [value, { count, files }] of rows) out.push(`- \`${value}\` ×${count} — ${[...files].join(", ")}`);
  out.push("");
}
fs.writeFileSync(process.argv[3], out.join("\n"));
console.log(Object.entries(tally).map(([k, v]) => `${k}: ${Object.keys(v).length} distinct, ${Object.values(v).reduce((s, x) => s + x.count, 0)} uses`).join("\n"));
