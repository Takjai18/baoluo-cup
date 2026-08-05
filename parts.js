/**
 * 寶螺盃 · Beyblade X 零件清單
 * 上蓋：完整名 + 編號 + 系列（BX / UX / CX）
 * 固鎖 / 軸心：完整官方代碼
 */

const PARTS = {
  /**
   * code: 產品編號
   * name: 中文名
   * en: 英文名
   * series: BX | UX | CX | OTHER
   * tier: T0 | T1 | ""  （本活動特別限制）
   */
  blades: [
    // ── BX ──
    { id: "bx-01", code: "BX-01", name: "蒼龍神劍", en: "DranSword", series: "BX", tier: "" },
    { id: "bx-02", code: "BX-02", name: "惡魔紅鐮", en: "HellsScythe", series: "BX", tier: "" },
    { id: "bx-03", code: "BX-03", name: "魔導幻箭", en: "WizardArrow", series: "BX", tier: "" },
    { id: "bx-04", code: "BX-04", name: "騎士重盾", en: "KnightShield", series: "BX", tier: "" },
    { id: "bx-13", code: "BX-13", name: "騎士長槍", en: "KnightLance", series: "BX", tier: "" },
    { id: "bx-14", code: "BX-14", name: "鮫鯊鋒鰭", en: "SharkEdge", series: "BX", tier: "T0" },
    { id: "bx-15", code: "BX-15", name: "雄獅獵爪", en: "LeonClaw", series: "BX", tier: "" },
    { id: "bx-16", code: "BX-16", name: "王蛇鞭尾", en: "ViperTail", series: "BX", tier: "" },
    { id: "bx-19", code: "BX-19", name: "戰犀號角", en: "RhinoHorn", series: "BX", tier: "" },
    { id: "bx-20", code: "BX-20", name: "蒼龍利刃", en: "DranDagger", series: "BX", tier: "" },
    { id: "bx-21", code: "BX-21", name: "惡魔鎖鏈", en: "HellsChain", series: "BX", tier: "" },
    { id: "bx-23", code: "BX-23", name: "鳳凰飛翼", en: "PhoenixWing", series: "BX", tier: "T1" },
    { id: "bx-24", code: "BX-24", name: "飛龍旋翼", en: "WyvernGale", series: "BX", tier: "" },
    { id: "bx-26", code: "BX-26", name: "獨角刺心", en: "UnicornSting", series: "BX", tier: "" },
    { id: "bx-27", code: "BX-27", name: "幻神護甲", en: "SphinxCowl", series: "BX", tier: "" },
    { id: "bx-31", code: "BX-31", name: "暴龍霸擊", en: "TyrannoBeat", series: "BX", tier: "" },
    { id: "bx-33", code: "BX-33", name: "皓戰猛虎", en: "WeissTiger", series: "BX", tier: "" },
    { id: "bx-34", code: "BX-34", name: "蒼穹龍騎士", en: "CobaltDragoon", series: "BX", tier: "T0" },
    { id: "bx-36", code: "BX-36", name: "巨鯨怒濤", en: "WhaleWave", series: "BX", tier: "" },
    { id: "bx-38", code: "BX-38", name: "赫燃天鳳", en: "CrimsonGaruda", series: "BX", tier: "" },
    { id: "bx-44", code: "BX-44", name: "三角強襲", en: "TriceraPress", series: "BX", tier: "" },
    { id: "bx-45", code: "BX-45", name: "武士魂斬", en: "SamuraiCalibur", series: "BX", tier: "" },
    { id: "bx-49", code: "BX-49", name: "蒼龍突擊", en: "DranStrike", series: "BX", tier: "T1" },
    { id: "bx-50", code: "BX-50", name: "天界之環", en: "Heaven's Ring", series: "BX", tier: "" },

    // ── UX ──
    { id: "ux-01", code: "UX-01", name: "蒼龍爆刃", en: "DranBuster", series: "UX", tier: "" },
    { id: "ux-02", code: "UX-02", name: "惡魔戰鎚", en: "HellsHammer", series: "UX", tier: "" },
    { id: "ux-03", code: "UX-03", name: "魔導神杖", en: "WizardRod", series: "UX", tier: "T0" },
    { id: "ux-05", code: "UX-05", name: "忍者闇影", en: "ShinobiShadow", series: "UX", tier: "" },
    { id: "ux-06", code: "UX-06", name: "雄獅紋章", en: "LeonCrest", series: "UX", tier: "" },
    { id: "ux-07", code: "UX-07", name: "鳳凰尾翼", en: "PhoenixRudder", series: "UX", tier: "T1" },
    { id: "ux-08", code: "UX-08", name: "霜輝銀狼", en: "SilverWolf", series: "UX", tier: "" },
    { id: "ux-09", code: "UX-09", name: "武士星劍", en: "SamuraiSaber", series: "UX", tier: "" },
    { id: "ux-10", code: "UX-10", name: "騎士圓甲", en: "KnightMail", series: "UX", tier: "" },
    { id: "ux-11", code: "UX-11", name: "衝擊龍神", en: "ImpactDrake", series: "UX", tier: "" },
    { id: "ux-14", code: "UX-14", name: "天蠍長矛", en: "ScorpioSpear", series: "UX", tier: "" },
    { id: "ux-15", code: "UX-15", name: "鮫鯊狂鱗", en: "SharkScale", series: "UX", tier: "" },
    { id: "ux-16", code: "UX-16", name: "時鐘幻影", en: "ClockMirage", series: "UX", tier: "T1" },
    { id: "ux-17", code: "UX-17", name: "隕星龍騎士", en: "MeteorDragoon", series: "UX", tier: "T1" },
    { id: "ux-19", code: "UX-19", name: "子彈獅鷲", en: "BulletGriffon", series: "UX", tier: "T1" },
    { id: "ux-20", code: "UX-20", name: "榮耀戰神", en: "GloryValkyrie", series: "UX", tier: "T0" },
    { id: "ux-21", code: "UX-21", name: "惡魔幽冥", en: "HellsNether", series: "UX", tier: "T1" },

    // ── 活動限制但列表未列全者（OTHER，仍可選）──
    { id: "t0-pegasus-blast", code: "T0", name: "天馬爆擊", en: "PegasusBlast", series: "OTHER", tier: "T0" },
    { id: "t0-aero-pegasus", code: "T0", name: "空力天馬", en: "AeroPegasus", series: "OTHER", tier: "T0" },
    { id: "t0-chip-dragon", code: "T0", name: "薯片龍", en: "ChipDragon", series: "OTHER", tier: "T0" },
    { id: "t0-emperor-crest", code: "T0", name: "帝王紋章", en: "EmperorCrest", series: "OTHER", tier: "T0" },
    { id: "t0-war-crest", code: "T0", name: "戰神紋章", en: "WarCrest", series: "OTHER", tier: "T0" },
  ],

  /** 固鎖完整列表 */
  ratchets: [
    "0-60", "0-70", "0-80",
    "1-50", "1-60", "1-70", "1-80",
    "2-60", "2-70", "2-80",
    "3-60", "3-70", "3-80", "3-85",
    "4-50", "4-55", "4-60", "4-70", "4-80",
    "5-60", "5-70", "5-80",
    "6-60", "6-70", "6-80",
    "7-55", "7-60", "7-70", "7-80",
    "8-70", "8-80",
    "9-60", "9-65", "9-70", "9-80",
    "M-85",
  ],

  /** 軸心完整列表（只顯示代碼） */
  bits: [
    "F", "LF", "R", "A", "Q", "C", "L", "LR", "V", "GR", "Tr", "UF", "J", "FF", "RA",
    "T", "HT", "P", "GP", "H", "U", "E", "TP", "M", "K", "Z", "Op", "I",
    "B", "O", "GB", "DB", "G", "FB", "LO", "WB",
    "N", "HN", "S", "GN", "MN", "UN", "BS", "Nr", "DS", "GU",
  ],

  /** 常用軸心（排序置頂） */
  bitsFrequent: ["H", "LR", "R", "FB", "O", "LO", "P", "E", "J", "L", "K", "UF", "A"],
};

