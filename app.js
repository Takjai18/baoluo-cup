/**
 * 寶螺盃 · 瑞士制管理系統
 * 16 人 · 4 輪瑞士制 · 先到 4 分 Match · localStorage
 */

const STORAGE_KEY = "baoluo-cup-v2";
const STORAGE_KEY_LEGACY = "baoluo-cup-v1";
const TOTAL_PLAYERS = 16;
const MATCH_TARGET = 4;
/** 報到區代號（按可用站點數取前 N 個） */
const ZONE_CODES = ["A", "B", "C", "D", "E", "F", "G", "H"];

function defaultSettings() {
  return {
    referees: 4, // 裁判人數
    stadiums: 4, // 對戰盤數量（建議 2–4）
    swissRounds: 4, // 瑞士制輪次
  };
}

function normalizeSettings(s) {
  const d = defaultSettings();
  const src = s && typeof s === "object" ? s : {};
  let referees = parseInt(src.referees, 10);
  let stadiums = parseInt(src.stadiums, 10);
  let swissRounds = parseInt(src.swissRounds, 10);
  if (!Number.isFinite(referees) || referees < 1) referees = d.referees;
  if (!Number.isFinite(stadiums) || stadiums < 1) stadiums = d.stadiums;
  if (!Number.isFinite(swissRounds) || swissRounds < 1) swissRounds = d.swissRounds;
  referees = Math.min(8, Math.max(1, referees));
  stadiums = Math.min(8, Math.max(1, stadiums));
  swissRounds = Math.min(8, Math.max(1, swissRounds));
  return { referees, stadiums, swissRounds };
}

/** 實際可用報到站 = min(裁判, 對戰盤) */
function getActiveStations() {
  const s = normalizeSettings(state.settings);
  return Math.max(1, Math.min(s.referees, s.stadiums));
}

function getSwissRounds() {
  return normalizeSettings(state.settings).swissRounds;
}

function zoneCode(zoneIndex) {
  return ZONE_CODES[zoneIndex] || String(zoneIndex + 1);
}

function zoneLabel(zoneIndex) {
  return `${zoneCode(zoneIndex)} 區`;
}

/** 將本輪各場分配到 A/B/C… 區（round-robin） */
function assignMatchZones(matches) {
  const n = getActiveStations();
  return matches.map((m, i) => {
    const zone = i % n;
    return {
      ...m,
      table: i + 1,
      zone,
      zoneCode: zoneCode(zone),
      zoneLabel: zoneLabel(zone),
    };
  });
}

const CHURCH = {
  kcc: { id: "kcc", short: "城基", full: "九龍城基督徒會" },
  ky: { id: "ky", short: "基蔭", full: "宣道會基蔭堂" },
};

const DEMO_PLAYERS = [
  ["陳大文", "kcc"], ["李小明", "kcc"], ["王志強", "kcc"], ["張美玲", "kcc"],
  ["劉偉傑", "kcc"], ["黃嘉欣", "kcc"], ["周子豪", "kcc"], ["吳詠詩", "kcc"],
  ["林俊傑", "ky"], ["何家輝", "ky"], ["鄭雅婷", "ky"], ["謝志明", "ky"],
  ["馬啟聰", "ky"], ["楊曉彤", "ky"], ["羅偉業", "ky"], ["許心怡", "ky"],
];

/** Demo decks for event-day practice (complete 3 beys) */
const DEMO_DECKS = [
  [
    { bladeId: "bx-01", ratchet: "3-60", bit: "J" },
    { bladeId: "bx-23", ratchet: "9-60", bit: "H" },
    { bladeId: "bx-21", ratchet: "5-70", bit: "T" },
  ],
  [
    { bladeId: "ux-03", ratchet: "1-60", bit: "B" },
    { bladeId: "ux-01", ratchet: "4-80", bit: "P" },
    { bladeId: "bx-04", ratchet: "9-80", bit: "F" },
  ],
];

function demoBeyFromTemplate(t) {
  const bey = emptyBey();
  const blade = findBladeById(t.bladeId);
  if (blade) applyBladeToBey(bey, blade);
  bey.ratchet = t.ratchet;
  bey.bit = t.bit;
  return bey;
}

// ─── State ───────────────────────────────────────────────
function defaultState() {
  return {
    // players: { id, name, church, beys[3], deckChecked }
    players: [],
    settings: defaultSettings(),
    phase: "setup", // setup | swiss | knockout | done
    currentRound: 0, // 1..N when swiss
    rounds: [], // { round, locked, matches: [{ id, p1, p2, zone, zoneLabel, winner, p1Bp, p2Bp, done }] }
    knockout: null, // { semis: [], third: null, final: null }
    updatedAt: null,
  };
}

function migratePlayers(players) {
  return (players || []).map((p) => normalizePlayer({ ...p }));
}

let state = loadState();

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY_LEGACY);
    }
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const st = { ...defaultState(), ...parsed };
    st.settings = normalizeSettings(parsed.settings || st.settings);
    st.players = migratePlayers(st.players);
    // 補上舊場次 zone（若無）
    const stations = Math.max(1, Math.min(st.settings.referees, st.settings.stadiums));
    st.rounds = (st.rounds || []).map((r) => ({
      ...r,
      matches: (r.matches || []).map((m, i) => {
        if (m.zone != null && m.zoneCode) return m;
        const zone = i % stations;
        return {
          ...m,
          zone,
          zoneCode: ZONE_CODES[zone] || String(zone + 1),
          zoneLabel: `${ZONE_CODES[zone] || zone + 1} 區`,
        };
      }),
    }));
    return st;
  } catch {
    return defaultState();
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const el = document.getElementById("saveTime");
  if (el) el.textContent = "已儲存 " + new Date().toLocaleTimeString("zh-HK");
}

function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}

function churchLabel(id) {
  return CHURCH[id]?.short || id;
}

function churchFull(id) {
  return CHURCH[id]?.full || id;
}

function playerById(id) {
  return state.players.find((p) => p.id === id);
}

function parseChurch(s) {
  const t = String(s || "").trim().toLowerCase();
  if (["kcc", "城基", "九龍城", "九龍城基督徒會", "kowloon", "kc"].includes(t)) return "kcc";
  if (["ky", "基蔭", "宣道會基蔭堂", "kei yam", "keiyam", "基蔭堂"].includes(t)) return "ky";
  if (t.includes("城基") || t.includes("九龍") || t.includes("kcc")) return "kcc";
  if (t.includes("基蔭") || t.includes("ky") || t.includes("宣道")) return "ky";
  return null;
}

// ─── Stats & Ranking ─────────────────────────────────────
function allCompletedMatches() {
  const list = [];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (m.done && m.winner) list.push({ ...m, round: r.round });
    }
  }
  if (state.knockout) {
    for (const m of [...(state.knockout.semis || []), state.knockout.third, state.knockout.final].filter(Boolean)) {
      if (m.done && m.winner) list.push({ ...m, round: "KO" });
    }
  }
  return list;
}

function swissMatchesOnly() {
  const list = [];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      if (m.done && m.winner) list.push({ ...m, round: r.round });
    }
  }
  return list;
}

function getPlayerStats(playerId) {
  let wins = 0, losses = 0, battlePoints = 0;
  const opponents = [];
  /** 每局詳情：{ round, oppId, won, myBp, oppBp } */
  const matchLog = [];
  for (const m of swissMatchesOnly()) {
    if (m.p1 !== playerId && m.p2 !== playerId) continue;
    const isP1 = m.p1 === playerId;
    const myBp = isP1 ? m.p1Bp : m.p2Bp;
    const oppBp = isP1 ? m.p2Bp : m.p1Bp;
    const oppId = isP1 ? m.p2 : m.p1;
    const won = m.winner === playerId;
    battlePoints += myBp || 0;
    opponents.push(oppId);
    matchLog.push({
      round: m.round,
      oppId,
      won,
      myBp: myBp || 0,
      oppBp: oppBp || 0,
    });
    if (won) wins++;
    else losses++;
  }
  return { wins, losses, battlePoints, opponents, matchLog, swissPoints: wins };
}

function headToHead(aId, bId) {
  for (const m of swissMatchesOnly()) {
    if ((m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)) {
      return m.winner; // id of winner, or null
    }
  }
  return null;
}

function havePlayed(aId, bId) {
  return headToHead(aId, bId) !== null ||
    state.rounds.some((r) =>
      r.matches.some((m) =>
        (m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)
      )
    );
}

function lastRoundOpponent(playerId) {
  if (!state.rounds.length) return null;
  const last = state.rounds[state.rounds.length - 1];
  // if current round not locked, "last" for pairing of new round is previous locked
  const locked = state.rounds.filter((r) => r.locked);
  const prev = locked[locked.length - 1];
  if (!prev) return null;
  const m = prev.matches.find((x) => x.p1 === playerId || x.p2 === playerId);
  if (!m) return null;
  return m.p1 === playerId ? m.p2 : m.p1;
}

/**
 * Rank players for standings.
 * Sort key: swiss points desc, then multi-way tie handling via comparator.
 * Comparator for two players with same swiss:
 *   1. H2H if they played
 *   2. Battle points
 *   3. equal (playoff needed)
 */
function rankedPlayers() {
  const rows = state.players.map((p) => {
    const s = getPlayerStats(p.id);
    return { ...p, ...s };
  });

  rows.sort((a, b) => {
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    // H2H only decisive for pairwise; for multi-way we use BP first then note H2H in UI
    const h2h = headToHead(a.id, b.id);
    if (h2h === a.id) return -1;
    if (h2h === b.id) return 1;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  // Assign ranks with ties marked
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const prev = rows[i - 1];
      const cur = rows[i];
      const same =
        prev.swissPoints === cur.swissPoints &&
        headToHead(prev.id, cur.id) === null &&
        prev.battlePoints === cur.battlePoints;
      // if H2H or BP differs, rank advances; if fully tied, share rank
      const fullyTied =
        prev.swissPoints === cur.swissPoints &&
        (headToHead(prev.id, cur.id) === null || true) &&
        prev.battlePoints === cur.battlePoints &&
        headToHead(prev.id, cur.id) === null;

      // Simpler rank: sequential after sort, but detect ties for display
      if (
        prev.swissPoints === cur.swissPoints &&
        headToHead(prev.id, cur.id) === null &&
        prev.battlePoints === cur.battlePoints
      ) {
        rows[i].rank = rows[i - 1].rank;
        rows[i].tied = true;
        rows[i - 1].tied = true;
      } else {
        rank = i + 1;
        rows[i].rank = rank;
        rows[i].tied = false;
      }
    } else {
      rows[i].rank = 1;
      rows[i].tied = false;
    }
  }
  return rows;
}

function needsPlayoffBetween(a, b) {
  if (a.swissPoints !== b.swissPoints) return false;
  if (headToHead(a.id, b.id)) return false;
  if (a.battlePoints !== b.battlePoints) return false;
  return true;
}

// ─── Swiss Pairing Algorithm ─────────────────────────────
/**
 * Priority (must follow order):
 * a. Same score group first
 * b. Within that, prefer different church
 * c. Avoid rematches (esp. last-round rematch)
 *
 * Strategy: sort by score, then recursive backtracking maximizing pair quality.
 * For n=16 this is fast enough.
 */
function pairQuality(p1, p2, playedSet, lastOpp) {
  // Higher = better
  let q = 0;
  const scoreDiff = Math.abs(p1.swissPoints - p2.swissPoints);
  q -= scoreDiff * 10000; // a. strongest: same score

  if (p1.church !== p2.church) q += 1000; // b. different church
  else q -= 200;

  const key = pairKey(p1.id, p2.id);
  if (playedSet.has(key)) q -= 5000; // c. rematch heavily penalized
  else q += 300;

  if (lastOpp[p1.id] === p2.id || lastOpp[p2.id] === p1.id) q -= 8000; // consecutive rematch worse
  else q += 100;

  return q;
}

function pairKey(a, b) {
  return a < b ? a + "|" + b : b + "|" + a;
}

