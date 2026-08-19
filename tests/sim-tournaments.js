/**
 * Monte Carlo: Swiss + cutoff qualification using live pairing/bye + cutoff.js
 * node tests/sim-tournaments.js
 */
const C = require("../cutoff.js");

const KO_PRESETS = [4, 8, 16];
function swissRoundsAdvice(playerCount) {
  const n = Math.max(2, playerCount | 0);
  const log2 = Math.log2(n);
  const optimal = Math.max(2, Math.min(n - 1, Math.ceil(log2)));
  return { n, optimal };
}
function getKoBracketSizeFor(playerCount, koSize) {
  let k = parseInt(koSize, 10);
  if (!Number.isFinite(k) || !KO_PRESETS.includes(k)) k = 4;
  while (k > playerCount && k > 2) k = k / 2;
  if (k < 2) k = 2;
  if (!KO_PRESETS.includes(k) && k !== 2) {
    k = KO_PRESETS.filter((x) => x <= playerCount).pop() || 2;
  }
  return k;
}

let state;
let swissRounds;
let koN;

function getSwissRounds() { return swissRounds; }
function getKoBracketSize() { return koN; }
function toast() {}

function swissMatchesOnly() {
  const list = [];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (m.done) list.push({ ...m, round: r.round });
    }
  }
  return list;
}
function isByeMatch(m) { return !!(m && (m.bye || !m.p2)); }
function getPlayerStats(playerId) {
  let wins = 0, losses = 0, battlePoints = 0;
  const opponents = [];
  for (const m of swissMatchesOnly()) {
    if (m.p1 !== playerId && m.p2 !== playerId) continue;
    if (isByeMatch(m)) {
      if (m.winner === playerId) wins++;
      continue;
    }
    const isP1 = m.p1 === playerId;
    const myBp = isP1 ? m.p1Bp : m.p2Bp;
    const oppId = isP1 ? m.p2 : m.p1;
    battlePoints += myBp || 0;
    opponents.push(oppId);
    if (m.winner === playerId) wins++;
    else if (m.winner) losses++;
  }
  return { wins, losses, battlePoints, opponents, swissPoints: wins };
}
function headToHead(aId, bId) {
  let last = null;
  for (const m of swissMatchesOnly()) {
    if (isByeMatch(m)) continue;
    if ((m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)) last = m.winner || null;
  }
  return last;
}
function rankedPlayers() {
  const rows = state.players.map((p) => ({ ...p, ...getPlayerStats(p.id) }));
  const bySwiss = new Map();
  for (const r of rows) {
    if (!bySwiss.has(r.swissPoints)) bySwiss.set(r.swissPoints, []);
    bySwiss.get(r.swissPoints).push(r);
  }
  const ordered = [];
  for (const sp of [...bySwiss.keys()].sort((a, b) => b - a)) {
    const g = bySwiss.get(sp);
    g.sort((a, b) => {
      if (g.length === 2) {
        const h2h = headToHead(a.id, b.id);
        if (h2h === a.id) return -1;
        if (h2h === b.id) return 1;
      }
      if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
    ordered.push(...g);
  }
  return ordered;
}
function getCutoffContext() {
  const ranked = rankedPlayers();
  if (!ranked.length || ranked.length < koN) return { needed: false, resolved: true, koN, ranked };
  const cutScore = ranked[koN - 1].swissPoints;
  const lockedIn = ranked.filter((p) => p.swissPoints > cutScore);
  const group = ranked.filter((p) => p.swissPoints === cutScore);
  const spots = koN - lockedIn.length;
  if (spots <= 0 || group.length <= spots) {
    return { needed: false, resolved: true, koN, ranked, lockedIn, group, spots, cutScore };
  }
  return { needed: true, resolved: false, koN, ranked, lockedIn, group, spots, cutScore };
}
function pairKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; }
function pairQuality(p1, p2, playedSet, lastOpp, hardNoRematch) {
  const key = pairKey(p1.id, p2.id);
  if (hardNoRematch && playedSet.has(key)) return -Infinity;
  let q = 0;
  q -= Math.abs(p1.swissPoints - p2.swissPoints) * 10000;
  if (p1.church !== p2.church) q += 1000; else q -= 200;
  if (playedSet.has(key)) q -= 5000; else q += 300;
  if (lastOpp[p1.id] === p2.id || lastOpp[p2.id] === p1.id) q -= 8000; else q += 100;
  return q;
}
function buildPlayedSet() {
  const set = new Set();
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (isByeMatch(m) || !m.p1 || !m.p2) continue;
      set.add(pairKey(m.p1, m.p2));
    }
  }
  return set;
}
function buildLastOppMap() {
  const map = {};
  const locked = state.rounds.filter((r) => r.locked);
  const prev = locked[locked.length - 1];
  if (!prev) return map;
  for (const m of prev.matches) {
    if (isByeMatch(m) || !m.p1 || !m.p2) continue;
    map[m.p1] = m.p2;
    map[m.p2] = m.p1;
  }
  return map;
}
function countRematches(pairs, playedSet) {
  let n = 0;
  for (const [a, b] of pairs) {
    if (!a || !b) continue;
    if (playedSet.has(pairKey(a.id, b.id))) n++;
  }
  return n;
}
function byeCount(playerId) {
  let n = 0;
  for (const r of state.rounds || []) {
    for (const m of r.matches || []) {
      if (isByeMatch(m) && m.p1 === playerId) n++;
    }
  }
  return n;
}
function currentRankMap() {
  const map = {};
  for (const p of rankedPlayers()) map[p.id] = p.rank || 9999;
  rankedPlayers().forEach((p, i) => { map[p.id] = i + 1; });
  return map;
}
function facedHigherRankInfo(playerId, rankOf) {
  const myRank = rankOf[playerId] ?? 9999;
  let faced = false, bestFaced = Infinity;
  for (const r of state.rounds || []) {
    for (const m of r.matches || []) {
      if (isByeMatch(m) || !m.p1 || !m.p2) continue;
      const opp = m.p1 === playerId ? m.p2 : m.p2 === playerId ? m.p1 : null;
      if (!opp) continue;
      const or = rankOf[opp] ?? 9999;
      if (or < myRank) faced = true;
      if (or < bestFaced) bestFaced = or;
    }
  }
  return { faced, bestFaced };
}
function isLockedForKo(player) {
  const ranked = rankedPlayers();
  const above = ranked.filter((p) => p.swissPoints > player.swissPoints).length;
  const same = ranked.filter((p) => p.swissPoints === player.swissPoints).length;
  return above < koN && above + same <= koN;
}
function remainingRoundsAfterThis() {
  return Math.max(0, getSwissRounds() - ((state.rounds || []).length + 1));
}
function noHopeWithBye(player) {
  const maxSwiss = (player.swissPoints || 0) + 1 + remainingRoundsAfterThis();
  const others = rankedPlayers().filter((p) => p.id !== player.id);
  return others.filter((p) => p.swissPoints > maxSwiss).length >= koN;
}
function lastRoundByeBucket(player) {
  if (isLockedForKo(player)) return 0;
  if (noHopeWithBye(player)) return 1;
  return 2;
}
function pickByePlayer(players) {
  const list = [...players];
  if (!list.length) return null;
  const minBye = Math.min(...list.map((p) => byeCount(p.id)));
  const lastRound = remainingRoundsAfterThis() === 0;
  const rankOf = currentRankMap();
  list.sort((a, b) => {
    const aOk = byeCount(a.id) === minBye ? 0 : 1;
    const bOk = byeCount(b.id) === minBye ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    if (lastRound) {
      const ia = lastRoundByeBucket(a);
      const ib = lastRoundByeBucket(b);
      if (ia !== ib) return ia - ib;
    }
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    const fa = facedHigherRankInfo(a.id, rankOf);
    const fb = facedHigherRankInfo(b.id, rankOf);
    if (fa.faced !== fb.faced) return fa.faced ? -1 : 1;
    if (fa.faced && fb.faced && fa.bestFaced !== fb.bestFaced) return fa.bestFaced - fb.bestFaced;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
  });
  return list[0] || null;
}
function pairRoundOne(players) {
  const kcc = players.filter((p) => p.church === "kcc");
  const ky = players.filter((p) => p.church === "ky");
  kcc.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  ky.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  const pairs = [];
  const used = new Set();
  const n = Math.min(kcc.length, ky.length);
  for (let i = 0; i < n; i++) {
    pairs.push([kcc[i], ky[i]]);
    used.add(kcc[i].id);
    used.add(ky[i].id);
  }
  const left = players.filter((p) => !used.has(p.id));
  for (let i = 0; i < left.length; i += 2) {
    if (left[i + 1]) pairs.push([left[i], left[i + 1]]);
    else pairs.push([left[i], null]);
  }
  return pairs;
}
function greedyPair(players, playedSet, lastOpp, hardNoRematch = false) {
  const remaining = [...players];
  const pairs = [];
  while (remaining.length >= 2) {
    const a = remaining.shift();
    let bestIdx = -1, bestQ = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const q = pairQuality(a, remaining[i], playedSet, lastOpp, hardNoRematch);
      if (q > bestQ) { bestQ = q; bestIdx = i; }
    }
    if (bestIdx < 0 || bestQ === -Infinity) {
      if (hardNoRematch) return null;
      bestIdx = 0;
    }
    const b = remaining.splice(bestIdx, 1)[0];
    pairs.push([a, b]);
  }
  return pairs;
}
function greedyPairPreferNoRematch(players, playedSet, lastOpp) {
  const hard = greedyPair(players, playedSet, lastOpp, true);
  if (hard && hard.length === players.length / 2) return hard;
  return greedyPair(players, playedSet, lastOpp, false);
}
function generateSwissPairings() {
  const stats = state.players.map((p) => ({ ...p, ...getPlayerStats(p.id) }));
  stats.sort((a, b) => {
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    return a.name.localeCompare(b.name, "zh-Hant");
  });
  const playedSet = buildPlayedSet();
  const lastOpp = buildLastOppMap();
  let pool = stats;
  let bye = null;
  if (pool.length % 2 === 1) {
    bye = pickByePlayer(pool);
    if (bye) pool = pool.filter((p) => p.id !== bye.id);
  }
  let pairs;
  if (state.rounds.length === 0) pairs = pairRoundOne(pool);
  else {
    pairs = greedyPairPreferNoRematch(pool, playedSet, lastOpp) || [];
  }
  if (bye) pairs.push([bye, null]);
  return { pairs, rematches: countRematches(pairs.filter((pr) => pr[0] && pr[1]), playedSet), bye };
}

