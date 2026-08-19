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

  async function pushNow(tournamentState) {
    if (!session || session.role !== "host" || !db) return;
    const rev = parseInt(tournamentState?._rev, 10) || 0;
    const now = new Date().toISOString();
    applyingRemote = true;
    try {
      await roomRef(session.roomId).update({
        state: tournamentState,
        rev,
        updatedAt: now,
        hostPassHash: session.hostPassHash,
        schemaVersion: SCHEMA_VERSION,
      });
      lastPushedRev = rev;
      pendingPush = false;
      emitStatus();
    } finally {
      // 短暫忽略自己寫入引發嘅 snapshot
      setTimeout(() => {
        applyingRemote = false;
      }, 50);
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
