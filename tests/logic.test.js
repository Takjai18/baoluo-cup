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
  if (a >= MATCH_TARGET && a > b) return p1Id;
  if (b >= MATCH_TARGET && b > a) return p2Id;
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
assert(autoWinnerFromScores("a", "b", 4, 4) === null, "4-4 → 無分");
assert(autoWinnerFromScores("a", "b", 5, 4) === "a", "5-4 → a");
assert(autoWinnerFromScores("a", "b", 2, 2) === null, "2-2 未到 4 → 未完場");

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
assert(autoWinnerFromScores("a", "b", 4, 4) === null, "4-4 無分");
assert(autoWinnerFromScores("a", "b", 5, 5) === null, "5-5 無分");

console.log("\n── CX filter must not mutate until ensureCx ──");
function isCxBey(bey) {
  return !!(bey && (bey.series === "CX" || bey.bladeId === "cx"));
}
function emptyCxParts() {
  return {
    cxProduct: "",
    cxType: "standard",
    lockChip: "",
    lockChipCustom: "",
    mainBlade: "",
    mainBladeCustom: "",
    assistBlade: "",
    overBlade: "",
  };
}
function ensureCx(bey, snapshotRef) {
  if (!bey || isCxBey(bey)) return snapshotRef;
  if (!snapshotRef.snap) snapshotRef.snap = JSON.parse(JSON.stringify(bey));
  const keepRatchet = bey.ratchet || "";
  const keepBit = bey.bit || "";
  bey.bladeId = "cx";
  bey.series = "CX";
  bey.bladeCode = "";
  bey.bladeName = "";
  Object.assign(bey, emptyCxParts());
  bey.cxType = "standard";
  bey.ratchet = keepRatchet;
  bey.bit = keepBit;
  return snapshotRef;
}
function restoreIfNeeded(bey, snapshotRef) {
  if (!bey || !snapshotRef.snap) return false;
  if (!isCxBey(bey)) {
    snapshotRef.snap = null;
    return false;
  }
  // incomplete CX → restore
  const complete = !!(bey.lockChip && bey.mainBlade && bey.assistBlade);
  if (complete) {
    snapshotRef.snap = null;
    return false;
  }
  const snap = snapshotRef.snap;
  snapshotRef.snap = null;
  Object.keys(bey).forEach((k) => delete bey[k]);
  Object.assign(bey, snap);
  return true;
}

const beyUx = {
  bladeId: "ux-15",
  series: "UX",
  bladeName: "鮫鯊狂鱗",
  ratchet: "1-70",
  bit: "LR",
};
const snapRef = { snap: JSON.parse(JSON.stringify(beyUx)) };
// 只切 filter：唔 call ensureCx → bey 仍係 UX
assert(beyUx.bladeId === "ux-15" && !isCxBey(beyUx), "切 CX filter 前 bey 仍係 UX");
// 用戶揀零件 → ensureCx
ensureCx(beyUx, snapRef);
assert(isCxBey(beyUx) && beyUx.ratchet === "1-70" && beyUx.bit === "LR", "ensureCx 轉 CX 但保留固鎖軸心");
assert(beyUx.bladeId === "cx" && !beyUx.mainBlade, "ensureCx 清上蓋改 cx");
// 未完成就離開 → 還原
assert(restoreIfNeeded(beyUx, snapRef) === true, "未完成 CX 離開可還原");
assert(beyUx.bladeId === "ux-15" && beyUx.bit === "LR", "還原後返 UX15");

console.log("\n── CX complete / expand over required ──");
function isCxBladeComplete(bey) {
  if (bey.series !== "CX" && bey.bladeId !== "cx") return false;
  if (!bey.lockChip || !bey.mainBlade || !bey.assistBlade) return false;
  if (bey.cxType === "expand" && !bey.overBlade) return false;
  return true;
}
assert(
  isCxBladeComplete({
    series: "CX",
    bladeId: "cx",
    cxType: "standard",
    lockChip: "蒼龍",
    mainBlade: "勇氣",
    assistBlade: "S",
  }) === true,
  "標準 CX 齊"
);
assert(
  isCxBladeComplete({
    series: "CX",
    bladeId: "cx",
    cxType: "expand",
    lockChip: "蒼龍",
    mainBlade: "閃擊",
    assistBlade: "S",
  }) === false,
  "Expand 缺超越 → 未齊"
);
assert(
  isCxBladeComplete({
    series: "CX",
    bladeId: "cx",
    cxType: "expand",
    lockChip: "蒼龍",
    mainBlade: "閃擊",
    assistBlade: "S",
    overBlade: "B",
  }) === true,
  "Expand 有超越 → 齊"
);