function playFirstTo4() {
  let a = 0, b = 0;
  const pts = [1, 1, 1, 1, 2, 2, 2, 3];
  for (let i = 0; i < 40; i++) {
    const p = pts[(Math.random() * pts.length) | 0];
    if (Math.random() < 0.5) a += p; else b += p;
    if (a >= 4 && a > b) return { winner: "p1", p1Bp: a, p2Bp: b };
    if (b >= 4 && b > a) return { winner: "p2", p1Bp: a, p2Bp: b };
  }
  if (a === b) {
    a += 1;
  }
  return a > b ? { winner: "p1", p1Bp: Math.max(a, 4), p2Bp: b } : { winner: "p2", p1Bp: a, p2Bp: Math.max(b, 4) };
}

function decorateGroup(group) {
  return group.map((p) => ({
    id: p.id,
    name: p.name,
    battlePoints: p.battlePoints,
    swissPoints: p.swissPoints,
    byeCount: byeCount(p.id),
  }));
}

function simulatePlayoff(group, spots, h2h) {
  const analysis = C.analyzeCutoff(decorateGroup(group), spots, h2h);
  const info = {
    chain: analysis.chain || (analysis.resolved ? "none" : "?"),
    needsMatches: !!analysis.needsMatches,
    resolvedUpfront: !!(analysis.resolved && !analysis.needsMatches),
    matches: 0,
    waves: 0,
    stuck: false,
    emptyMaterialize: false,
    qualifierIds: analysis.qualifierIds || [],
  };
  if (analysis.resolved && !analysis.needsMatches) return info;
  const built = C.materializeCutoff(analysis, Math.random, (id) => id);
  if (!built.firstMatches || !built.firstMatches.length) {
    info.emptyMaterialize = true;
    info.stuck = true;
    return info;
  }
  const po = {
    chain: built.chain,
    ko: built.ko || null,
    tiedIds: built.tiedIds || analysis.tiedIds,
    preQualifyIds: built.preQualifyIds || [],
    byeId: built.byeId,
    challengerId: built.challengerId,
    autoOpen: built.autoOpen,
    phase: built.phase,
    inner: built.inner,
    multiBye: built.multiBye,
    take: built.take,
    matches: [],
  };
  const add = (ds) => {
    (ds || []).forEach((d) => {
      const dup = po.matches.some(
        (m) => m.wave === (d.wave || 1) && ((m.p1 === d.p1 && m.p2 === d.p2) || (m.p1 === d.p2 && m.p2 === d.p1)) && m.role === d.role
      );
      if (dup) return;
      po.matches.push({
        ...d,
        wave: d.wave || 1,
        done: false,
        winner: null,
        p1Bp: 0,
        p2Bp: 0,
        creditBp: d.creditBp !== false,
      });
    });
  };
  add(built.firstMatches);
  for (let step = 0; step < 40; step++) {
    for (const m of po.matches) {
      if (m.done) continue;
      const res = playFirstTo4();
      m.p1Bp = res.p1Bp;
      m.p2Bp = res.p2Bp;
      m.winner = res.winner === "p1" ? m.p1 : m.p2;
      m.done = true;
      info.matches++;
    }
    const r = C.resolvePlayoff(decorateGroup(group), spots, h2h, po);
    info.waves = step + 1;
    if (r.phase) po.phase = r.phase;
    if (r.byeId) po.byeId = r.byeId;
    if (r.challengerId) po.challengerId = r.challengerId;
    if (r.preQualifyIds) po.preQualifyIds = r.preQualifyIds;
    if (r.chain) po.chain = r.chain;
    if (r.ko) po.ko = r.ko;
    if (r.tiedIds) po.tiedIds = r.tiedIds;
    if (r.take != null) po.take = r.take;
    if (r.resolved) {
      info.qualifierIds = r.qualifierIds || [];
      info.stuck = false;
      return info;
    }
    if (r.nextMatches && r.nextMatches.length) add(r.nextMatches);
    else {
      info.stuck = true;
      info.qualifierIds = r.qualifierIds || [];
      return info;
    }
  }
  info.stuck = true;
  return info;
}

