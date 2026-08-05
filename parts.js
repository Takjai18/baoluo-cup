/**
 * 寶螺盃 · Beyblade X 零件清單（上蓋 / 固鎖 / 軸心）
 * T0 / T1 依活動計劃書特別限制
 */
const PARTS = {
  blades: [
    // ── 本活動 T0 限一 ──
    { id: "wizard_rod", name: "神仗", tier: "T0" },
    { id: "shark_edge", name: "鯊魚", tier: "T0" },
    { id: "pegasus_blast", name: "天馬爆擊", tier: "T0" },
    { id: "aero_pegasus", name: "空力天馬", tier: "T0" },
    { id: "left_dragoon", name: "左膠龍", tier: "T0" },
    { id: "valkyrie", name: "女武神", tier: "T0" },
    { id: "chip_dragon", name: "薯片龍", tier: "T0" },
    { id: "emperor_crest", name: "帝王紋章", tier: "T0" },
    { id: "war_crest", name: "戰神紋章", tier: "T0" },
    // ── 本活動 T1 限一（無 T0 時可兩隻 T1）──
    { id: "phoenix", name: "鳳凰", tier: "T1" },
    { id: "left_dragon", name: "左龍", tier: "T1" },
    { id: "assault", name: "突擊", tier: "T1" },
    { id: "clock", name: "時鐘", tier: "T1" },
    { id: "bullet_griffin", name: "子彈獅鷲", tier: "T1" },
    { id: "demon_phantom", name: "惡魔幽冥", tier: "T1" },
    // ── 常用其他上蓋 ──
    { id: "dran_sword", name: "劍龍", tier: "" },
    { id: "dran_buster", name: "弓龍", tier: "" },
    { id: "dran_dagger", name: "匕首龍", tier: "" },
    { id: "hells_chain", name: "地獄鎖鏈", tier: "" },
    { id: "knight_shield", name: "騎士盾", tier: "" },
    { id: "knight_lance", name: "騎士槍", tier: "" },
    { id: "wizard_arrow", name: "魔法箭", tier: "" },
    { id: "shark_scale", name: "鯊鱗", tier: "" },
    { id: "unicorn_sting", name: "獨角獸", tier: "" },
    { id: "tyranno_beat", name: "暴龍", tier: "" },
    { id: "rhino_horn", name: "犀牛角", tier: "" },
    { id: "scythe_incisor", name: "鐮刀", tier: "" },
    { id: "hover_wyvern", name: "飛龍", tier: "" },
    { id: "leo", name: "獅子", tier: "" },
    { id: "wolf", name: "狼", tier: "" },
    { id: "cobra", name: "眼鏡蛇", tier: "" },
    { id: "other_blade", name: "其他（自填）", tier: "", custom: true },
  ],

  ratchets: [
    { id: "1-60", name: "1-60" },
    { id: "2-60", name: "2-60" },
    { id: "3-60", name: "3-60" },
    { id: "4-60", name: "4-60" },
    { id: "5-60", name: "5-60" },
    { id: "9-60", name: "9-60" },
    { id: "1-70", name: "1-70" },
    { id: "3-70", name: "3-70" },
    { id: "4-70", name: "4-70" },
    { id: "5-70", name: "5-70" },
    { id: "9-70", name: "9-70" },
    { id: "0-80", name: "0-80" },
    { id: "1-80", name: "1-80" },
    { id: "2-80", name: "2-80" },
    { id: "3-80", name: "3-80" },
    { id: "4-80", name: "4-80" },
    { id: "5-80", name: "5-80" },
    { id: "9-80", name: "9-80" },
    { id: "3-85", name: "3-85" },
    { id: "5-85", name: "5-85" },
    { id: "9-85", name: "9-85" },
    { id: "other_ratchet", name: "其他（自填）", custom: true },
  ],

  bits: [
    { id: "ball", name: "平 (Ball)" },
    { id: "needle", name: "針 (Needle)" },
    { id: "point", name: "尖 (Point)" },
    { id: "taper", name: "斜 (Taper)" },
    { id: "spike", name: "尖針 (Spike)" },
    { id: "flat", name: "平底 (Flat)" },
    { id: "low_flat", name: "低平 (Low Flat)" },
    { id: "high_ball", name: "高平 (High Ball)" },
    { id: "accel", name: "加速 (Accel)" },
    { id: "rubber_accel", name: "橡膠加速 (R.Accel)" },
    { id: "gear_ball", name: "齒輪平 (Gear Ball)" },
    { id: "gear_point", name: "齒輪尖 (Gear Point)" },
    { id: "gear_flat", name: "齒輪平地 (Gear Flat)" },
    { id: "gear_needle", name: "齒輪針 (Gear Needle)" },
    { id: "free_ball", name: "自由平 (Free Ball)" },
    { id: "orb", name: "球 (Orb)" },
    { id: "dot", name: "點 (Dot)" },
    { id: "hexa", name: "六角 (Hexa)" },
    { id: "disk_ball", name: "碟平 (Disk Ball)" },
    { id: "unite", name: "聯合 (Unite)" },
    { id: "other_bit", name: "其他（自填）", custom: true },
  ],
};