const SERIES_LABELS = {
  ALL: "全部",
  BX: "BX 系列",
  UX: "UX 系列",
  CX: "CX（自填）",
  OTHER: "其他／限制款",
};

function emptyBey() {
  return {
    bladeId: "",
    bladeCode: "",
    bladeName: "",
    bladeEn: "",
    series: "",
    bladeCustom: "",
    ratchet: "",
    bit: "",
  };
}

function emptyBeys() {
  return [emptyBey(), emptyBey(), emptyBey()];
}

function normalizePlayer(p) {
  if (!p.beys || !Array.isArray(p.beys) || p.beys.length !== 3) {
    p.beys = emptyBeys();
  } else {
    p.beys = p.beys.map((b) => normalizeBey(b));
    while (p.beys.length < 3) p.beys.push(emptyBey());
    p.beys = p.beys.slice(0, 3);
  }
  if (typeof p.deckChecked !== "boolean") p.deckChecked = false;
  return p;
}

/** 相容舊版字串結構 */
function normalizeBey(b) {
  if (!b || typeof b !== "object") return emptyBey();
  const out = emptyBey();

  // 新結構
  if (b.bladeId || b.bladeCode || b.bladeName || b.bladeCustom) {
    out.bladeId = b.bladeId || "";
    out.bladeCode = b.bladeCode || "";
    out.bladeName = b.bladeName || "";
    out.bladeEn = b.bladeEn || "";
    out.series = b.series || "";
    out.bladeCustom = b.bladeCustom || "";
    out.ratchet = b.ratchet || "";
    out.bit = normalizeBitCode(b.bit || "");
    return out;
  }

  // 舊結構：blade / ratchet / bit 字串 + *Custom
  out.ratchet = b.ratchet || "";
  out.bit = normalizeBitCode(stripBitName(b.bit || ""));
  const oldBlade = (b.blade || "").trim();
  if (oldBlade.includes("其他") || oldBlade === "其他（自填）") {
    out.bladeId = "custom";
    out.series = "CX";
    out.bladeCustom = b.bladeCustom || "";
    out.bladeName = out.bladeCustom;
  } else if (oldBlade) {
    const found = findBladeByQuery(oldBlade);
    if (found) {
      applyBladeToBey(out, found);
    } else {
      out.bladeId = "custom";
      out.series = "OTHER";
      out.bladeCustom = b.bladeCustom || oldBlade;
      out.bladeName = out.bladeCustom;
    }
  }
  return out;
}

