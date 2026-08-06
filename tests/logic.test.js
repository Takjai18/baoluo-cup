/**
 * 寶螺盃 · 純邏輯單元測試（Node，無需瀏覽器）
 * 執行：node tests/logic.test.js
 */

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log("  ✓", msg);
  } else {
    failed++;
    console.error("  ✗", msg);
  }
}

function seededBracketOrder(n) {
  if (n < 2 || (n & (n - 1)) !== 0) return [];
  let bracket = [1, 2];
  while (bracket.length < n) {
    const sum = bracket.length * 2 + 1;
    const next = [];
    for (const s of bracket) {
      next.push(s);
      next.push(sum - s);
    }
    bracket = next;
  }
  return bracket;
}

function swissRoundsAdvice(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const log2 = Math.log2(n);
  const optimal = Math.max(2, Math.min(n - 1, Math.ceil(log2)));
  const minOk = Math.max(2, optimal - 1);
  const maxOk = Math.min(n - 1, Math.max(optimal + 1, minOk));
  const maxHard = Math.max(1, n - 1);
  const rematchRiskAt = Math.max(minOk, Math.floor(n / 2));
  return { n, optimal, minOk, maxOk, maxHard, rematchRiskAt, log2 };
}

const MATCH_TARGET = 4;
function autoWinnerFromScores(p1Id, p2Id, p1Bp, p2Bp) {
  const a = Math.max(0, parseInt(p1Bp, 10) || 0);
  const b = Math.max(0, parseInt(p2Bp, 10) || 0);
  const aWin = a >= MATCH_TARGET;
  const bWin = b >= MATCH_TARGET;
  if (aWin && !bWin) return p1Id;
  if (bWin && !aWin) return p2Id;
  if (aWin && bWin) {
    if (a > b) return p1Id;
    if (b > a) return p2Id;
    return null;
  }
  return null;
}

/** 多角同分：同一瑞士分組內，>2 人唔用 H2H */
function rankSortGroups(players, h2hMap) {
  const bySwiss = new Map();
  for (const r of players) {
    if (!bySwiss.has(r.swissPoints)) bySwiss.set(r.swissPoints, []);
    bySwiss.get(r.swissPoints).push(r);
  }
  const ordered = [];
  for (const sp of [...bySwiss.keys()].sort((a, b) => b - a)) {
    const g = bySwiss.get(sp);
    g.sort((a, b) => {
      if (g.length === 2) {
        const h2h = h2hMap[`${a.id}|${b.id}`] || h2hMap[`${b.id}|${a.id}`];
        if (h2h === a.id) return -1;
        if (h2h === b.id) return 1;
      }
      if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
      return a.name.localeCompare(b.name);
    });
    ordered.push(...g);
  }
  return ordered;
}

console.log("\n── seededBracketOrder ──");
assert(JSON.stringify(seededBracketOrder(4)) === JSON.stringify([1, 4, 2, 3]), "4: 1,4,2,3");
assert(JSON.stringify(seededBracketOrder(8)) === JSON.stringify([1, 8, 4, 5, 2, 7, 3, 6]), "8: 1,8,4,5,2,7,3,6");
const b16 = seededBracketOrder(16);
assert(b16[0] === 1 && b16[1] === 16 && b16[2] === 8 && b16[3] === 9, "16: 1v16, 8v9…");
assert(b16.length === 16 && new Set(b16).size === 16, "16: unique seeds");

console.log("\n── swissRoundsAdvice ──");
assert(swissRoundsAdvice(8).optimal === 3, "8 人 → 3 輪");
assert(swissRoundsAdvice(16).optimal === 4, "16 人 → 4 輪");
assert(swissRoundsAdvice(32).optimal === 5, "32 人 → 5 輪");
assert(swissRoundsAdvice(64).optimal === 6, "64 人 → 6 輪");

console.log("\n── autoWinnerFromScores ──");
assert(autoWinnerFromScores("a", "b", 4, 2) === "a", "4-2 → a");
assert(autoWinnerFromScores("a", "b", 3, 4) === "b", "3-4 → b");
assert(autoWinnerFromScores("a", "b", 4, 4) === null, "4-4 → null（須人手）");
assert(autoWinnerFromScores("a", "b", 5, 4) === "a", "5-4 → a");
assert(autoWinnerFromScores("a", "b", 2, 2) === null, "2-2 → null");

