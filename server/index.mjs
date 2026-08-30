import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const ROOT_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATA_DIR = resolve(process.env.LILY_DATA_DIR || join(ROOT_DIR, "server", "data"));
const DATABASE_FILE = join(DATA_DIR, "rooms.json");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_STATE_BYTES = Number(process.env.MAX_STATE_BYTES || 60 * 1024 * 1024);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const PLAYER_DEFAULT_ID = "player-1";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const database = { rooms: new Map() };
let persistTimer = null;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function matchesToken(candidate, expectedHash) {
  const candidateHash = Buffer.from(hashToken(candidate), "utf8");
  const storedHash = Buffer.from(String(expectedHash || ""), "utf8");
  return candidateHash.length === storedHash.length && timingSafeEqual(candidateHash, storedHash);
}

function makeRoomId() {
  return randomBytes(8).toString("base64url");
}

function makeGmToken() {
  return randomBytes(24).toString("base64url");
}

function safeRoomName(value) {
  const name = String(value || "Mesa de teste").trim().slice(0, 80);
  return name || "Mesa de teste";
}

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStoredState(input) {
  if (!input || typeof input !== "object") throw new Error("Estado da sala inválido.");
  const state = cloneJson(input);
  state.room = { ...(state.room || {}), id: String(state.room?.id || ""), name: safeRoomName(state.room?.name) };
  state.members = Array.isArray(state.members) ? state.members.slice(0, 100) : [];
  state.permissions = { ...(state.permissions || {}) };
  state.library = {
    ...(state.library || {}),
    maps: Array.isArray(state.library?.maps) ? state.library.maps : [],
    tokenBlueprints: Array.isArray(state.library?.tokenBlueprints) ? state.library.tokenBlueprints : [],
    sequences: Array.isArray(state.library?.sequences) ? state.library.sequences : [],
  };
  state.scenes = Array.isArray(state.scenes) ? state.scenes.slice(0, 100) : [];
  state.scenes = state.scenes.map((scene) => ({
    ...scene,
    mapAnalysis: undefined,
    tokens: Array.isArray(scene?.tokens) ? scene.tokens : [],
    walls: Array.isArray(scene?.walls) ? scene.walls : [],
    lights: Array.isArray(scene?.lights) ? scene.lights : [],
    darknessZones: Array.isArray(scene?.darknessZones) ? scene.darknessZones : [],
  }));
  state.activeSceneId = String(state.activeSceneId || state.scenes[0]?.id || "");
  state.ui = { ...(state.ui || {}) };
  return state;
}