function checkRoundCoverage(pairs, n, roundNo) {
  const ids = [];
  for (const [a, b] of pairs) {
    if (a) ids.push(a.id);
    if (b) ids.push(b.id);
  }
  const uniq = new Set(ids);
  const problems = [];
  if (uniq.size !== n) problems.push(`round ${roundNo}: covered ${uniq.size}/${n}`);
  if (ids.length !== uniq.size) problems.push(`round ${roundNo}: duplicate player`);
  if (n % 2 === 1) {
    const byes = pairs.filter((pr) => !pr[1]);
    if (byes.length !== 1) problems.push(`round ${roundNo}: bye count ${byes.length}`);
  }
  return problems;
}

function runOne(n) {
  swissRounds = swissRoundsAdvice(n).optimal;
  koN = getKoBracketSizeFor(n, 4);
  state = {
    players: Array.from({ length: n }, (_, i) => ({
      id: "p" + String(i + 1).padStart(2, "0"),
      name: "P" + String(i + 1).padStart(2, "0"),
      church: i % 2 === 0 ? "kcc" : "ky",
    })),
    rounds: [],
  };
  const problems = [];
  let rematches = 0;
  let lastByeBucket = null;
  for (let r = 1; r <= swissRounds; r++) {
    const { pairs, rematches: rem, bye } = generateSwissPairings();
    rematches += rem;
    problems.push(...checkRoundCoverage(pairs, n, r));
    if (n % 2 === 1 && bye && remainingRoundsAfterThis() === 0) {
      lastByeBucket = lastRoundByeBucket(bye);
    }
    const matches = pairs.map(([a, b]) => {
      if (!b) {
        return { p1: a.id, p2: null, bye: true, winner: a.id, done: true, p1Bp: 0, p2Bp: 0 };
      }
      const res = playFirstTo4();
      return {
        p1: a.id,
        p2: b.id,
        bye: false,
        winner: res.winner === "p1" ? a.id : b.id,
        done: true,
        p1Bp: res.p1Bp,
        p2Bp: res.p2Bp,
      };
    });
    state.rounds.push({ round: r, locked: true, matches });
  }

  const ctx = getCutoffContext();
  const ranked = ctx.ranked;
  const seedFromRank = ranked.slice(0, koN).map((p) => p.id);
  let playoff = null;
  let seedIds = seedFromRank;
  let qualifiers = [];

  if (!ctx.needed) {
    seedIds = seedFromRank;
    if (seedIds.length !== koN) problems.push(`no-cutoff seed ${seedIds.length} != koN ${koN}`);
  } else {
    playoff = simulatePlayoff(ctx.group, ctx.spots, headToHead);
    if (playoff.emptyMaterialize) problems.push("needsMatches but materialize empty");
    if (playoff.stuck) problems.push(`playoff stuck chain=${playoff.chain} waves=${playoff.waves} matches=${playoff.matches}`);
    qualifiers = playoff.qualifierIds || [];
    const groupIds = new Set(ctx.group.map((p) => p.id));
    if (qualifiers.length !== ctx.spots) {
      problems.push(`qualifiers ${qualifiers.length} != spots ${ctx.spots} chain=${playoff.chain}`);
    }
    if (qualifiers.some((id) => !groupIds.has(id))) problems.push("qualifier outside cutoff group");
    if (new Set(qualifiers).size !== qualifiers.length) problems.push("duplicate qualifier");
    const locked = (ctx.lockedIn || []).map((p) => p.id);
    const extra = qualifiers.filter((id) => !locked.includes(id));
    const idSet = new Set([...locked, ...extra]);
    seedIds = ranked.filter((p) => idSet.has(p.id)).slice(0, koN).map((p) => p.id);
    if (seedIds.length !== koN) problems.push(`seed ${seedIds.length} != koN ${koN} locked=${locked.length} q=${qualifiers.length}`);

    // P0 check: 2-person group different BP should pick higher BP not H2H
    if (ctx.group.length === 2 && ctx.spots === 1 && !playoff.needsMatches) {
      const [a, b] = ctx.group;
      if (a.battlePoints !== b.battlePoints) {
        const bpWin = a.battlePoints > b.battlePoints ? a.id : b.id;
        if (qualifiers[0] && qualifiers[0] !== bpWin) {
          problems.push(`P0-regression: BP winner ${bpWin} but qualifier ${qualifiers[0]}`);
        }
      }
    }
  }

  return {
    n,
    swissRounds,
    koN,
    needed: !!ctx.needed,
    spots: ctx.spots || 0,
    groupN: ctx.group ? ctx.group.length : 0,
    lockedN: ctx.lockedIn ? ctx.lockedIn.length : 0,
    cutScore: ctx.cutScore,
    chain: playoff ? playoff.chain : "none",
    resolvedUpfront: playoff ? playoff.resolvedUpfront : true,
    playoffMatches: playoff ? playoff.matches : 0,
    rematches,
    lastByeBucket,
    problems,
  };
}

