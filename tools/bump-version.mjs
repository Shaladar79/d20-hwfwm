// tools/bump-version.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const systemPath = path.join(root, "system.json");
const roadmapPath = path.join(root, "docs", "roadmap.md");

// --- helpers ---
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJSON = (p, obj) =>
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");

const today = new Date();
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const stamp = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

// --- 1) bump system.json version (patch +1) ---
const sys = readJSON(systemPath);
const oldVer = sys.version || "0.0.0";
const [maj, min, pat] = oldVer.split(".").map((n) => parseInt(n || "0", 10));
const newVer = `${maj}.${min}.${(isNaN(pat) ? 0 : pat) + 1}`;
sys.version = newVer;
writeJSON(systemPath, sys);
console.log(`✔ system.json version: ${oldVer} → ${newVer}`);

// --- 2) update Last Updated line in roadmap.md ---
if (fs.existsSync(roadmapPath)) {
  let md = fs.readFileSync(roadmapPath, "utf8");
  if (/^\*Last Updated:\* .*/m.test(md)) {
    md = md.replace(/^\*Last Updated:\* .*/m, `*Last Updated:* ${stamp}`);
  } else {
    md += `\n\n*Last Updated:* ${stamp}\n`;
  }
  fs.writeFileSync(roadmapPath, md, "utf8");
  console.log(`✔ roadmap.md date set to ${stamp}`);
} else {
  console.warn("⚠ docs/roadmap.md not found; skipped date update");
}

// --- 3) optional: write a lightweight CHANGELOG entry (append) ---
const changelogPath = path.join(root, "CHANGELOG.md");
const header = `## v${newVer} - ${stamp}\n- Version bump.\n\n`;
try {
  if (!fs.existsSync(changelogPath)) fs.writeFileSync(changelogPath, "# Changelog\n\n", "utf8");
  fs.appendFileSync(changelogPath, header, "utf8");
  console.log(`✔ CHANGELOG.md appended for v${newVer}`);
} catch (e) {
  console.warn("⚠ Could not update CHANGELOG.md:", e?.message);
}

console.log("✅ Done. Don’t forget to commit your changes.");
