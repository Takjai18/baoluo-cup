/**
 * 寶螺盃 · 入圍加賽規則（純邏輯，無 DOM）
 *
 * 入圍同種子分開。不同自動獲勝次數嘅人，瑞士總 BP 唔直接比。
 * 加賽先到 4（最多 6）：多數情況把該場 BP 加進總分再比，打贏唔等於入圍。
 * 5 人以上真同分：抽籤種子／種子線小型淘汰，打贏出線，唔計 BP。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BaoluoCutoff = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PLAYOFF_CATCHUP_MAX = 6;

  function shuffleList(arr, rng) {
    const a = [...arr];
    const rand = typeof rng === "function" ? rng : Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sortBpName(players) {
    return [...players].sort((a, b) => {
      if (b.battlePoints !== a.battlePoints) return b.battlePoints - a.battlePoints;
      return String(a.name || a.id).localeCompare(String(b.name || b.id), "zh-Hant");
    });
  }

  function namesOf(players) {
    return players.map((p) => p.name || p.id).join("、");
  }

  function byIdMap(players) {
    const m = {};
    for (const p of players) m[p.id] = p;
    return m;
  }

  function withCredits(players, credits) {
    return players.map((p) => ({
      ...p,
      battlePoints: (p.battlePoints || 0) + (credits[p.id] || 0),
    }));
  }

  function matchCredits(matches) {
    const c = {};
    for (const m of matches || []) {
      if (!m.done || m.creditBp === false) continue;
      c[m.p1] = (c[m.p1] || 0) + (m.p1Bp || 0);
      c[m.p2] = (c[m.p2] || 0) + (m.p2Bp || 0);
    }
    return c;
  }

  function bandAtCut(sorted, spots) {
    if (!sorted.length) {
      return { cutBp: 0, clearIn: [], tied: [], clearOut: [], spotsLeft: spots };
    }
    if (spots >= sorted.length) {
      return { cutBp: sorted[sorted.length - 1].battlePoints, clearIn: sorted, tied: [], clearOut: [], spotsLeft: 0 };
    }
    if (spots <= 0) {
      return { cutBp: Infinity, clearIn: [], tied: [], clearOut: sorted, spotsLeft: 0 };
    }
    const cutBp = sorted[spots - 1].battlePoints;
    const clearIn = sorted.filter((p) => p.battlePoints > cutBp);
    const tied = sorted.filter((p) => p.battlePoints === cutBp);
    const clearOut = sorted.filter((p) => p.battlePoints < cutBp);
    return { cutBp, clearIn, tied, clearOut, spotsLeft: spots - clearIn.length };
  }

  function allMatchesDone(matches) {
    return !!(matches && matches.length && matches.every((m) => m.done && m.winner));
  }

  function h2hOfMatch(matches, aId, bId) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (!m.done || !m.winner) continue;
      if ((m.p1 === aId && m.p2 === bId) || (m.p1 === bId && m.p2 === aId)) return m.winner;
    }
    return null;
  }

  /** 2 人：BP → 對賽 → 加賽 */
  function splitTwo(a, b, spotsLeft, h2h, lines) {
    if (spotsLeft >= 2) return { resolved: true, qualifierIds: [a.id, b.id], lines };
    if (spotsLeft <= 0) return { resolved: true, qualifierIds: [], lines };
    if (a.battlePoints !== b.battlePoints) {
      const win = a.battlePoints > b.battlePoints ? a : b;
      lines.push(`兩人總分 ${a.name} ${a.battlePoints} vs ${b.name} ${b.battlePoints} → ${win.name} 入圍。`);
      return { resolved: true, qualifierIds: [win.id], lines };
    }
    const h = h2h ? h2h(a.id, b.id) : null;
    if (h) {
      const wName = h === a.id ? a.name : b.name;
      lines.push(`兩人總分相同，對賽已分 → ${wName} 入圍。`);
      return { resolved: true, qualifierIds: [h], lines };
    }
    lines.push(`兩人總分同為 ${a.battlePoints} 且未對賽 → 加賽（先到 4，打完加本場 BP 再比）。`);
    return {
      resolved: false,
      needsMatches: true,
      chain: "pair",
      tiedIds: [a.id, b.id],
      take: 1,
      firstMatches: [
        { p1: a.id, p2: b.id, wave: 1, creditBp: true, role: "pair", label: "入圍加賽 · 對賽" },
      ],
      lines,
    };
  }

  function analyzeSameBye(group, spots, h2h, lines) {
    lines = lines || [];
    if (group.length <= spots) {
      return { resolved: true, qualifierIds: group.map((p) => p.id), needsMatches: false, chain: null, preQualifyIds: [], lines };
    }
    if (spots <= 0) {
      return { resolved: true, qualifierIds: [], needsMatches: false, chain: null, preQualifyIds: [], lines };
    }

    const sorted = sortBpName(group);
    const { cutBp, clearIn, tied, spotsLeft } = bandAtCut(sorted, spots);
    const preQualifyIds = clearIn.map((p) => p.id);

    if (clearIn.length) {
      lines.push(`比賽總分已可先入圍：${clearIn.map((p) => `${p.name}（${p.battlePoints}）`).join("、")}。`);
    }

    if (tied.length <= spotsLeft) {
      if (tied.length === 2 && spotsLeft === 1) {
        return splitTwo(tied[0], tied[1], 1, h2h, lines);
      }
      lines.push("用總分已可分清入圍，無需加賽。");
      return {
        resolved: true,
        qualifierIds: preQualifyIds.concat(tied.map((p) => p.id)),
        needsMatches: false,
        chain: null,
        preQualifyIds,
        lines,
      };
    }

    const n = tied.length;
    const s = spotsLeft;

    if (n === 2 && s === 1) {
      const r = splitTwo(tied[0], tied[1], 1, h2h, lines);
      r.preQualifyIds = preQualifyIds;
      if (r.resolved) r.qualifierIds = preQualifyIds.concat(r.qualifierIds || []);
      return r;
    }

    if (n === 3) {
      lines.push(
        `三人總分同為 ${cutBp}，爭 ${s} 席：打 round-robin（三場），把這三場 BP 加進總分再排。`
      );
      const [x, y, z] = tied;
      return {
        resolved: false,
        needsMatches: true,
        chain: "rr3",
        tiedIds: tied.map((p) => p.id),
        take: s,
        preQualifyIds,
        firstMatches: [
          { p1: x.id, p2: y.id, wave: 1, creditBp: true, role: "rr3", label: `入圍加賽 · ${x.name} vs ${y.name}` },
          { p1: y.id, p2: z.id, wave: 1, creditBp: true, role: "rr3", label: `入圍加賽 · ${y.name} vs ${z.name}` },
          { p1: x.id, p2: z.id, wave: 1, creditBp: true, role: "rr3", label: `入圍加賽 · ${x.name} vs ${z.name}` },
        ],
        lines,
      };
    }

    if (n === 4) {
      lines.push(
        `四人總分同為 ${cutBp}，爭 ${s} 席：抽籤兩場，打完把本場 BP 加進總分再排（打贏唔等於入圍）。`
      );
      return {
        resolved: false,
        needsMatches: true,
        chain: "draw4",
        tiedIds: tied.map((p) => p.id),
        take: s,
        preQualifyIds,
        needsDraw: true,
        lines,
      };
    }

    if (n - s === 1 && n >= 5) {
      lines.push(`${n} 人只淘汰 1 人：抽兩人打一場，負者出局（打贏出線，唔計 BP）。`);
      return {
        resolved: false,
        needsMatches: true,
        chain: "elim1",
        tiedIds: tied.map((p) => p.id),
        take: s,
        preQualifyIds,
        needsDraw: true,
        lines,
      };
    }

    lines.push(
      `${n} 人總分相同、對賽分唔開，爭 ${s} 席：抽籤小型淘汰，打贏出線（唔計 BP）。` +
        (n % 2 === 1 ? "單數先抽種子選手。" : "雙數先抽對賽，再抽種子線。")
    );
    if (s >= 2) {
      lines.push(s === 2 ? "爭 2 席：種子／種子線佔 1 席，另一邊勝者佔第 2 席。" : `爭 ${s} 席：種子／種子線同淘汰勝者一齊入。`);
    }
    return {
      resolved: false,
      needsMatches: true,
      chain: "seedKo",
      tiedIds: tied.map((p) => p.id),
      take: s,
      preQualifyIds,
      needsDraw: true,
      lines,
    };
  }

  function analyzeOneBye(bye, open, spots, h2h, lines) {
    lines = lines || [];
    if (open.length + 1 <= spots) {
      lines.push("自動獲勝者同未輪空者人數已少於或等於名額，全部入圍。");
      return { resolved: true, qualifierIds: open.map((p) => p.id).concat(bye.id), needsMatches: false, chain: null, lines };
    }

    const autoOpen = Math.max(0, spots - 1);
    if (open.length <= autoOpen) {
      lines.push(`未輪空 ${open.length} 人直接入圍，餘席給自動獲勝者 ${bye.name}。`);
      return {
        resolved: true,
        qualifierIds: open.map((p) => p.id).concat(bye.id),
        needsMatches: false,
        chain: null,
        lines,
      };
    }

    const needFromOpen = autoOpen + 1;
    lines.push(
      `只有 ${bye.name} 曾經自動獲勝（瑞士 BP ${bye.battlePoints}）。未輪空者先比：前 ${autoOpen} 名直接入圍，第 ${needFromOpen} 名挑戰自動獲勝者。`
    );

    const inner = analyzeSameBye(open, needFromOpen, h2h, []);
    if (inner.needsMatches) {
      lines.push(...(inner.lines || []));
      lines.push(`以上加賽只決定邊個挑戰 ${bye.name}，分數唔帶入之後同自動獲勝者比較。`);
      return {
        resolved: false,
        needsMatches: true,
        chain: "openThenBye",
        phase: "open",
        inner,
        byeId: bye.id,
        autoOpen,
        spots,
        take: spots,
        preQualifyIds: inner.preQualifyIds || [],
        firstMatches: inner.firstMatches || [],
        needsDraw: inner.needsDraw,
        tiedIds: inner.tiedIds,
        lines,
      };
    }

    const chosen = (inner.qualifierIds || []).map((id) => open.find((p) => p.id === id)).filter(Boolean);
    const ordered = sortBpName(chosen);
    const autoIds = ordered.slice(0, autoOpen).map((p) => p.id);
    const challenger = ordered[autoOpen];
    if (!challenger) {
      return { resolved: true, qualifierIds: autoIds.concat(bye.id), needsMatches: false, chain: null, lines };
    }

    if (autoIds.length) {
      lines.push(`未輪空已入圍：${ordered.slice(0, autoOpen).map((p) => p.name).join("、")}。`);
    }
    return byeVsChallenger(bye, challenger, autoIds, h2h, lines);
  }

  function byeVsChallenger(bye, challenger, autoIds, h2h, lines) {
    const gap = Math.abs((challenger.battlePoints || 0) - (bye.battlePoints || 0));
    lines.push(
      `挑戰者 ${challenger.name}（${challenger.battlePoints}）對自動獲勝者 ${bye.name}（${bye.battlePoints}），差距 ${gap}。`
    );
    if (gap > PLAYOFF_CATCHUP_MAX) {
      const win = (challenger.battlePoints || 0) > (bye.battlePoints || 0) ? challenger : bye;
      lines.push(`差距大於 ${PLAYOFF_CATCHUP_MAX} 分（即使 6–0 都追唔到）→ ${win.name} 入圍，唔使打。`);
      return {
        resolved: true,
        qualifierIds: autoIds.concat(win.id),
        needsMatches: false,
        chain: null,
        preQualifyIds: autoIds,
        lines,
      };
    }
    lines.push(
      `加賽先到 4（最多可到 6）。打完把本場 BP 加進總分再比；總分仍同先睇對賽。打贏唔等於入圍。進攻 Finish 可以一次過追到 6 分。`
    );
    return {
      resolved: false,
      needsMatches: true,
      chain: "byeChallenge",
      byeId: bye.id,
      challengerId: challenger.id,
      preQualifyIds: autoIds,
      firstMatches: [
        {
          p1: challenger.id,
          p2: bye.id,
          wave: 1,
          creditBp: true,
          role: "byeChallenge",
          label: "入圍加賽 · 挑戰自動獲勝者",
        },
      ],
      lines,
    };
  }

  function analyzeMultiBye(byes, open, spots, h2h, lines) {
    lines = lines || [];
    lines.push(`${byes.length} 人曾經自動獲勝：同類先比，再同未輪空者加賽（瑞士總 BP 唔跨組直接比）。`);

    if (open.length + byes.length <= spots) {
      return { resolved: true, qualifierIds: open.concat(byes).map((p) => p.id), needsMatches: false, chain: null, lines };
    }

    const autoOpen = Math.max(0, spots - byes.length);
    if (open.length <= autoOpen) {
      const needByes = spots - open.length;
      const bp = analyzeSameBye(byes, needByes, h2h, lines);
      if (bp.resolved) {
        return { ...bp, qualifierIds: open.map((p) => p.id).concat(bp.qualifierIds || []) };
      }
      return bp;
    }

    if (spots === 1) {
      const bPlan = analyzeSameBye(byes, 1, h2h, []);
      const oPlan = analyzeSameBye(open, 1, h2h, []);
      if (bPlan.needsMatches || oPlan.needsMatches) {
        const inner = bPlan.needsMatches ? bPlan : oPlan;
        lines.push(...(inner.lines || []));
        lines.push("先完成同類加賽，再由雙方代表對賽。");
        return {
          resolved: false,
          needsMatches: true,
          chain: "openThenBye",
          phase: "open",
          inner,
          multiBye: true,
          byeIds: byes.map((p) => p.id),
          openIds: open.map((p) => p.id),
          autoOpen: 0,
          spots: 1,
          firstMatches: inner.firstMatches || [],
          needsDraw: inner.needsDraw,
          tiedIds: inner.tiedIds,
          lines,
        };
      }
      const bRep = byes.find((p) => (bPlan.qualifierIds || [])[0] === p.id) || byes[0];
      const oRep = open.find((p) => (oPlan.qualifierIds || [])[0] === p.id) || open[0];
      return byeVsChallenger(bRep, oRep, [], h2h, lines);
    }

    const needFromOpen = autoOpen + byes.length;
    const inner = analyzeSameBye(open, Math.min(open.length, needFromOpen), h2h, []);
    if (inner.needsMatches) {
      lines.push(...(inner.lines || []));
      lines.push("先排定未輪空者次序，再同自動獲勝者加賽。");
      return {
        resolved: false,
        needsMatches: true,
        chain: "openThenBye",
        phase: "open",
        inner,
        multiBye: true,
        byeIds: byes.map((p) => p.id),
        autoOpen,
        spots,
        firstMatches: inner.firstMatches || [],
        needsDraw: inner.needsDraw,
        tiedIds: inner.tiedIds,
        lines,
      };
    }

    const chosen = (inner.qualifierIds || []).map((id) => open.find((p) => p.id === id)).filter(Boolean);
    const ordered = sortBpName(chosen.length ? chosen : sortBpName(open));
    return planMixedPlayIn(byes, ordered, autoOpen, spots, h2h, lines);
  }

  function planMixedPlayIn(byes, orderedOpen, autoOpen, spots, h2h, lines) {
    lines = lines || [];
    const autoIds = orderedOpen.slice(0, autoOpen).map((p) => p.id);
    const remainingSpots = spots - autoOpen;
    const challengers = orderedOpen.slice(autoOpen);
    const playIn = byes.concat(challengers);
    if (playIn.length <= remainingSpots) {
      const ids = [];
      const seen = new Set();
      for (const id of autoIds.concat(playIn.map((p) => p.id))) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      return {
        resolved: true,
        qualifierIds: ids,
        needsMatches: false,
        chain: null,
        lines,
      };
    }
    if (byes.length === 1 && remainingSpots === 1 && challengers[0]) {
      return byeVsChallenger(byes[0], challengers[0], autoIds, h2h, lines);
    }
    const n = playIn.length;
    const s = remainingSpots;
    const tiedIds = playIn.map((p) => p.id);
    if (n === 2 && s === 1) {
      const bye = byes[0] || playIn[0];
      const ch = playIn.find((p) => p.id !== bye.id) || playIn[1];
      if ((bye.byeCount || 0) > 0 && (ch.byeCount || 0) <= 0) return byeVsChallenger(bye, ch, autoIds, h2h, lines);
      return byeVsChallenger(playIn[0], playIn[1], autoIds, h2h, lines);
    }
    if (n - s === 1) {
      lines.push(`${n} 人只淘汰 1 人：抽兩人打一場，負者出局（打贏留隊）。`);
      return {
        resolved: false,
        needsMatches: true,
        chain: "elim1",
        tiedIds,
        take: s,
        preQualifyIds: autoIds,
        needsDraw: true,
        lines,
      };
    }
    if (n === 4 && s === 2) {
      lines.push("四人爭 2 席：抽籤兩場，勝者出線。");
      return {
        resolved: false,
        needsMatches: true,
        chain: "crossDraw",
        tiedIds,
        take: 2,
        preQualifyIds: autoIds,
        needsDraw: true,
        lines,
      };
    }
    lines.push(`${n} 人爭 ${s} 席：抽籤小型淘汰，打贏出線（跨自動獲勝組唔用瑞士 BP）。`);
    return {
      resolved: false,
      needsMatches: true,
      chain: "seedKo",
      tiedIds,
      take: s,
      preQualifyIds: autoIds,
      needsDraw: true,
      lines,
    };
  }

  function analyzeCutoff(group, spots, h2h) {
    const lines = [];
    const g = group || [];
    const s = spots | 0;
    if (!g.length) {
      return { resolved: true, qualifierIds: [], needsMatches: false, chain: null, lines: ["沒有爭席選手。"] };
    }
    lines.push(`${g.length} 人爭最後 ${s} 個名額。`);
    const byes = g.filter((p) => (p.byeCount || 0) > 0);
    const open = g.filter((p) => (p.byeCount || 0) <= 0);
    if (byes.length) {
      lines.push(`曾經自動獲勝：${namesOf(byes)}（同未輪空者唔直接用瑞士總 BP 比）。`);
    }
    if (byes.length === 0 || open.length === 0) return analyzeSameBye(g, s, h2h, lines);
    if (byes.length === 1) return analyzeOneBye(byes[0], open, s, h2h, lines);
    return analyzeMultiBye(byes, open, s, h2h, lines);
  }

  function buildSeedKo(ids, spots, rng) {
    const n = ids.length;
    const sh = shuffleList(ids, rng);
    const s = Math.max(1, spots | 0);
    if (n === 4) {
      return {
        template: "4",
        spots: s,
        seedId: null,
        wave1: [
          [sh[0], sh[1]],
          [sh[2], sh[3]],
        ],
        seedLinePair: [sh[2], sh[3]],
      };
    }
    if (n === 5) {
      return {
        template: "5",
        spots: s,
        seedId: sh[0],
        wave1: [
          [sh[1], sh[2]],
          [sh[3], sh[4]],
        ],
        seedLinePair: null,
      };
    }
    if (n === 6) {
      return {
        template: "6",
        spots: s,
        seedId: null,
        wave1: [
          [sh[0], sh[1]],
          [sh[2], sh[3]],
          [sh[4], sh[5]],
        ],
        seedLinePair: [sh[4], sh[5]],
      };
    }
    if (n === 7) {
      return {
        template: "7",
        spots: s,
        seedId: sh[0],
        wave1: [
          [sh[1], sh[2]],
          [sh[3], sh[4]],
          [sh[5], sh[6]],
        ],
        seedLinePair: [sh[5], sh[6]],
      };
    }
    if (n === 10) {
      return {
        template: "10",
        spots: s,
        seedId: null,
        wave1: [
          [sh[0], sh[1]],
          [sh[2], sh[3]],
          [sh[4], sh[5]],
          [sh[6], sh[7]],
          [sh[8], sh[9]],
        ],
        seedLinePair: [sh[8], sh[9]],
      };
    }
    if (n % 2 === 1) {
      const rest = sh.slice(1);
      const pairs = [];
      for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);
      return { template: "oddGeneric", spots: s, seedId: sh[0], wave1: pairs, seedLinePair: null };
    }
    const pairs = [];
    for (let i = 0; i < sh.length; i += 2) pairs.push([sh[i], sh[i + 1]]);
    return {
      template: "evenGeneric",
      spots: s,
      seedId: null,
      wave1: pairs,
      seedLinePair: pairs[pairs.length - 1],
    };
  }

  function seedKoWave1Matches(ko, nameOf) {
    const nm = (id) => nameOf(id);
    return (ko.wave1 || []).map((pr, i) => {
      const isLine =
        ko.seedLinePair &&
        ((pr[0] === ko.seedLinePair[0] && pr[1] === ko.seedLinePair[1]) ||
          (pr[0] === ko.seedLinePair[1] && pr[1] === ko.seedLinePair[0]));
      return {
        p1: pr[0],
        p2: pr[1],
        wave: 1,
        creditBp: false,
        role: isLine ? "seedLine" : "ko",
        label: isLine
          ? `入圍加賽 · 種子線 ${nm(pr[0])} vs ${nm(pr[1])}`
          : `入圍加賽 · ${nm(pr[0])} vs ${nm(pr[1])}`,
      };
    });
  }

  function materializeCutoff(analysis, rng, nameOf) {
    const out = { ...analysis, firstMatches: analysis.firstMatches ? [...analysis.firstMatches] : [] };
    const nm = typeof nameOf === "function" ? nameOf : (id) => id;
    if (analysis.chain === "draw4" && analysis.tiedIds) {
      const pool = shuffleList(analysis.tiedIds, rng);
      out.firstMatches = [
        { p1: pool[0], p2: pool[1], wave: 1, creditBp: true, role: "draw4", label: `入圍加賽 · ${nm(pool[0])} vs ${nm(pool[1])}` },
        { p1: pool[2], p2: pool[3], wave: 1, creditBp: true, role: "draw4", label: `入圍加賽 · ${nm(pool[2])} vs ${nm(pool[3])}` },
      ];
    }
    if (analysis.chain === "elim1" && analysis.tiedIds) {
      const pool = shuffleList(analysis.tiedIds, rng);
      out.firstMatches = [
        {
          p1: pool[0],
          p2: pool[1],
          wave: 1,
          creditBp: false,
          role: "elim1",
          label: `入圍加賽 · 淘汰場 ${nm(pool[0])} vs ${nm(pool[1])}`,
        },
      ];
    }
    if (analysis.chain === "seedKo" && analysis.tiedIds) {
      out.ko = buildSeedKo(analysis.tiedIds, analysis.take || 1, rng);
      out.firstMatches = seedKoWave1Matches(out.ko, nm);
    }
    if (analysis.chain === "crossDraw" && analysis.tiedIds) {
      const pool = shuffleList(analysis.tiedIds, rng);
      out.firstMatches = [
        { p1: pool[0], p2: pool[1], wave: 1, creditBp: false, role: "crossDraw", label: `入圍加賽 · ${nm(pool[0])} vs ${nm(pool[1])}` },
        { p1: pool[2], p2: pool[3], wave: 1, creditBp: false, role: "crossDraw", label: `入圍加賽 · ${nm(pool[2])} vs ${nm(pool[3])}` },
      ];
    }
    if (analysis.chain === "openThenBye" && analysis.inner && !out.firstMatches.length) {
      const innerMat = materializeCutoff(analysis.inner, rng, nm);
      out.firstMatches = innerMat.firstMatches || [];
      out.ko = innerMat.ko;
      out.inner = { ...analysis.inner, ...innerMat, ko: innerMat.ko, firstMatches: innerMat.firstMatches };
    }
    return out;
  }

  function pickByEffective(players, spots, matches, h2h) {
    const cred = matchCredits(matches);
    const worked = sortBpName(withCredits(players, cred));
    const { clearIn, tied, spotsLeft } = bandAtCut(worked, spots);
    if (tied.length <= spotsLeft) {
      return { resolved: true, ids: clearIn.concat(tied).map((p) => p.id) };
    }
    if (tied.length === 2 && spotsLeft === 1) {
      const a = tied[0];
      const b = tied[1];
      if (a.battlePoints !== b.battlePoints) {
        return { resolved: true, ids: clearIn.map((p) => p.id).concat([a.battlePoints > b.battlePoints ? a.id : b.id]) };
      }
      const h = h2hOfMatch(matches, a.id, b.id) || (h2h && h2h(a.id, b.id));
      if (h) return { resolved: true, ids: clearIn.map((p) => p.id).concat([h]) };
      return { resolved: false, needPair: [a.id, b.id], pre: clearIn.map((p) => p.id) };
    }
    return { resolved: false, needPair: null, tied: tied.map((p) => p.id), pre: clearIn.map((p) => p.id) };
  }

  function waveDone(matches, wave) {
    const w = matches.filter((m) => (m.wave || 1) === wave);
    return w.length > 0 && w.every((m) => m.done && m.winner) ? w : null;
  }

  function advanceSeedKo(po, nameOf) {
    const ko = po.ko;
    const matches = (po.matches || []).filter(
      (m) => m.role === "ko" || m.role === "seedLine" || m.role === "seedVsLine"
    );
    const nm = nameOf || ((id) => id);
    const maxWave = matches.reduce((n, m) => Math.max(n, m.wave || 1), 0);
    const w = waveDone(matches, maxWave);
    if (!w) return [];
    const non = w.filter((m) => m.role !== "seedLine" && m.role !== "seedVsLine");
    const sl = matches.find((m) => m.role === "seedLine");
    const t = ko.template;
    const spots = ko.spots || 1;

    if (t === "4") {
      if (maxWave === 1 && w.length === 2) {
        if (spots >= 2) return [];
        return [{ p1: w[0].winner, p2: w[1].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 決勝" }];
      }
    }
    if (t === "5") {
      if (maxWave === 1 && w.length === 2) {
        if (spots >= 3) return [];
        if (spots >= 2) {
          return [{ p1: w[0].winner, p2: w[1].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 爭第 2 席" }];
        }
        return [{ p1: w[0].winner, p2: w[1].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 準決賽" }];
      }
      if (maxWave === 2 && spots === 1) {
        return [
          { p1: w[0].winner, p2: ko.seedId, wave: 3, creditBp: false, role: "ko", label: `入圍加賽 · 對種子 ${nm(ko.seedId)}` },
        ];
      }
    }
    if (t === "6") {
      if (maxWave === 1 && w.length === 3) {
        if (spots >= 3) return [];
        return [
          {
            p1: non[0].winner,
            p2: non[1].winner,
            wave: 2,
            creditBp: false,
            role: "ko",
            label: spots >= 2 ? "入圍加賽 · 爭第 2 席" : "入圍加賽 · 準決賽",
          },
        ];
      }
      if (maxWave === 2 && spots === 1 && sl?.winner) {
        return [
          { p1: w[0].winner, p2: sl.winner, wave: 3, creditBp: false, role: "ko", label: "入圍加賽 · 對種子線" },
        ];
      }
    }
    if (t === "7") {
      if (maxWave === 1 && w.length === 3) {
        if (spots >= 4) return [];
        if (spots === 3) {
          return [
            { p1: non[0].winner, p2: non[1].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 爭第 3 席" },
          ];
        }
        return [
          { p1: non[0].winner, p2: non[1].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 準決賽" },
          {
            p1: sl.winner,
            p2: ko.seedId,
            wave: 2,
            creditBp: false,
            role: "seedVsLine",
            label: `入圍加賽 · 種子線對種子 ${nm(ko.seedId)}`,
          },
        ];
      }
      if (maxWave === 2 && w.length === 2 && spots === 1) {
        return [{ p1: w[0].winner, p2: w[1].winner, wave: 3, creditBp: false, role: "ko", label: "入圍加賽 · 決勝" }];
      }
    }
    if (t === "10") {
      if (maxWave === 1 && w.length === 5) {
        if (spots >= 5) return [];
        return [
          { p1: non[0].winner, p2: non[1].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 準決賽 1" },
          { p1: non[2].winner, p2: non[3].winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 準決賽 2" },
        ];
      }
      if (maxWave === 2 && w.length === 2) {
        return [
          {
            p1: w[0].winner,
            p2: w[1].winner,
            wave: 3,
            creditBp: false,
            role: "ko",
            label: spots >= 2 ? "入圍加賽 · 爭第 2 席" : "入圍加賽 · 決賽",
          },
        ];
      }
      if (maxWave === 3 && spots === 1 && sl?.winner) {
        return [{ p1: w[0].winner, p2: sl.winner, wave: 4, creditBp: false, role: "ko", label: "入圍加賽 · 對種子線" }];
      }
    }
    if (t === "oddGeneric") {
      if (maxWave === 1) {
        if (w.length === 1) {
          return [{ p1: w[0].winner, p2: ko.seedId, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 對種子" }];
        }
        const next = [];
        for (let i = 0; i + 1 < w.length; i += 2) {
          next.push({ p1: w[i].winner, p2: w[i + 1].winner, wave: maxWave + 1, creditBp: false, role: "ko", label: "入圍加賽 · 晉級" });
        }
        if (w.length % 2 === 1) {
          next.push({
            p1: w[w.length - 1].winner,
            p2: ko.seedId,
            wave: maxWave + 1,
            creditBp: false,
            role: "ko",
            label: "入圍加賽 · 對種子",
          });
        }
        return next;
      }
      if (w.length === 1 && !matches.some((m) => (m.wave || 1) > maxWave)) {
        const alreadyVsSeed = matches.some((m) => m.p1 === ko.seedId || m.p2 === ko.seedId);
        if (!alreadyVsSeed && spots === 1) {
          return [{ p1: w[0].winner, p2: ko.seedId, wave: maxWave + 1, creditBp: false, role: "ko", label: "入圍加賽 · 對種子" }];
        }
      }
      if (w.length >= 2) {
        const next = [];
        for (let i = 0; i + 1 < w.length; i += 2) {
          next.push({ p1: w[i].winner, p2: w[i + 1].winner, wave: maxWave + 1, creditBp: false, role: "ko", label: "入圍加賽 · 晉級" });
        }
        return next;
      }
    }
    if (t === "evenGeneric") {
      if (maxWave === 1 && sl) {
        const others = w.filter((m) => m.role !== "seedLine");
        if (others.length === 1 && spots === 1) {
          return [{ p1: others[0].winner, p2: sl.winner, wave: 2, creditBp: false, role: "ko", label: "入圍加賽 · 對種子線" }];
        }
        const next = [];
        for (let i = 0; i + 1 < others.length; i += 2) {
          next.push({
            p1: others[i].winner,
            p2: others[i + 1].winner,
            wave: 2,
            creditBp: false,
            role: "ko",
            label: "入圍加賽 · 準決賽",
          });
        }
        if (others.length % 2 === 1 && others.length >= 1) {
          next.push({
            p1: others[others.length - 1].winner,
            p2: sl.winner,
            wave: 2,
            creditBp: false,
            role: "seedVsLine",
            label: "入圍加賽 · 對種子線",
          });
        }
        return next;
      }
      if (w.length >= 2) {
        const next = [];
        for (let i = 0; i + 1 < w.length; i += 2) {
          next.push({ p1: w[i].winner, p2: w[i + 1].winner, wave: maxWave + 1, creditBp: false, role: "ko", label: "入圍加賽 · 晉級" });
        }
        if (next.length) return next;
      }
      if (w.length === 1 && spots === 1 && sl?.winner && w[0].winner !== sl.winner) {
        const vsLine = matches.some((m) => m.role === "seedVsLine" || (sl.winner && (m.p1 === sl.winner || m.p2 === sl.winner) && (m.wave || 1) > 1));
        if (!vsLine) {
          return [{ p1: w[0].winner, p2: sl.winner, wave: maxWave + 1, creditBp: false, role: "ko", label: "入圍加賽 · 對種子線" }];
        }
      }
    }
    return [];
  }

  function seedKoQualifiers(po) {
    const ko = po.ko;
    const matches = (po.matches || []).filter(
      (m) => m.role === "ko" || m.role === "seedLine" || m.role === "seedVsLine"
    );
    const spots = ko.spots || 1;
    const lastWave = matches.reduce((n, m) => Math.max(n, m.wave || 1), 0);
    const last = matches.filter((m) => (m.wave || 1) === lastWave && m.done && m.winner);
    if (!last.length) return null;
    if (spots === 1) {
      if (last.length !== 1) return null;
      return [last[0].winner];
    }
    const t = ko.template;
    const sl = matches.find((m) => m.role === "seedLine");
    if (t === "4") {
      if (spots >= 2) {
        if (lastWave !== 1 || last.length !== 2) return null;
        return last.map((m) => m.winner);
      }
    }
    if (t === "5") {
      if (spots >= 3) {
        if (lastWave !== 1 || last.length !== 2) return null;
        return [ko.seedId, last[0].winner, last[1].winner].filter(Boolean);
      }
      if (spots === 2) {
        if (lastWave < 2) return null;
        return [ko.seedId, last[0].winner].filter(Boolean);
      }
    }
    if (t === "6") {
      if (spots >= 3) {
        if (lastWave !== 1 || last.length !== 3) return null;
        return last.map((m) => m.winner);
      }
      if (spots === 2) {
        if (lastWave < 2 || !sl?.winner) return null;
        return [sl.winner, last[0].winner];
      }
    }
    if (t === "7") {
      if (spots >= 4) {
        if (lastWave !== 1 || last.length !== 3) return null;
        return [ko.seedId].concat(last.map((m) => m.winner)).filter(Boolean);
      }
      if (spots === 3) {
        if (lastWave !== 2 || last.length !== 1 || !sl?.winner) return null;
        return [ko.seedId, sl.winner, last[0].winner].filter(Boolean);
      }
      if (spots === 2) {
        if (lastWave !== 2 || last.length !== 2) return null;
        return last.map((m) => m.winner);
      }
    }
    if (t === "10") {
      if (spots >= 5) {
        if (lastWave !== 1 || last.length !== 5) return null;
        return last.map((m) => m.winner);
      }
      if (spots === 2) {
        if (lastWave < 3 || !sl?.winner) return null;
        return [sl.winner, last[0].winner];
      }
    }
    if (last.length === 1) return last.map((m) => m.winner);
    return last.map((m) => m.winner).slice(0, spots);
  }

  function resolveByeChallengeMatch(po, group) {
    const m = (po.matches || []).find((x) => x.role === "byeChallenge") || po.matches[po.matches.length - 1];
    if (!m || !m.done || !m.winner) return { resolved: false };
    const map = byIdMap(group);
    const bye = map[po.byeId];
    const ch = map[po.challengerId];
    if (!bye || !ch) return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat([m.winner]) };
    const byeBp = (bye.battlePoints || 0) + (m.p1 === bye.id ? m.p1Bp : m.p2Bp);
    const chBp = (ch.battlePoints || 0) + (m.p1 === ch.id ? m.p1Bp : m.p2Bp);
    let win;
    if (byeBp !== chBp) win = byeBp > chBp ? bye.id : ch.id;
    else win = m.winner;
    return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat([win]) };
  }

  function resolvePlayoff(group, spots, h2h, po) {
    if (!po || !po.chain) {
      const a = analyzeCutoff(group, spots, h2h);
      return { ...a, nextMatches: [] };
    }
    const matches = po.matches || [];
    const nameOf = (id) => (group.find((p) => p.id === id) || {}).name || id;

    if (po.chain === "pair") {
      if (!allMatchesDone(matches)) return { resolved: false, nextMatches: [], chain: po.chain };
      const tied = (po.tiedIds || []).map((id) => group.find((p) => p.id === id)).filter(Boolean);
      const pick = pickByEffective(tied, po.take || 1, matches, h2h);
      if (pick.resolved) {
        return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat(pick.ids), nextMatches: [], chain: po.chain };
      }
      return { resolved: false, nextMatches: [], chain: po.chain };
    }

    if (po.chain === "rr3") {
      if (!allMatchesDone(matches)) return { resolved: false, nextMatches: [], chain: po.chain };
      const tied = (po.tiedIds || []).map((id) => group.find((p) => p.id === id)).filter(Boolean);
      const pick = pickByEffective(tied, po.take || 1, matches, h2h);
      if (pick.resolved) {
        return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat(pick.ids), nextMatches: [], chain: po.chain };
      }
      if (pick.needPair) {
        const exists = matches.some(
          (m) =>
            (m.p1 === pick.needPair[0] && m.p2 === pick.needPair[1]) ||
            (m.p1 === pick.needPair[1] && m.p2 === pick.needPair[0])
        );
        if (exists) {
          const h = h2hOfMatch(matches, pick.needPair[0], pick.needPair[1]);
          if (h) {
            return {
              resolved: true,
              qualifierIds: (po.preQualifyIds || []).concat(pick.pre || []).concat([h]),
              nextMatches: [],
              chain: po.chain,
            };
          }
        }
        return {
          resolved: false,
          nextMatches: [
            {
              p1: pick.needPair[0],
              p2: pick.needPair[1],
              wave: 2,
              creditBp: true,
              role: "pair",
              label: "入圍加賽 · 同分決勝",
            },
          ],
          chain: po.chain,
        };
      }
      return { resolved: false, nextMatches: [], chain: po.chain };
    }

    if (po.chain === "draw4") {
      const w1 = matches.filter((m) => (m.wave || 1) === 1);
      if (!allMatchesDone(w1)) return { resolved: false, nextMatches: [], chain: po.chain };
      const tied = (po.tiedIds || []).map((id) => group.find((p) => p.id === id)).filter(Boolean);
      const pick = pickByEffective(tied, po.take || 1, matches, h2h);
      if (pick.resolved) {
        return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat(pick.ids), nextMatches: [], chain: po.chain };
      }
      if (pick.needPair) {
        const has = matches.some(
          (m) =>
            (m.p1 === pick.needPair[0] && m.p2 === pick.needPair[1]) ||
            (m.p1 === pick.needPair[1] && m.p2 === pick.needPair[0])
        );
        if (!has) {
          return {
            resolved: false,
            nextMatches: [
              {
                p1: pick.needPair[0],
                p2: pick.needPair[1],
                wave: 2,
                creditBp: true,
                role: "pair",
                label: "入圍加賽 · 總分仍同再打",
              },
            ],
            chain: po.chain,
          };
        }
        const h = h2hOfMatch(matches, pick.needPair[0], pick.needPair[1]);
        if (h) {
          return {
            resolved: true,
            qualifierIds: (po.preQualifyIds || []).concat(pick.pre || []).concat([h]),
            nextMatches: [],
            chain: po.chain,
          };
        }
      }
      return { resolved: false, nextMatches: [], chain: po.chain };
    }

    if (po.chain === "elim1") {
      const elim = matches.filter((m) => m.role === "elim1");
      const use = elim.length ? elim : matches;
      if (!allMatchesDone(use)) return { resolved: false, nextMatches: [], chain: po.chain };
      const m = use[use.length - 1];
      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      const ids = (po.tiedIds || []).filter((id) => id !== loser);
      return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat(ids), nextMatches: [], chain: po.chain };
    }

    if (po.chain === "crossDraw") {
      const cd = matches.filter((m) => m.role === "crossDraw");
      const use = cd.length ? cd : matches.filter((m) => (m.wave || 1) === 1);
      if (!allMatchesDone(use)) return { resolved: false, nextMatches: [], chain: po.chain };
      const wins = use.map((m) => m.winner);
      return { resolved: true, qualifierIds: (po.preQualifyIds || []).concat(wins), nextMatches: [], chain: po.chain };
    }

    if (po.chain === "byeChallenge") {
      if (!allMatchesDone(matches)) return { resolved: false, nextMatches: [], chain: po.chain };
      const r = resolveByeChallengeMatch(po, group);
      return { ...r, nextMatches: [], chain: po.chain };
    }

    if (po.chain === "seedKo") {
      if (!po.ko) return { resolved: false, nextMatches: [], chain: po.chain };
      const next = advanceSeedKo(po, nameOf);
      if (next.length) return { resolved: false, nextMatches: next, chain: po.chain };
      if (!allMatchesDone(matches)) return { resolved: false, nextMatches: [], chain: po.chain };
      const q = seedKoQualifiers(po);
      if (!q) return { resolved: false, nextMatches: [], chain: po.chain };
      const pre = po.preQualifyIds || [];
      if ((po.ko.spots || 1) >= 2 && po.ko.template === "5" && po.ko.seedId && !q.includes(po.ko.seedId)) {
        q.unshift(po.ko.seedId);
      }
      return { resolved: true, qualifierIds: pre.concat(q), nextMatches: [], chain: po.chain };
    }

    if (po.chain === "openThenBye") {
      const innerMatches = matches.filter((m) => m.role !== "byeChallenge");
      const challenge = matches.filter((m) => m.role === "byeChallenge");
      if (po.phase !== "challenge" && innerMatches.length && !allMatchesDone(innerMatches)) {
        const innerPo = {
          ...po.inner,
          matches: innerMatches,
          chain: po.inner?.chain,
          ko: po.inner?.ko || po.ko,
        };
        const innerRes = resolvePlayoff(
          group.filter((p) => (po.inner?.tiedIds || po.openIds || group.map((x) => x.id)).includes(p.id)),
          po.inner?.take || (Number.isFinite(po.autoOpen) ? po.autoOpen : 0) + 1,
          h2h,
          innerPo
        );
        if (innerRes.nextMatches && innerRes.nextMatches.length) {
          return { resolved: false, nextMatches: innerRes.nextMatches, chain: po.chain, phase: "open" };
        }
        if (!innerRes.resolved) return { resolved: false, nextMatches: [], chain: po.chain, phase: "open" };
      }
      if (!challenge.length) {
        const open = group.filter((p) => (p.byeCount || 0) <= 0);
        const byes = group.filter((p) => (p.byeCount || 0) > 0);
        const cred = matchCredits(innerMatches);
        const autoOpen = Number.isFinite(po.autoOpen) ? po.autoOpen : 0;
        const needFromOpen = autoOpen + (po.multiBye ? byes.length : 1);
        let innerWinnerIds = null;
        if (innerMatches.length && allMatchesDone(innerMatches) && po.inner) {
          const ir = resolvePlayoff(
            group.filter((p) => (po.inner.tiedIds || []).includes(p.id)),
            po.inner.take || 1,
            h2h,
            { ...po.inner, matches: innerMatches, chain: po.inner.chain, ko: po.inner.ko || po.ko }
          );
          if (ir.resolved) innerWinnerIds = ir.qualifierIds || [];
        }
        const innerTied = new Set(po.inner?.tiedIds || []);
        const innerAmongOpen = open.some((p) => innerTied.has(p.id));
        const needFromOpenClamped = Math.min(open.length, needFromOpen);
        let orderedOpen;
        if (innerWinnerIds && innerWinnerIds.length && innerAmongOpen) {
          const seen = new Set();
          orderedOpen = [];
          for (const id of innerWinnerIds) {
            if (seen.has(id)) continue;
            const p = open.find((x) => x.id === id);
            if (!p) continue;
            seen.add(id);
            orderedOpen.push(p);
            if (orderedOpen.length >= needFromOpenClamped) break;
          }
        } else {
          const inner2 = analyzeSameBye(withCredits(open, cred), Math.min(open.length, needFromOpen), h2h, []);
          if (inner2.needsMatches) {
            const mat = materializeCutoff(inner2, Math.random, nameOf);
            return { resolved: false, nextMatches: mat.firstMatches || [], chain: po.chain, phase: "open" };
          }
          const chosen = (inner2.qualifierIds || []).map((id) => open.find((p) => p.id === id)).filter(Boolean);
          orderedOpen = sortBpName(withCredits(chosen, cred))
            .map((p) => open.find((x) => x.id === p.id))
            .filter(Boolean);
        }
        if (innerWinnerIds && innerWinnerIds.length && !innerAmongOpen && spots === 1) {
          const bRep = byes.find((p) => innerWinnerIds[0] === p.id) || byes[0];
          const oPlan = analyzeSameBye(withCredits(open, cred), 1, h2h, []);
          if (oPlan.needsMatches) {
            const mat = materializeCutoff(oPlan, Math.random, nameOf);
            return { resolved: false, nextMatches: mat.firstMatches || [], chain: po.chain, phase: "open" };
          }
          const oRep = open.find((p) => (oPlan.qualifierIds || [])[0] === p.id) || open[0];
          const plan = byeVsChallenger(bRep, oRep, [], h2h, []);
          if (plan.resolved) return { resolved: true, qualifierIds: plan.qualifierIds, nextMatches: [], chain: po.chain };
          return {
            resolved: false,
            nextMatches: plan.firstMatches,
            chain: "byeChallenge",
            phase: "challenge",
            byeId: plan.byeId,
            challengerId: plan.challengerId,
            preQualifyIds: [],
          };
        }
        const plan = planMixedPlayIn(byes, orderedOpen, autoOpen, spots, h2h, []);
        if (plan.resolved) return { resolved: true, qualifierIds: plan.qualifierIds, nextMatches: [], chain: po.chain };
        const mat = materializeCutoff(plan, Math.random, nameOf);
        return {
          resolved: false,
          nextMatches: mat.firstMatches || plan.firstMatches || [],
          chain: plan.chain,
          phase: plan.chain === "byeChallenge" ? "challenge" : po.phase,
          byeId: plan.byeId,
          challengerId: plan.challengerId,
          preQualifyIds: plan.preQualifyIds || [],
          ko: mat.ko || null,
          tiedIds: plan.tiedIds,
          take: plan.take,
        };
      }
      if (!allMatchesDone(challenge)) return { resolved: false, nextMatches: [], chain: po.chain, phase: "challenge" };
      const r = resolveByeChallengeMatch({ ...po, matches: challenge }, group);
      return { ...r, nextMatches: [], chain: po.chain };
    }

    const a = analyzeCutoff(group, spots, h2h);
    return { ...a, nextMatches: [] };
  }

  return {
    PLAYOFF_CATCHUP_MAX,
    analyzeCutoff,
    materializeCutoff,
    resolvePlayoff,
    buildSeedKo,
    advanceSeedKo,
    seedKoQualifiers,
    shuffleList,
    sortBpName,
    bandAtCut,
    matchCredits,
    withCredits,
  };
});
