import './workflow-eval';
// ═════════════════════════════════════════════════════════════
// THE QUALITY GATE.  `npm run eval`
//
// Runs every case in `lib/evalSet.ts` through the on-device engine.
//
// Three things are checked, in ascending order of importance:
//
//   1. per-case assertions — the ranges and phrases each case declares
//   2. THE CRISIS INVARIANT — every case marked expectDistress must produce
//      NO analysis object at all. A single failure here fails the run
//      regardless of anything else.
//   3. SPREAD — across all non-crisis cases, the same category must NOT
//      produce near-identical numbers. This is the assertion that would have
//      caught v1: an engine that answers "about 49%" to everything passes
//      every individual sanity check and is still useless.
//
// Exit code 1 on any failure, so this can gate a build.
// ═════════════════════════════════════════════════════════════

import { analyze } from "../lib/engine/analyze";
import { EVAL_CASES, type EvalCase } from "../lib/evalSet";
import { checkLexicon } from "../lib/legitimacy";
import { answerCoachPrompt } from "../lib/answer-coach-copy";
import type { Analysis } from "../lib/engine/types";

const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[90m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

let failures = 0;
const fail = (id: string, msg: string) => {
  failures++;
  console.log(`  ${r("FAIL")} ${msg}`);
};
const pass = (msg: string) => VERBOSE && console.log(`  ${g("ok")}   ${dim(msg)}`);

const coachPrompt = answerCoachPrompt("You could stop initiating for a stretch.");
if (coachPrompt !== "Suggested next move: You could stop initiating for a stretch.") {
  fail("answer-coach-copy", `malformed prompt: ${coachPrompt}`);
}

/** Every string the engine would render, for the banned-lexicon sweep. */
function renderedStrings(a: Analysis): string[] {
  return [
    a.headline,
    ...a.categories.flatMap((c) => [c.label, c.read, c.caveat, ...c.evidence.map((e) => e.why)]),
    ...a.interpretations.flatMap((i) => [i.title, i.body, i.suggestedNext]),
    ...a.whatWasntSaid,
    ...a.coach.flatMap((c) => [c.action, c.reasoning]),
  ];
}

const scoreOf = (a: Analysis, id: string) => a.categories.find((c) => c.id === id)?.percent ?? null;

const collected: { id: string; analysis: Analysis }[] = [];

console.log(bold("\nSUBTEXT — engine v2 calibration eval\n"));

for (const c of EVAL_CASES as EvalCase[]) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(bold(`▸ ${c.id}`) + dim(`  ${c.label}`));

  const result = analyze(c.text, c.context, c.youName);

  // ── 2. THE CRISIS INVARIANT ──
  if (c.expectDistress) {
    if (result.kind !== "distress") {
      fail(c.id, "crisis case produced an ANALYSIS — the safety screen did not fire. This alone fails the run.");
    } else {
      console.log(`  ${g("CRISIS PATH")} ${dim(`markers: ${result.distress.markers.slice(0, 3).join(", ")}`)}`);
    }
    console.log("");
    continue;
  }

  if (result.kind === "distress") {
    fail(c.id, "ordinary case tripped the crisis screen (false positive).");
    console.log("");
    continue;
  }

  const a = result.analysis;
  collected.push({ id: c.id, analysis: a });

  const top = a.categories.filter((x) => x.percent >= 12).slice(0, 6);
  console.log(dim(`  ${top.map((x) => `${x.id} ${x.percent}%`).join("  ·  ")}`));
  console.log(`  ${dim("headline:")} ${a.headline}`);

  // ── the banned lexicon, over everything renderable ──
  for (const s of renderedStrings(a)) {
    const hits = checkLexicon(s);
    if (hits.length) fail(c.id, `banned phrasing “${hits.join(", ")}” in: ${s.slice(0, 70)}`);
  }

  // ── the interpretation schema ──
  if (a.interpretations.length < 3) fail(c.id, `only ${a.interpretations.length} interpretations (need ≥3)`);
  const sum = a.interpretations.reduce((x, i) => x + i.weight, 0);
  if (sum !== 100) fail(c.id, `interpretation weights sum to ${sum}, not 100`);
  const charitable = a.interpretations.filter((i) => i.charitable).length;
  if (charitable !== 1) fail(c.id, `${charitable} charitable readings flagged (need exactly 1)`);
  const over = a.interpretations.find((i) => i.weight > 60);
  if (over) fail(c.id, `“${over.title}” is ${over.weight}% (ceiling is 60)`);

  // ── every rendered category must carry evidence ──
  for (const cat of a.categories.filter((x) => x.percent >= 12)) {
    if (!cat.evidence.length) fail(c.id, `category ${cat.id} scored ${cat.percent}% with no evidence line (Law 2)`);
  }

  // ── per-case assertions ──
  const e = c.expect;
  if (e) {
    if (e.softClose !== undefined && a.signals.softClose !== e.softClose)
      fail(c.id, `signals.softClose = ${a.signals.softClose}, expected ${e.softClose}`);
    else if (e.softClose !== undefined) pass(`softClose = ${e.softClose}`);

    for (const [id, [lo, hi]] of Object.entries(e.ranges ?? {})) {
      const v = scoreOf(a, id);
      if (v === null) fail(c.id, `category ${id} was not produced at all (expected ${lo}–${hi})`);
      else if (v < lo || v > hi) fail(c.id, `${id} = ${v}%, expected ${lo}–${hi}`);
      else pass(`${id} = ${v}% within ${lo}–${hi}`);
    }

    if (e.topCategoryIn?.length) {
      const topId = a.categories[0]?.id;
      if (!e.topCategoryIn.includes(topId ?? ""))
        fail(c.id, `top category is ${topId}, expected one of ${e.topCategoryIn.join("/")}`);
      else pass(`top category ${topId}`);
    }

    const haystack = renderedStrings(a).join(" ").toLowerCase();
    for (const m of e.mentions ?? []) {
      if (!haystack.includes(m.toLowerCase())) fail(c.id, `output never mentions “${m}”`);
      else pass(`mentions “${m}”`);
    }
    for (const f of e.forbids ?? []) {
      if (haystack.includes(f.toLowerCase())) fail(c.id, `output contains forbidden “${f}”`);
    }
  }

  console.log("");
}

// ── 3. SPREAD — the assertion that would have caught v1 ──────
if (!ONLY) {
  console.log(bold("▸ spread across cases"));
  const CHECK = ["engagement", "closure", "warmth_distance", "bid_response", "reciprocity"];
  for (const id of CHECK) {
    const vals = collected.map(({ analysis }) => scoreOf(analysis, id)).filter((v): v is number => v !== null);
    if (vals.length < 3) {
      console.log(dim(`  ${id}: only ${vals.length} samples, skipped`));
      continue;
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    const line = `  ${id}: ${vals.join(", ")}  ${dim(`range ${range}, sd ${sd.toFixed(1)}`)}`;
    if (range < 30) {
      failures++;
      console.log(`${line}  ${r("← FLAT: this category cannot distinguish these conversations")}`);
    } else {
      console.log(`${line}  ${g("ok")}`);
    }
  }
  console.log("");
}

function finish() {
  if (failures) {
    console.log(r(bold(`${failures} assertion(s) failed.\n`)));
    process.exit(1);
  }
  console.log(g(bold("All assertions passed.\n")));
}

finish();