function roomRecordForPersistence(room) {
  return {
    roomId: room.roomId,
    gmTokenHash: room.gmTokenHash,
    state: room.state,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

async function loadDatabase() {
  try {
    const raw = await readFile(DATABASE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const [roomId, savedRoom] of Object.entries(parsed.rooms || {})) {
      if (!savedRoom?.gmTokenHash || !savedRoom?.state) continue;
      const state = normalizeStoredState(savedRoom.state);
      state.room.id = roomId;
      database.rooms.set(roomId, {
        roomId,
        gmTokenHash: String(savedRoom.gmTokenHash),
        state,
        createdAt: savedRoom.createdAt || new Date().toISOString(),
        updatedAt: savedRoom.updatedAt || new Date().toISOString(),
        clients: new Set(),
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Não foi possível carregar as salas salvas:", error.message);
  }
}

async function persistDatabase() {
  await mkdir(DATA_DIR, { recursive: true });
  const serializable = { rooms: {} };
  for (const [roomId, room] of database.rooms) serializable.rooms[roomId] = roomRecordForPersistence(room);
  const temporaryFile = `${DATABASE_FILE}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(serializable), "utf8");
  await rename(temporaryFile, DATABASE_FILE);
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistDatabase().catch((error) => console.error("Não foi possível persistir as salas:", error));
  }, 180);
}

function publicStateFor(roomState, role) {
  const state = cloneJson(roomState);
  if (role === "gm") return state;

  const visibleBlueprintIds = new Set();
  state.scenes = (state.scenes || []).map((scene) => {
    const tokens = (scene.tokens || []).filter((token) => token?.visibleToPlayers !== false && token?.visible !== false);
    tokens.forEach((token) => visibleBlueprintIds.add(String(token.blueprintId || "")));
    return {
      ...scene,
      tokens,
      // A camada visual das barreiras fica escondida no Player, mas a
      // geometria continua disponível para a máscara de luz/visão.
      walls: scene.walls || [],
    };
  });
  state.library = {
    ...(state.library || {}),
    tokenBlueprints: (state.library?.tokenBlueprints || []).filter((blueprint) => visibleBlueprintIds.has(String(blueprint.id))),
    sequences: [],
  };
  state.members = (state.members || []).map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
  }));
  state.ui = {
    ...(state.ui || {}),
    role: "player",
    activeTool: "select",
    selectedTokenId: null,
    selectedLightId: null,
    selectedDarknessId: null,
    panels: { leftOpen: false, rightOpen: false },
  };
  return state;
}

function hasTokenState(blueprint, activeKey) {
  const key = String(activeKey || "");
  if (!/^[1-9]$/.test(key)) return false;
  return (blueprint?.images || []).some((image, index) => String(image?.key || index + 1) === key);
}

function mergePlayerState(roomState, playerState, memberId) {
  const merged = cloneJson(roomState);
  if (!playerState || typeof playerState !== "object") return merged;
  const candidateScenes = Array.isArray(playerState.scenes) ? playerState.scenes : [];
  const moveOwnToken = roomState.permissions?.moveOwnToken !== false;
  const changeOwnImage = roomState.permissions?.changeOwnImage !== false;
  const blueprints = roomState.library?.tokenBlueprints || [];
  const blueprintById = new Map(blueprints.map((blueprint) => [String(blueprint.id), blueprint]));

  for (const scene of merged.scenes || []) {
    const submittedScene = candidateScenes.find((item) => String(item?.id) === String(scene.id));
    if (!submittedScene) continue;
    const submittedTokens = new Map((submittedScene.tokens || []).map((token) => [String(token?.id), token]));
    scene.tokens = (scene.tokens || []).map((token) => {
      if (String(token.ownerId || "") !== String(memberId)) return token;
      if (token.visibleToPlayers === false || token.visible === false) return token;
      const submittedToken = submittedTokens.get(String(token.id));
      if (!submittedToken) return token;
      const updated = { ...token };
      if (moveOwnToken) {
        updated.x = clamp(finiteNumber(submittedToken.x, token.x), 0, 1);
        updated.y = clamp(finiteNumber(submittedToken.y, token.y), 0, 1);
      }
      if (changeOwnImage && hasTokenState(blueprintById.get(String(token.blueprintId)), submittedToken.activeKey)) {
        updated.activeKey = String(submittedToken.activeKey);
      }
      return updated;
    });
  }
  return merged;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_STATE_BYTES) {
        rejectBody(new Error("Payload muito grande."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        rejectBody(new Error("JSON inválido."));
      }
    });
    request.on("error", rejectBody);
  });
}

function websocketUrlForRequest(request) {
  return new URL(request.url, `http://${request.headers.host || "localhost"}`);
}

function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status} Error\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${message}`);
  socket.destroy();
}

function sendSocket(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

function sendRoomState(client) {
  sendSocket(client.socket, {
    type: "state",
    roomId: client.room.roomId,
    state: publicStateFor(client.room.state, client.role),
    updatedAt: client.room.updatedAt,
  });
}

function broadcastRoom(room) {
  for (const client of room.clients) sendRoomState(client);
}

function sanitizeRealtimeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const kind = String(event.kind || "");
  if (![
    "token-animation",
    "token-attack",
  ].includes(kind)) return null;
  return {
    kind,
    tokenId: String(event.tokenId || "").slice(0, 120),
    targetId: String(event.targetId || "").slice(0, 120),
    animationId: String(event.animationId || "").slice(0, 120),
    attackType: String(event.attackType || "").slice(0, 40),
  };
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    response.end();
    return true;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, rooms: database.rooms.size });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    try {
      const body = await readRequestBody(request);
      if (jsonSize(body.state) > MAX_STATE_BYTES) throw new Error("Estado muito grande.");
      const roomId = makeRoomId();
      const gmToken = makeGmToken();
      const state = normalizeStoredState(body.state);
      state.room.id = roomId;
      const now = new Date().toISOString();
      database.rooms.set(roomId, {
        roomId,
        gmTokenHash: hashToken(gmToken),
        state,
        createdAt: now,
        updatedAt: now,
        clients: new Set(),
      });
      schedulePersist();
      sendJson(response, 201, { roomId, gmToken });
    } catch (error) {
      sendJson(response, error.message === "Payload muito grande." ? 413 : 400, { error: error.message });
    }
    return true;
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (request.method === "GET" && roomMatch) {
    const room = database.rooms.get(decodeURIComponent(roomMatch[1]));
    if (!room) {
      sendJson(response, 404, { error: "Sala não encontrada." });
      return true;
    }
    sendJson(response, 200, { roomId: room.roomId, state: publicStateFor(room.state, "player"), updatedAt: room.updatedAt });
    return true;
  }

  return false;
}

async function serveStatic(request, response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendJson(response, 400, { error: "URL inválida." });
    return;
  }
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (requestedPath.startsWith("server/") || requestedPath === "package.json") {
    sendJson(response, 404, { error: "Arquivo não encontrado." });
    return;
  }
  const filePath = resolve(ROOT_DIR, normalize(requestedPath));
  const relativePath = relative(ROOT_DIR, filePath);
  if (relativePath.startsWith("..") || relativePath.includes(`${process.platform === "win32" ? "\\" : "/"}..`)) {
    sendJson(response, 403, { error: "Acesso negado." });
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not-file");
    response.writeHead(200, {
      "Cache-Control": pathname === "/" ? "no-store" : "public, max-age=300",
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Arquivo não encontrado." });
  }
}

await loadDatabase();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
    const handled = await handleApi(request, response, url);
    if (handled) return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Método não permitido." });
    return;
  }
  await serveStatic(request, response, url);
});

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_STATE_BYTES });

server.on("upgrade", (request, socket, head) => {
  let url;
  try {
    url = websocketUrlForRequest(request);
  } catch {
    rejectUpgrade(socket, 400, "URL inválida");
    return;
  }
  if (url.pathname !== "/ws") {
    rejectUpgrade(socket, 404, "WebSocket não encontrado");
    return;
  }
  const roomId = String(url.searchParams.get("room") || "");
  const role = url.searchParams.get("role") === "gm" ? "gm" : "player";
  const memberId = String(url.searchParams.get("member") || PLAYER_DEFAULT_ID).slice(0, 80);
  const room = database.rooms.get(roomId);
  if (!room) {
    rejectUpgrade(socket, 404, "Sala não encontrada");
    return;
  }
  if (role === "gm" && !matchesToken(url.searchParams.get("token"), room.gmTokenHash)) {
    rejectUpgrade(socket, 401, "Credencial do Mestre inválida");
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (ws) => {
    websocketServer.emit("connection", ws, request, { room, role, memberId });
  });
});

websocketServer.on("connection", (socket, _request, context) => {
  const client = { socket, room: context.room, role: context.role, memberId: context.memberId };
  context.room.clients.add(client);
  sendSocket(socket, { type: "connected", roomId: context.room.roomId, role: context.role });
  sendRoomState(client);

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString("utf8"));
      if (message.type === "state") {
        if (context.role === "gm") {
          const nextState = normalizeStoredState(message.state);
          if (jsonSize(nextState) > MAX_STATE_BYTES) throw new Error("Estado muito grande.");
          nextState.room.id = context.room.roomId;
          context.room.state = nextState;
        } else {
          context.room.state = mergePlayerState(context.room.state, message.state, context.memberId);
        }
        context.room.updatedAt = new Date().toISOString();
        schedulePersist();
        broadcastRoom(context.room);
        return;
      }
      if (message.type === "event" && context.role === "gm") {
        const event = sanitizeRealtimeEvent(message.event);
        if (!event) return;
        for (const otherClient of context.room.clients) {
          if (otherClient !== client && otherClient.role === "player") sendSocket(otherClient.socket, { type: "event", event });
        }
      }
    } catch (error) {
      sendSocket(socket, { type: "error", message: error.message || "Mensagem inválida." });
    }
  });
  socket.on("close", () => context.room.clients.delete(client));
  socket.on("error", () => context.room.clients.delete(client));
});

server.listen(PORT, HOST, () => {
  console.log(`LilyVTT server ouvindo em http://${HOST}:${PORT}`);
});