function summarize(n, runs) {
  const out = {
    n,
    swiss: swissRoundsAdvice(n).optimal,
    ko: getKoBracketSizeFor(n, 4),
    trials: runs.length,
    crashes: 0,
    problemRuns: 0,
    cutoffNeeded: 0,
    chains: {},
    stuck: 0,
    emptyMat: 0,
    wrongQ: 0,
    lastBye: { 0: 0, 1: 0, 2: 0, none: 0 },
    rematchSum: 0,
    groupSizes: {},
    samples: [],
  };
  for (const r of runs) {
    if (r.crash) { out.crashes++; continue; }
    if (r.problems.length) {
      out.problemRuns++;
      if (out.samples.length < 8) out.samples.push(r.problems.join(" | ") + ` (group ${r.groupN} for ${r.spots}, chain ${r.chain})`);
    }
    if (r.needed) out.cutoffNeeded++;
    out.chains[r.chain] = (out.chains[r.chain] || 0) + 1;
    if (r.problems.some((p) => p.startsWith("playoff stuck"))) out.stuck++;
    if (r.problems.some((p) => p.includes("materialize"))) out.emptyMat++;
    if (r.problems.some((p) => p.startsWith("qualifiers"))) out.wrongQ++;
    out.rematchSum += r.rematches;
    if (r.needed) {
      const gs = `${r.groupN}for${r.spots}`;
      out.groupSizes[gs] = (out.groupSizes[gs] || 0) + 1;
    }
    if (r.lastByeBucket == null) out.lastBye.none++;
    else out.lastBye[r.lastByeBucket] = (out.lastBye[r.lastByeBucket] || 0) + 1;
  }
  return out;
}