console.log("\n── multi-way ranking ──");
// 三角：A 勝 B，但 BP 不同 — 三人同分瑞士分時應按 BP 唔跟 H2H
const multi = rankSortGroups(
  [
    { id: "a", name: "A", swissPoints: 2, battlePoints: 5 },
    { id: "b", name: "B", swissPoints: 2, battlePoints: 10 },
    { id: "c", name: "C", swissPoints: 2, battlePoints: 7 },
  ],
  { "a|b": "a" } // A 曾贏 B，但多角應忽略
);
assert(multi[0].id === "b" && multi[1].id === "c" && multi[2].id === "a", "多角：BP 10>7>5，忽略 H2H");

// 二人組：H2H 優先
const pair = rankSortGroups(
  [
    { id: "a", name: "A", swissPoints: 3, battlePoints: 5 },
    { id: "b", name: "B", swissPoints: 3, battlePoints: 12 },
  ],
  { "a|b": "a" }
);
assert(pair[0].id === "a", "二人組：H2H 勝方排前（即使 BP 較低）");

console.log("\n── pairing time budget (n=32 greedy-like) ──");
// 模擬 greedy 32 人應即時完成
const t0 = Date.now();
const players = Array.from({ length: 32 }, (_, i) => ({
  id: "p" + i,
  swissPoints: Math.floor(i / 4),
  battlePoints: i,
  church: i % 2 ? "kcc" : "ky",
}));
const remaining = [...players];
const pairs = [];
const played = new Set();
while (remaining.length >= 2) {
  const a = remaining.shift();
  let best = 0;
  let bestQ = -Infinity;
  for (let i = 0; i < remaining.length; i++) {
    const b = remaining[i];
    const key = a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
    let q = -Math.abs(a.swissPoints - b.swissPoints) * 10000;
    if (played.has(key)) q -= 5000;
    if (a.church !== b.church) q += 1000;
    if (q > bestQ) {
      bestQ = q;
      best = i;
    }
  }
  pairs.push([a, remaining.splice(best, 1)[0]]);
}
const elapsed = Date.now() - t0;
assert(pairs.length === 16, "32 人 greedy 產生 16 對");
assert(elapsed < 100, "32 人 greedy < 100ms（實際 " + elapsed + "ms）");

console.log("\n── KO invalidate cascade ──");
// 模擬：2 場準決賽完 → final/third；改 early 後清下游
function invalidateKnockoutAfter(ko, roundIndex) {
  const ri = Math.max(0, roundIndex);
  ko.rounds = ko.rounds.slice(0, ri + 1);
  ko.final = null;
  ko.third = null;
  const adv = { ...(ko._advancedFrom || {}) };
  Object.keys(adv).forEach((k) => {
    if (Number(k) >= ri) delete adv[k];
  });
  ko._advancedFrom = adv;
}
function tryAdvance(ko) {
  const ri = ko.rounds.length - 1;
  const last = ko.rounds[ri];
  if (!last.matches.every((m) => m.done && m.winner)) return false;
  if (ko._advancedFrom?.[ri]) return false;
  if (last.matches.length === 2 && !ko.final) {
    const [m0, m1] = last.matches;
    ko.final = { p1: m0.winner, p2: m1.winner, done: false };
    ko.third = {
      p1: m0.p1 === m0.winner ? m0.p2 : m0.p1,
      p2: m1.p1 === m1.winner ? m1.p2 : m1.p1,
      done: false,
    };
    ko._advancedFrom[ri] = true;
    return true;
  }
  return false;
}
const ko = {
  rounds: [
    {
      name: "準決賽",
      matches: [
        { p1: "a", p2: "d", winner: "a", done: true },
        { p1: "b", p2: "c", winner: "b", done: true },
      ],
    },
  ],
  final: null,
  third: null,
  _advancedFrom: {},
};
assert(tryAdvance(ko) === true && ko.final.p1 === "a" && ko.final.p2 === "b", "晉級產生決賽 a vs b");
// 改準決賽1勝方 a→d
ko.rounds[0].matches[0].winner = "d";
invalidateKnockoutAfter(ko, 0);
assert(!ko.final && !ko.third && !ko._advancedFrom[0], "invalidate 清 final/third/_advancedFrom");
ko.rounds[0].matches[0].done = true;
ko.rounds[0].matches[1].done = true;
assert(tryAdvance(ko) === true && ko.final.p1 === "d" && ko.final.p2 === "b", "重建決賽 d vs b");

console.log("\n── resolveWinner scores edge ──");
assert(autoWinnerFromScores("a", "b", 4, 4) === null, "4-4 不可自動");
assert(autoWinnerFromScores("a", "b", 5, 5) === null, "5-5 不可自動");

console.log("\n════════════════════════");
console.log(`結果：${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log("全部通過\n");
