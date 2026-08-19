/**
 * 寶螺盃 · 雲端即時同步（Firebase Firestore）
 * 比賽 ID 加入；主持碼可寫，其他人只讀。
 *
 * 依賴：firebase-app-compat + firebase-firestore-compat + firebase-config.js
 * 對外：window.BaoluoSync
 */
(function (global) {
  const SESSION_KEY = "baoluo-cup-sync-session";
  const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 唔用易混字
  const SCHEMA_VERSION = 2;
  const PUSH_DEBOUNCE_MS = 400;

  /** @type {{ roomId: string, role: 'host'|'viewer', hostPassHash: string|null } | null} */
  let session = null;
  /** @type {FirebaseFirestore.Firestore | null} */
  let db = null;
  let unsub = null;
  let pushTimer = null;
  let applyingRemote = false;
  let lastPushedRev = 0;
  let connected = false;
  let statusListeners = [];
  let remoteListeners = [];
  let pendingPush = false;

  function isConfigReady() {
    const c = global.BAOLUO_FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId && c.apiKey !== "YOUR_API_KEY");
  }

  function initFirebase() {
    if (db) return true;
    if (!isConfigReady()) return false;
    if (typeof firebase === "undefined") {
      console.warn("[BaoluoSync] Firebase SDK 未載入");
      return false;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(global.BAOLUO_FIREBASE_CONFIG);
      }
      db = firebase.firestore();
      // 長時間現場：盡量用長輪詢以外預設；離線暫存交畀 SDK
      try {
        db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      } catch (_) {
        /* ignore */
      }
      return true;
    } catch (e) {
      console.error("[BaoluoSync] init failed", e);
      return false;
    }
  }

  function roomRef(roomId) {
    return db.collection("rooms").doc(roomId);
  }

  function normalizeRoomId(id) {
    return String(id || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function generateRoomId() {
    let out = "";
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 6; i++) {
      out += ROOM_ID_ALPHABET[arr[i] % ROOM_ID_ALPHABET.length];
    }
    return out;
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(String(text));
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.roomId) return null;
      return {
        roomId: normalizeRoomId(s.roomId),
        role: s.role === "host" ? "host" : "viewer",
        hostPassHash: s.hostPassHash || null,
      };
    } catch {
      return null;
    }
  }

  function persistSession() {
    if (!session) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function emitStatus() {
    const info = getStatus();
    statusListeners.forEach((fn) => {
      try {
        fn(info);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function getStatus() {
    return {
      configured: isConfigReady(),
      connected,
      roomId: session?.roomId || null,
      role: session?.role || null,
      isHost: session?.role === "host",
      isReadOnly: !!(session && session.role !== "host"),
      pendingPush,
      lastPushedRev,
    };
  }

  function stopListen() {
    if (unsub) {
      try {
        unsub();
      } catch (_) {
        /* ignore */
      }
      unsub = null;
    }
    connected = false;
  }

  function startListen(roomId) {
    stopListen();
    if (!db) return;
    unsub = roomRef(roomId).onSnapshot(
      (snap) => {
        connected = true;
        emitStatus();
        if (!snap.exists) return;
        const data = snap.data() || {};
        const rev = parseInt(data.rev, 10) || 0;
        const remoteState = data.state;
        if (!remoteState || typeof remoteState !== "object") return;
        if (applyingRemote) return;
        // 自己啱啱推上去
        if (session?.role === "host" && rev <= lastPushedRev) return;
        remoteListeners.forEach((fn) => {
          try {
            fn({
              rev,
              state: remoteState,
              hostPassHash: data.hostPassHash || null,
              updatedAt: data.updatedAt || null,
            });
          } catch (e) {
            console.error(e);
          }
        });
      },
      (err) => {
        console.error("[BaoluoSync] snapshot error", err);
        connected = false;
        emitStatus();
      }
    );
  }

  async function createRoom(password, tournamentState) {
    if (!initFirebase()) {
      throw new Error("尚未設定 Firebase（見 firebase-config.js）");
    }
    const pass = String(password || "").trim();
    if (pass.length < 4) throw new Error("主持碼至少 4 個字元");
    const hostPassHash = await sha256Hex(pass);

    let roomId = "";
    let created = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      roomId = generateRoomId();
      const ref = roomRef(roomId);
      const existing = await ref.get();
      if (existing.exists) continue;
      const now = new Date().toISOString();
      const rev = parseInt(tournamentState?._rev, 10) || 1;
      await ref.set({
        roomId,
        createdAt: now,
        updatedAt: now,
        hostPassHash,
        schemaVersion: SCHEMA_VERSION,
        rev,
        state: tournamentState || {},
      });
      created = true;
      lastPushedRev = rev;
      break;
    }
    if (!created) throw new Error("無法產生可用比賽 ID，請再試");

    session = { roomId, role: "host", hostPassHash };
    persistSession();
    startListen(roomId);
    emitStatus();
    return { roomId, role: "host" };
  }

  async function joinRoom(roomIdInput, password) {
    if (!initFirebase()) {
      throw new Error("尚未設定 Firebase（見 firebase-config.js）");
    }
    const roomId = normalizeRoomId(roomIdInput);
    if (roomId.length < 4) throw new Error("請輸入有效比賽 ID");

    const snap = await roomRef(roomId).get();
    if (!snap.exists) throw new Error("搵唔到呢場比賽（請檢查 ID）");
    const data = snap.data() || {};
    const hash = data.hostPassHash || "";

    let role = "viewer";
    const pass = String(password || "").trim();
    if (pass) {
      const tryHash = await sha256Hex(pass);
      if (tryHash !== hash) throw new Error("主持碼不正確");
      role = "host";
    }

    session = {
      roomId,
      role,
      hostPassHash: role === "host" ? hash : null,
    };
    persistSession();
    lastPushedRev = parseInt(data.rev, 10) || 0;
    startListen(roomId);
    emitStatus();

    return {
      roomId,
      role,
      rev: parseInt(data.rev, 10) || 0,
      state: data.state || null,
      hostPassHash: hash,
    };
  }

  async function resumeSession() {
    const s = loadSession();
    if (!s) return null;
    if (!initFirebase()) return null;
    try {
      const snap = await roomRef(s.roomId).get();
      if (!snap.exists) {
        session = null;
        persistSession();
        emitStatus();
        return null;
      }
      const data = snap.data() || {};
      // 主持必須仍然握住正確 hash（防止房間被重建）
      if (s.role === "host") {
        if (!s.hostPassHash || s.hostPassHash !== data.hostPassHash) {
          s.role = "viewer";
          s.hostPassHash = null;
        }
      }
      session = s;
      persistSession();
      lastPushedRev = parseInt(data.rev, 10) || 0;
      startListen(s.roomId);
      emitStatus();
      return {
        roomId: s.roomId,
        role: s.role,
        rev: parseInt(data.rev, 10) || 0,
        state: data.state || null,
      };
    } catch (e) {
      console.error("[BaoluoSync] resume failed", e);
      return null;
    }
  }

  function leaveRoom() {
    stopListen();
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    session = null;
    pendingPush = false;
    lastPushedRev = 0;
    persistSession();
    emitStatus();
  }

  function cloneForFirestore(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function phaseRank(phase) {
    return { setup: 0, swiss: 1, knockout: 2, done: 3 }[phase] || 0;
  }

  function matchProgress(m) {
    if (!m) return 0;
    const battles = Array.isArray(m.battles) ? m.battles.filter((b) => b && b.winnerId).length : 0;
    const bp = (Number(m.p1Bp) || 0) + (Number(m.p2Bp) || 0);
    return (m.done ? 1000 : 0) + battles * 10 + bp;
  }

  function richerMatch(a, b) {
    if (!a) return b;
    if (!b) return a;
    return matchProgress(a) >= matchProgress(b) ? a : b;
  }

  function pairKeyOf(m) {
    if (!m || !m.p1) return "";
    if (!m.p2) return "bye:" + m.p1;
    return m.p1 < m.p2 ? m.p1 + "|" + m.p2 : m.p2 + "|" + m.p1;
  }

  function mergeMatchLists(localList, remoteList) {
    const out = [];
    const usedRemote = new Set();
    const remote = remoteList || [];
    const local = localList || [];
    for (const lm of local) {
      const byId = remote.find((rm) => rm.id && lm.id && rm.id === lm.id);
      const byPair = !byId ? remote.find((rm) => pairKeyOf(rm) && pairKeyOf(rm) === pairKeyOf(lm)) : null;
      const rm = byId || byPair;
      if (rm) {
        usedRemote.add(rm);
        out.push(richerMatch(lm, rm));
      } else {
        out.push(lm);
      }
    }
    for (const rm of remote) {
      if (!usedRemote.has(rm)) out.push(rm);
    }
    return out;
  }

  function mergeRounds(localRounds, remoteRounds) {
    const map = new Map();
    for (const r of remoteRounds || []) {
      map.set(r.round, cloneForFirestore(r));
    }
    for (const r of localRounds || []) {
      if (!map.has(r.round)) {
        map.set(r.round, cloneForFirestore(r));
        continue;
      }
      const dest = map.get(r.round);
      dest.locked = !!(dest.locked || r.locked);
      dest.matches = mergeMatchLists(r.matches, dest.matches);
    }
    return [...map.values()].sort((a, b) => (a.round || 0) - (b.round || 0));
  }

  function mergePlayers(localPlayers, remotePlayers) {
    const map = new Map();
    for (const p of remotePlayers || []) if (p && p.id) map.set(p.id, p);
    for (const p of localPlayers || []) {
      if (!p || !p.id) continue;
      const other = map.get(p.id);
      if (!other) {
        map.set(p.id, p);
        continue;
      }
      const localDone = !!p.deckChecked;
      const remoteDone = !!other.deckChecked;
      map.set(p.id, localDone && !remoteDone ? p : remoteDone && !localDone ? other : p);
    }
    return [...map.values()];
  }

  function mergeKnockout(localKo, remoteKo) {
    if (!localKo) return remoteKo || null;
    if (!remoteKo) return localKo;
    const out = cloneForFirestore(localKo);
    const rem = remoteKo;
    if (Array.isArray(out.rounds) && Array.isArray(rem.rounds)) {
      const n = Math.max(out.rounds.length, rem.rounds.length);
      const rounds = [];
      for (let i = 0; i < n; i++) {
        const a = out.rounds[i];
        const b = rem.rounds[i];
        if (!a) rounds.push(b);
        else if (!b) rounds.push(a);
        else rounds.push({ ...a, matches: mergeMatchLists(a.matches, b.matches) });
      }
      out.rounds = rounds;
    }
    if (rem.third || out.third) out.third = richerMatch(out.third, rem.third);
    if (rem.final || out.final) out.final = richerMatch(out.final, rem.final);
    return out;
  }

  function mergeTournamentStates(localState, remoteState) {
    const local = localState || {};
    const remote = remoteState || {};
    const out = cloneForFirestore(local);
    out.players = mergePlayers(local.players, remote.players);
    out.rounds = mergeRounds(local.rounds, remote.rounds);
    out.knockout = mergeKnockout(local.knockout, remote.knockout);
    out.settings = { ...(remote.settings || {}), ...(local.settings || {}) };
    out.phase = phaseRank(local.phase) >= phaseRank(remote.phase) ? local.phase : remote.phase;
    out.currentRound = Math.max(local.currentRound || 0, remote.currentRound || 0);
    return out;
  }

  async function pushNow(tournamentState) {
    if (!session || session.role !== "host" || !db) return null;
    const now = new Date().toISOString();
    applyingRemote = true;
    let result = null;
    try {
      result = await db.runTransaction(async (tx) => {
        const ref = roomRef(session.roomId);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("比賽房間已不存在");
        const remote = snap.data() || {};
        const remoteRev = parseInt(remote.rev, 10) || 0;
        let next = cloneForFirestore(tournamentState || {});
        let nextRev = parseInt(next._rev, 10) || 0;
        let merged = false;
        if (remote.state && remoteRev > lastPushedRev) {
          next = mergeTournamentStates(next, remote.state);
          nextRev = Math.max(nextRev, remoteRev) + 1;
          next._rev = nextRev;
          merged = true;
        }
        tx.update(ref, {
          state: next,
          rev: nextRev,
          updatedAt: now,
          hostPassHash: session.hostPassHash,
          schemaVersion: SCHEMA_VERSION,
        });
        return { state: next, rev: nextRev, merged };
      });
      lastPushedRev = result.rev;
      pendingPush = false;
      emitStatus();
      if (result.merged && result.state) {
        remoteListeners.forEach((fn) => {
          try {
            fn({
              rev: result.rev,
              state: result.state,
              hostPassHash: session.hostPassHash,
              updatedAt: now,
              merged: true,
            });
          } catch (e) {
            console.error(e);
          }
        });
      }
      return result;
    } catch (e) {
      pendingPush = true;
      emitStatus();
      throw e;
    } finally {
      setTimeout(() => {
        applyingRemote = false;
      }, 80);
    }
  }

  function schedulePush(tournamentState) {
    if (!session || session.role !== "host") return;
    if (!initFirebase()) return;
    pendingPush = true;
    emitStatus();
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      pushNow(tournamentState).catch((e) => {
        console.error("[BaoluoSync] push failed", e);
        pendingPush = true;
        emitStatus();
      });
    }, PUSH_DEBOUNCE_MS);
  }

  /** 離開／關頁前先推走未上載改動 */
  async function flush(tournamentState) {
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    if (!session || session.role !== "host") return null;
    if (!initFirebase()) return null;
    try {
      return await pushNow(tournamentState);
    } catch (e) {
      console.error("[BaoluoSync] flush failed", e);
      return null;
    }
  }

  function onStatus(fn) {
    statusListeners.push(fn);
    return () => {
      statusListeners = statusListeners.filter((x) => x !== fn);
    };
  }

  function onRemote(fn) {
    remoteListeners.push(fn);
    return () => {
      remoteListeners = remoteListeners.filter((x) => x !== fn);
    };
  }

  function isHost() {
    return session?.role === "host";
  }

  function isReadOnly() {
    return !!(session && session.role !== "host");
  }

  function isConnected() {
    return !!(session && connected);
  }

  function getRoomId() {
    return session?.roomId || null;
  }

  // 純函式：畀測試用
  function shouldApplyRemote(localRev, remoteRev, role, justPushedRev) {
    const l = parseInt(localRev, 10) || 0;
    const r = parseInt(remoteRev, 10) || 0;
    if (role === "host" && r <= (justPushedRev || 0)) return false;
    return r > l;
  }

  global.BaoluoSync = {
    isConfigReady,
    initFirebase,
    createRoom,
    joinRoom,
    resumeSession,
    leaveRoom,
    schedulePush,
    pushNow,
    flush,
    mergeTournamentStates,
    onStatus,
    onRemote,
    getStatus,
    isHost,
    isReadOnly,
    isConnected,
    getRoomId,
    normalizeRoomId,
    generateRoomId,
    sha256Hex,
    shouldApplyRemote,
    SESSION_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