function main() {
  const sizes = [8, 9, 10, 16, 17, 31, 32, 33];
  const TRIALS = 50;
  console.log(`Simulating ${sizes.join("/")} × ${TRIALS} tournaments (Swiss=ceil(log2 N), KO=4)\n`);
  const t0 = Date.now();
  for (const n of sizes) {
    const runs = [];
    for (let i = 0; i < TRIALS; i++) {
      try {
        runs.push(runOne(n));
      } catch (e) {
        runs.push({ n, crash: true, problems: ["CRASH " + e.message], chain: "crash" });
      }
    }
    const s = summarize(n, runs);
    console.log(`══ ${n} 人 · 瑞士 ${s.swiss} 輪 · ${s.ko} 強 · ${s.trials} 場 ══`);
    console.log(`  入圍加賽需要：${s.cutoffNeeded}/${s.trials}`);
    console.log(`  加賽類型：${JSON.stringify(s.chains)}`);
    if (s.cutoffNeeded) console.log(`  爭席形狀：${JSON.stringify(s.groupSizes)}`);
    console.log(`  問題場次：${s.problemRuns}  崩潰：${s.crashes}  加賽卡住：${s.stuck}  入圍人數錯：${s.wrongQ}  抽籤空白：${s.emptyMat}`);
    console.log(`  重賽場數合計：${s.rematchSum}（平均 ${(s.rematchSum / s.trials).toFixed(2)} 對/場）`);
    if (n % 2 === 1) {
      console.log(`  最後一輪自動獲勝 bucket：穩入圍=${s.lastBye[0] || 0} 無希望=${s.lastBye[1] || 0} 其他人=${s.lastBye[2] || 0}`);
    }
    if (s.samples.length) {
      console.log("  問題例子：");
      s.samples.forEach((x) => console.log("   - " + x));
    }
    console.log("");
  }
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