console.log("\n── integrated ratchet complete ──");
function beyHasIntegrated(id) {
  return id === "ux-19" || id === "ux-20" || id === "ux-21";
}
function isBeyCompleteSimple(bey) {
  if (!bey.bit) return false;
  if (!beyHasIntegrated(bey.bladeId) && !bey.ratchet) return false;
  if (bey.series === "CX" || bey.bladeId === "cx") return isCxBladeComplete(bey);
  return !!bey.bladeId;
}
assert(isBeyCompleteSimple({ bladeId: "ux-20", bit: "H", ratchet: "" }) === true, "UX20 一體化免固鎖");
assert(isBeyCompleteSimple({ bladeId: "ux-15", bit: "H", ratchet: "" }) === false, "UX15 要固鎖");
assert(isBeyCompleteSimple({ bladeId: "ux-15", bit: "H", ratchet: "1-70" }) === true, "UX15 齊");

console.log("\n── filterBlades HOT treated as ALL ──");
function filterSeriesOk(series) {
  // mirror parts.js guard
  return !(series && series !== "ALL" && series !== "CX" && series !== "HOT");
}
assert(filterSeriesOk("HOT") === true, "HOT 唔會被當成 series 名 filter");
assert(filterSeriesOk("BX") === false, "BX 會 filter");

console.log("\n── cloud sync rev apply ──");
function shouldApplyRemote(localRev, remoteRev, role, justPushedRev) {
  const l = parseInt(localRev, 10) || 0;
  const r = parseInt(remoteRev, 10) || 0;
  if (role === "host" && r <= (justPushedRev || 0)) return false;
  return r > l;
}
assert(shouldApplyRemote(1, 2, "viewer", 0) === true, "只讀遠端較新 → 套用");
assert(shouldApplyRemote(2, 2, "viewer", 0) === false, "同 rev → 唔套用");
assert(shouldApplyRemote(3, 2, "viewer", 0) === false, "本地較新 → 唔套用");
assert(shouldApplyRemote(5, 5, "host", 5) === false, "主持自己啱推 → 唔套用");
assert(shouldApplyRemote(5, 6, "host", 5) === true, "另一主持推高 → 套用");

function normalizeRoomId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
assert(normalizeRoomId(" a3k-9p2 ") === "A3K9P2", "比賽 ID 正規化");

console.log("\n── getBeyTier custom / catalog ──");
function getBeyTierAudit(bey, catalog) {
  if (!bey) return "";
  if (bey.bladeId === "custom") return "";
  if (bey.bladeId && bey.bladeId !== "cx") {
    const b = catalog.find((x) => x.id === bey.bladeId);
    if (b) return b.tier || "";
  }
  return "";
}
const catalog = [
  { id: "bx-14", tier: "" },
  { id: "ux-15", tier: "T0" },
  { id: "bx-34", tier: "T1" },
];
assert(getBeyTierAudit({ bladeId: "bx-14" }, catalog) === "", "BX14 唔係 T0");
assert(getBeyTierAudit({ bladeId: "ux-15" }, catalog) === "T0", "UX15 係 T0");
assert(getBeyTierAudit({ bladeId: "bx-34" }, catalog) === "T1", "BX34 係 T1");
assert(getBeyTierAudit({ bladeId: "custom", bladeCustom: "鯊魚神劍" }, catalog) === "", "自訂永不 T0/T1");

console.log("\n── H2H uses last match ──");
function headToHeadLast(matches, aId, bId) {
  let last = null;
  for (const m of matches) {
    if (m.bye || !m.p2) continue;
    if ((m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)) last = m.winner || null;
  }
  return last;
}
assert(
  headToHeadLast(
    [
      { p1: "a", p2: "b", winner: "a" },
      { p1: "b", p2: "a", winner: "b" },
    ],
    "a",
    "b"
  ) === "b",
  "重賽用最近一場"
);

console.log("\n── odd pairing bye ──");
function pairRoundOneOdd(players) {
  const pairs = [];
  for (let i = 0; i < players.length; i += 2) {
    if (players[i + 1]) pairs.push([players[i], players[i + 1]]);
    else pairs.push([players[i], null]);
  }
  return pairs;
}
const oddPairs = pairRoundOneOdd(["a", "b", "c"]);
assert(oddPairs.length === 2 && oddPairs[1][1] === null, "單數最後一人輪空");

function pickByeOrder(players) {
  const minBye = Math.min(...players.map((p) => p.byes));
  return [...players].sort((a, b) => {
    const aOk = a.byes === minBye ? 0 : 1;
    const bOk = b.byes === minBye ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    if (a.facedHigher !== b.facedHigher) return a.facedHigher ? -1 : 1;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    if (a.lockedKo !== b.lockedKo) return a.lockedKo ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hant");
  })[0];
}
const byePick = pickByeOrder([
  { name: "第一", swissPoints: 3, battlePoints: 8, byes: 1, facedHigher: false, lockedKo: true },
  { name: "第二", swissPoints: 2, battlePoints: 4, byes: 0, facedHigher: true, lockedKo: false },
  { name: "第三", swissPoints: 2, battlePoints: 5, byes: 0, facedHigher: false, lockedKo: false },
]);
assert(byePick.name === "第二", "未休息＋同勝場時：曾打過更高名次者休息");

console.log("\n════════════════════════");
console.log(`結果：${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log("全部通過\n");