function stripBitName(s) {
  // "平 (Ball)" → try extract code; else keep
  const m = String(s).match(/\(([A-Za-z]+)\)/);
  if (m) return m[1];
  // map old Chinese names roughly
  const map = {
    "平 (Ball)": "B",
    "針 (Needle)": "N",
    "尖 (Point)": "P",
    "斜 (Taper)": "T",
    "尖針 (Spike)": "S",
    "平底 (Flat)": "F",
    "低平 (Low Flat)": "LF",
    "高平 (High Ball)": "H",
    "加速 (Accel)": "A",
    "橡膠加速 (R.Accel)": "RA",
    "齒輪平 (Gear Ball)": "GB",
    "齒輪尖 (Gear Point)": "GP",
    "齒輪平地 (Gear Flat)": "G",
    "齒輪針 (Gear Needle)": "GN",
    "自由平 (Free Ball)": "FB",
  };
  return map[s] || s;
}

function normalizeBitCode(code) {
  const c = String(code || "").trim();
  if (!c) return "";
  // case-insensitive match against list
  const hit = PARTS.bits.find((x) => x.toLowerCase() === c.toLowerCase());
  return hit || c;
}

function findBladeById(id) {
  return PARTS.blades.find((b) => b.id === id) || null;
}

/**
 * 精簡編號：BX-49 → BX49、UX-15 → UX15（工作人員主要輸入格式）
 */