function buildPlayedSet() {
  const set = new Set();
  for (const r of state.rounds) {
    for (const m of r.matches) {
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
    map[m.p1] = m.p2;
    map[m.p2] = m.p1;
  }
  return map;
}

function generateSwissPairings() {
  const stats = state.players.map((p) => {
    const s = getPlayerStats(p.id);
    return { ...p, ...s };
  });

  // Sort: high score first, then BP, then alternate church for round 1 variety
  stats.sort((a, b) => {
    if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;
    if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  const playedSet = buildPlayedSet();
  const lastOpp = buildLastOppMap();

  // Round 1 special: snake/church-aware pairing if all 0-0
  if (state.rounds.length === 0 || stats.every((p) => p.swissPoints === 0)) {
    return pairRoundOne(stats);
  }

  const result = bestPairingSearch(stats, playedSet, lastOpp);
  if (!result) {
    // Fallback greedy
    return greedyPair(stats, playedSet, lastOpp);
  }
  return result;
}

function pairRoundOne(players) {
  // Prefer different church: sort into two church lists, pair across
  const kcc = players.filter((p) => p.church === "kcc");
  const ky = players.filter((p) => p.church === "ky");
  // Shuffle lightly but deterministically by name for stability
  kcc.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  ky.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

  const pairs = [];
  const used = new Set();

  // Pair across churches first
  const n = Math.min(kcc.length, ky.length);
  for (let i = 0; i < n; i++) {
    pairs.push([kcc[i], ky[i]]);
    used.add(kcc[i].id);
    used.add(ky[i].id);
  }
  // Remaining same-church pair among leftovers
  const left = players.filter((p) => !used.has(p.id));
  for (let i = 0; i < left.length; i += 2) {
    if (left[i + 1]) pairs.push([left[i], left[i + 1]]);
  }
  return pairs;
}

function bestPairingSearch(players, playedSet, lastOpp) {
  const n = players.length;
  if (n % 2 !== 0) return null; // need even; no byes in this event

  const ids = players.map((p) => p.id);
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  let bestPairs = null;
  let bestScore = -Infinity;

  // Limit search: try candidates ordered by quality for each position
  function search(unpaired, pairs, scoreSoFar) {
    if (unpaired.length === 0) {
      if (scoreSoFar > bestScore) {
        bestScore = scoreSoFar;
        bestPairs = pairs.map((pr) => [byId[pr[0]], byId[pr[1]]]);
      }
      return;
    }

    // Prune if even perfect remaining can't beat best
    // (simple: if we already have a solution and score is far behind, skip)
    if (bestPairs && scoreSoFar + unpaired.length * 2000 < bestScore) return;

    const a = unpaired[0];
    const rest = unpaired.slice(1);

    // Rank possible opponents
    const candidates = rest
      .map((b) => ({
        b,
        q: pairQuality(byId[a], byId[b], playedSet, lastOpp),
      }))
      .sort((x, y) => y.q - x.q);

    // Only try top few to keep fast (16! is huge, but with ordering top-6 is enough)
    const limit = Math.min(candidates.length, 6);
    for (let i = 0; i < limit; i++) {
      const { b, q } = candidates[i];
      const nextUnpaired = rest.filter((x) => x !== b);
      search(nextUnpaired, [...pairs, [a, b]], scoreSoFar + q);
      // Early exit if we found a "perfect enough" pairing
      if (bestScore > 5000 * (n / 2) - 1000 && i >= 2) break;
    }
  }

  search(ids, [], 0);
  return bestPairs;
}

function greedyPair(players, playedSet, lastOpp) {
  const remaining = [...players];
  const pairs = [];
  while (remaining.length >= 2) {
    const a = remaining.shift();
    let bestIdx = 0;
    let bestQ = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const q = pairQuality(a, remaining[i], playedSet, lastOpp);
      if (q > bestQ) {
        bestQ = q;
        bestIdx = i;
      }
    }
    const b = remaining.splice(bestIdx, 1)[0];
    pairs.push([a, b]);
  }
  return pairs;
}

function createRoundFromPairs(pairs, roundNum) {
  const raw = pairs.map((pair, i) => ({
    id: uid("m"),
    table: i + 1,
    p1: pair[0].id,
    p2: pair[1].id,
    winner: null,
    p1Bp: 0,
    p2Bp: 0,
    done: false,
  }));
  return {
    round: roundNum,
    locked: false,
    matches: assignMatchZones(raw),
  };
}

function saveSettingsFromForm() {
  const referees = parseInt(document.getElementById("setReferees")?.value, 10);
  const stadiums = parseInt(document.getElementById("setStadiums")?.value, 10);
  const swissRounds = parseInt(document.getElementById("setSwissRounds")?.value, 10);
  state.settings = normalizeSettings({ referees, stadiums, swissRounds });

  // 未鎖定輪次重新分配報到區
  state.rounds.forEach((r) => {
    if (!r.locked) r.matches = assignMatchZones(r.matches);
  });
  saveState();
  render();
  toast(
    `已儲存：裁判 ${state.settings.referees} · 對戰盤 ${state.settings.stadiums} · 可用站 ${getActiveStations()} · 瑞士 ${getSwissRounds()} 輪`,
    "success"
  );
}

// ─── Church radio helpers（二選一，原生互斥）────────────
function getSelectedChurch(rootSelector) {
  const root = typeof rootSelector === "string" ? document.querySelector(rootSelector) : rootSelector;
  if (!root) return null;
  const checked = root.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
  return checked ? checked.value : null;
}

function syncChurchCheckStyles(root) {
  if (!root) return;
  root.querySelectorAll(".church-check").forEach((lab) => {
    const inp = lab.querySelector("input");
    lab.classList.toggle("on", !!(inp && inp.checked));
  });
}

// ─── Actions ─────────────────────────────────────────────
function makePlayer(name, church, beys) {
  return normalizePlayer({
    id: uid("p"),
    name,
    church,
    beys: beys || emptyBeys(),
    deckChecked: false,
  });
}

function addPlayer(name, church) {
  name = (name || "").trim();
  if (!name) {
    toast("請輸入姓名", "error");
    return false;
  }
  if (state.players.length >= TOTAL_PLAYERS) {
    toast("已滿 16 人", "error");
    return false;
  }
  if (state.phase !== "setup") {
    toast("比賽已開始，無法新增選手（可改名或補登陀螺）", "error");
    return false;
  }
  if (!CHURCH[church]) {
    toast("教會無效", "error");
    return false;
  }
  state.players.push(makePlayer(name, church));
  saveState();
  render();
  toast(`已預先登記：${name}`, "success");
  return true;
}

function removePlayer(id) {
  if (state.phase !== "setup") {
    toast("比賽已開始，無法刪除選手", "error");
    return;
  }
  state.players = state.players.filter((p) => p.id !== id);
  saveState();
  render();
}

function updatePlayerName(id, name) {
  const p = playerById(id);
  if (!p) return;
  p.name = (name || "").trim() || p.name;
  saveState();
}

function updatePlayerChurch(id, church) {
  if (state.phase !== "setup") {
    toast("比賽開始後不宜改教會（影響配對統計）", "error");
    render();
    return;
  }
  const p = playerById(id);
  if (!p || !CHURCH[church]) return;
  p.church = church;
  saveState();
  render();
}

function fillDemo() {
  if (state.phase !== "setup") return;
  state.players = DEMO_PLAYERS.map(([name, church], i) => {
    const template = DEMO_DECKS[i % DEMO_DECKS.length];
    const beys = template.map(demoBeyFromTemplate);
    const p = makePlayer(name, church, beys);
    p.deckChecked = true;
    return p;
  });
  saveState();
  render();
  toast("已填入 16 人 + 示範陀螺配置", "success");
}

function startTournament() {
  if (state.players.length !== TOTAL_PLAYERS) {
    toast(`需要剛好 ${TOTAL_PLAYERS} 人（目前 ${state.players.length}）`, "error");
    return;
  }
  const incomplete = state.players.filter((p) => !isDeckComplete(p));
  if (incomplete.length) {
    const names = incomplete
      .slice(0, 5)
      .map((p) => p.name)
      .join("、");
    const more = incomplete.length > 5 ? ` 等 ${incomplete.length} 人` : "";
    if (
      !confirm(
        `尚有 ${incomplete.length} 人未完成 3 隻陀螺登記（${names}${more}）。\n仍要開始比賽？（可稍後在選手頁補登）`
      )
    ) {
      return;
    }
  } else if (!confirm("確定開始比賽並產生第 1 輪配對？開始後不可刪除選手。")) {
    return;
  }

  state.phase = "swiss";
  state.currentRound = 1;
  state.rounds = [];
  const pairs = generateSwissPairings();
  state.rounds.push(createRoundFromPairs(pairs, 1));
  saveState();
  render();
  switchTab("pairings");
  toast("第 1 輪配對已產生", "success");
}

// ─── Deck registration modal ─────────────────────────────
let deckEditPlayerId = null;
let deckEditBeyIndex = 0;
/** Working copy while modal open */
let deckDraft = null;
/** Blade picker UI state */
let bladeSeriesFilter = "ALL";
let bladeSearchQuery = "";

function openDeckModal(playerId) {
  const p = playerById(playerId);
  if (!p) return;
  normalizePlayer(p);
  deckEditPlayerId = playerId;
  deckEditBeyIndex = 0;
  deckDraft = p.beys.map((b) => normalizeBey(JSON.parse(JSON.stringify(b))));
  bladeSeriesFilter = "ALL";
  bladeSearchQuery = "";
  document.getElementById("deckModalTitle").textContent = `登記陀螺 · ${p.name}`;
  renderDeckModal();
  document.getElementById("deckModal").classList.remove("hidden");
}

function closeDeckModal() {
  document.getElementById("deckModal").classList.add("hidden");
  deckEditPlayerId = null;
  deckDraft = null;
}

function renderDeckModal() {
  const p = playerById(deckEditPlayerId);
  if (!p || !deckDraft) return;
  const body = document.getElementById("deckModalBody");
  const bey = deckDraft[deckEditBeyIndex];
  const draftPlayer = { beys: deckDraft };
  const warnings = checkDeckRestrictions(draftPlayer);
  const completeCount = deckDraft.filter(isBeyComplete).length;

  const tabs = deckDraft
    .map((b, i) => {
      const done = isBeyComplete(b);
      return `<button type="button" class="bey-tab ${i === deckEditBeyIndex ? "active" : ""} ${done ? "done" : ""}" data-bey="${i}">
        陀螺 ${i + 1}${done ? " ✓" : ""}
      </button>`;
    })
    .join("");

  const shortCombo = beyLabel(bey, { short: true });
  const fullCombo = beyLabel(bey);

  body.innerHTML = `
    <div class="deck-player-meta">
      <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
      <span class="meta">已完成 ${completeCount} / 3 隻 · 上蓋可搜尋 · 固鎖／軸心下拉選</span>
    </div>
    <div class="bey-tabs">${tabs}</div>
    <div class="deck-preview">
      <div class="combo-short">組合：<strong>${escapeHtml(shortCombo)}</strong></div>
      <div class="combo-full meta">${escapeHtml(fullCombo)}</div>
    </div>
    ${
      warnings.length
        ? `<div class="deck-restrict-warn">⚠ 限制提示：${warnings.map(escapeHtml).join("；")}</div>`
        : completeCount === 3
          ? `<div class="deck-restrict-ok">✓ 三隻已齊，未見明顯違規</div>`
          : ""
    }
    ${renderBladePicker(bey)}
    ${renderRatchetPicker(bey)}
    ${renderBitPicker(bey)}
    <div class="btn-row wrap mt-16">
      <button type="button" class="btn btn-ghost" id="btnClearBey">清空此陀螺</button>
      <button type="button" class="btn btn-secondary" id="btnCopyBey" ${deckEditBeyIndex === 0 ? "disabled" : ""}>複製陀螺1配置</button>
      <button type="button" class="btn btn-primary" id="btnSaveDeck" style="margin-left:auto">儲存 3 隻配置</button>
    </div>
  `;

  bindDeckModalEvents(body);
}

function renderBladePicker(bey) {
  const seriesBtns = ["ALL", "BX", "UX", "CX", "OTHER"]
    .map((s) => {
      const label = SERIES_LABELS[s] || s;
      return `<button type="button" class="series-chip ${bladeSeriesFilter === s ? "active" : ""}" data-series="${s}">${label}</button>`;
    })
    .join("");

  const isCxMode = bladeSeriesFilter === "CX" || bey.series === "CX" || bey.bladeId === "cx";

  // 選中顯示
  let selectedCompact = "";
  if (bey.series === "CX" || bey.bladeId === "cx") {
    selectedCompact = cxComboLabel(bey) || bey.cxProduct || "CX 組裝中";
  } else if (bey.bladeId && bey.bladeId !== "custom" && bey.bladeId !== "cx") {
    const selectedBlade = findBladeById(bey.bladeId);
    selectedCompact = selectedBlade ? bladeStaffLabel(selectedBlade) : "";
  } else if (bey.bladeId === "custom") {
    selectedCompact = bey.bladeCustom || "自訂";
  }

  return `
    <div class="part-block">
      <h4>上蓋 Blade <span class="req">必選</span>
        ${selectedCompact ? `<span class="selected-compact">已選 <strong>${escapeHtml(selectedCompact)}</strong></span>` : ""}
      </h4>
      <div class="series-row">${seriesBtns}</div>
      ${
        bladeSeriesFilter === "CX" || (bladeSeriesFilter === "ALL" && bey.series === "CX")
          ? renderCxAssembler(bey)
          : renderBxUxBladePicker(bey)
      }
    </div>
  `;
}

function renderBxUxBladePicker(bey) {
  const list = filterBlades(bladeSeriesFilter, bladeSearchQuery);
  const exactHit =
    bladeSearchQuery.trim() && list.length
      ? findBladeByQuery(bladeSearchQuery) || (list.length === 1 ? list[0] : null)
      : null;
  // CX 虛擬 blade 在 BX/UX 模式不應 quick confirm（除非 ALL）
  const canQuickConfirm =
    exactHit &&
    exactHit.series !== "CX" &&
    list.some((b) => b.id === exactHit.id || (exactHit.series === "CX" && b.compact === exactHit.compact));

  // 若輸入 CX 碼，提示轉 CX 分頁
  const cxHint = /^CX\d/i.test(normalizeCodeQuery(bladeSearchQuery));

  const options = list
    .map((b) => {
      const sel = bey.bladeId === b.id || (b.series === "CX" && bey.cxProduct === b.compact);
      const compact = b.series === "CX" ? b.compact || bladeCompactCode(b) : bladeCompactCode(b);
      const tier =
        b.tier === "T0"
          ? '<span class="tier t0">T0</span>'
          : b.tier === "T1"
            ? '<span class="tier t1">T1</span>'
            : b.series === "CX"
              ? `<span class="tier ${b.cxType === "expand" ? "t0" : "t1"}">${b.cxType === "expand" ? "Expand" : "標準"}</span>`
              : "";
      return `<button type="button" class="blade-option ${sel ? "selected" : ""}" data-blade-id="${escapeAttr(b.id)}" data-series="${b.series}" data-compact="${escapeAttr(b.compact || "")}" data-cx-type="${escapeAttr(b.cxType || "")}">
        <span class="bo-code">${escapeHtml(compact)}</span>
        <span class="bo-name">${escapeHtml(b.name)}</span>
        <span class="bo-en">${escapeHtml(b.series)}</span>
        ${tier}
      </button>`;
    })
    .join("");

  return `
      <div class="blade-code-entry">
        <input class="input blade-search" id="bladeSearchInput" inputmode="text" autocomplete="off"
          placeholder="輸入 BX49 / UX15 / CX07 / CX15 後 Enter"
          value="${escapeAttr(bladeSearchQuery)}" />
        ${
          canQuickConfirm && exactHit.series !== "CX"
            ? `<button type="button" class="btn btn-primary" id="btnConfirmBlade">確認 ${escapeHtml(bladeCompactCode(exactHit))}</button>`
            : exactHit && exactHit.series === "CX"
              ? `<button type="button" class="btn btn-primary" id="btnConfirmBlade">確認 ${escapeHtml(exactHit.compact || "")}</button>`
              : ""
        }
      </div>
      <div class="hint" style="margin:8px 0 6px">
        打 <strong>BX49</strong> / <strong>UX15</strong> / <strong>CX07</strong> / <strong>CX15</strong> 即可。
        ${cxHint ? "（偵測到 CX 編號，Enter 後進入 CX 組件選擇）" : ""}
      </div>
      <div class="blade-option-list" id="bladeOptionList">
        ${options || '<div class="empty-mini">無符合結果 — 試 BX49、UX15、CX07</div>'}
      </div>
      <div class="btn-row mt-8">
        <button type="button" class="btn btn-ghost btn-sm" id="btnBladeCustom">改為自由輸入…</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnGoCx">改用 CX 組裝…</button>
        ${
          bey.bladeId === "custom"
            ? `<input class="input" id="bladeCustomInput" style="flex:1" placeholder="自訂上蓋名稱" value="${escapeAttr(bey.bladeCustom || "")}" />`
            : ""
        }
      </div>
  `;
}

function renderCxAssembler(bey) {
  // 確保 CX 狀態
  const type = bey.cxType || resolveCxType(bey.cxProduct) || "standard";
  const isExpand = type === "expand";
  const productOpts = PARTS.cx.products
    .map(
      (p) =>
        `<option value="${p.compact}" ${bey.cxProduct === p.compact ? "selected" : ""}>${p.compact} · ${
          p.type === "expand" ? "Expand" : "標準"
        }</option>`
    )
    .join("");

  const lockOpts = PARTS.cx.lockChips
    .map(
      (c) =>
        `<option value="${escapeAttr(c.name)}" ${bey.lockChip === c.name ? "selected" : ""}>${escapeHtml(
          c.name
        )}</option>`
    )
    .join("");

  const mainList = isExpand ? PARTS.cx.metalBlades : PARTS.cx.mainBlades;
  const mainLabel = isExpand ? "金屬戰刃" : "主刃";
  const mainOpts = mainList
    .map(
      (c) =>
        `<option value="${escapeAttr(c.name)}" ${bey.mainBlade === c.name ? "selected" : ""}>${escapeHtml(
          c.name
        )}</option>`
    )
    .join("");

  const assistChips = PARTS.cx.assistBlades
    .map(
      (a) =>
        `<button type="button" class="chip ${bey.assistBlade === a.code ? "selected" : ""}" data-cx-assist="${a.code}">
          <input type="checkbox" ${bey.assistBlade === a.code ? "checked" : ""} tabindex="-1" />
          <span>${a.code}</span>
        </button>`
    )
    .join("");

  const overChips = PARTS.cx.overBlades
    .map(
      (o) =>
        `<button type="button" class="chip ${bey.overBlade === o.code ? "selected" : ""}" data-cx-over="${o.code}">
          <input type="checkbox" ${bey.overBlade === o.code ? "checked" : ""} tabindex="-1" />
          <span>${o.code}</span>
        </button>`
    )
    .join("");

  const preview = cxComboLabel(bey) || "（未完成）";
  const complete = isCxBladeComplete(bey);

  return `
    <div class="cx-assembler">
      <div class="hint" style="margin:0 0 10px">
        <strong>標準 CX</strong>（CX01–CX12，如 CX07）：紋章 + 主刃 + 輔助戰刃<br>
        <strong>Expand CX</strong>（CX13+，如 CX15）：紋章 + 金屬戰刃 + <strong>超越戰刃</strong> + 輔助戰刃
      </div>

      <div class="cx-type-row">
        <button type="button" class="series-chip ${!isExpand ? "active" : ""}" data-cx-type-set="standard">標準 CX</button>
        <button type="button" class="series-chip ${isExpand ? "active" : ""}" data-cx-type-set="expand">Expand CX</button>
      </div>

      <div class="cx-field">
        <label>產品編號（可選）</label>
        <div class="blade-code-entry">
          <select class="input select part-select" id="cxProductSelect">
            <option value="">— 選擇 CX01–CX18 —</option>
            ${productOpts}
          </select>
          <input class="input blade-search" id="cxProductInput" placeholder="或輸入 CX07 / CX15" value="${escapeAttr(
            bey.cxProduct || ""
          )}" />
        </div>
      </div>

      <div class="cx-field">
        <label>鎖定紋章 <span class="req">必選</span></label>
        <select class="input select part-select" id="cxLockSelect">
          <option value="">— 選擇紋章 —</option>
          ${lockOpts}
          <option value="__custom__" ${bey.lockChip === "__custom__" ? "selected" : ""}>其他（自填）</option>
        </select>
        <input class="input mt-8 ${bey.lockChip === "__custom__" ? "" : "hidden"}" id="cxLockCustom"
          placeholder="自訂紋章名稱" value="${escapeAttr(bey.lockChipCustom || "")}" />
        <div class="chip-grid chip-compact mt-8">
          ${PARTS.cx.lockChips
            .slice(0, 12)
            .map(
              (c) =>
                `<button type="button" class="chip ${bey.lockChip === c.name ? "selected" : ""}" data-cx-lock="${escapeAttr(
                  c.name
                )}"><span>${escapeHtml(c.name)}</span></button>`
            )
            .join("")}
        </div>
      </div>

      <div class="cx-field">
        <label>${mainLabel} <span class="req">必選</span></label>
        <select class="input select part-select" id="cxMainSelect">
          <option value="">— 選擇${mainLabel} —</option>
          ${mainOpts}
          <option value="__custom__" ${bey.mainBlade === "__custom__" ? "selected" : ""}>其他（自填）</option>
        </select>
        <input class="input mt-8 ${bey.mainBlade === "__custom__" ? "" : "hidden"}" id="cxMainCustom"
          placeholder="自訂${mainLabel}名稱" value="${escapeAttr(bey.mainBladeCustom || "")}" />
        <div class="chip-grid chip-compact mt-8">
          ${mainList
            .map(
              (c) =>
                `<button type="button" class="chip ${bey.mainBlade === c.name ? "selected" : ""}" data-cx-main="${escapeAttr(
                  c.name
                )}"><span>${escapeHtml(c.name)}</span></button>`
            )
            .join("")}
        </div>
      </div>

      ${
        isExpand
          ? `<div class="cx-field cx-over-required">
        <label>超越戰刃 <span class="req">Expand 必選（代碼）</span></label>
        <div class="chip-grid chip-compact">${overChips}</div>
        ${!(bey.overBlade || "").trim() ? `<div class="score-note warn">⚠ Expand 必須選擇超越戰刃（B / G / F / P / O）</div>` : ""}
      </div>`
          : `<div class="hint" style="margin:0 0 10px">標準 CX 無需超越戰刃</div>`
      }

      <div class="cx-field">
        <label>輔助戰刃 <span class="req">必選（代碼）</span></label>
        <div class="chip-grid chip-compact">${assistChips}</div>
      </div>

      <div class="deck-preview">
        <div class="combo-short">CX 組合：<strong>${escapeHtml(preview)}</strong>
          ${complete ? '<span class="selected-compact">✓ 完整</span>' : '<span class="meta">未齊</span>'}
        </div>
        <div class="combo-full meta">${isExpand ? "Expand" : "標準"} · 輔助／超越只顯示英文字母</div>
      </div>
    </div>
  `;
}

function selectBladeByStaffCode(query) {
  const list = filterBlades(bladeSeriesFilter === "CX" ? "ALL" : bladeSeriesFilter, query);
  let blade = findBladeByQuery(query);
  if (!blade && list.length === 1) blade = list[0];
  if (!blade) return false;

  // CX 產品 → 進入組裝
  if (blade.series === "CX" || (blade.compact && /^CX/i.test(blade.compact))) {
    const compact = blade.compact || normalizeCodeQuery(query);
    const bey = deckDraft[deckEditBeyIndex];
    applyCxProductToBey(bey, compact);
    bladeSeriesFilter = "CX";
    bladeSearchQuery = "";
    renderDeckModal();
    toast(`已選 ${compact}（${bey.cxType === "expand" ? "Expand" : "標準"}）— 請選紋章／主刃／輔助`, "success");
    return true;
  }

  applyBladeToBey(deckDraft[deckEditBeyIndex], blade);
  bladeSearchQuery = "";
  if (bladeSeriesFilter === "CX") bladeSeriesFilter = blade.series || "ALL";
  renderDeckModal();
  toast(`已選上蓋 ${bladeCompactCode(blade)}`, "success");
  return true;
}

function bindCxAssemblerEvents(body) {
  const bey = deckDraft[deckEditBeyIndex];
  if (!bey) return;

  body.querySelectorAll("[data-cx-type-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bey.series = "CX";
      bey.bladeId = "cx";
      bey.cxType = btn.dataset.cxTypeSet;
      if (bey.cxType !== "expand") bey.overBlade = "";
      // 主刃列表切換時若當前主刃不在新列表，可保留或清空
      const list = bey.cxType === "expand" ? PARTS.cx.metalBlades : PARTS.cx.mainBlades;
      if (bey.mainBlade && bey.mainBlade !== "__custom__" && !list.some((m) => m.name === bey.mainBlade)) {
        bey.mainBlade = "";
        bey.mainBladeCustom = "";
      }
      syncCxDisplayFields(bey);
      renderDeckModal();
    });
  });

  document.getElementById("cxProductSelect")?.addEventListener("change", (e) => {
    if (e.target.value) applyCxProductToBey(bey, e.target.value);
    else {
      bey.cxProduct = "";
      syncCxDisplayFields(bey);
    }
    renderDeckModal();
  });

  const cxProdIn = document.getElementById("cxProductInput");
  if (cxProdIn) {
    cxProdIn.addEventListener("change", () => {
      const v = cxProdIn.value.trim();
      if (v) applyCxProductToBey(bey, v);
      renderDeckModal();
    });
    cxProdIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = cxProdIn.value.trim();
        if (v) {
          applyCxProductToBey(bey, v);
          renderDeckModal();
        }
      }
    });
  }

  document.getElementById("cxLockSelect")?.addEventListener("change", (e) => {
    bey.series = "CX";
    bey.bladeId = "cx";
    bey.lockChip = e.target.value;
    if (bey.lockChip !== "__custom__") bey.lockChipCustom = "";
    syncCxDisplayFields(bey);
    renderDeckModal();
  });
  document.getElementById("cxLockCustom")?.addEventListener("input", (e) => {
    bey.lockChip = "__custom__";
    bey.lockChipCustom = e.target.value;
    syncCxDisplayFields(bey);
    const prev = body.querySelector(".combo-short strong");
    if (prev) prev.textContent = cxComboLabel(bey) || "（未完成）";
  });
  body.querySelectorAll("[data-cx-lock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bey.series = "CX";
      bey.bladeId = "cx";
      bey.lockChip = btn.dataset.cxLock;
      bey.lockChipCustom = "";
      syncCxDisplayFields(bey);
      renderDeckModal();
    });
  });

  document.getElementById("cxMainSelect")?.addEventListener("change", (e) => {
    bey.series = "CX";
    bey.bladeId = "cx";
    bey.mainBlade = e.target.value;
    if (bey.mainBlade !== "__custom__") bey.mainBladeCustom = "";
    syncCxDisplayFields(bey);
    renderDeckModal();
  });
  document.getElementById("cxMainCustom")?.addEventListener("input", (e) => {
    bey.mainBlade = "__custom__";
    bey.mainBladeCustom = e.target.value;
    syncCxDisplayFields(bey);
    const prev = body.querySelector(".combo-short strong");
    if (prev) prev.textContent = cxComboLabel(bey) || "（未完成）";
  });
  body.querySelectorAll("[data-cx-main]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bey.series = "CX";
      bey.bladeId = "cx";
      bey.mainBlade = btn.dataset.cxMain;
      bey.mainBladeCustom = "";
      syncCxDisplayFields(bey);
      renderDeckModal();
    });
  });

  body.querySelectorAll("[data-cx-assist]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.dataset.cxAssist;
      bey.series = "CX";
      bey.bladeId = "cx";
      bey.assistBlade = bey.assistBlade === c ? "" : c;
      syncCxDisplayFields(bey);
      renderDeckModal();
    });
  });

  body.querySelectorAll("[data-cx-over]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.dataset.cxOver;
      bey.series = "CX";
      bey.bladeId = "cx";
      bey.cxType = "expand";
      bey.overBlade = bey.overBlade === c ? "" : c;
      syncCxDisplayFields(bey);
      renderDeckModal();
    });
  });
}

function renderRatchetPicker(bey) {
  // 確保「簡易固鎖」在完整列表內
  const allRatchets = PARTS.ratchets.includes("簡易固鎖")
    ? PARTS.ratchets
    : [...PARTS.ratchets, "簡易固鎖"];
  const frequent = (PARTS.ratchetsFrequent || []).filter((r) => allRatchets.includes(r));

  const opts = allRatchets
    .map((r) => `<option value="${r}" ${bey.ratchet === r ? "selected" : ""}>${r}</option>`)
    .join("");
  return `
    <div class="part-block">
      <h4>固鎖 Ratchet <span class="req">必選</span></h4>
      <div class="chip-grid chip-compact" style="margin-bottom:10px">
        ${frequent
          .map(
            (r) =>
              `<button type="button" class="chip ${bey.ratchet === r ? "selected" : ""}" data-quick-ratchet="${escapeAttr(r)}">
                <input type="checkbox" ${bey.ratchet === r ? "checked" : ""} tabindex="-1" />
                <span>${escapeHtml(r)}</span>
              </button>`
          )
          .join("")}
      </div>
      <select class="input select part-select" id="ratchetSelect">
        <option value="">— 其他固鎖 —</option>
        ${opts}
      </select>
    </div>
  `;
}

function renderBitPicker(bey) {
  const { freq, rest } = sortedBits();
  const current = normalizeBitCode(bey.bit || "");
  // 確保草稿只存代碼
  if (bey.bit && bey.bit !== current) bey.bit = current;

  const optGroup = (label, codes) =>
    `<optgroup label="${label}">${codes
      .map((c) => `<option value="${c}" ${current === c ? "selected" : ""}>${c}</option>`)
      .join("")}</optgroup>`;

  return `
    <div class="part-block">
      <h4>軸心 Bit <span class="req">必選</span></h4>
      <div class="chip-grid chip-compact" style="margin-bottom:10px">
        ${freq
          .map(
            (c) =>
              `<button type="button" class="chip ${current === c ? "selected" : ""}" data-quick-bit="${c}">
                <input type="checkbox" ${current === c ? "checked" : ""} tabindex="-1" />
                <span>${c}</span>
              </button>`
          )
          .join("")}
      </div>
      <select class="input select part-select" id="bitSelect">
        <option value="">— 其他軸心 —</option>
        ${optGroup("常用", freq)}
        ${optGroup("全部", rest)}
      </select>
    </div>
  `;
}

function bindDeckModalEvents(body) {
  body.querySelectorAll(".bey-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      deckEditBeyIndex = Number(btn.dataset.bey);
      bladeSearchQuery = "";
      renderDeckModal();
    });
  });

  body.querySelectorAll(".series-chip[data-series]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bladeSeriesFilter = btn.dataset.series;
      bladeSearchQuery = "";
      if (bladeSeriesFilter === "CX") {
        const bey = deckDraft[deckEditBeyIndex];
        bey.series = "CX";
        bey.bladeId = "cx";
        if (!bey.cxType) bey.cxType = resolveCxType(bey.cxProduct) || "standard";
        syncCxDisplayFields(bey);
      }
      renderDeckModal();
    });
  });

  // CX 組裝事件
  if (bladeSeriesFilter === "CX" || deckDraft[deckEditBeyIndex]?.series === "CX") {
    bindCxAssemblerEvents(body);
  }

  const search = body.querySelector("#bladeSearchInput");
  if (search) {
    search.addEventListener("input", () => {
      bladeSearchQuery = search.value;
      const pos = search.selectionStart;
      renderDeckModal();
      const again = document.getElementById("bladeSearchInput");
      if (again) {
        again.focus();
        try {
          again.setSelectionRange(pos, pos);
        } catch (_) {}
      }
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = search.value.trim();
        if (!q) return;
        if (!selectBladeByStaffCode(q)) {
          toast("搵唔到呢個編號，請用 BX49 / UX15 / CX07 格式", "error");
        }
      }
    });
  }

  document.getElementById("btnConfirmBlade")?.addEventListener("click", () => {
    const q = bladeSearchQuery.trim();
    if (!selectBladeByStaffCode(q)) toast("搵唔到呢個編號", "error");
  });

  body.querySelectorAll(".blade-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.series === "CX" || (btn.dataset.compact || "").startsWith("CX")) {
        const compact = btn.dataset.compact || btn.dataset.bladeId;
        applyCxProductToBey(deckDraft[deckEditBeyIndex], compact);
        bladeSeriesFilter = "CX";
        bladeSearchQuery = "";
        renderDeckModal();
        toast(`已選 ${normalizeCodeQuery(compact)} — 請完成 CX 組件`, "success");
        return;
      }
      const blade = findBladeById(btn.dataset.bladeId);
      if (!blade) return;
      applyBladeToBey(deckDraft[deckEditBeyIndex], blade);
      bladeSearchQuery = "";
      renderDeckModal();
      toast(`已選上蓋 ${bladeCompactCode(blade)}`, "success");
    });
  });

  document.getElementById("btnGoCx")?.addEventListener("click", () => {
    bladeSeriesFilter = "CX";
    const bey = deckDraft[deckEditBeyIndex];
    bey.series = "CX";
    bey.bladeId = "cx";
    if (!bey.cxType) bey.cxType = "standard";
    syncCxDisplayFields(bey);
    renderDeckModal();
  });

  document.getElementById("btnBladeCustom")?.addEventListener("click", () => {
    const bey = deckDraft[deckEditBeyIndex];
    Object.assign(bey, emptyCxParts());
    bey.bladeId = "custom";
    bey.series = "OTHER";
    bey.bladeCode = "";
    bey.bladeEn = "";
    bey.bladeName = bey.bladeCustom || "";
    renderDeckModal();
    document.getElementById("bladeCustomInput")?.focus();
  });

  document.getElementById("bladeCustomInput")?.addEventListener("input", (e) => {
    const bey = deckDraft[deckEditBeyIndex];
    bey.bladeId = "custom";
    bey.bladeCustom = e.target.value;
    bey.bladeName = e.target.value;
    if (!bey.series) bey.series = bladeSeriesFilter === "CX" ? "CX" : "OTHER";
    const short = body.querySelector(".combo-short strong");
    const full = body.querySelector(".combo-full");
    if (short) short.textContent = beyLabel(bey, { short: true });
    if (full) full.textContent = beyLabel(bey);
  });

  document.getElementById("ratchetSelect")?.addEventListener("change", (e) => {
    deckDraft[deckEditBeyIndex].ratchet = e.target.value;
    renderDeckModal();
  });
  document.getElementById("bitSelect")?.addEventListener("change", (e) => {
    deckDraft[deckEditBeyIndex].bit = normalizeBitCode(e.target.value);
    renderDeckModal();
  });

  body.querySelectorAll("[data-quick-ratchet]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.quickRatchet;
      const bey = deckDraft[deckEditBeyIndex];
      bey.ratchet = bey.ratchet === v ? "" : v;
      renderDeckModal();
    });
  });
  body.querySelectorAll("[data-quick-bit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = normalizeBitCode(btn.dataset.quickBit);
      const bey = deckDraft[deckEditBeyIndex];
      bey.bit = bey.bit === v ? "" : v;
      renderDeckModal();
    });
  });

  document.getElementById("btnClearBey")?.addEventListener("click", () => {
    deckDraft[deckEditBeyIndex] = emptyBey();
    bladeSearchQuery = "";
    renderDeckModal();
  });
  document.getElementById("btnCopyBey")?.addEventListener("click", () => {
    deckDraft[deckEditBeyIndex] = normalizeBey(JSON.parse(JSON.stringify(deckDraft[0])));
    renderDeckModal();
  });
  document.getElementById("btnSaveDeck")?.addEventListener("click", saveDeckFromModal);
}

function saveDeckFromModal() {
  const p = playerById(deckEditPlayerId);
  if (!p || !deckDraft) return;

  for (let i = 0; i < 3; i++) {
    const b = deckDraft[i];
    const hasParts = b.ratchet || b.bit || partDisplayBlade(b) || b.lockChip || b.mainBlade;

    // CX 完整度檢查
    if (b.series === "CX" || b.bladeId === "cx") {
      if (hasParts && !isCxBladeComplete(b)) {
        deckEditBeyIndex = i;
        bladeSeriesFilter = "CX";
        renderDeckModal();
        const type = b.cxType || "standard";
        if (type === "expand" && !(b.overBlade || "").trim()) {
          toast(`陀螺 ${i + 1}：Expand CX 必須選擇超越戰刃`, "error");
        } else {
          toast(`陀螺 ${i + 1}：CX 請完成紋章 + 主刃 + 輔助戰刃`, "error");
        }
        return;
      }
      syncCxDisplayFields(b);
      continue;
    }

    if (b.bladeId === "custom" && hasParts && !(b.bladeCustom || b.bladeName || "").trim()) {
      deckEditBeyIndex = i;
      renderDeckModal();
      toast(`陀螺 ${i + 1}：請填寫上蓋名稱`, "error");
      return;
    }
  }

  const warnings = checkDeckRestrictions({ beys: deckDraft });
  if (warnings.length) {
    if (!confirm("檢測到限制提示：\n· " + warnings.join("\n· ") + "\n\n仍要儲存？")) return;
  }

  p.beys = deckDraft.map((b) => normalizeBey(JSON.parse(JSON.stringify(b))));
  p.deckChecked = isDeckComplete(p);
  saveState();
  closeDeckModal();
  render();
  toast(
    p.deckChecked ? `${p.name} 陀螺登記完成（3/3）` : `${p.name} 已儲存（完成 ${deckProgress(p)}/3）`,
    "success"
  );
}

function regeneratePairing() {
  const round = currentRoundObj();
  if (!round || round.locked) {
    toast("本輪已鎖定，無法重新配對", "error");
    return;
  }
  if (round.matches.some((m) => m.done)) {
    if (!confirm("本輪已有比賽結果，重新配對會清除本輪結果。確定？")) return;
  }
  // Remove current unlocked round and regenerate
  state.rounds = state.rounds.filter((r) => r.round !== round.round);
  const pairs = generateSwissPairings();
  state.rounds.push(createRoundFromPairs(pairs, state.currentRound));
  state.rounds.sort((a, b) => a.round - b.round);
  saveState();
  render();
  toast("已重新產生配對", "success");
}

function currentRoundObj() {
  return state.rounds.find((r) => r.round === state.currentRound);
}

function saveMatchResult(matchId, winnerId, p1Bp, p2Bp) {
  const round = currentRoundObj();
  if (!round || round.locked) {
    toast("本輪已鎖定", "error");
    return false;
  }
  const m = round.matches.find((x) => x.id === matchId);
  if (!m) return false;

  p1Bp = Math.max(0, parseInt(p1Bp, 10) || 0);
  p2Bp = Math.max(0, parseInt(p2Bp, 10) || 0);

  if (winnerId !== m.p1 && winnerId !== m.p2) {
    toast("請選擇勝方", "error");
    return false;
  }

  // 優先用分數自動判定（≥4 分勝出）
  const auto = autoWinnerFromScores(m.p1, m.p2, p1Bp, p2Bp);
  if (auto) winnerId = auto;
  const winBp = winnerId === m.p1 ? p1Bp : p2Bp;
  const loseBp = winnerId === m.p1 ? p2Bp : p1Bp;
  if (winBp < MATCH_TARGET) {
    if (!confirm(`勝方比賽分（${winBp}）未達 ${MATCH_TARGET}，仍要儲存？`)) return false;
  }

  m.winner = winnerId;
  m.p1Bp = p1Bp;
  m.p2Bp = p2Bp;
  m.done = true;
  saveState();
  render();
  toast("結果已儲存", "success");
  return true;
}

function clearMatchResult(matchId) {
  const round = currentRoundObj();
  if (!round || round.locked) return;
  const m = round.matches.find((x) => x.id === matchId);
  if (!m) return;
  m.winner = null;
  m.p1Bp = 0;
  m.p2Bp = 0;
  m.done = false;
  saveState();
  render();
}

function lockRoundAndAdvance() {
  const round = currentRoundObj();
  if (!round) return;
  if (!round.matches.every((m) => m.done)) {
    toast("請先完成所有比賽結果", "error");
    return;
  }
  if (round.locked) return;

  const isLast = state.currentRound >= getSwissRounds();
  const msg = isLast
    ? "鎖定第 4 輪並結算排名？前 4 名將晉級淘汰賽。"
    : `鎖定第 ${state.currentRound} 輪並產生第 ${state.currentRound + 1} 輪配對？`;
  if (!confirm(msg)) return;

  round.locked = true;

  if (isLast) {
    state.phase = "knockout";
    saveState();
    render();
    switchTab("standings");
    toast("瑞士制結束！請查看前 4 名", "success");
    return;
  }

  state.currentRound += 1;
  const pairs = generateSwissPairings();
  state.rounds.push(createRoundFromPairs(pairs, state.currentRound));
  saveState();
  render();
  toast(`第 ${state.currentRound} 輪配對已產生`, "success");
}

function applyManualPairings(pairIds) {
  // pairIds: [[p1,p2], ...]
  const round = currentRoundObj();
  if (!round || round.locked) {
    toast("無法調整", "error");
    return;
  }
  if (round.matches.some((m) => m.done)) {
    if (!confirm("本輪已有結果，手動調整會清除。確定？")) return;
  }
  const all = pairIds.flat();
  if (new Set(all).size !== TOTAL_PLAYERS || all.length !== TOTAL_PLAYERS) {
    toast("請確保每位選手恰好出現一次", "error");
    return;
  }
  round.matches = assignMatchZones(
    pairIds.map((pair, i) => ({
      id: uid("m"),
      table: i + 1,
      p1: pair[0],
      p2: pair[1],
      winner: null,
      p1Bp: 0,
      p2Bp: 0,
      done: false,
    }))
  );
  saveState();
  closeManualModal();
  render();
  toast("配對已更新", "success");
}

// Knockout
function startKnockout() {
  if (state.phase !== "knockout" && !(state.phase === "swiss" && state.rounds.every((r) => r.locked) && state.rounds.length === getSwissRounds())) {
    toast("請先完成 4 輪瑞士制", "error");
    return;
  }
  const ranked = rankedPlayers();
  // Check top4 ties that need playoff
  const top = ranked.slice(0, 4);
  const borderline = ranked.filter((p) => p.swissPoints === ranked[3].swissPoints);
  // If more than 4 people could claim top4 due to full ties involving rank boundary — warn
  if (ranked[3].tied && ranked.filter((r) => r.rank === ranked[3].rank).length + ranked.filter((r) => r.rank < ranked[3].rank).length > 4) {
    if (!confirm("前 4 名邊界有未解決同分，建議先加賽。仍以目前排序產生淘汰賽？")) return;
  }

  // 固定：瑞士制第 1 名 vs 第 4 名；第 2 名 vs 第 3 名（不因教會調位）
  const first = ranked[0];
  const second = ranked[1];
  const third = ranked[2];
  const fourth = ranked[3];

  state.phase = "knockout";
  state.knockout = {
    semis: [
      {
        id: uid("ko"),
        label: "準決賽 · 第1 vs 第4",
        p1: first.id,
        p2: fourth.id,
        winner: null,
        p1Bp: 0,
        p2Bp: 0,
        done: false,
      },
      {
        id: uid("ko"),
        label: "準決賽 · 第2 vs 第3",
        p1: second.id,
        p2: third.id,
        winner: null,
        p1Bp: 0,
        p2Bp: 0,
        done: false,
      },
    ],
    third: null,
    final: null,
  };
  saveState();
  render();
  switchTab("knockout");
  toast("準決賽已產生：1vs4、2vs3", "success");
}

function saveKoResult(matchRef, winnerId, p1Bp, p2Bp) {
  // matchRef: { type: 'semi'|'third'|'final', index? }
  let m;
  if (matchRef.type === "semi") m = state.knockout.semis[matchRef.index];
  else if (matchRef.type === "third") m = state.knockout.third;
  else m = state.knockout.final;
  if (!m) return false;

  const auto = autoWinnerFromScores(m.p1, m.p2, p1Bp, p2Bp);
  if (auto) winnerId = auto;
  m.winner = winnerId;
  m.p1Bp = Math.max(0, parseInt(p1Bp, 10) || 0);
  m.p2Bp = Math.max(0, parseInt(p2Bp, 10) || 0);
  m.done = true;

  // Advance
  if (matchRef.type === "semi" && state.knockout.semis.every((s) => s.done)) {
    const w1 = state.knockout.semis[0].winner;
    const w2 = state.knockout.semis[1].winner;
    const l1 = state.knockout.semis[0].p1 === w1 ? state.knockout.semis[0].p2 : state.knockout.semis[0].p1;
    const l2 = state.knockout.semis[1].p1 === w2 ? state.knockout.semis[1].p2 : state.knockout.semis[1].p1;
    state.knockout.final = {
      id: uid("ko"), label: "決賽", p1: w1, p2: w2, winner: null, p1Bp: 0, p2Bp: 0, done: false,
    };
    state.knockout.third = {
      id: uid("ko"), label: "季軍賽", p1: l1, p2: l2, winner: null, p1Bp: 0, p2Bp: 0, done: false,
    };
  }
  if (state.knockout.final?.done && state.knockout.third?.done) {
    state.phase = "done";
  }
  saveState();
  render();
  toast("淘汰賽結果已儲存", "success");
  return true;
}

function resetAll() {
  if (!confirm("確定清除全部資料？此操作無法復原。")) return;
  state = defaultState();
  saveState();
  render();
  switchTab("players");
  toast("已重置", "success");
}

// ─── Export ──────────────────────────────────────────────
function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportStandingsCsv() {
  const ranked = rankedPlayers();
  const lines = [
    "排名,姓名,教會,勝,負,瑞士分,比賽總分,陀螺1組合,陀螺1上蓋,陀螺1固鎖,陀螺1軸心,陀螺2組合,陀螺2上蓋,陀螺2固鎖,陀螺2軸心,陀螺3組合,陀螺3上蓋,陀螺3固鎖,陀螺3軸心,狀態",
  ];
  for (const p of ranked) {
    normalizePlayer(p);
    const status = p.rank <= 4 ? "晉級" : "";
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const b = p.beys[i];
      parts.push(
        beyLabel(b, { short: true }),
        partDisplayBlade(b),
        partDisplay(b, "ratchet"),
        partDisplay(b, "bit")
      );
    }
    lines.push(
      [
        p.rank,
        p.name,
        churchFull(p.church),
        p.wins,
        p.losses,
        p.swissPoints,
        p.battlePoints,
        ...parts,
        status,
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",")
    );
  }
  downloadText("寶螺盃_排名.csv", lines.join("\n"), "text/csv;charset=utf-8");
  document.getElementById("exportPreview").textContent = lines.join("\n");
  toast("已匯出排名 CSV（含陀螺）", "success");
}

function exportMatchesCsv() {
  const lines = ["輪次,場次,報到區,選手1,教會1,選手2,教會2,勝方,P1比賽分,P2比賽分,同教會"];
  for (const r of state.rounds) {
    for (const m of r.matches) {
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      const w = m.winner ? playerById(m.winner)?.name : "";
      const same = p1 && p2 && p1.church === p2.church ? "是" : "否";
      lines.push(
        [
          r.round,
          m.table,
          m.zoneLabel || zoneLabel(m.zone ?? 0),
          p1?.name || "",
          churchLabel(p1?.church),
          p2?.name || "",
          churchLabel(p2?.church),
          w,
          m.p1Bp,
          m.p2Bp,
          same,
        ].join(",")
      );
    }
  }
  downloadText("寶螺盃_對戰紀錄.csv", lines.join("\n"), "text/csv;charset=utf-8");
  document.getElementById("exportPreview").textContent = lines.join("\n");
  toast("已匯出對戰紀錄 CSV", "success");
}

function exportTextReport() {
  const ranked = rankedPlayers();
  let t = "═══ 寶螺盃 瑞士制報告 ═══\n";
  t += `產生時間：${new Date().toLocaleString("zh-HK")}\n`;
  t += `階段：${phaseLabel()}\n\n`;
  t += "【排名】\n";
  ranked.forEach((p) => {
    t += `${p.rank}. ${p.name}（${churchLabel(p.church)}） 勝${p.wins}  總分${p.battlePoints}${p.rank <= 4 ? " ★晉級" : ""}${p.tied ? " ＝同分" : ""}\n`;
  });
  t += "\n【陀螺登記】\n";
  state.players.forEach((p, i) => {
    normalizePlayer(p);
    t += `${i + 1}. ${p.name}（${churchLabel(p.church)}）${isDeckComplete(p) ? " ✓" : " 未齊"}\n`;
    p.beys.forEach((b, bi) => {
      t += `   陀螺${bi + 1}: ${beyLabel(b)}\n`;
    });
    const w = checkDeckRestrictions(p);
    if (w.length) t += `   提示: ${w.join("；")}\n`;
  });
  t += "\n【各輪對戰】\n";
  for (const r of state.rounds) {
    t += `\n— 第 ${r.round} 輪 ${r.locked ? "（已鎖定）" : ""} —\n`;
    for (const m of r.matches) {
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      const same = p1?.church === p2?.church ? "同教會" : "不同教會";
      if (m.done) {
        const w = playerById(m.winner);
        t += `  桌${m.table}: ${p1?.name} ${m.p1Bp} - ${m.p2Bp} ${p2?.name}  → 勝：${w?.name}（${same}）\n`;
      } else {
        t += `  桌${m.table}: ${p1?.name} vs ${p2?.name}（${same}） 未完成\n`;
      }
    }
  }
  if (state.knockout) {
    t += "\n【淘汰賽】\n";
    for (const m of [...state.knockout.semis, state.knockout.third, state.knockout.final].filter(Boolean)) {
      const p1 = playerById(m.p1);
      const p2 = playerById(m.p2);
      t += `  ${m.label}: ${p1?.name} vs ${p2?.name}`;
      if (m.done) t += ` → ${playerById(m.winner)?.name} 勝 (${m.p1Bp}-${m.p2Bp})`;
      t += "\n";
    }
  }
  downloadText("寶螺盃_報告.txt", t);
  document.getElementById("exportPreview").textContent = t;
  toast("已匯出文字報告", "success");
}

function exportJson() {
  downloadText("寶螺盃_備份.json", JSON.stringify(state, null, 2), "application/json");
  toast("已匯出 JSON 備份", "success");
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.players || !Array.isArray(data.players)) throw new Error("格式錯誤");
      if (!confirm("還原會覆蓋目前資料，確定？")) return;
      state = { ...defaultState(), ...data };
      state.settings = normalizeSettings(data.settings || state.settings);
      state.players = migratePlayers(state.players);
      saveState();
      render();
      toast("已還原備份", "success");
    } catch (e) {
      toast("JSON 無效：" + e.message, "error");
    }
  };
  reader.readAsText(file);
}

// ─── Render ──────────────────────────────────────────────
function phaseLabel() {
  if (state.phase === "setup") return "準備中";
  if (state.phase === "swiss") return `瑞士制 第 ${state.currentRound} 輪`;
  if (state.phase === "knockout") return "淘汰賽";
  if (state.phase === "done") return "已完賽";
  return state.phase;
}

function render() {
  document.getElementById("phasePill").textContent = phaseLabel();
  document.getElementById("roundPill").textContent =
    state.phase === "swiss"
      ? `第 ${state.currentRound} / ${getSwissRounds()} 輪`
      : state.phase === "setup"
        ? "未開始"
        : state.phase === "knockout" || state.phase === "done"
          ? "淘汰賽"
          : "—";
  renderSettings();
  renderPlayers();
  renderPairings();
  renderStandings();
  renderTies();
  renderKnockout();
  renderHeaderTime();
}

function renderHeaderTime() {
  const el = document.getElementById("saveTime");
  if (el && state.updatedAt) {
    el.textContent = "上次儲存 " + new Date(state.updatedAt).toLocaleTimeString("zh-HK");
  }
}

function renderPlayers() {
  state.players.forEach(normalizePlayer);

  document.getElementById("playerCount").textContent = `${state.players.length} / ${TOTAL_PLAYERS}`;
  const kcc = state.players.filter((p) => p.church === "kcc").length;
  const ky = state.players.filter((p) => p.church === "ky").length;
  const deckDone = state.players.filter((p) => isDeckComplete(p)).length;
  const deckPartial = state.players.filter((p) => {
    const n = deckProgress(p);
    return n > 0 && n < 3;
  }).length;
  const deckNone = state.players.length - deckDone - deckPartial;

  document.getElementById("churchSummary").innerHTML = `
    <span><span class="church-tag kcc">城基</span> <strong>${kcc}</strong> 人</span>
    <span><span class="church-tag ky">基蔭</span> <strong>${ky}</strong> 人</span>
  `;

  document.getElementById("deckSummaryBar").innerHTML = `
    <span class="ds-item">已預登姓名 <strong>${state.players.length}</strong> / ${TOTAL_PLAYERS}</span>
    <span class="ds-item ok">陀螺齊 3 隻 <strong>${deckDone}</strong></span>
    <span class="ds-item warn">部分登記 <strong>${deckPartial}</strong></span>
    <span class="ds-item">未登陀螺 <strong>${deckNone}</strong></span>
  `;

  const list = document.getElementById("playerCards");
  if (!state.players.length) {
    list.innerHTML = `<div class="empty"><div class="big">📝</div>尚未登記選手。<br>可先預先匯入／輸入 16 人姓名，活動當日再按「登記陀螺」。</div>`;
  } else {
    list.innerHTML = state.players
      .map((p, i) => {
        const prog = deckProgress(p);
        const complete = prog === 3;
        const partial = prog > 0 && prog < 3;
        const statusClass = complete ? "complete" : partial ? "partial" : "name-only";
        const statusText = complete ? "陀螺已齊 3/3" : partial ? `陀螺登記中 ${prog}/3` : "僅預登姓名";
        const cardClass = complete ? "deck-done" : partial ? "deck-partial" : "";
        const warnings = complete ? checkDeckRestrictions(p) : [];
        const beyMinis = (p.beys || emptyBeys())
          .map((b, bi) => {
            const empty = !isBeyComplete(b) && !partDisplayBlade(b) && !partDisplay(b, "ratchet") && !partDisplay(b, "bit");
            return `<div class="pc-bey-mini ${empty ? "empty" : ""}">
              <div class="bn">陀螺 ${bi + 1}${getBeyTier(b) ? ` · ${getBeyTier(b)}` : ""}</div>
              <div class="bv">${escapeHtml(beyLabel(b, { short: true }))}</div>
              <div class="bv-sub">${empty ? "" : escapeHtml(beyLabel(b))}</div>
            </div>`;
          })
          .join("");

        return `
        <div class="player-card ${cardClass}" data-id="${p.id}">
          <div class="pc-top">
            <span class="pc-num">#${i + 1}</span>
            <div class="pc-name">
              <input type="text" class="pc-name-input" data-id="${p.id}" value="${escapeAttr(p.name)}" maxlength="20" />
            </div>
            <div class="pc-church church-checks compact" data-id="${p.id}" role="radiogroup">
              <label class="church-check kcc ${p.church === "kcc" ? "on" : ""}">
                <input type="radio" class="pc-church-radio" name="church_${p.id}" data-id="${p.id}" value="kcc"
                  ${p.church === "kcc" ? "checked" : ""} ${state.phase !== "setup" ? "disabled" : ""} />
                <span>城基</span>
              </label>
              <label class="church-check ky ${p.church === "ky" ? "on" : ""}">
                <input type="radio" class="pc-church-radio" name="church_${p.id}" data-id="${p.id}" value="ky"
                  ${p.church === "ky" ? "checked" : ""} ${state.phase !== "setup" ? "disabled" : ""} />
                <span>基蔭</span>
              </label>
            </div>
            <span class="pc-status ${statusClass}">${statusText}</span>
            <div class="pc-actions">
              <button type="button" class="btn btn-primary btn-sm btn-deck" data-id="${p.id}">
                ${complete ? "修改陀螺" : "登記陀螺"}
              </button>
              ${
                state.phase === "setup"
                  ? `<button type="button" class="btn btn-ghost btn-sm btn-del" data-id="${p.id}">刪除</button>`
                  : ""
              }
            </div>
          </div>
          <div class="pc-beys">${beyMinis}</div>
          ${warnings.length ? `<div class="pc-warn">⚠ ${warnings.map(escapeHtml).join("；")}</div>` : ""}
        </div>`;
      })
      .join("");
  }

  list.querySelectorAll(".pc-name-input").forEach((inp) => {
    inp.addEventListener("change", () => updatePlayerName(inp.dataset.id, inp.value));
  });
  list.querySelectorAll(".pc-church-radio").forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      const group = radio.closest(".church-checks");
      syncChurchCheckStyles(group);
      updatePlayerChurch(radio.dataset.id, radio.value);
    });
  });
  list.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", () => removePlayer(btn.dataset.id));
  });
  list.querySelectorAll(".btn-deck").forEach((btn) => {
    btn.addEventListener("click", () => openDeckModal(btn.dataset.id));
  });

  const startBtn = document.getElementById("btnStartTournament");
  startBtn.disabled = !(state.phase === "setup" && state.players.length === TOTAL_PLAYERS);
  document.getElementById("btnFillDemo").disabled = state.phase !== "setup";
  document.getElementById("btnClearPlayers").disabled = state.phase !== "setup";
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 對戰表顯示：project = 投影看板；staff = 計分操作 */
let pairingsViewMode = "project";

function setPairingsViewMode(mode) {
  pairingsViewMode = mode === "staff" ? "staff" : "project";
  const onPairings = document.getElementById("tab-pairings")?.classList.contains("active");
  document.body.classList.toggle("projection-mode", pairingsViewMode === "project" && !!onPairings);

  document.querySelectorAll(".pair-mode-btn").forEach((b) => {
    const on = b.dataset.pairView === pairingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-primary", false);
    b.classList.toggle("btn-ghost", !on);
  });
  document.querySelectorAll(".staff-tools").forEach((el) => {
    el.style.display = pairingsViewMode === "staff" ? "" : "none";
  });
  const panel = document.querySelector(".pairings-panel");
  if (panel) {
    panel.classList.toggle("is-project", pairingsViewMode === "project");
    panel.classList.toggle("is-staff", pairingsViewMode === "staff");
  }
  // 只重繪對戰內容，避免整頁 reset 導致按鈕狀態錯亂
  renderPairings();
}

function renderMatchCardStaff(m, round, statsMap) {
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  const same = p1 && p2 && p1.church === p2.church;
  const s1 = statsMap[m.p1] || { swissPoints: 0, battlePoints: 0 };
  const s2 = statsMap[m.p2] || { swissPoints: 0, battlePoints: 0 };
  const pre1 = m.done ? s1.swissPoints - (m.winner === m.p1 ? 1 : 0) : s1.swissPoints;
  const pre2 = m.done ? s2.swissPoints - (m.winner === m.p2 ? 1 : 0) : s2.swissPoints;
  const zLabel = m.zoneLabel || zoneLabel(m.zone ?? 0);
  const zCode = m.zoneCode || zoneCode(m.zone ?? 0);

  return `
    <div class="match-card ${m.done ? "done" : ""} ${same ? "same-church" : "diff-church"}" data-zone="${zCode}">
      <div class="match-top">
        <span class="match-num">場次 ${m.table}</span>
        <span class="zone-badge zone-${zCode}">報到：${escapeHtml(zLabel)}</span>
        <span class="vs-tag ${same ? "same" : "diff"}">${same ? "同教會" : "不同教會"}</span>
      </div>
      <div class="match-players">
        <div class="player-side ${m.done && m.winner === m.p1 ? "winner" : ""} ${m.done && m.winner === m.p2 ? "loser" : ""}">
          <div class="p-name">${escapeHtml(p1?.name || "?")}</div>
          <div class="p-meta"><span class="church-tag ${p1?.church}">${churchLabel(p1?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre1} 勝</div>
          ${m.done ? `<div class="p-bp">${m.p1Bp}</div>` : ""}
        </div>
        <div class="vs-center">VS</div>
        <div class="player-side ${m.done && m.winner === m.p2 ? "winner" : ""} ${m.done && m.winner === m.p1 ? "loser" : ""}">
          <div class="p-name">${escapeHtml(p2?.name || "?")}</div>
          <div class="p-meta"><span class="church-tag ${p2?.church}">${churchLabel(p2?.church)}</span></div>
          <div class="p-meta">本輪前 ${pre2} 勝</div>
          ${m.done ? `<div class="p-bp">${m.p2Bp}</div>` : ""}
        </div>
      </div>
      <div class="match-actions">
        ${
          round.locked
            ? `<button class="btn btn-ghost btn-sm" disabled>${m.done ? "已鎖定" : "未完成"}</button>`
            : m.done
              ? `<button class="btn btn-secondary btn-sm btn-edit-score" data-id="${m.id}">修改結果</button>
                 <button class="btn btn-ghost btn-sm btn-clear-score" data-id="${m.id}">清除</button>`
              : `<button class="btn btn-primary btn-sm btn-enter-score" data-id="${m.id}">輸入結果</button>`
        }
      </div>
    </div>`;
}

/**
 * 投影看板：按報到區分行
 * 第 1 行 = A 區所有對戰（雙方放埋一齊）
 * 第 2 行 = B 區 …
 * 例：A區：甲 vs 乙 | 丙 vs 丁
 */
function renderProjectionBoard(round) {
  const stations = getActiveStations();
  const byZone = {};
  for (let z = 0; z < stations; z++) byZone[z] = [];
  round.matches.forEach((m) => {
    const z = m.zone != null ? m.zone : 0;
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(m);
  });
  // 區內按場次排序
  Object.keys(byZone).forEach((z) => {
    byZone[z].sort((a, b) => (a.table || 0) - (b.table || 0));
  });

  const zoneRows = Object.keys(byZone)
    .sort((a, b) => Number(a) - Number(b))
    .map((z) => {
      const zNum = Number(z);
      const zCode = zoneCode(zNum);
      const zLab = zoneLabel(zNum);
      const list = byZone[z];
      if (!list.length) return "";

      const matchCells = list
        .map((m) => {
          const p1 = playerById(m.p1);
          const p2 = playerById(m.p2);
          const w1 = m.done && m.winner === m.p1 ? "is-win" : m.done ? "is-lose" : "";
          const w2 = m.done && m.winner === m.p2 ? "is-win" : m.done ? "is-lose" : "";
          const score = m.done
            ? `<span class="zg-score">${m.p1Bp}–${m.p2Bp}</span>`
            : `<span class="zg-live">對戰中</span>`;
          return `
            <div class="zg-match ${m.done ? "is-done" : ""}">
              <div class="zg-pair">
                <span class="zg-p ${w1}">${escapeHtml(p1?.name || "?")}</span>
                <span class="zg-vs">VS</span>
                <span class="zg-p ${w2}">${escapeHtml(p2?.name || "?")}</span>
              </div>
              <div class="zg-sub">
                <span class="church-tag ${p1?.church || ""}">${churchLabel(p1?.church)}</span>
                <span class="zg-dot">·</span>
                <span class="church-tag ${p2?.church || ""}">${churchLabel(p2?.church)}</span>
                ${score}
              </div>
            </div>`;
        })
        .join('<div class="zg-divider" aria-hidden="true"></div>');

      return `
        <div class="zg-row zone-${zCode}">
          <div class="zg-label zone-${zCode}">
            <span class="zg-letter">${escapeHtml(zCode)}</span>
            <span class="zg-label-text">區</span>
            <span class="zg-label-full">報到 ${escapeHtml(zLab)}</span>
          </div>
          <div class="zg-matches">${matchCells}</div>
        </div>`;
    })
    .join("");

  return `
    <div class="proj-zones">
      <div class="proj-fit-head">
        <div class="proj-fit-title">第 ${round.round} 輪對戰 · 請到自己報到區</div>
      </div>
      <div class="zg-board">${zoneRows}</div>
    </div>`;
}

function renderPairings() {
  const grid = document.getElementById("matchGrid");
  const round = currentRoundObj();
  const badge = document.getElementById("pairRoundBadge");
  const lockBtn = document.getElementById("btnLockRound");
  const regenBtn = document.getElementById("btnRegenPairing");
  const manualBtn = document.getElementById("btnManualPair");
  const progress = document.getElementById("roundProgress");
  const zoneBar = document.getElementById("zoneSummaryBar");
  const panel = document.querySelector(".pairings-panel");

  if (panel) {
    panel.classList.toggle("is-project", pairingsViewMode === "project");
    panel.classList.toggle("is-staff", pairingsViewMode === "staff");
  }
  document.body.classList.toggle(
    "projection-mode",
    pairingsViewMode === "project" && document.getElementById("tab-pairings")?.classList.contains("active")
  );

  if (!round) {
    badge.textContent = "—";
    grid.innerHTML = `<div class="empty"><div class="big">📋</div>尚未開始比賽。請先在「選手」頁完成 16 人名單並開始。</div>`;
    lockBtn.disabled = true;
    regenBtn.disabled = true;
    manualBtn.disabled = true;
    progress.textContent = "";
    if (zoneBar) zoneBar.innerHTML = "";
    return;
  }

  if (!round.locked) {
    round.matches = assignMatchZones(round.matches);
  }

  const stations = getActiveStations();
  const settings = normalizeSettings(state.settings);
  badge.textContent = `第 ${round.round} / ${getSwissRounds()} 輪 · ${stations} 站`;
  const doneCount = round.matches.filter((m) => m.done).length;
  progress.textContent =
    pairingsViewMode === "project"
      ? `完成 ${doneCount} / ${round.matches.length} 場`
      : `完成進度：${doneCount} / ${round.matches.length} 場 · 報到站 ${stations}（min 裁判${settings.referees}／對戰盤${settings.stadiums}）`;
  lockBtn.disabled = round.locked || doneCount < round.matches.length;
  lockBtn.textContent =
    round.round >= getSwissRounds()
      ? `鎖定第 ${getSwissRounds()} 輪 · 結算晉級`
      : `鎖定本輪 · 進入第 ${round.round + 1} 輪`;
  regenBtn.disabled = round.locked || state.phase !== "swiss";
  manualBtn.disabled = round.locked || state.phase !== "swiss";

  const byZone = {};
  for (let z = 0; z < stations; z++) byZone[z] = [];
  round.matches.forEach((m) => {
    const z = m.zone != null ? m.zone : 0;
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(m);
  });

  if (zoneBar) {
    zoneBar.innerHTML = Object.keys(byZone)
      .sort((a, b) => Number(a) - Number(b))
      .map((z) => {
        const list = byZone[z];
        const done = list.filter((m) => m.done).length;
        return `<span class="ds-item zone-chip zone-${zoneCode(Number(z))}"><strong>${zoneLabel(Number(z))}</strong> ${done}/${list.length}</span>`;
      })
      .join("");
  }

  // ── 投影看板模式：16 人一屏 ──
  if (pairingsViewMode === "project") {
    grid.innerHTML = renderProjectionBoard(round);
    return;
  }

  // ── 計分操作模式 ──
  const statsMap = {};
  state.players.forEach((p) => {
    statsMap[p.id] = getPlayerStats(p.id);
  });

  grid.innerHTML = Object.keys(byZone)
    .sort((a, b) => Number(a) - Number(b))
    .map((z) => {
      const zNum = Number(z);
      const list = byZone[z];
      return `
        <div class="zone-section zone-${zoneCode(zNum)}">
          <div class="zone-section-header">
            <h3 class="zone-title">📍 ${zoneLabel(zNum)}</h3>
            <span class="meta">${list.length} 場</span>
          </div>
          <div class="match-grid zone-matches">
            ${list.map((m) => renderMatchCardStaff(m, round, statsMap)).join("")}
          </div>
        </div>`;
    })
    .join("");

  grid.querySelectorAll(".btn-enter-score, .btn-edit-score").forEach((btn) => {
    btn.addEventListener("click", () => openScoreModal(btn.dataset.id));
  });
  grid.querySelectorAll(".btn-clear-score").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("清除此場結果？")) clearMatchResult(btn.dataset.id);
    });
  });
}

function renderSettings() {
  const s = normalizeSettings(state.settings);
  const refEl = document.getElementById("setReferees");
  const stEl = document.getElementById("setStadiums");
  const swEl = document.getElementById("setSwissRounds");
  if (refEl) refEl.value = s.referees;
  if (stEl) stEl.value = s.stadiums;
  if (swEl) swEl.value = s.swissRounds;

  const stations = getActiveStations();
  const preview = document.getElementById("settingsPreview");
  if (preview) {
    const zones = Array.from({ length: stations }, (_, i) => zoneLabel(i)).join("、");
    preview.innerHTML = `
      <div class="hint" style="margin:0">
        <strong>實際可用報到站：${stations}</strong>
        ＝ min(裁判 ${s.referees}，對戰盤 ${s.stadiums})<br>
        本輪對戰會分派到：<strong>${zones}</strong><br>
        瑞士制共 <strong>${s.swissRounds}</strong> 輪 · 每輪 8 場（16 人）
        ${state.phase !== "setup" && state.phase !== "swiss" ? "<br><span class='meta'>比賽進行中仍可改裁判／對戰盤；未鎖定輪次會重分區。</span>" : ""}
      </div>`;
  }
}

/** 排名頁：project = 投影大字；detail = 詳細對戰紀錄 */
let standingsViewMode = "project";

function setStandingsViewMode(mode) {
  standingsViewMode = mode === "detail" ? "detail" : "project";
  document.querySelectorAll(".standings-mode-btn").forEach((b) => {
    const on = b.dataset.standingsView === standingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-ghost", !on);
  });
  const onStandings = document.getElementById("tab-standings")?.classList.contains("active");
  document.body.classList.toggle(
    "projection-mode",
    standingsViewMode === "project" && !!onStandings
  );
  // pairings projection 優先時唔好被蓋掉
  if (document.getElementById("tab-pairings")?.classList.contains("active") && pairingsViewMode === "project") {
    document.body.classList.add("projection-mode");
  }
  renderStandings();
}

function renderStandings() {
  const board = document.getElementById("standingsBoard");
  const detailPanel = document.getElementById("standingsDetailPanel");
  const tbody = document.querySelector("#standingsTable tbody");
  const meta = document.getElementById("standingsMeta");

  if (!state.players.length) {
    if (meta) meta.textContent = "";
    if (board) board.innerHTML = `<div class="empty"><div class="big">📊</div>尚未有選手資料</div>`;
    if (tbody) tbody.innerHTML = "";
    if (detailPanel) detailPanel.style.display = standingsViewMode === "detail" ? "" : "none";
    if (board) board.style.display = standingsViewMode === "project" ? "" : "none";
    return;
  }

  const ranked = rankedPlayers();
  const completedRounds = state.rounds.filter((r) => r.locked).length;
  const totalMatches = swissMatchesOnly().length;
  if (meta) {
    meta.textContent = `已鎖定 ${completedRounds} / ${getSwissRounds()} 輪 · ${totalMatches} 場完成`;
  }

  const isProject = standingsViewMode === "project";
  if (board) board.style.display = isProject ? "" : "none";
  if (detailPanel) detailPanel.style.display = isProject ? "none" : "";

  if (isProject) {
    renderStandingsProjection(ranked, completedRounds);
    return;
  }

  // 詳細紀錄表
  if (!tbody) return;
  tbody.innerHTML = ranked
    .map((p) => {
      const log = p.matchLog || [];
      const rec =
        log.length === 0
          ? "—"
          : log
              .map((entry) => {
                const opp = playerById(entry.oppId);
                const wl = entry.won ? "W" : "L";
                const wlClass = entry.won ? "rec-w" : "rec-l";
                return `<span class="rec-item ${wlClass}" title="第${entry.round}輪 vs ${escapeAttr(opp?.name || "?")}">${escapeHtml(opp?.name || "?")} <b>${wl}</b> <span class="rec-score">${entry.myBp}-${entry.oppBp}</span></span>`;
              })
              .join("");
      const status =
        p.rank <= 4 && state.phase !== "setup"
          ? completedRounds >= getSwissRounds() ||
            state.phase === "knockout" ||
            state.phase === "done"
            ? '<span class="qualify-badge">晉級</span>'
            : "前段"
          : "";
      return `
      <tr class="${p.rank <= 4 ? "top4-row" : ""}">
        <td><span class="rank-num ${p.rank <= 4 ? "top4" : ""}">${p.rank}${p.tied ? "=" : ""}</span></td>
        <td class="name-cell">${escapeHtml(p.name)}</td>
        <td><span class="church-tag ${p.church}">${churchLabel(p.church)}</span></td>
        <td>${p.wins}</td>
        <td>${p.losses}</td>
        <td><strong>${p.swissPoints}</strong></td>
        <td>${p.battlePoints}</td>
        <td class="record-mini">${rec}</td>
        <td>${status}</td>
      </tr>`;
    })
    .join("");
}

/** 投影排名：大字列出全部選手名次、勝場、比賽總分 */
function renderStandingsProjection(ranked, completedRounds) {
  const board = document.getElementById("standingsBoard");
  if (!board) return;

  const showQualify =
    completedRounds >= getSwissRounds() ||
    state.phase === "knockout" ||
    state.phase === "done";

  const rows = ranked
    .map((p) => {
      const top = p.rank <= 4;
      const status = top
        ? showQualify
          ? '<span class="sp-badge qualify">晉級</span>'
          : '<span class="sp-badge front">前 4</span>'
        : "";
      return `
        <div class="sp-row ${top ? "is-top4" : ""}">
          <div class="sp-rank ${top ? "top4" : ""}">${p.rank}${p.tied ? "=" : ""}</div>
          <div class="sp-player">
            <span class="sp-name">${escapeHtml(p.name)}</span>
            <span class="church-tag ${p.church}">${churchLabel(p.church)}</span>
          </div>
          <div class="sp-wl">
            <span class="sp-wl-num">${p.wins}</span><span class="sp-wl-sep">勝</span>
            <span class="sp-wl-num loss">${p.losses}</span><span class="sp-wl-sep">負</span>
          </div>
          <div class="sp-swiss">
            <span class="sp-label">瑞士分</span>
            <span class="sp-val">${p.swissPoints}</span>
          </div>
          <div class="sp-bp">
            <span class="sp-label">比賽總分</span>
            <span class="sp-val bp">${p.battlePoints}</span>
          </div>
          <div class="sp-status">${status}</div>
        </div>`;
    })
    .join("");

  board.innerHTML = `
    <div class="sp-board">
      <div class="sp-board-head">
        <div class="sp-board-title">即時排名 · 全部 ${ranked.length} 人</div>
        <div class="sp-board-meta">已鎖定 ${completedRounds} / ${getSwissRounds()} 輪 · 勝場優先 · 同分比對賽／比賽總分</div>
      </div>
      <div class="sp-col-head">
        <span>排名</span>
        <span>選手</span>
        <span>戰績</span>
        <span>瑞士分</span>
        <span>比賽總分</span>
        <span></span>
      </div>
      <div class="sp-list">${rows}</div>
    </div>`;
}

function renderTies() {
  const panel = document.getElementById("tieBreakPanel");
  if (!state.players.length || !swissMatchesOnly().length) {
    panel.innerHTML = `<div class="empty"><div class="big">⚖️</div>完成部分比賽後，同分情況會顯示於此。</div>`;
    return;
  }

  const ranked = rankedPlayers();
  // Group by swiss points
  const groups = {};
  for (const p of ranked) {
    groups[p.swissPoints] = groups[p.swissPoints] || [];
    groups[p.swissPoints].push(p);
  }

  const multi = Object.entries(groups)
    .filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  if (!multi.length) {
    panel.innerHTML = `<div class="empty">目前沒有瑞士積分相同的選手。</div>`;
    return;
  }

  panel.innerHTML = multi
    .map(([sp, arr]) => {
      // Build H2H matrix
      let matrix = `<table class="tie-matrix"><thead><tr><th></th>${arr
        .map((p) => `<th>${escapeHtml(p.name)}</th>`)
        .join("")}<th>總分</th></tr></thead><tbody>`;
      for (const a of arr) {
        matrix += `<tr><th>${escapeHtml(a.name)}</th>`;
        for (const b of arr) {
          if (a.id === b.id) {
            matrix += `<td>—</td>`;
          } else {
            const w = headToHead(a.id, b.id);
            if (!w) matrix += `<td style="color:var(--muted)">未對賽</td>`;
            else if (w === a.id) matrix += `<td style="color:var(--success);font-weight:800">勝</td>`;
            else matrix += `<td style="color:var(--danger)">負</td>`;
          }
        }
        matrix += `<td><strong>${a.battlePoints}</strong></td></tr>`;
      }
      matrix += `</tbody></table>`;

      // Explain resolution
      const lines = [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const w = headToHead(a.id, b.id);
          if (w) {
            lines.push(`• <strong>${escapeHtml(playerById(w).name)}</strong> 曾擊敗 ${escapeHtml(playerById(w === a.id ? b.id : a.id).name)}（對賽成績優先）`);
          } else if (a.battlePoints !== b.battlePoints) {
            const better = a.battlePoints > b.battlePoints ? a : b;
            const worse = better.id === a.id ? b : a;
            lines.push(
              `• ${escapeHtml(a.name)} 與 ${escapeHtml(b.name)} 未對賽 → 比賽總分 ${a.battlePoints} vs ${b.battlePoints}，<strong>${escapeHtml(better.name)}</strong> 較高`
            );
          } else {
            lines.push(
              `• <span class="need-playoff">⚠ ${escapeHtml(a.name)} 與 ${escapeHtml(b.name)}：未對賽且總分同為 ${a.battlePoints} → 需要加賽（先到 4 分）</span>`
            );
          }
        }
      }

      return `
      <div class="tie-group">
        <h3>瑞士積分 <span class="swiss-label">${sp} 分</span> · ${arr.length} 人</h3>
        ${matrix}
        <div class="tie-result">${lines.join("<br>") || "—"}</div>
      </div>`;
    })
    .join("");
}

function renderKnockout() {
  const box = document.getElementById("knockoutBracket");
  const btn = document.getElementById("btnStartKnockout");
  const canStart =
    (state.phase === "knockout" && !state.knockout) ||
    (state.rounds.length === getSwissRounds() && state.rounds.every((r) => r.locked) && !state.knockout);
  btn.disabled = !canStart && !!state.knockout;
  if (state.knockout) btn.disabled = true;
  else btn.disabled = !(state.rounds.length === getSwissRounds() && state.rounds.every((r) => r.locked));

  if (!state.knockout) {
    const ready = state.rounds.length === getSwissRounds() && state.rounds.every((r) => r.locked);
    box.innerHTML = ready
      ? `<div class="empty"><div class="big">🏆</div>瑞士制已完成。按上方按鈕產生準決賽（1vs4、2vs3）。</div>`
      : `<div class="empty"><div class="big">🏆</div>完成 4 輪瑞士制後可產生淘汰賽。</div>`;
    return;
  }

  const renderKoMatch = (m, type, index) => {
    if (!m) return "";
    const p1 = playerById(m.p1);
    const p2 = playerById(m.p2);
    return `
      <div class="ko-match ${m.done ? "done" : ""}">
        <div class="match-top">
          <strong>${escapeHtml(m.label)}</strong>
          ${m.done ? `<span class="vs-tag diff">勝：${escapeHtml(playerById(m.winner)?.name || "")}</span>` : ""}
        </div>
        <div class="match-players" style="margin:10px 0">
          <div class="player-side ${m.done && m.winner === m.p1 ? "winner" : ""}">
            <div class="p-name">${escapeHtml(p1?.name || "")}</div>
            <div class="p-meta"><span class="church-tag ${p1?.church}">${churchLabel(p1?.church)}</span></div>
            ${m.done ? `<div class="p-bp">${m.p1Bp}</div>` : ""}
          </div>
          <div class="vs-center">VS</div>
          <div class="player-side ${m.done && m.winner === m.p2 ? "winner" : ""}">
            <div class="p-name">${escapeHtml(p2?.name || "")}</div>
            <div class="p-meta"><span class="church-tag ${p2?.church}">${churchLabel(p2?.church)}</span></div>
            ${m.done ? `<div class="p-bp">${m.p2Bp}</div>` : ""}
          </div>
        </div>
        ${
          m.done
            ? `<button class="btn btn-secondary btn-sm btn-ko-edit" data-type="${type}" data-index="${index ?? ""}">修改</button>`
            : `<button class="btn btn-primary btn-sm btn-ko-score" data-type="${type}" data-index="${index ?? ""}">輸入結果</button>`
        }
      </div>`;
  };

  let html = `<div class="ko-round"><h3>準決賽</h3>`;
  state.knockout.semis.forEach((m, i) => {
    html += renderKoMatch(m, "semi", i);
  });
  html += `</div>`;

  if (state.knockout.third || state.knockout.final) {
    html += `<div class="ko-round"><h3>季軍賽 / 決賽</h3>`;
    if (state.knockout.third) html += renderKoMatch(state.knockout.third, "third");
    if (state.knockout.final) html += renderKoMatch(state.knockout.final, "final");
    html += `</div>`;
  }

  if (state.phase === "done" && state.knockout.final?.done) {
    const champ = playerById(state.knockout.final.winner);
    const runner = playerById(
      state.knockout.final.p1 === state.knockout.final.winner
        ? state.knockout.final.p2
        : state.knockout.final.p1
    );
    const third = state.knockout.third?.done ? playerById(state.knockout.third.winner) : null;
    html += `<div class="ko-round" style="border-color:#fbbf24">
      <h3 style="color:#fbbf24">最終名次</h3>
      <p style="font-size:1.2rem;font-weight:800;margin:8px 0">🥇 冠軍：${escapeHtml(champ?.name || "")}</p>
      <p style="font-size:1.1rem;font-weight:700">🥈 亞軍：${escapeHtml(runner?.name || "")}</p>
      ${third ? `<p style="font-size:1.05rem;font-weight:700">🥉 季軍：${escapeHtml(third.name)}</p>` : ""}
    </div>`;
  }

  box.innerHTML = html;

  box.querySelectorAll(".btn-ko-score, .btn-ko-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const index = btn.dataset.index === "" ? undefined : Number(btn.dataset.index);
      openKoScoreModal(type, index);
    });
  });
}

// ─── Score Modal ─────────────────────────────────────────
let scoreModalMatchId = null;
let scoreModalWinner = null;
let scoreModalP1Id = null;
let scoreModalP2Id = null;
let koModalRef = null;

/**
 * 根據分數自動判定勝方：
 * - 一方 ≥ 4 分、另一方 < 4 → 該方勝
 * - 雙方都 ≥ 4 → 分數較高者勝；同分則無法自動判定
 * - 雙方都 < 4 → 未完結，無勝方
 */
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

function openScoreModal(matchId) {
  const round = currentRoundObj();
  const m = round?.matches.find((x) => x.id === matchId);
  if (!m) return;
  scoreModalMatchId = matchId;
  koModalRef = null;
  scoreModalP1Id = m.p1;
  scoreModalP2Id = m.p2;
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  // 開啟時若已有分數，先自動判定
  scoreModalWinner =
    autoWinnerFromScores(m.p1, m.p2, m.p1Bp, m.p2Bp) || m.winner || null;

  document.getElementById("scoreModalTitle").textContent = `桌 ${m.table} · 輸入結果`;
  document.getElementById("scoreModalBody").innerHTML = buildScoreForm(p1, p2, m.p1Bp, m.p2Bp);
  document.getElementById("scoreModal").classList.remove("hidden");
  bindScoreForm(() => {
    const p1Bp = document.getElementById("scoreP1").value;
    const p2Bp = document.getElementById("scoreP2").value;
    const auto = autoWinnerFromScores(scoreModalP1Id, scoreModalP2Id, p1Bp, p2Bp);
    scoreModalWinner = auto || scoreModalWinner;
    if (!scoreModalWinner) {
      toast(`請輸入分數：先到 ${MATCH_TARGET} 分自動判定勝方`, "error");
      return;
    }
    if (saveMatchResult(scoreModalMatchId, scoreModalWinner, p1Bp, p2Bp)) {
      closeScoreModal();
    }
  });
}

function openKoScoreModal(type, index) {
  if (!state.knockout) {
    toast("尚未產生淘汰賽", "error");
    return;
  }
  let m = null;
  const idx = index === undefined || index === null || index === "" ? null : Number(index);
  if (type === "semi") {
    m = state.knockout.semis?.[idx];
  } else if (type === "third") {
    m = state.knockout.third;
  } else if (type === "final") {
    m = state.knockout.final;
  }
  if (!m) {
    toast("搵唔到該場比賽", "error");
    return;
  }
  const p1 = playerById(m.p1);
  const p2 = playerById(m.p2);
  if (!p1 || !p2) {
    toast("選手資料缺失", "error");
    return;
  }

  scoreModalMatchId = null;
  koModalRef = { type, index: idx };
  scoreModalP1Id = m.p1;
  scoreModalP2Id = m.p2;
  scoreModalWinner =
    autoWinnerFromScores(m.p1, m.p2, m.p1Bp, m.p2Bp) || m.winner || null;

  document.getElementById("scoreModalTitle").textContent = m.label || "淘汰賽結果";
  document.getElementById("scoreModalBody").innerHTML = buildScoreForm(
    p1,
    p2,
    m.p1Bp || 0,
    m.p2Bp || 0
  );
  document.getElementById("scoreModal").classList.remove("hidden");
  bindScoreForm(() => {
    const p1Bp = document.getElementById("scoreP1").value;
    const p2Bp = document.getElementById("scoreP2").value;
    const auto = autoWinnerFromScores(scoreModalP1Id, scoreModalP2Id, p1Bp, p2Bp);
    scoreModalWinner = auto || scoreModalWinner;
    if (!scoreModalWinner) {
      toast(`請輸入分數：先到 ${MATCH_TARGET} 分自動判定勝方`, "error");
      return;
    }
    if (saveKoResult(koModalRef, scoreModalWinner, p1Bp, p2Bp)) {
      closeScoreModal();
    }
  });
}

function buildScoreForm(p1, p2, p1Bp, p2Bp) {
  return `
    <div class="score-note">輸入雙方比賽分（BP）。<strong>≥ ${MATCH_TARGET} 分</strong> 自動判定為勝方（Extreme 3 · Over/Burst 2 · Spin 1）。</div>
    <div class="score-vs">
      <div class="score-side" id="scoreSide1" data-id="${p1.id}">
        <div class="name">${escapeHtml(p1.name)}</div>
        <input type="number" id="scoreP1" min="0" max="6" value="${p1Bp || 0}" inputmode="numeric" />
        <div class="quick">
          ${[0, 1, 2, 3, 4, 5, 6]
            .map(
              (n) =>
                `<button type="button" data-target="scoreP1" data-val="${n}">${n}</button>`
            )
            .join("")}
        </div>
        <div class="auto-win-tag" id="winTag1" hidden>勝方</div>
      </div>
      <div class="score-mid">BP</div>
      <div class="score-side" id="scoreSide2" data-id="${p2.id}">
        <div class="name">${escapeHtml(p2.name)}</div>
        <input type="number" id="scoreP2" min="0" max="6" value="${p2Bp || 0}" inputmode="numeric" />
        <div class="quick">
          ${[0, 1, 2, 3, 4, 5, 6]
            .map(
              (n) =>
                `<button type="button" data-target="scoreP2" data-val="${n}">${n}</button>`
            )
            .join("")}
        </div>
        <div class="auto-win-tag" id="winTag2" hidden>勝方</div>
      </div>
    </div>
    <div class="winner-banner" id="winnerBanner">—</div>
    <div class="score-note" id="scoreHint"></div>
    <button class="btn btn-primary" id="btnSaveScore" style="width:100%">儲存結果</button>
  `;
}

function bindScoreForm(onSave) {
  const body = document.getElementById("scoreModalBody");
  body.querySelectorAll(".quick button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inp = document.getElementById(btn.dataset.target);
      if (btn.dataset.delta) {
        inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(btn.dataset.delta));
      } else {
        inp.value = btn.dataset.val;
      }
      updateScoreHint();
    });
  });
  document.getElementById("scoreP1").addEventListener("input", updateScoreHint);
  document.getElementById("scoreP2").addEventListener("input", updateScoreHint);
  document.getElementById("btnSaveScore").addEventListener("click", onSave);
  updateScoreHint();
}

function updateScoreHint() {
  const hint = document.getElementById("scoreHint");
  const banner = document.getElementById("winnerBanner");
  const tag1 = document.getElementById("winTag1");
  const tag2 = document.getElementById("winTag2");
  const side1 = document.getElementById("scoreSide1");
  const side2 = document.getElementById("scoreSide2");
  if (!hint) return;

  const a = Math.max(0, parseInt(document.getElementById("scoreP1").value, 10) || 0);
  const b = Math.max(0, parseInt(document.getElementById("scoreP2").value, 10) || 0);
  const auto = autoWinnerFromScores(scoreModalP1Id, scoreModalP2Id, a, b);
  scoreModalWinner = auto;

  // UI 高亮
  side1?.classList.toggle("is-winner", auto === scoreModalP1Id);
  side2?.classList.toggle("is-winner", auto === scoreModalP2Id);
  side1?.classList.toggle("is-loser", auto && auto !== scoreModalP1Id);
  side2?.classList.toggle("is-loser", auto && auto !== scoreModalP2Id);
  if (tag1) {
    tag1.hidden = auto !== scoreModalP1Id;
  }
  if (tag2) {
    tag2.hidden = auto !== scoreModalP2Id;
  }

  const p1 = playerById(scoreModalP1Id);
  const p2 = playerById(scoreModalP2Id);

  if (auto) {
    const wName = auto === scoreModalP1Id ? p1?.name : p2?.name;
    const winBp = auto === scoreModalP1Id ? a : b;
    const loseBp = auto === scoreModalP1Id ? b : a;
    if (banner) {
      banner.textContent = `自動判定勝方：${wName}（${winBp} : ${loseBp}）`;
      banner.className = "winner-banner ok";
    }
    if (a >= MATCH_TARGET && b >= MATCH_TARGET && a !== b) {
      hint.textContent = `雙方都 ≥ ${MATCH_TARGET} 分，已按較高分判定勝方。`;
      hint.className = "score-note warn";
    } else {
      hint.textContent = `分數已達 ${MATCH_TARGET} 分，勝方已自動選定。可直接儲存。`;
      hint.className = "score-note";
    }
  } else if (a >= MATCH_TARGET && b >= MATCH_TARGET && a === b) {
    if (banner) {
      banner.textContent = `雙方同為 ${a} 分（≥${MATCH_TARGET}），無法自動判定 — 請調分`;
      banner.className = "winner-banner warn";
    }
    hint.textContent = `雙方分數相同且都 ≥ ${MATCH_TARGET}，請調整其中一方分數。`;
    hint.className = "score-note warn";
  } else {
    if (banner) {
      banner.textContent = `尚未判定勝方（需一方 ≥ ${MATCH_TARGET} 分）`;
      banner.className = "winner-banner";
    }
    hint.textContent = `目前 ${a} : ${b} — 先到 ${MATCH_TARGET} 分者自動勝出。`;
    hint.className = "score-note";
  }
}

function closeScoreModal() {
  document.getElementById("scoreModal").classList.add("hidden");
  scoreModalMatchId = null;
  scoreModalWinner = null;
  scoreModalP1Id = null;
  scoreModalP2Id = null;
  koModalRef = null;
}

// ─── Manual pairing modal ────────────────────────────────
function openManualModal() {
  const round = currentRoundObj();
  if (!round || round.locked) return;
  const body = document.getElementById("manualModalBody");
  const options = state.players
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}（${churchLabel(p.church)} · ${getPlayerStats(p.id).swissPoints}勝）</option>`)
    .join("");

  let rows = "";
  for (let i = 0; i < TOTAL_PLAYERS / 2; i++) {
    const m = round.matches[i];
    rows += `
      <div class="manual-pair-row">
        <select class="input select man-p1" data-i="${i}">${options}</select>
        <span style="font-weight:900;color:var(--muted)">VS</span>
        <select class="input select man-p2" data-i="${i}">${options}</select>
        <span class="match-num">桌 ${i + 1}</span>
      </div>`;
  }
  body.innerHTML = `
    <div class="hint">每位選手只能出現一次。儲存後會覆蓋本輪配對。</div>
    <div class="manual-list">${rows}</div>
    <div class="btn-row mt-16">
      <button class="btn btn-primary" id="btnSaveManual">儲存配對</button>
    </div>
  `;

  // Set current values
  body.querySelectorAll(".manual-pair-row").forEach((row, i) => {
    const m = round.matches[i];
    if (m) {
      row.querySelector(".man-p1").value = m.p1;
      row.querySelector(".man-p2").value = m.p2;
    }
  });

  document.getElementById("btnSaveManual").addEventListener("click", () => {
    const pairs = [];
    body.querySelectorAll(".manual-pair-row").forEach((row) => {
      pairs.push([row.querySelector(".man-p1").value, row.querySelector(".man-p2").value]);
    });
    // validate no self-pair
    if (pairs.some(([a, b]) => a === b)) {
      toast("同一場不能選同一人", "error");
      return;
    }
    applyManualPairings(pairs);
  });

  document.getElementById("manualModal").classList.remove("hidden");
}