const T0_NAMES = new Set(PARTS.blades.filter((b) => b.tier === "T0").map((b) => b.name));
const T1_NAMES = new Set(PARTS.blades.filter((b) => b.tier === "T1").map((b) => b.name));

function emptyBey() {
  return { blade: "", ratchet: "", bit: "", bladeCustom: "", ratchetCustom: "", bitCustom: "" };
}

function emptyBeys() {
  return [emptyBey(), emptyBey(), emptyBey()];
}

function normalizePlayer(p) {
  if (!p.beys || !Array.isArray(p.beys) || p.beys.length !== 3) {
    p.beys = emptyBeys();
  } else {
    p.beys = p.beys.map((b) => ({
      blade: b?.blade || "",
      ratchet: b?.ratchet || "",
      bit: b?.bit || "",
      bladeCustom: b?.bladeCustom || "",
      ratchetCustom: b?.ratchetCustom || "",
      bitCustom: b?.bitCustom || "",
    }));
    while (p.beys.length < 3) p.beys.push(emptyBey());
    p.beys = p.beys.slice(0, 3);
  }
  if (typeof p.deckChecked !== "boolean") p.deckChecked = false;
  return p;
}

/** 顯示用完整零件名 */
function partDisplay(bey, field) {
  const val = bey[field] || "";
  const custom = bey[field + "Custom"] || "";
  if (!val) return "";
  if (val.includes("其他") || val === "其他（自填）") return custom || "其他";
  return val;
}

function beyLabel(bey) {
  const bl = partDisplay(bey, "blade");
  const rt = partDisplay(bey, "ratchet");
  const bt = partDisplay(bey, "bit");
  if (!bl && !rt && !bt) return "（未登記）";
  return [bl || "?", rt || "?", bt || "?"].join(" · ");
}

function isBeyComplete(bey) {
  const bl = partDisplay(bey, "blade");
  const rt = partDisplay(bey, "ratchet");
  const bt = partDisplay(bey, "bit");
  return !!(bl && rt && bt && bl !== "其他" && rt !== "其他" && bt !== "其他");
}

function isDeckComplete(player) {
  return player.beys && player.beys.length === 3 && player.beys.every(isBeyComplete);
}

function deckProgress(player) {
  if (!player.beys) return 0;
  return player.beys.filter(isBeyComplete).length;
}

/** 檢查本活動 T0/T1 限制，回傳警告字串陣列 */
function checkDeckRestrictions(player) {
  const warnings = [];
  const blades = (player.beys || [])
    .map((b) => partDisplay(b, "blade"))
    .filter(Boolean);

  let t0 = 0;
  let t1 = 0;
  const seen = new Set();
  for (const name of blades) {
    if (seen.has(name)) warnings.push(`上蓋「${name}」重複使用`);
    seen.add(name);
    if (T0_NAMES.has(name)) t0++;
    if (T1_NAMES.has(name)) t1++;
  }
  if (t0 > 1) warnings.push(`T0 上蓋超過 1 隻（目前 ${t0}）`);
  if (t0 >= 1 && t1 > 1) warnings.push(`已用 T0 時，T1 最多 1 隻（目前 T1：${t1}）`);
  if (t0 === 0 && t1 > 2) warnings.push(`無 T0 時，T1 最多 2 隻（目前 ${t1}）`);

  // 固鎖 / 軸心 通常官方限不重複（本活動檢查提示）
  const ratchets = (player.beys || []).map((b) => partDisplay(b, "ratchet")).filter(Boolean);
  const bits = (player.beys || []).map((b) => partDisplay(b, "bit")).filter(Boolean);
  const rSet = new Set();
  for (const r of ratchets) {
    if (rSet.has(r)) warnings.push(`固鎖「${r}」重複`);
    rSet.add(r);
  }
  const bSet = new Set();
  for (const b of bits) {
    if (bSet.has(b)) warnings.push(`軸心「${b}」重複`);
    bSet.add(b);
  }
  return warnings;
}