function bladeCompactCode(bladeOrCode) {
  if (!bladeOrCode) return "";
  const code = typeof bladeOrCode === "string" ? bladeOrCode : bladeOrCode.code;
  if (!code || code === "T0" || code === "T1") return code || "";
  // BX-49 / UX-01 → BX49 / UX01（保留前導零較易對表；另提供無前導零鍵）
  return String(code).replace(/-/g, "").toUpperCase();
}

/** BX49 / bx-49 / BX 49 / ux15 → 正規化為可比對字串 */
function normalizeCodeQuery(q) {
  return String(q || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

/** 從輸入抽出系列+數字：BX49、UX15、49（僅數字則靠 series filter） */
function parseCompactBladeQuery(q) {
  const n = normalizeCodeQuery(q);
  if (!n) return null;
  const m = n.match(/^(BX|UX|CX)(\d{1,3})$/i);
  if (m) {
    return { series: m[1].toUpperCase(), num: String(parseInt(m[2], 10)), raw: n };
  }
  if (/^\d{1,3}$/.test(n)) {
    return { series: null, num: String(parseInt(n, 10)), raw: n };
  }
  return null;
}

function bladeMatchesCompact(blade, compactQuery) {
  if (!blade || !compactQuery) return false;
  const compact = bladeCompactCode(blade); // e.g. BX49
  const n = normalizeCodeQuery(compactQuery);
  if (!n) return false;
  if (compact === n) return true;
  // BX049 vs BX49
  const parsed = parseCompactBladeQuery(n);
  if (!parsed) return compact.includes(n) || n.includes(compact);
  if (parsed.series && blade.series !== parsed.series && blade.code.indexOf(parsed.series) !== 0) {
    // series mismatch
    if (blade.series !== parsed.series) return false;
  }
  const bladeNum = String(blade.code).replace(/^[A-Z]+-?/i, "").replace(/^0+/, "") || "0";
  const qNum = String(parsed.num).replace(/^0+/, "") || "0";
  if (parsed.series) {
    return blade.series === parsed.series && bladeNum === qNum;
  }
  return bladeNum === qNum;
}

function findBladeByQuery(q) {
  const t = String(q || "").trim();
  if (!t) return null;
  const compact = normalizeCodeQuery(t);

  // 1) 精確精簡碼：BX49、UX15
  const exactCompact = PARTS.blades.find((b) => bladeCompactCode(b) === compact);
  if (exactCompact) return exactCompact;

  // 2) 系列+數字（容忍前導零）
  const byCompact = PARTS.blades.find((b) => bladeMatchesCompact(b, t));
  if (byCompact) return byCompact;

  const lower = t.toLowerCase();
  return (
    PARTS.blades.find(
      (b) =>
        b.id === lower ||
        b.code.toLowerCase() === lower ||
        b.name.toLowerCase() === lower ||
        b.en.toLowerCase() === lower ||
        `${b.code} ${b.name}`.toLowerCase() === lower ||
        bladeFullLabel(b).toLowerCase() === lower
    ) ||
    PARTS.blades.find(
      (b) =>
        b.name.includes(t) ||
        b.en.toLowerCase().includes(lower) ||
        b.code.toLowerCase().includes(lower) ||
        bladeCompactCode(b).toLowerCase().includes(compact.toLowerCase())
    ) ||
    null
  );
}

function applyBladeToBey(bey, blade) {
  bey.bladeId = blade.id;
  bey.bladeCode = blade.code;
  bey.bladeName = blade.name;
  bey.bladeEn = blade.en;
  bey.series = blade.series;
  bey.bladeCustom = "";
}

/** 工作人員用短標籤：BX49 */
function bladeStaffLabel(blade) {
  if (!blade) return "";
  if (blade.series === "OTHER" || blade.code === "T0" || blade.code === "T1") {
    return blade.name;
  }
  return bladeCompactCode(blade);
}

function bladeFullLabel(blade) {
  if (!blade) return "";
  if (blade.series === "OTHER" || blade.code === "T0" || blade.code === "T1") {
    return `${blade.name} (${blade.en})`;
  }
  // 顯示精簡碼為主：BX49 蒼龍突擊
  return `${bladeCompactCode(blade)} ${blade.name}`;
}

/** 顯示用上蓋名稱（完整） */
function partDisplayBlade(bey) {
  if (!bey) return "";
  if (bey.bladeId === "custom" || bey.series === "CX") {
    return (bey.bladeCustom || bey.bladeName || "").trim();
  }
  if (bey.bladeId) {
    const b = findBladeById(bey.bladeId);
    if (b) return bladeFullLabel(b);
  }
  if (bey.bladeCode && bey.bladeName) {
    if (bey.bladeCode === "T0" || bey.bladeCode === "T1") {
      return `${bey.bladeName}${bey.bladeEn ? ` (${bey.bladeEn})` : ""}`;
    }
    return `${bey.bladeCode} ${bey.bladeName}${bey.bladeEn ? ` (${bey.bladeEn})` : ""}`;
  }
  return (bey.bladeName || bey.bladeCustom || "").trim();
}

/** 短名（用於組合顯示）— 優先系列編號 BX49 */
function partDisplayBladeShort(bey) {
  if (!bey) return "";
  if (bey.bladeId === "custom" || bey.series === "CX") {
    return (bey.bladeCustom || bey.bladeName || "").trim();
  }
  if (bey.bladeId) {
    const b = findBladeById(bey.bladeId);
    if (b) return bladeStaffLabel(b);
  }
  if (bey.bladeCode && bey.bladeCode !== "T0" && bey.bladeCode !== "T1") {
    return bladeCompactCode(bey.bladeCode);
  }
  if (bey.bladeName) return bey.bladeName;
  return partDisplayBlade(bey);
}

function partDisplay(bey, field) {
  if (field === "blade") return partDisplayBlade(bey);
  if (field === "ratchet") return (bey?.ratchet || "").trim();
  if (field === "bit") return (bey?.bit || "").trim();
  return "";
}

/** 完整組合：BX49 3-60 J 或 BX49 蒼龍突擊 3-60 J */
function beyLabel(bey, opts = {}) {
  const rt = partDisplay(bey, "ratchet");
  const bt = partDisplay(bey, "bit");
  if (!partDisplayBlade(bey) && !rt && !bt) return "（未登記）";
  // 短顯示：BX49 3-60 J（現場主用）
  if (opts.short) {
    const shortBl = partDisplayBladeShort(bey) || "?";
    return [shortBl, rt || "?", bt || "?"].join(" ");
  }
  // 完整：BX49 蒼龍突擊 3-60 J
  return [partDisplayBlade(bey) || "?", rt || "?", bt || "?"].join(" ");
}

function isBeyComplete(bey) {
  const bl = partDisplayBlade(bey);
  const rt = partDisplay(bey, "ratchet");
  const bt = partDisplay(bey, "bit");
  return !!(bl && rt && bt);
}

function isDeckComplete(player) {
  return player.beys && player.beys.length === 3 && player.beys.every(isBeyComplete);
}

function deckProgress(player) {
  if (!player.beys) return 0;
  return player.beys.filter(isBeyComplete).length;
}

function getBeyTier(bey) {
  if (bey.bladeId && bey.bladeId !== "custom") {
    const b = findBladeById(bey.bladeId);
    if (b?.tier) return b.tier;
  }
  // custom text match activity keywords
  const name = partDisplayBladeShort(bey) || partDisplayBlade(bey);
  const t0 = ["神仗", "魔導神杖", "鯊魚", "鮫鯊鋒鰭", "天馬爆擊", "空力天馬", "左膠龍", "蒼穹龍騎士", "女武神", "榮耀戰神", "薯片龍", "帝王紋章", "戰神紋章"];
  const t1 = ["鳳凰", "鳳凰飛翼", "鳳凰尾翼", "左龍", "隕星龍騎士", "突擊", "蒼龍突擊", "時鐘", "時鐘幻影", "子彈獅鷲", "惡魔幽冥"];
  if (t0.some((k) => name.includes(k))) return "T0";
  if (t1.some((k) => name.includes(k))) return "T1";
  return "";
}

/** 檢查本活動 T0/T1 限制 */
function checkDeckRestrictions(player) {
  const warnings = [];
  const blades = (player.beys || [])
    .map((b) => ({
      full: partDisplayBlade(b),
      short: partDisplayBladeShort(b),
      tier: getBeyTier(b),
      id: b.bladeId || partDisplayBlade(b),
    }))
    .filter((x) => x.full);

  let t0 = 0;
  let t1 = 0;
  const seen = new Set();
  for (const b of blades) {
    const key = b.short || b.full;
    if (seen.has(key)) warnings.push(`上蓋「${key}」重複使用`);
    seen.add(key);
    if (b.tier === "T0") t0++;
    if (b.tier === "T1") t1++;
  }
  if (t0 > 1) warnings.push(`T0 上蓋超過 1 隻（目前 ${t0}）`);
  if (t0 >= 1 && t1 > 1) warnings.push(`已用 T0 時，T1 最多 1 隻（目前 T1：${t1}）`);
  if (t0 === 0 && t1 > 2) warnings.push(`無 T0 時，T1 最多 2 隻（目前 ${t1}）`);

  const ratchets = (player.beys || []).map((b) => partDisplay(b, "ratchet")).filter(Boolean);
  const bits = (player.beys || []).map((b) => partDisplay(b, "bit")).filter(Boolean);
  const rSet = new Set();
  for (const r of ratchets) {
    if (rSet.has(r)) warnings.push(`固鎖「${r}」重複`);
    rSet.add(r);
  }
  const bSet = new Set();
  for (const bit of bits) {
    if (bSet.has(bit)) warnings.push(`軸心「${bit}」重複`);
    bSet.add(bit);
  }
  return warnings;
}

function filterBlades(series, query) {
  let list = PARTS.blades.slice();
  if (series && series !== "ALL" && series !== "CX") {
    list = list.filter((b) => b.series === series);
  }
  if (series === "CX") {
    // CX 以自填為主，列表可空
    list = [];
  }
  const raw = String(query || "").trim();
  if (!raw) return list;

  const compact = normalizeCodeQuery(raw);
  const lower = raw.toLowerCase();
  const parsed = parseCompactBladeQuery(raw);

  // 有系列+數字時，優先精確／數字匹配（BX49、UX15）
  const scored = list
    .map((b) => {
      let score = 0;
      const bCompact = bladeCompactCode(b);
      if (bCompact === compact) score = 100;
      else if (bladeMatchesCompact(b, raw)) score = 90;
      else if (bCompact.startsWith(compact) || compact.startsWith(bCompact)) score = 70;
      else if (b.code.toLowerCase().includes(lower) || bCompact.includes(compact)) score = 50;
      else if (b.name.toLowerCase().includes(lower) || b.en.toLowerCase().includes(lower)) score = 30;
      else if (`${b.code} ${b.name}`.toLowerCase().includes(lower)) score = 20;
      else score = 0;
      // 僅輸入數字時，若已選系列 filter 則加強
      if (parsed && !parsed.series && series && series !== "ALL") {
        const bladeNum = String(b.code).replace(/^[A-Z]+-?/i, "").replace(/^0+/, "") || "0";
        if (bladeNum === parsed.num) score = Math.max(score, 85);
      }
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.b.code.localeCompare(b.b.code));

  return scored.map((x) => x.b);
}

function sortedBits() {
  const freq = PARTS.bitsFrequent.filter((c) => PARTS.bits.includes(c));
  const rest = PARTS.bits.filter((c) => !freq.includes(c));
  return { freq, rest, all: [...freq, ...rest] };
}