function closeManualModal() {
  document.getElementById("manualModal").classList.add("hidden");
}

// ─── Tabs ────────────────────────────────────────────────
const TAB_STORAGE_KEY = "baoluo-cup-active-tab";
const VALID_TABS = ["settings", "players", "pairings", "standings", "ties", "knockout", "export"];

function getSavedTab() {
  try {
    const t = localStorage.getItem(TAB_STORAGE_KEY);
    if (t && VALID_TABS.includes(t)) return t;
  } catch (_) {}
  return "settings";
}

/** 優先用 URL hash（refresh 會保留），其次 localStorage */
function getInitialTab() {
  try {
    const hash = (location.hash || "").replace(/^#/, "").trim();
    if (VALID_TABS.includes(hash)) return hash;
  } catch (_) {}
  return getSavedTab();
}

function switchTab(name, opts = {}) {
  if (!VALID_TABS.includes(name)) name = "settings";
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.id === "tab-" + name);
  });
  try {
    localStorage.setItem(TAB_STORAGE_KEY, name);
  } catch (_) {}
  // URL hash：refresh 時瀏覽器會保留 #pairings
  if (!opts.fromHash) {
    try {
      const next = "#" + name;
      if (location.hash !== next) {
        history.replaceState(null, "", next);
      }
    } catch (_) {}
  }
  // 對戰表／排名 投影模式
  const proj =
    (name === "pairings" && pairingsViewMode === "project") ||
    (name === "standings" && standingsViewMode === "project");
  document.body.classList.toggle("projection-mode", proj);
  if (name === "pairings") renderPairings();
  if (name === "standings") renderStandings();
}

// ─── Init ────────────────────────────────────────────────
function init() {
  // Nav
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  // 瀏覽器前後按鈕 / 手動改 hash
  window.addEventListener("hashchange", () => {
    const hash = (location.hash || "").replace(/^#/, "").trim();
    if (VALID_TABS.includes(hash)) switchTab(hash, { fromHash: true });
  });
  // 還原分頁：URL #pairings 優先，其次 localStorage（refresh 會留喺同一分頁）
  switchTab(getInitialTab());


  // 新增選手：教會二選一（radio，原生互斥）
  const newChurchRoot = document.getElementById("newChurchChecks");
  if (newChurchRoot) {
    syncChurchCheckStyles(newChurchRoot);
    newChurchRoot.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", () => syncChurchCheckStyles(newChurchRoot));
    });
    // 點整塊 label 時同步樣式（雙重保險）
    newChurchRoot.querySelectorAll(".church-check").forEach((lab) => {
      lab.addEventListener("click", () => {
        // 讓瀏覽器先處理 radio，再於下一幀同步樣式
        requestAnimationFrame(() => syncChurchCheckStyles(newChurchRoot));
      });
    });
  }

  document.getElementById("btnAddPlayer").addEventListener("click", () => {
    const name = document.getElementById("newName").value;
    const church = getSelectedChurch("#newChurchChecks");
    if (!church) {
      toast("請選擇所屬教會", "error");
      return;
    }
    if (addPlayer(name, church)) {
      document.getElementById("newName").value = "";
      document.getElementById("newName").focus();
    }
  });
  document.getElementById("newName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnAddPlayer").click();
  });

  document.getElementById("btnFillDemo").addEventListener("click", fillDemo);
  document.getElementById("btnClearPlayers").addEventListener("click", () => {
    if (state.phase !== "setup") return;
    if (confirm("清空全部選手？")) {
      state.players = [];
      saveState();
      render();
    }
  });
  // 對戰表模式切換（固定工具列，不隨 matchGrid 重繪）
  const sticky = document.getElementById("pairStickyBar");
  if (sticky) {
    sticky.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pair-view]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      setPairingsViewMode(btn.dataset.pairView);
    });
  }
  // 排名頁投影／詳細切換
  document.getElementById("standingsStickyBar")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-standings-view]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    setStandingsViewMode(btn.dataset.standingsView);
  });
  // 同步按鈕樣式（唔強制 re-render 整頁，避免初始化死循環）
  document.querySelectorAll(".pair-mode-btn").forEach((b) => {
    const on = b.dataset.pairView === pairingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-ghost", !on);
  });
  document.querySelectorAll(".staff-tools").forEach((el) => {
    el.style.display = pairingsViewMode === "staff" ? "" : "none";
  });
  document.querySelectorAll(".standings-mode-btn").forEach((b) => {
    const on = b.dataset.standingsView === standingsViewMode;
    b.classList.toggle("active", on);
    b.classList.toggle("btn-secondary", on);
    b.classList.toggle("btn-ghost", !on);
  });

  document.getElementById("btnSaveSettings")?.addEventListener("click", saveSettingsFromForm);
  ["setReferees", "setStadiums", "setSwissRounds"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      // 即時預覽（未儲存）
      const referees = parseInt(document.getElementById("setReferees")?.value, 10);
      const stadiums = parseInt(document.getElementById("setStadiums")?.value, 10);
      const swissRounds = parseInt(document.getElementById("setSwissRounds")?.value, 10);
      const tmp = normalizeSettings({ referees, stadiums, swissRounds });
      const stations = Math.max(1, Math.min(tmp.referees, tmp.stadiums));
      const preview = document.getElementById("settingsPreview");
      if (preview) {
        const zones = Array.from({ length: stations }, (_, i) => zoneLabel(i)).join("、");
        preview.innerHTML = `
          <div class="hint" style="margin:0">
            <strong>預覽 · 可用報到站：${stations}</strong>
            ＝ min(裁判 ${tmp.referees}，對戰盤 ${tmp.stadiums})<br>
            會分派到：<strong>${zones}</strong> · 瑞士 <strong>${tmp.swissRounds}</strong> 輪
            <br><span class="meta">按「儲存設定」後生效</span>
          </div>`;
      }
    });
  });

  document.getElementById("btnStartTournament").addEventListener("click", startTournament);
  document.getElementById("btnCloseDeck").addEventListener("click", closeDeckModal);
  document.getElementById("deckModal").addEventListener("click", (e) => {
    if (e.target.id === "deckModal") closeDeckModal();
  });
  document.getElementById("btnRegenPairing").addEventListener("click", regeneratePairing);
  document.getElementById("btnLockRound").addEventListener("click", lockRoundAndAdvance);
  document.getElementById("btnManualPair").addEventListener("click", openManualModal);
  document.getElementById("btnCloseScore").addEventListener("click", closeScoreModal);
  document.getElementById("btnCloseManual").addEventListener("click", closeManualModal);
  document.getElementById("scoreModal").addEventListener("click", (e) => {
    if (e.target.id === "scoreModal") closeScoreModal();
  });
  document.getElementById("manualModal").addEventListener("click", (e) => {
    if (e.target.id === "manualModal") closeManualModal();
  });

  document.getElementById("btnStartKnockout").addEventListener("click", startKnockout);

  document.getElementById("btnExportStandings").addEventListener("click", exportStandingsCsv);
  document.getElementById("btnExportMatches").addEventListener("click", exportMatchesCsv);
  document.getElementById("btnExportText").addEventListener("click", exportTextReport);
  document.getElementById("btnExportJson").addEventListener("click", exportJson);
  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("jsonFileInput").click();
  });
  document.getElementById("jsonFileInput").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importJsonFile(f);
    e.target.value = "";
  });
  document.getElementById("btnResetAll").addEventListener("click", resetAll);

  render();
}

init();
