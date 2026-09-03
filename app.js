"use strict";

/*
 * LilyVTT — beta local + sala online
 *
 * A cena guarda apenas instâncias posicionadas. A biblioteca guarda os assets
 * reutilizáveis. Essa separação é o que permite trocar o mapa sem perder os
 * tokens, estados e imagens que o Mestre já preparou.
 */

const STORAGE_KEY = "tabletop-rpg-beta-state-v1";
const ONLINE_CREDENTIALS_KEY = "lilyvtt-online-credentials-v1";
const AUTH_SESSION_KEY = "lilyvtt-auth-session-v1";
const STATE_SCHEMA_VERSION = 8;
const PLAYER_ID = "player-1";
const DEFAULT_LIGHT_COLOR = "#f4c783";
const DEFAULT_ONLINE_SERVER_URL = "https://lilyvtt.falcaolendario.chatgpt.site";
const MAX_TOKEN_ANIMATION_FRAMES = 12;
const TOKEN_ANIMATION_FRAME_MS = 560;
const TOKEN_ACTION_ANIMATION_FRAME_MS = 120;
const TOKEN_IMPACT_DURATION_MS = 720;
const TOKEN_ATTACK_ACTIONS = {
  shot: { name: "Disparo", icon: "➜", hint: "à distância" },
  physical: { name: "Ataque físico", icon: "↯", hint: "corpo a corpo" },
};
const TOKEN_ANIMATION_TRIGGERS = {
  manual: { label: "Manual", hint: "Ative pelo botão ou tecla H" },
  shot: { label: "Disparo", hint: "Toca quando este ataque é escolhido" },
  physical: { label: "Ataque físico", hint: "Toca quando este ataque é escolhido" },
  impact: { label: "Impacto recebido", hint: "Toca quando o token é atingido" },
};
const TIME_OF_DAY_PRESETS = {
  day: { label: "Dia", hint: "luz aberta", darknessMultiplier: 0.1, tint: null },
  afternoon: { label: "Tarde", hint: "tom quente", darknessMultiplier: 0.42, tint: "rgba(255, 157, 86, 0.1)" },
  night: { label: "Noite", hint: "depende das luzes", darknessMultiplier: 1, tint: "rgba(28, 48, 112, 0.16)" },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  body: document.body,
  roomName: $("#roomName"),
  saveIndicator: $("#saveIndicator"),
  connectionStatus: $("#connectionStatus"),
  betaStrip: $("#betaStrip"),
  roleButtons: $$("[data-role-choice]"),
  sideTabs: $$(".side-tab"),
  sidePanels: $$(".side-panel"),
  toolButtons: $$("[data-tool]"),
  toggleLeftPanel: $("#toggleLeftPanel"),
  toggleRightPanel: $("#toggleRightPanel"),
  toggleLightingPreview: $("#toggleLightingPreview"),
  closeLeftPanel: $("#closeLeftPanel"),
  closeRightPanel: $("#closeRightPanel"),
  stage: $("#stage"),
  sceneViewport: $("#sceneViewport"),
  mapImage: $("#mapImage"),
  mapPlaceholder: $("#mapPlaceholder"),
  wallsLayer: $("#wallsLayer"),
  gridLayer: $("#gridLayer"),
  lightingCanvas: $("#lightingCanvas"),
  visionRangeLayer: $("#visionRangeLayer"),
  darknessLayer: $("#darknessLayer"),
  lightsLayer: $("#lightsLayer"),
  hotspotsLayer: $("#hotspotsLayer"),
  attackLayer: $("#attackLayer"),
  tokensLayer: $("#tokensLayer"),
  wallDraft: $("#wallDraft"),
  darknessDraft: $("#darknessDraft"),
  stageHint: $("#stageHint"),
  sceneChip: $("#sceneChip"),
  toolStatus: $("#toolStatus"),
  mapInput: $("#mapInput"),
  mapList: $("#mapList"),
  tokenList: $("#tokenList"),
  assetCount: $("#assetCount"),
  mapCount: $("#mapCount"),
  tokenCount: $("#tokenCount"),
  sequenceCount: $("#sequenceCount"),
  sequenceList: $("#sequenceList"),
  sceneName: $("#sceneName"),
  globalIllumination: $("#globalIllumination"),
  visionMask: $("#visionMask"),
  gmLightingPreview: $("#gmLightingPreview"),
  darknessOpacity: $("#darknessOpacity"),
  darknessOpacityValue: $("#darknessOpacityValue"),
  timeOfDay: $("#timeOfDay"),
  gridEnabled: $("#gridEnabled"),
  gridSnap: $("#gridSnap"),
  gridSize: $("#gridSize"),
  gridSizeValue: $("#gridSizeValue"),
  gridOpacity: $("#gridOpacity"),
  gridOpacityValue: $("#gridOpacityValue"),
  wallType: $("#wallType"),
  newLightColor: $("#newLightColor"),
  selectionAvatar: $("#selectionAvatar"),
  selectionName: $("#selectionName"),
  selectionDetail: $("#selectionDetail"),
  hotkeyStrip: $("#hotkeyStrip"),
  inspectorTitle: $("#inspectorTitle"),
  inspectorContent: $("#inspectorContent"),
  tokenDialog: $("#tokenDialog"),
  tokenForm: $("#tokenForm"),
  tokenDialogTitle: $("#tokenDialogTitle"),
  tokenName: $("#tokenName"),
  tokenOwner: $("#tokenOwner"),
  tokenImages: $("#tokenImages"),
  addTokenState: $("#addTokenState"),
  framePreview: $("#framePreview"),
  saveToken: $("#saveToken"),
  sequenceDialog: $("#sequenceDialog"),
  sequenceDialogTitle: $("#sequenceDialogTitle"),
  sequenceForm: $("#sequenceForm"),
  sequenceName: $("#sequenceName"),
  sequenceSpeaker: $("#sequenceSpeaker"),
  sequenceTrigger: $("#sequenceTrigger"),
  addSequenceFrame: $("#addSequenceFrame"),
  sequenceFrameList: $("#sequenceFrameList"),
  sequencePlayerDialog: $("#sequencePlayerDialog"),
  sequenceMedia: $("#sequenceMedia"),
  sequenceCounter: $("#sequenceCounter"),
  sequenceSpeakerView: $("#sequenceSpeakerView"),
  sequenceText: $("#sequenceText"),
  previousFrame: $("#previousFrame"),
  nextFrame: $("#nextFrame"),
  accountButton: $("#accountButton"),
  authGate: $("#authGate"),
  authTitle: $("#authTitle"),
  authLoginTab: $("#authLoginTab"),
  authSignupTab: $("#authSignupTab"),
  authForm: $("#authForm"),
  authNameLabel: $("#authNameLabel"),
  authName: $("#authName"),
  authEmail: $("#authEmail"),
  authPassword: $("#authPassword"),
  authSubmit: $("#authSubmit"),
  continueLocal: $("#continueLocal"),
  authLogout: $("#authLogout"),
  authAccountSummary: $("#authAccountSummary"),
  authMessage: $("#authMessage"),
  toast: $("#toast"),
};

const queryParams = new URLSearchParams(window.location.search);
const launchedAsPlayer = queryParams.get("mode") === "player";
const requestedRoomId = queryParams.get("room") || "";
const requestedServerUrl = queryParams.get("server") || "";
const pageServerUrl = document.querySelector('meta[name="lily-server-url"]')?.content || "";
const serverHint = requestedServerUrl || window.LILY_SERVER_URL || pageServerUrl;
const isGithubPages = /\.github\.io$/i.test(window.location.hostname);
const onlineServerBase = normalizeServerBase(serverHint) || normalizeServerBase(!isGithubPages ? window.location.origin : DEFAULT_ONLINE_SERVER_URL);
const initialRole = launchedAsPlayer ? "player" : "gm";
let stateStorageKey = STORAGE_KEY;
let state = loadState();
let realtime = {
  socket: null,
  connected: false,
  connecting: false,
  shouldReconnect: true,
  roomId: "",
  role: launchedAsPlayer ? "player" : "gm",
  gmToken: "",
  memberId: PLAYER_ID,
  reconnectTimer: null,
  applyingRemote: false,
  pollTimer: null,
  snapshotRequestInFlight: false,
  hasSnapshot: false,
  lastServerUpdateAt: "",
};
let onlineStateTimer = null;
let editingBlueprintId = null;
let editingDefaultFrameId = null;
let pendingTokenFiles = [];
let pendingSequenceFrames = [];
let editingTokenAnimation = null;
let sequencePlayback = null;
let wallDraftPoint = null;
let activeWallDrag = null;
let activeDrag = null;
let activeAttackDrag = null;
let armedAttack = null;
let activePan = null;
let activeLightDrag = null;
let activeDarknessDrag = null;
let activeDarknessDraw = null;
let activeTokenResize = null;
let suppressStageClick = false;
let spaceHeld = false;
let cameraSaveTimer = null;
let tokenTransformSaveTimer = null;
let toastTimer = null;
let authUser = null;
let authSessionToken = "";
let authMode = "login";
let authGateVisible = false;
let authMessageText = "";
let authMessageError = false;
let authBusy = false;
let localMode = false;
let accountWorkspaceLoaded = false;
let accountSaveTimer = null;
let removedTokenImageKeys = new Set();
let framePreviewUrls = [];
const activeTokenAnimations = new Map();
const activeTokenImpacts = new Map();

if (launchedAsPlayer) {
  state.ui.role = "player";
  state.ui.activeTool = "select";
}

function makeId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeServerBase(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.origin);
    if (!(["http:", "https:"].includes(url.protocol))) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHexColor(value, fallback = DEFAULT_LIGHT_COLOR) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split("").map((part) => part + part).join("").toLowerCase()}`;
  }
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initialState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    room: { id: makeId("room"), name: "Mesa de teste" },
    members: [
      { id: "gm", name: "Mestre", role: "gm" },
      { id: PLAYER_ID, name: "Player 1", role: "player" },
    ],
    permissions: {
      moveOwnToken: true,
      changeOwnImage: true,
      interactSequences: true,
      useTokenAttacks: true,
      pingAndMeasure: true,
    },
    library: {
      maps: [],
      tokenBlueprints: [],
      sequences: [],
    },
    scenes: [
      {
        id: "scene-main",
        name: "Cena inicial",
        mapAssetId: null,
        globalIllumination: false,
        visionMaskEnabled: true,
        darknessOpacity: 0.82,
        timeOfDay: "day",
        grid: { enabled: true, snap: true, size: 0.05, opacity: 0.22 },
        camera: { x: 0, y: 0, zoom: 1 },
        tokens: [],
        walls: [],
        lights: [],
        darknessZones: [],
        hotspots: [],
      },
    ],
    activeSceneId: "scene-main",
    ui: {
      role: initialRole,
      activeTool: "select",
      selectedTokenId: null,
      selectedWallId: null,
      selectedLightId: null,
      selectedDarknessId: null,
      gmLightingPreview: true,
      newLightColor: DEFAULT_LIGHT_COLOR,
      wallType: "wall",
      panels: { leftOpen: false, rightOpen: false },
    },
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(stateStorageKey);
    if (!raw) return initialState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Não foi possível carregar o estado local.", error);
    return initialState();
  }
}

function normalizePoint(value, fallback = { x: 0.5, y: 0.5 }) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return {
    x: clamp(Number.isFinite(x) ? x : fallback.x, 0.01, 0.99),
    y: clamp(Number.isFinite(y) ? y : fallback.y, 0.01, 0.99),
  };
}

function normalizeCamera(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const zoom = Number(value?.zoom);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    zoom: clamp(Number.isFinite(zoom) ? zoom : 1, 0.5, 4),
  };
}

function normalizeTokens(tokens) {
  const seenIds = new Set();
  return tokens.reduce((normalizedTokens, token) => {
    if (!token || typeof token !== "object") return normalizedTokens;
    let id = String(token.id || makeId("token"));
    if (seenIds.has(id)) id = makeId("token");
    seenIds.add(id);
    normalizedTokens.push({
      ...token,
      id,
      blueprintId: String(token.blueprintId || ""),
      ownerId: String(token.ownerId || PLAYER_ID),
      visibleToPlayers: token.visibleToPlayers !== false && token.visible !== false,
      ...normalizePoint(token),
      size: clamp(Number(token.size) || 0.08, 0.025, 0.5),
      activeKey: String(token.activeKey || "1"),
      rotation: Number.isFinite(Number(token.rotation)) ? clamp(Number(token.rotation), -180, 180) : 0,
      visionRange: clamp(Number(token.visionRange) || 0, 0, 2),
    });
    return normalizedTokens;
  }, []);
}

function normalizeGrid(value) {
  const source = value && typeof value === "object" ? value : {};
  const size = Number(source.size);
  const opacity = Number(source.opacity);
  return {
    enabled: source.enabled !== false,
    snap: source.snap !== false,
    size: clamp(Number.isFinite(size) ? size : 0.05, 0.03, 0.15),
    opacity: clamp(Number.isFinite(opacity) ? opacity : 0.22, 0.05, 0.5),
  };
}

function normalizeWallType(value) {
  return ["wall", "door", "window"].includes(String(value)) ? String(value) : "wall";
}

function syncWallBlocking(wall) {
  const type = normalizeWallType(wall?.type);
  const open = type === "door" && wall?.open === true;
  if (type === "door" || type === "window") {
    wall.blocksMovement = type === "window" || !open;
    wall.blocksVision = type === "window" ? false : !open;
    wall.blocksLight = type === "window" ? false : !open;
  } else {
    wall.blocksMovement = wall.blocksMovement !== false;
    wall.blocksVision = wall.blocksVision !== false;
    wall.blocksLight = wall.blocksLight !== false;
  }
  return wall;
}

function wallBlocksMovement(wall) {
  if (!wall) return false;
  if (normalizeWallType(wall.type) === "window") return true;
  if (normalizeWallType(wall.type) === "door") return wall.open !== true;
  return wall.blocksMovement !== false;
}

function wallBlocksVision(wall) {
  if (!wall) return false;
  if (["door", "window"].includes(normalizeWallType(wall.type))) return normalizeWallType(wall.type) === "door" && wall.open !== true;
  return wall.blocksVision !== false;
}

function wallBlocksLight(wall) {
  if (!wall) return false;
  if (["door", "window"].includes(normalizeWallType(wall.type))) return normalizeWallType(wall.type) === "door" && wall.open !== true;
  return wall.blocksLight !== false;
}

function wallTypeLabel(wall) {
  const type = normalizeWallType(wall?.type);
  if (type === "door") return wall.open === true ? "Porta aberta" : "Porta fechada";
  if (type === "window") return "Janela";
  return "Parede";
}

function normalizeWalls(walls) {
  const sampleWallIds = new Set(["wall-a", "wall-b", "wall-c", "wall-d", "wall-divider", "wall-divider-2"]);
  const seenIds = new Set();
  return walls.reduce((normalizedWalls, wall) => {
    if (!wall || typeof wall !== "object" || sampleWallIds.has(wall.id)) return normalizedWalls;
    const a = normalizePoint(wall.a || { x: wall.x1, y: wall.y1 });
    const b = normalizePoint(wall.b || { x: wall.x2, y: wall.y2 });
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.004) return normalizedWalls;
    let id = String(wall.id || makeId("wall"));
    if (seenIds.has(id)) id = makeId("wall");
    seenIds.add(id);
    const type = normalizeWallType(wall.type);
    const normalizedWall = {
      ...wall,
      id,
      a,
      b,
      type,
      open: type === "door"
        ? wall.open === true || (wall.open == null && wall.blocksMovement === false)
        : false,
    };
    normalizedWalls.push(syncWallBlocking(normalizedWall));
    return normalizedWalls;
  }, []);
}

function normalizeLights(lights) {
  const sampleLightIds = new Set(["light-a", "light-b"]);
  const seenIds = new Set();
  return lights.reduce((normalizedLights, light) => {
    if (!light || typeof light !== "object" || sampleLightIds.has(light.id)) return normalizedLights;
    let id = String(light.id || makeId("light"));
    if (seenIds.has(id)) id = makeId("light");
    seenIds.add(id);
    const point = normalizePoint(light);
    normalizedLights.push({
      ...light,
      id,
      ...point,
      radius: clamp(Number(light.radius) || 0.2, 0.02, 2),
      falloff: clamp(Number(light.falloff) || 0.72, 0.2, 0.95),
      intensity: clamp(Number(light.intensity) || 1, 0.05, 1.5),
      color: normalizeHexColor(light.color),
      providesVision: light.providesVision !== false,
    });
    return normalizedLights;
  }, []);
}

function normalizeDarknessZones(zones) {
  const seenIds = new Set();
  return zones.reduce((normalizedZones, zone) => {
    if (!zone || typeof zone !== "object") return normalizedZones;
    let id = String(zone.id || makeId("darkness"));
    if (seenIds.has(id)) id = makeId("darkness");
    seenIds.add(id);
    const point = normalizePoint(zone);
    const width = clamp(Number(zone.width) || 0.18, 0.02, 0.98);
    const height = clamp(Number(zone.height) || 0.16, 0.02, 0.98);
    normalizedZones.push({
      ...zone,
      id,
      x: clamp(point.x, 0.01, Math.max(0.01, 0.99 - width)),
      y: clamp(point.y, 0.01, Math.max(0.01, 0.99 - height)),
      width,
      height,
      opacity: clamp(Number(zone.opacity) || 0.82, 0.1, 1),
    });
    return normalizedZones;
  }, []);
}

function normalizeTokenAnimations(animations) {
  const seenIds = new Set();
  return (Array.isArray(animations) ? animations : []).reduce((normalizedAnimations, animation) => {
    if (!animation || typeof animation !== "object") return normalizedAnimations;
    let id = String(animation.id || makeId("animation"));
    if (seenIds.has(id)) id = makeId("animation");
    seenIds.add(id);
    const frames = (Array.isArray(animation.frames) ? animation.frames : [])
      .slice(0, MAX_TOKEN_ANIMATION_FRAMES)
      .map((frame) => ({
        image: frame?.image ? String(frame.image) : null,
        text: String(frame?.text || "").trim().slice(0, 500),
      }))
      .filter((frame) => frame.image || frame.text);
    if (!frames.length) return normalizedAnimations;
    const trigger = Object.prototype.hasOwnProperty.call(TOKEN_ANIMATION_TRIGGERS, String(animation.trigger))
      ? String(animation.trigger)
      : "manual";
    normalizedAnimations.push({
      ...animation,
      id,
      name: String(animation.name || "Animação do token").trim() || "Animação do token",
      speaker: String(animation.speaker || "Narrador").trim() || "Narrador",
      trigger,
      frameDuration: clamp(Number(animation.frameDuration) || (trigger === "manual" ? TOKEN_ANIMATION_FRAME_MS : TOKEN_ACTION_ANIMATION_FRAME_MS), 60, 1200),
      frames,
    });
    return normalizedAnimations;
  }, []);
}

function normalizeTokenBlueprint(blueprint) {
  const source = blueprint && typeof blueprint === "object" ? blueprint : {};
  const images = (Array.isArray(source.images) ? source.images : [])
    .slice(0, 9)
    .map((image, index) => ({
      ...(image || {}),
      key: String(image?.key || index + 1),
      label: String(image?.label || `Estado ${index + 1}`),
      src: image?.src ? String(image.src) : "",
    }));
  const firstKey = images[0]?.key || "1";
  const defaultKey = images.some((image) => image.key === String(source.defaultKey))
    ? String(source.defaultKey)
    : firstKey;
  return {
    ...source,
    images,
    defaultKey,
    defaultSize: clamp(Number(source.defaultSize) || 0.08, 0.025, 0.5),
    animations: normalizeTokenAnimations(source.animations),
  };
}

function normalizeState(value) {
  const base = initialState();
  const loaded = value && typeof value === "object" ? value : {};
  const normalized = {
    ...base,
    ...loaded,
    room: { ...base.room, ...(loaded.room || {}) },
    members: Array.isArray(loaded.members) && loaded.members.length ? loaded.members : base.members,
    permissions: { ...base.permissions, ...(loaded.permissions || {}) },
    library: {
      ...base.library,
      ...(loaded.library || {}),
      maps: Array.isArray(loaded.library?.maps) ? loaded.library.maps : base.library.maps,
      tokenBlueprints: Array.isArray(loaded.library?.tokenBlueprints)
        ? loaded.library.tokenBlueprints.map(normalizeTokenBlueprint)
        : base.library.tokenBlueprints,
      sequences: Array.isArray(loaded.library?.sequences) ? loaded.library.sequences : base.library.sequences,
    },
    scenes: Array.isArray(loaded.scenes) && loaded.scenes.length ? loaded.scenes : base.scenes,
    ui: {
      ...base.ui,
      ...(loaded.ui || {}),
      panels: { ...base.ui.panels, ...(loaded.ui?.panels || {}) },
    },
  };

  normalized.ui.newLightColor = normalizeHexColor(normalized.ui.newLightColor);
  normalized.ui.wallType = normalizeWallType(normalized.ui.wallType);

  normalized.scenes = normalized.scenes.map((scene) => {
    const sceneWithoutLegacyAnalysis = { ...scene };
    delete sceneWithoutLegacyAnalysis.mapAnalysis;
    return {
      ...sceneWithoutLegacyAnalysis,
      camera: normalizeCamera(scene.camera),
      grid: normalizeGrid(scene.grid),
      tokens: normalizeTokens((Array.isArray(scene.tokens) ? scene.tokens : [])
        .filter((token) => token?.id !== "token-example-player" && token?.id !== "token-example-gm")),
      walls: normalizeWalls(Array.isArray(scene.walls) ? scene.walls : []),
      // As luzes marcadas pelo analisador pertencem ao beta anterior. A partir
      // daqui, somente luzes colocadas pelo Mestre continuam na cena.
      lights: normalizeLights(Array.isArray(scene.lights) ? scene.lights : []).filter((light) => light.generatedFromMap !== true),
      darknessZones: normalizeDarknessZones(Array.isArray(scene.darknessZones) ? scene.darknessZones : []),
      hotspots: (Array.isArray(scene.hotspots) ? scene.hotspots : [])
        .filter((hotspot) => hotspot?.id !== "hotspot-example")
        .map((hotspot) => ({ ...hotspot, ...normalizePoint(hotspot), visible: hotspot.visible !== false })),
      globalIllumination: Boolean(scene.globalIllumination),
      visionMaskEnabled: scene.visionMaskEnabled !== false,
      darknessOpacity: Number.isFinite(Number(scene.darknessOpacity)) ? clamp(Number(scene.darknessOpacity), 0, 0.98) : 0.82,
      timeOfDay: Object.prototype.hasOwnProperty.call(TIME_OF_DAY_PRESETS, String(scene.timeOfDay)) ? String(scene.timeOfDay) : "day",
    };
  });

  normalized.schemaVersion = STATE_SCHEMA_VERSION;

  if (!normalized.scenes.some((scene) => scene.id === normalized.activeSceneId)) {
    normalized.activeSceneId = normalized.scenes[0].id;
  }
  return normalized;
}

function accountStorageKey(accountId) {
  return `${STORAGE_KEY}:account:${encodeURIComponent(String(accountId || "unknown"))}`;
}

function saveState({ sync = true, accountSync = true } = {}) {
  try {
    window.localStorage.setItem(stateStorageKey, JSON.stringify(state));
    els.saveIndicator.innerHTML = '<span class="status-dot"></span> salvo localmente';
    if (sync && !realtime.applyingRemote) scheduleRealtimeState();
    if (accountSync && !realtime.applyingRemote) scheduleAccountStateSave();
  } catch (error) {
    els.saveIndicator.innerHTML = '<span class="status-dot" style="background:var(--rose)"></span> armazenamento cheio';
    showToast("O armazenamento local atingiu o limite. Use imagens menores no beta.", true);
    console.warn("Não foi possível salvar o estado local.", error);
  }
}

function readStoredAuthSession() {
  try {
    const session = JSON.parse(window.localStorage.getItem(AUTH_SESSION_KEY) || "null");
    if (!session || session.serverUrl !== onlineServerBase || !session.sessionToken) return null;
    return session;
  } catch {
    return null;
  }
}

function storeAuthSession(sessionToken) {
  if (!sessionToken || !onlineServerBase) return;
  try {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
      serverUrl: onlineServerBase,
      sessionToken: String(sessionToken),
    }));
  } catch (error) {
    console.warn("Não foi possível guardar a sessão do Mestre.", error);
  }
}

function clearStoredAuthSession() {
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // O modo local continua funcionando mesmo sem acesso ao armazenamento.
  }
}

function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (authSessionToken) headers.set("Authorization", `Bearer ${authSessionToken}`);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  const requestOptions = {
    ...options,
    headers,
    // O GitHub Pages usa o servidor online em outra origem. Como o beta não depende de cookies,\n    // não envie credenciais de navegador: isso permite CORS com Access-Control-Allow-Origin: *.\n    credentials: "omit",
    signal: options.signal || controller.signal,
  };
  return fetch(`${onlineServerBase}${path}`, requestOptions)
    .catch((error) => {
      if (error?.name === "AbortError") throw new Error("O servidor online demorou para responder. Tente novamente.");
      if (error instanceof TypeError) throw new Error("Não foi possível conectar ao servidor online. Confira sua conexão e tente novamente.");
      throw error;
    })
    .finally(() => window.clearTimeout(timeoutId));
}

async function responsePayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function setAuthMessage(message = "", isError = false) {
  authMessageText = String(message || "");
  authMessageError = Boolean(isError);
  if (!els.authMessage) return;
  els.authMessage.textContent = authMessageText;
  els.authMessage.classList.toggle("error", authMessageError);
  els.authMessage.classList.toggle("success", Boolean(authMessageText) && !authMessageError);
}

function renderAuthGate() {
  if (!els.authGate) return;
  const isPlayer = launchedAsPlayer;
  const loggedIn = Boolean(authUser);
  const visible = false;
  els.authGate.hidden = true;
  els.body.classList.remove("auth-gate-open");
  if (els.accountButton) {
    els.accountButton.hidden = true;
    els.accountButton.textContent = loggedIn
      ? `Conta · ${authUser.name || authUser.email}`
      : "Entrar como Mestre";
    els.accountButton.title = loggedIn ? `Conta do Mestre: ${authUser.email}` : "Entrar ou criar conta de Mestre";
  }
  if (!visible) return;
  if (els.authTitle) els.authTitle.textContent = loggedIn ? "Conta do Mestre" : "Entre na sua mesa";
  if (els.authAccountSummary) {
    els.authAccountSummary.hidden = !loggedIn;
    els.authAccountSummary.innerHTML = loggedIn
      ? `<strong>${escapeHtml(authUser.name || "Mestre")}</strong><small>${escapeHtml(authUser.email || "")} · biblioteca isolada nesta conta</small>`
      : "";
  }
  [els.authLoginTab, els.authSignupTab].forEach((tab) => {
    if (!tab) return;
    tab.hidden = loggedIn;
    tab.disabled = loggedIn || authBusy;
  });
  const formHidden = loggedIn;
  if (els.authForm) els.authForm.hidden = formHidden;
  if (els.authNameLabel) els.authNameLabel.hidden = loggedIn || authMode !== "signup";
  if (els.authName) {
    els.authName.hidden = loggedIn || authMode !== "signup";
    els.authName.required = !loggedIn && authMode === "signup";
  }
  if (els.authEmail) els.authEmail.disabled = loggedIn || authBusy;
  if (els.authPassword) els.authPassword.disabled = loggedIn || authBusy;
  if (els.authSubmit) {
    els.authSubmit.disabled = loggedIn || authBusy;
    els.authSubmit.textContent = authBusy ? "Aguarde…" : (authMode === "signup" ? "Criar conta" : "Entrar");
  }
  if (els.continueLocal) {
    els.continueLocal.hidden = false;
    els.continueLocal.disabled = authBusy;
    els.continueLocal.textContent = loggedIn ? "Continuar no LilyVTT" : "Usar modo local";
  }
  if (els.authLogout) {
    els.authLogout.hidden = !loggedIn;
    els.authLogout.disabled = authBusy;
  }
  if (els.authMessage) {
    els.authMessage.textContent = authMessageText;
    els.authMessage.classList.toggle("error", authMessageError);
    els.authMessage.classList.toggle("success", Boolean(authMessageText) && !authMessageError);
  }
  if (els.authLoginTab) {
    els.authLoginTab.classList.toggle("active", authMode === "login");
    els.authLoginTab.setAttribute("aria-selected", String(authMode === "login"));
  }
  if (els.authSignupTab) {
    els.authSignupTab.classList.toggle("active", authMode === "signup");
    els.authSignupTab.setAttribute("aria-selected", String(authMode === "signup"));
  }
}

function openAuthGate(message = "") {
  if (launchedAsPlayer) return;
  authGateVisible = true;
  if (message) setAuthMessage(message);
  renderAuthGate();
}

function closeAuthGate() {
  authGateVisible = false;
  renderAuthGate();
}

function stopRealtimeConnection() {
  window.clearTimeout(realtime.reconnectTimer);
  window.clearInterval(realtime.pollTimer);
  realtime.reconnectTimer = null;
  realtime.pollTimer = null;
  realtime.shouldReconnect = false;
  if (realtime.socket && realtime.socket.readyState < 2) realtime.socket.close();
  realtime.socket = null;
  realtime.connected = false;
  realtime.connecting = false;
  realtime.shouldReconnect = true;
}

async function saveAccountStateNow() {
  if (!authUser || !onlineServerBase || !accountWorkspaceLoaded || realtime.applyingRemote) return;
  try {
    const response = await apiRequest("/api/account/state", {
      method: "PUT",
      body: JSON.stringify({ state }),
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar a conta.");
    els.saveIndicator.innerHTML = '<span class="status-dot"></span> salvo na conta';
  } catch (error) {
    console.warn("Não foi possível salvar o espaço do Mestre.", error);
    if (authUser) showToast("A alteração ficou salva neste dispositivo, mas não chegou à conta online.", true);
  }
}

function scheduleAccountStateSave() {
  if (!authUser || !onlineServerBase || !accountWorkspaceLoaded || realtime.applyingRemote) return;
  window.clearTimeout(accountSaveTimer);
  accountSaveTimer = window.setTimeout(() => {
    accountSaveTimer = null;
    saveAccountStateNow();
  }, 900);
}

async function loadAccountWorkspace() {
  if (!authUser || !onlineServerBase || accountWorkspaceLoaded) return;
  stateStorageKey = accountStorageKey(authUser.id);
  try {
    const response = await apiRequest("/api/account/state");
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar a conta.");
    state = payload?.state ? normalizeState(payload.state) : initialState();
  } catch (error) {
    throw error;
  }
  state.ui.role = "gm";
  state.ui.activeTool = "select";
  state.ui.selectedTokenId = null;
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = null;
  accountWorkspaceLoaded = true;
  saveState({ sync: false, accountSync: false });
}

async function activateAccount(user, sessionToken = "") {
  authUser = {
    id: String(user?.id || ""),
    name: String(user?.name || "Mestre"),
    email: String(user?.email || ""),
  };
  authSessionToken = String(sessionToken || "");
  if (authSessionToken) storeAuthSession(authSessionToken);
  localMode = false;
  accountWorkspaceLoaded = false;
  await loadAccountWorkspace();
  setAuthMessage("");
  closeAuthGate();
  renderAll();
}

async function restoreAuthSession() {
  if (!onlineServerBase || launchedAsPlayer) return false;
  const stored = readStoredAuthSession();
  if (stored) authSessionToken = stored.sessionToken;
  try {
    const response = await apiRequest("/api/auth/me");
    const payload = await responsePayload(response);
    if (!response.ok || !payload?.user?.id) {
      authSessionToken = "";
      if (stored) clearStoredAuthSession();
      return false;
    }
    await activateAccount(payload.user, "");
    return true;
  } catch (error) {
    console.warn("Não foi possível restaurar a sessão do Mestre.", error);
    return false;
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (authBusy) return;
  if (!onlineServerBase) {
    setAuthMessage("Abra o LilyVTT pelo endereço online para criar uma conta. O modo local está disponível abaixo.", true);
    renderAuthGate();
    return;
  }
  const name = els.authName?.value?.trim() || "";
  const email = els.authEmail?.value?.trim() || "";
  const password = els.authPassword?.value || "";
  if (authMode === "signup" && !name) {
    setAuthMessage("Digite o nome do Mestre para criar a conta.", true);
    renderAuthGate();
    els.authName?.focus();
    return;
  }
  if (!email || !els.authEmail?.checkValidity?.()) {
    setAuthMessage("Digite um e-mail válido para continuar.", true);
    renderAuthGate();
    els.authEmail?.focus();
    return;
  }
  if (password.length < 8) {
    setAuthMessage("A senha precisa ter pelo menos 8 caracteres.", true);
    renderAuthGate();
    els.authPassword?.focus();
    return;
  }
  authBusy = true;
  setAuthMessage(authMode === "signup" ? "Criando sua conta…" : "Entrando…");
  renderAuthGate();
  try {
    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const body = {
      name,
      email,
      password,
    };
    const response = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
    const payload = await responsePayload(response);
    if (!response.ok || !payload?.user?.id) throw new Error(payload?.error || "Não foi possível acessar a conta.");
    await activateAccount(payload.user, payload.sessionToken || "");
    if (els.authPassword) els.authPassword.value = "";
    showToast(authMode === "signup" ? "Conta criada; seu espaço de Mestre está pronto." : "Conta carregada; biblioteca restaurada.");
    await initRealtime();
  } catch (error) {
    setAuthMessage(error.message || "Não foi possível acessar a conta.", true);
    openAuthGate();
  } finally {
    authBusy = false;
    renderAuthGate();
  }
}

function enterLocalMode() {
  stopRealtimeConnection();
  window.clearTimeout(accountSaveTimer);
  accountSaveTimer = null;
  authUser = null;
  authSessionToken = "";
  accountWorkspaceLoaded = false;
  localMode = true;
  stateStorageKey = STORAGE_KEY;
  state = loadState();
  state.ui.role = "gm";
  state.ui.activeTool = "select";
  setAuthMessage("");
  closeAuthGate();
  renderAll();
  updateConnectionStatus("offline", "somente local");
}

async function logoutAccount() {
  if (authBusy) return;
  authBusy = true;
  renderAuthGate();
  try {
    if (onlineServerBase) await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.warn("Não foi possível encerrar a sessão online.", error);
  }
  stopRealtimeConnection();
  window.clearTimeout(accountSaveTimer);
  accountSaveTimer = null;
  clearStoredAuthSession();
  authUser = null;
  authSessionToken = "";
  accountWorkspaceLoaded = false;
  localMode = false;
  stateStorageKey = STORAGE_KEY;
  state = initialState();
  state.ui.role = "gm";
  authBusy = false;
  authMode = "login";
  setAuthMessage("Você saiu da conta. Entre novamente ou continue em modo local.");
  openAuthGate();
  renderAll();
}

function updateConnectionStatus(status, message) {
  if (!els.connectionStatus) return;
  const labels = {
    online: "online",
    connecting: "conectando",
    offline: "offline",
    error: "sem servidor",
  };
  els.connectionStatus.className = `connection-status ${status}`;
  els.connectionStatus.textContent = message || labels[status] || status;
  els.connectionStatus.title = onlineServerBase
    ? `Sala online: ${onlineServerBase}`
    : "Nenhum servidor online configurado nesta página.";
}

function readOnlineCredentials() {
  try {
    const storageKey = authUser ? `${ONLINE_CREDENTIALS_KEY}:${encodeURIComponent(authUser.id)}` : ONLINE_CREDENTIALS_KEY;
    const credentials = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (!credentials || credentials.serverUrl !== onlineServerBase || !credentials.roomId || !credentials.gmToken) return null;
    if (authUser && credentials.accountId !== authUser.id) return null;
    return credentials;
  } catch {
    return null;
  }
}

function storeOnlineCredentials(credentials) {
  try {
    const storageKey = authUser ? `${ONLINE_CREDENTIALS_KEY}:${encodeURIComponent(authUser.id)}` : ONLINE_CREDENTIALS_KEY;
    window.localStorage.setItem(storageKey, JSON.stringify({
      serverUrl: onlineServerBase,
      roomId: credentials.roomId,
      gmToken: credentials.gmToken,
      accountId: authUser?.id || null,
    }));
  } catch (error) {
    console.warn("Não foi possível guardar a credencial da sala online.", error);
  }
}

function buildWebSocketUrl(roomId, role, gmToken = "") {
  const url = new URL("/ws", onlineServerBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("room", roomId);
  url.searchParams.set("role", role);
  url.searchParams.set("member", currentMemberId());
  if (role === "gm") url.searchParams.set("token", gmToken);
  return url.toString();
}

function sendRealtimeState() {
  if (!realtime.socket || realtime.socket.readyState !== 1 || realtime.applyingRemote) return;
  try {
    realtime.socket.send(JSON.stringify({ type: "state", state }));
  } catch (error) {
    console.warn("Não foi possível enviar o estado para a sala online.", error);
  }
}

function scheduleRealtimeState() {
  if (!onlineServerBase || realtime.applyingRemote || !realtime.socket || realtime.socket.readyState !== 1) return;
  window.clearTimeout(onlineStateTimer);
  onlineStateTimer = window.setTimeout(() => {
    onlineStateTimer = null;
    sendRealtimeState();
  }, 90);
}

async function loadOnlineRoomState(roomId) {
  if (!onlineServerBase || !roomId || !launchedAsPlayer || realtime.snapshotRequestInFlight) return;
  realtime.snapshotRequestInFlight = true;
  try {
    const response = await apiRequest("/api/rooms/" + encodeURIComponent(roomId));
    const payload = await responsePayload(response);
    if (!response.ok || !payload?.state) {
      throw new Error(payload?.error || "Não foi possível carregar a sala online.");
    }
    const remoteUpdatedAt = String(payload.updatedAt || "");
    const previousTime = Date.parse(realtime.lastServerUpdateAt);
    const remoteTime = Date.parse(remoteUpdatedAt);
    if (
      remoteUpdatedAt &&
      remoteUpdatedAt === realtime.lastServerUpdateAt
    ) return;
    if (
      Number.isFinite(previousTime) &&
      Number.isFinite(remoteTime) &&
      remoteTime < previousTime
    ) return;
    realtime.lastServerUpdateAt = remoteUpdatedAt || realtime.lastServerUpdateAt;
    realtime.hasSnapshot = true;
    applyRemoteState(payload.state);
    if (!realtime.connected) {
      updateConnectionStatus("connecting", "estado carregado · aguardando tempo real");
    }
  } catch (error) {
    console.warn("Não foi possível carregar o estado da sala online.", error);
    if (!realtime.connected && !realtime.hasSnapshot) {
      updateConnectionStatus("error", "sala indisponível");
      showToast(error.message || "Não foi possível carregar a sala do Player.", true);
    }
  } finally {
    realtime.snapshotRequestInFlight = false;
  }
}

function startOnlineStatePolling(roomId) {
  if (!launchedAsPlayer || !roomId) return;
  window.clearInterval(realtime.pollTimer);
  realtime.pollTimer = window.setInterval(() => {
    loadOnlineRoomState(roomId);
  }, 1500);
}

function applyRemoteState(incomingState) {
  if (!incomingState || typeof incomingState !== "object") return;
  const localUi = state.ui;
  const normalizedIncoming = normalizeState(incomingState);
  state = normalizedIncoming;
  state.ui = {
    ...normalizedIncoming.ui,
    ...localUi,
    role: launchedAsPlayer ? "player" : localUi.role,
    panels: { ...normalizedIncoming.ui.panels, ...localUi.panels },
  };
  realtime.applyingRemote = true;
  try {
    saveState({ sync: false });
    renderAll();
  } finally {
    realtime.applyingRemote = false;
  }
}

function handleRealtimeMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "state") {
    if (message.roomId) realtime.roomId = String(message.roomId);
    if (message.updatedAt) realtime.lastServerUpdateAt = String(message.updatedAt);
    realtime.hasSnapshot = true;
    applyRemoteState(message.state);
    return;
  }
  if (message.type === "error") {
    updateConnectionStatus("error", "erro de sincronização");
    showToast(message.message || "O servidor recusou a atualização.", true);
  }
}

function connectRealtime(roomId, role, gmToken = "") {
  if (!onlineServerBase || !roomId || !window.WebSocket) {
    updateConnectionStatus("offline", "offline");
    return;
  }
  window.clearTimeout(realtime.reconnectTimer);
  if (realtime.socket && realtime.socket.readyState < 2) realtime.socket.close();
  realtime.connected = false;
  realtime.connecting = true;
  realtime.roomId = roomId;
  realtime.role = role;
  realtime.gmToken = gmToken;
  updateConnectionStatus("connecting", "conectando");

  const socket = new window.WebSocket(buildWebSocketUrl(roomId, role, gmToken));
  realtime.socket = socket;
  socket.addEventListener("open", () => {
    if (realtime.socket !== socket) return;
    realtime.connected = true;
    realtime.connecting = false;
    updateConnectionStatus("online", "online");
    if (role === "gm") sendRealtimeState();
  });
  socket.addEventListener("message", (event) => {
    if (realtime.socket !== socket) return;
    try {
      handleRealtimeMessage(JSON.parse(event.data));
    } catch (error) {
      console.warn("Mensagem inválida recebida da sala online.", error);
    }
  });
  socket.addEventListener("error", () => {
    if (realtime.socket === socket) updateConnectionStatus("error", "sem conexão");
  });
  socket.addEventListener("close", () => {
    if (realtime.socket !== socket) return;
    realtime.socket = null;
    realtime.connected = false;
    realtime.connecting = false;
    updateConnectionStatus("offline", "reconectando");
    if (realtime.shouldReconnect) {
      realtime.reconnectTimer = window.setTimeout(() => connectRealtime(roomId, role, gmToken), 3500);
    }
  });
}

async function createOnlineRoom() {
  const response = await apiRequest("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ state }),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.roomId || !payload?.gmToken) {
    throw new Error(payload?.error || "Não foi possível criar a sala online.");
  }
  state.room.id = payload.roomId;
  saveState({ sync: false });
  storeOnlineCredentials(payload);
  return payload;
}

async function initRealtime() {
  if (launchedAsPlayer) {
    if (!onlineServerBase) {
      updateConnectionStatus("error", "link sem servidor");
      showToast("Este link precisa do endereço do servidor online.", true);
      return;
    }
    if (!window.WebSocket) {
      updateConnectionStatus("error", "WebSocket indisponível");
      return;
    }
    if (!requestedRoomId) {
      updateConnectionStatus("error", "link sem sala");
      showToast("Este link de Player não contém uma sala online.", true);
      return;
    }
    connectRealtime(requestedRoomId, "player");
    loadOnlineRoomState(requestedRoomId);
    startOnlineStatePolling(requestedRoomId);
    return;
  }
  if (!onlineServerBase) {
    updateConnectionStatus("offline", "somente local");
    return;
  }
  if (!window.WebSocket) {
    updateConnectionStatus("error", "WebSocket indisponível");
    return;
  }

  try {
    let credentials = readOnlineCredentials();
    if (!credentials) credentials = await createOnlineRoom();
    state.room.id = credentials.roomId;
    saveState({ sync: false });
    connectRealtime(credentials.roomId, "gm", credentials.gmToken);
  } catch (error) {
    updateConnectionStatus("error", "servidor indisponível");
    showToast("A sala online não respondeu; o modo local continua disponível.", true);
    console.warn("Não foi possível iniciar a sala online.", error);
  }
}

function syncStateFromAnotherTab(event) {
  if (event.key !== stateStorageKey || !event.newValue) return;
  try {
    const localUi = state.ui;
    const incomingState = normalizeState(JSON.parse(event.newValue));
    state = incomingState;
    state.ui = {
      ...incomingState.ui,
      ...localUi,
      role: launchedAsPlayer ? "player" : localUi.role,
      panels: { ...incomingState.ui.panels, ...localUi.panels },
    };
    renderAll();
  } catch (error) {
    console.warn("Não foi possível sincronizar a sala nesta aba.", error);
  }
}

window.addEventListener("storage", syncStateFromAnotherTab);

function currentScene() {
  return state.scenes.find((scene) => scene.id === state.activeSceneId) || state.scenes[0];
}

function currentCamera() {
  const scene = currentScene();
  if (!scene.camera) scene.camera = normalizeCamera();
  return scene.camera;
}

function renderCamera() {
  if (!els.sceneViewport) return;
  const camera = currentCamera();
  els.sceneViewport.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`;
}

function gridCellSteps(scene = currentScene()) {
  const grid = normalizeGrid(scene?.grid);
  const rect = els.stage?.getBoundingClientRect?.() || { width: 1, height: 1 };
  const width = Math.max(1, rect.width || 1);
  const height = Math.max(1, rect.height || 1);
  const cellPixels = Math.max(1, Math.min(width, height) * grid.size);
  return {
    grid,
    cellPixels,
    stepX: cellPixels / width,
    stepY: cellPixels / height,
  };
}

function snapPointToGrid(point, scene = currentScene()) {
  const normalized = normalizePoint(point);
  const { grid, stepX, stepY } = gridCellSteps(scene);
  if (grid.snap === false) return normalized;
  return {
    x: clamp((Math.floor(normalized.x / stepX) + 0.5) * stepX, stepX / 2, 1 - stepX / 2),
    y: clamp((Math.floor(normalized.y / stepY) + 0.5) * stepY, stepY / 2, 1 - stepY / 2),
  };
}

function alignTokensToGrid(scene = currentScene()) {
  const { grid } = gridCellSteps(scene);
  if (grid.snap === false) return false;
  let changed = false;
  scene.tokens.forEach((token) => {
    const next = snapPointToGrid(token, scene);
    if (Math.abs(token.x - next.x) < 0.0001 && Math.abs(token.y - next.y) < 0.0001) return;
    token.x = next.x;
    token.y = next.y;
    changed = true;
  });
  return changed;
}

function renderGrid() {
  if (!els.gridLayer) return;
  const { grid, cellPixels } = gridCellSteps();
  els.gridLayer.hidden = grid.enabled === false;
  els.gridLayer.style.opacity = String(grid.opacity);
  els.gridLayer.style.backgroundSize = `${cellPixels}px ${cellPixels}px`;
  els.gridLayer.style.backgroundPosition = "0 0";
}

function currentRole() {
  return state.ui.role === "player" ? "player" : "gm";
}

function currentMemberId() {
  return currentRole() === "gm" ? "gm" : PLAYER_ID;
}

function getBlueprint(blueprintId) {
  return state.library.tokenBlueprints.find((blueprint) => blueprint.id === blueprintId);
}

function getToken(tokenId) {
  return currentScene().tokens.find((token) => token.id === tokenId);
}

function getWall(wallId) {
  return currentScene().walls.find((wall) => wall.id === wallId);
}

function getSequence(sequenceId) {
  return state.library.sequences.find((sequence) => sequence.id === sequenceId);
}

function getLight(lightId) {
  return currentScene().lights.find((light) => light.id === lightId);
}

function getDarknessZone(zoneId) {
  return currentScene().darknessZones.find((zone) => zone.id === zoneId);
}

function isLightingPreviewActive() {
  return currentRole() === "player" || (currentRole() === "gm" && state.ui.gmLightingPreview !== false);
}

function getTokenImage(token) {
  const blueprint = getBlueprint(token.blueprintId);
  return blueprint?.images?.find((image) => String(image.key) === String(token.activeKey)) || blueprint?.images?.[0] || null;
}

function getTokenAnimations(token) {
  return getBlueprint(token?.blueprintId)?.animations || [];
}

function getTokenAnimation(token, animationId = null) {
  const animations = getTokenAnimations(token);
  if (animationId) return animations.find((animation) => animation.id === animationId) || null;
  return animations.find((animation) => animation.trigger === "manual") || animations[0] || null;
}

function getTokenAnimationTrigger(animation) {
  return TOKEN_ANIMATION_TRIGGERS[animation?.trigger] || TOKEN_ANIMATION_TRIGGERS.manual;
}

function getTokenAnimationForTrigger(token, trigger) {
  return getTokenAnimations(token).find((animation) => animation.trigger === trigger) || null;
}

function getAnimationFrameDuration(animation, override = null) {
  const fallback = animation?.trigger === "manual" ? TOKEN_ANIMATION_FRAME_MS : TOKEN_ACTION_ANIMATION_FRAME_MS;
  return clamp(Number(override) || Number(animation?.frameDuration) || fallback, 60, 1200);
}

function countTokenAnimations() {
  return state.library.tokenBlueprints.reduce((total, blueprint) => total + (blueprint.animations?.length || 0), 0);
}

function canPlayTokenAnimation(token) {
  if (!token) return false;
  if (currentRole() === "gm") return true;
  return Boolean(state.permissions.interactSequences && token.ownerId === currentMemberId());
}

function getActiveTokenAnimationFrame(token) {
  const playback = activeTokenAnimations.get(token?.id);
  if (!playback) return null;
  const animation = getTokenAnimation(token, playback.animationId);
  if (!animation?.frames?.length) return null;
  return animation.frames[clamp(playback.frameIndex, 0, animation.frames.length - 1)] || null;
}

function stopTokenAnimation(tokenId, { restore = true, render = true, announce = false } = {}) {
  const playback = activeTokenAnimations.get(tokenId);
  if (!playback) return;
  window.clearTimeout(playback.timer);
  const token = getToken(tokenId);
  let restored = false;
  if (restore && token && playback.returnStateKey && token.activeKey !== playback.returnStateKey) {
    token.activeKey = playback.returnStateKey;
    restored = true;
  }
  activeTokenAnimations.delete(tokenId);
  if (restored) saveState();
  if (render) {
    renderCanvasObjects();
    renderFooter();
    renderInspector();
  }
  if (announce) showToast("Animação concluída; estado anterior restaurado.");
}

function scheduleTokenAnimation(tokenId) {
  const playback = activeTokenAnimations.get(tokenId);
  if (!playback) return;
  const animation = getTokenAnimation(getToken(tokenId), playback.animationId);
  playback.timer = window.setTimeout(() => advanceTokenAnimation(tokenId), getAnimationFrameDuration(animation, playback.frameDuration));
}

function advanceTokenAnimation(tokenId) {
  const playback = activeTokenAnimations.get(tokenId);
  const token = getToken(tokenId);
  const animation = getTokenAnimation(token, playback?.animationId);
  if (!playback || !token || !animation?.frames?.length || playback.frameIndex >= animation.frames.length - 1) {
    stopTokenAnimation(tokenId, { announce: Boolean(playback) });
    return;
  }
  playback.frameIndex += 1;
  renderCanvasObjects();
  renderFooter();
  renderInspector();
  scheduleTokenAnimation(tokenId);
}

function playTokenAnimation(tokenId, animationId = null, options = {}) {
  const token = getToken(tokenId);
  if (!token) return;
  const { bypassPermission = false, announce = true, render = true, frameDuration = null } = options;
  if (!bypassPermission && !canPlayTokenAnimation(token)) {
    showToast("O Mestre não liberou a animação deste token.", true);
    return;
  }
  const animation = getTokenAnimation(token, animationId);
  if (!animation?.frames?.length) {
    showToast("Este token ainda não tem uma animação salva.", true);
    return;
  }
  stopTokenAnimation(tokenId, { render: false, announce: false });
  activeTokenAnimations.set(tokenId, {
    animationId: animation.id,
    frameIndex: 0,
    returnStateKey: String(token.activeKey || getBlueprint(token.blueprintId)?.images?.[0]?.key || "1"),
    frameDuration: getAnimationFrameDuration(animation, frameDuration),
    timer: null,
  });
  if (render) {
    renderCanvasObjects();
    renderFooter();
    renderInspector();
  }
  if (announce) showToast(`${animation.name} ativada · volta ao estado anterior no fim.`);
  scheduleTokenAnimation(tokenId);
}

function playAttackAnimation(token, trigger) {
  const animation = getTokenAnimationForTrigger(token, trigger);
  if (!animation) return;
  playTokenAnimation(token.id, animation.id, {
    bypassPermission: true,
    announce: false,
    render: false,
    frameDuration: Math.min(getAnimationFrameDuration(animation), 240),
  });
}

function getTokenAttackAction(attackType) {
  return TOKEN_ATTACK_ACTIONS[attackType] || null;
}

function canUseTokenAttacks(token) {
  if (!token) return false;
  if (currentRole() === "gm") return true;
  return Boolean(state.permissions.useTokenAttacks && token.ownerId === currentMemberId());
}

function updateAttackTargetStyles() {
  $$(".token").forEach((element) => {
    const tokenId = element.dataset.tokenId;
    element.classList.toggle("attack-source", Boolean(armedAttack?.attackerId === tokenId));
    element.classList.toggle("attack-target", Boolean(activeAttackDrag?.targetId === tokenId && activeAttackDrag?.attackerId !== tokenId));
  });
}

function renderAttackLayer() {
  if (!els.attackLayer) return;
  const lines = [];
  lines.push(`<defs>
    <marker id="attack-arrow-shot" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 Z" fill="#83e1dc" /></marker>
    <marker id="attack-arrow-physical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 Z" fill="#f4c783" /></marker>
  </defs>`);

  if (activeAttackDrag) {
    const attacker = getToken(activeAttackDrag.attackerId);
    const attack = getTokenAttackAction(activeAttackDrag.attackType);
    if (attacker && attack && activeAttackDrag.point) {
      const marker = activeAttackDrag.attackType === "shot" ? "attack-arrow-shot" : "attack-arrow-physical";
      lines.push(`<line class="attack-preview attack-${escapeHtml(activeAttackDrag.attackType)}" x1="${attacker.x}" y1="${attacker.y}" x2="${activeAttackDrag.point.x}" y2="${activeAttackDrag.point.y}" marker-end="url(#${marker})" />`);
    }
  }

  activeTokenImpacts.forEach((impact, targetId) => {
    const attacker = getToken(impact.attackerId);
    const target = getToken(targetId);
    const attack = getTokenAttackAction(impact.attackType);
    if (!attacker || !target || !attack) return;
    lines.push(`<line class="attack-impact-trail attack-${escapeHtml(impact.attackType)}" x1="${attacker.x}" y1="${attacker.y}" x2="${target.x}" y2="${target.y}" />`);
  });
  els.attackLayer.innerHTML = lines.join("");
  updateAttackTargetStyles();
}

function setArmedAttack(tokenId, attackType) {
  const token = getToken(tokenId);
  const attack = getTokenAttackAction(attackType);
  if (!token || !attack) return;
  if (!canUseTokenAttacks(token)) {
    showToast("O Mestre não liberou ataques para este token.", true);
    return;
  }
  if (armedAttack?.attackerId === token.id && armedAttack.attackType === attackType) {
    armedAttack = null;
    renderToolbar();
    renderCanvasObjects();
    renderFooter();
    renderInspector();
    showToast("Ação cancelada.");
    return;
  }
  armedAttack = { attackerId: token.id, attackType };
  activeAttackDrag = null;
  renderToolbar();
  renderCanvasObjects();
  renderFooter();
  renderInspector();
  showToast(`${attack.name} preparado. Arraste do token até o alvo.`);
}

function clearArmedAttack({ render = true } = {}) {
  if (activeAttackDrag) {
    removeAttackDragListeners();
    activeAttackDrag = null;
  }
  armedAttack = null;
  if (render) {
    renderToolbar();
    renderCanvasObjects();
    renderFooter();
    renderInspector();
  }
}

function getTokenAtClientPoint(clientX, clientY) {
  const element = document.elementFromPoint?.(clientX, clientY);
  return element?.closest?.(".token")?.dataset.tokenId || null;
}

function startAttackDrag(event, token) {
  if (!armedAttack || armedAttack.attackerId !== token.id) return false;
  activeAttackDrag = {
    attackerId: token.id,
    attackType: armedAttack.attackType,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    point: { x: token.x, y: token.y },
    targetId: null,
    moved: false,
  };
  tokenElementForDrag(event)?.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", handleAttackDragMove);
  window.addEventListener("pointerup", finishAttackDrag);
  window.addEventListener("pointercancel", cancelAttackDrag);
  renderAttackLayer();
  event.preventDefault();
  return true;
}

function tokenElementForDrag(event) {
  return event.currentTarget?.closest?.(".token") || event.target?.closest?.(".token") || null;
}

function handleAttackDragMove(event) {
  if (!activeAttackDrag || event.pointerId !== activeAttackDrag.pointerId) return;
  const distance = Math.hypot(event.clientX - activeAttackDrag.startX, event.clientY - activeAttackDrag.startY);
  activeAttackDrag.moved = activeAttackDrag.moved || distance >= 4;
  activeAttackDrag.point = clientToNormalized(event);
  activeAttackDrag.targetId = getTokenAtClientPoint(event.clientX, event.clientY);
  renderAttackLayer();
  event.preventDefault();
}

function removeAttackDragListeners() {
  window.removeEventListener("pointermove", handleAttackDragMove);
  window.removeEventListener("pointerup", finishAttackDrag);
  window.removeEventListener("pointercancel", cancelAttackDrag);
}

function cancelAttackDrag() {
  removeAttackDragListeners();
  activeAttackDrag = null;
  renderAttackLayer();
}

function finishAttackDrag(event) {
  if (!activeAttackDrag || (event?.pointerId != null && event.pointerId !== activeAttackDrag.pointerId)) return;
  const drag = activeAttackDrag;
  removeAttackDragListeners();
  activeAttackDrag = null;
  drag.targetId = getTokenAtClientPoint(event.clientX, event.clientY) || drag.targetId;
  const validTarget = drag.moved && drag.targetId && drag.targetId !== drag.attackerId;
  if (validTarget) executeTokenAttack(drag.attackerId, drag.targetId, drag.attackType);
  else renderAttackLayer();
}

function finishTokenImpact(targetId, impactId) {
  const impact = activeTokenImpacts.get(targetId);
  if (!impact || impact.id !== impactId) return;
  activeTokenImpacts.delete(targetId);
  renderCanvasObjects();
  renderFooter();
  renderInspector();
}

function executeTokenAttack(attackerId, targetId, attackType) {
  const attacker = getToken(attackerId);
  const target = getToken(targetId);
  const attack = getTokenAttackAction(attackType);
  if (!attacker || !target || attacker.id === target.id || !attack) {
    clearArmedAttack();
    return;
  }
  if (!canUseTokenAttacks(attacker)) {
    clearArmedAttack();
    showToast("O Mestre não liberou ataques para este token.", true);
    return;
  }
  playAttackAnimation(attacker, attackType);
  playAttackAnimation(target, "impact");
  const previousImpact = activeTokenImpacts.get(target.id);
  if (previousImpact) window.clearTimeout(previousImpact.timer);
  const impact = { id: makeId("impact"), attackerId: attacker.id, attackType, timer: null };
  impact.timer = window.setTimeout(() => finishTokenImpact(target.id, impact.id), TOKEN_IMPACT_DURATION_MS);
  activeTokenImpacts.set(target.id, impact);
  armedAttack = null;
  state.ui.selectedTokenId = attacker.id;
  state.ui.selectedWallId = null;
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = null;
  renderAll();
  showToast(`${attack.name} executado · impacto visual aplicado.`);
}

function canMoveToken(token) {
  if (currentRole() === "gm") return true;
  return Boolean(state.permissions.moveOwnToken && token.ownerId === currentMemberId());
}

function isTokenVisibleToCurrentRole(token) {
  return currentRole() === "gm" || token?.visibleToPlayers !== false;
}

function canChangeTokenImage(token) {
  if (currentRole() === "gm") return true;
  return Boolean(state.permissions.changeOwnImage && token.ownerId === currentMemberId());
}

function canInteractWithSequences() {
  // As sequências antigas pertencem ao espaço de preparação do Mestre.
  // Players interagem somente com animações ligadas aos tokens já colocados.
  return currentRole() === "gm";
}

function renderAll() {
  const aligned = currentRole() === "gm" ? alignTokensToGrid() : false;
  if (aligned) saveState();
  renderShell();
  renderSidebar();
  renderToolbar();
  renderCamera();
  renderMap();
  renderGrid();
  renderCanvasObjects();
  renderFooter();
  renderInspector();
  window.requestAnimationFrame(renderLighting);
}

function renderShell() {
  if (launchedAsPlayer && state.ui.role !== "player") state.ui.role = "player";
  const role = currentRole();
  const scene = currentScene();
  if (role === "player") {
    state.ui.activeTool = "select";
    wallDraftPoint = null;
    state.ui.selectedWallId = null;
    state.ui.selectedLightId = null;
    state.ui.selectedDarknessId = null;
    if (state.ui.selectedTokenId && !isTokenVisibleToCurrentRole(getToken(state.ui.selectedTokenId))) {
      state.ui.selectedTokenId = null;
    }
  }
  els.body.dataset.role = role;
  els.body.classList.toggle("linked-player", launchedAsPlayer);
  els.roomName.textContent = state.room.name;
  els.sceneChip.textContent = scene.name.toUpperCase();
  els.roleButtons.forEach((button) => button.classList.toggle("active", button.dataset.roleChoice === role));
  renderPanels();
  if (role === "player") {
    els.toolStatus.textContent = "Modo Player · mova apenas o que for permitido";
  }
}

function renderPanels() {
  const isGm = currentRole() === "gm";
  const panels = state.ui.panels || { leftOpen: false, rightOpen: false };
  const leftOpen = isGm && panels.leftOpen === true;
  const rightOpen = isGm && panels.rightOpen === true;
  els.body.classList.toggle("panel-left-closed", !leftOpen);
  els.body.classList.toggle("panel-right-closed", !rightOpen);

  [els.toggleLeftPanel, els.toggleRightPanel].forEach((button) => {
    if (button) button.hidden = !isGm;
  });
  if (els.toggleLeftPanel) {
    els.toggleLeftPanel.setAttribute("aria-expanded", String(leftOpen));
    els.toggleLeftPanel.setAttribute("aria-label", leftOpen ? "Fechar Biblioteca" : "Abrir Biblioteca");
    els.toggleLeftPanel.title = leftOpen ? "Fechar Biblioteca" : "Abrir Biblioteca";
    const label = els.toggleLeftPanel.querySelector("em");
    if (label) label.textContent = leftOpen ? "Fechar" : "Biblioteca";
  }
  if (els.toggleRightPanel) {
    els.toggleRightPanel.setAttribute("aria-expanded", String(rightOpen));
    els.toggleRightPanel.setAttribute("aria-label", rightOpen ? "Fechar Inspector" : "Abrir Inspector");
    els.toggleRightPanel.title = rightOpen ? "Fechar Inspector" : "Abrir Inspector";
    const label = els.toggleRightPanel.querySelector("em");
    if (label) label.textContent = rightOpen ? "Fechar" : "Inspector";
  }
}

function renderSidebar() {
  if (currentRole() !== "gm") {
    // Não basta esconder a coluna: o Player também não recebe a biblioteca
    // nem seus metadados no DOM renderizado.
    els.mapList.innerHTML = "";
    els.tokenList.innerHTML = "";
    els.sequenceList.innerHTML = "";
    return;
  }
  const maps = state.library.maps;
  const blueprints = state.library.tokenBlueprints;
  const tokenAnimations = blueprints.flatMap((blueprint) => (blueprint.animations || []).map((animation) => ({ blueprint, animation })));
  els.assetCount.textContent = maps.length + blueprints.length + tokenAnimations.length;
  els.mapCount.textContent = maps.length;
  els.tokenCount.textContent = blueprints.length;
  els.sequenceCount.textContent = tokenAnimations.length;

  els.mapList.innerHTML = maps.length
    ? maps.map((map) => `
      <div class="asset-row ${currentScene().mapAssetId === map.id ? "active" : ""}">
        <button class="asset-row-main" data-action="set-map" data-id="${escapeHtml(map.id)}" title="Usar este mapa">
          <span class="asset-thumb"><img src="${escapeHtml(map.dataUrl)}" alt="" /></span>
          <span class="asset-row-copy"><strong>${escapeHtml(map.name)}</strong><small>Mapa reutilizável</small></span>
        </button>
        <button class="asset-action" data-action="set-map" data-id="${escapeHtml(map.id)}" aria-label="Usar mapa">↗</button>
      </div>`).join("")
    : '<div class="empty-list">Nenhum mapa salvo. O mapa atual pode ser trocado sem afetar a biblioteca de tokens.</div>';

  els.tokenList.innerHTML = blueprints.length
    ? blueprints.map((blueprint) => {
      const image = blueprint.images?.[0];
      const thumb = image
        ? `<img src="${escapeHtml(image.src)}" alt="" />`
        : `<span>${escapeHtml(blueprint.name.slice(0, 1).toUpperCase())}</span>`;
      return `
        <div class="asset-row">
          <button class="asset-row-main" data-action="add-token" data-id="${escapeHtml(blueprint.id)}" title="Adicionar à cena">
            <span class="asset-thumb">${thumb}</span>
            <span class="asset-row-copy"><strong>${escapeHtml(blueprint.name)}</strong><small>${blueprint.images?.length || 0} estados · clique para adicionar</small></span>
          </button>
          <button class="asset-action" data-action="edit-token" data-id="${escapeHtml(blueprint.id)}" aria-label="Editar token">···</button>
        </div>`;
    }).join("")
    : '<div class="empty-list">Crie um token com imagens, estados e teclas reutilizáveis.</div>';

  els.sequenceList.innerHTML = tokenAnimations.length
    ? tokenAnimations.map(({ blueprint, animation }) => `
      <button class="asset-row" data-action="edit-blueprint-animation" data-id="${escapeHtml(blueprint.id)}" data-animation-id="${escapeHtml(animation.id)}" title="Editar animação do token">
        <span class="asset-thumb" style="color:var(--violet);border-color:rgba(185,169,255,.28)">✦</span>
        <span class="asset-row-copy"><strong>${escapeHtml(blueprint.name)} · ${escapeHtml(animation.name)}</strong><small>${animation.frames?.length || 0}/12 frames · ${escapeHtml(getTokenAnimationTrigger(animation).label)}</small></span>
      </button>`).join("")
    : '<div class="empty-list">Nenhuma animação salva. Selecione um token no mapa para criar a primeira.</div>';

  els.sceneName.value = currentScene().name;
  els.globalIllumination.checked = Boolean(currentScene().globalIllumination);
  els.visionMask.checked = currentScene().visionMaskEnabled !== false;
  const darknessOpacity = Math.round((currentScene().darknessOpacity ?? 0.82) * 100);
  els.gmLightingPreview.checked = state.ui.gmLightingPreview !== false;
  els.newLightColor.value = normalizeHexColor(state.ui.newLightColor);
  els.timeOfDay.value = Object.prototype.hasOwnProperty.call(TIME_OF_DAY_PRESETS, currentScene().timeOfDay)
    ? currentScene().timeOfDay
    : "day";
  const sceneGrid = normalizeGrid(currentScene().grid);
  els.gridEnabled.checked = sceneGrid.enabled !== false;
  els.gridSnap.checked = sceneGrid.snap !== false;
  els.gridSize.value = String(Math.round(sceneGrid.size * 100));
  els.gridSizeValue.textContent = `${Math.round(sceneGrid.size * 100)}%`;
  els.gridOpacity.value = String(Math.round(sceneGrid.opacity * 100));
  els.gridOpacityValue.textContent = `${Math.round(sceneGrid.opacity * 100)}%`;
  els.wallType.value = normalizeWallType(state.ui.wallType);
  updateLightPresetStyles();
  els.darknessOpacity.value = String(darknessOpacity);
  els.darknessOpacityValue.textContent = `${darknessOpacity}%`;
  $$('[data-permission]').forEach((input) => {
    input.checked = Boolean(state.permissions[input.dataset.permission]);
  });
}

function renderToolbar() {
  const tool = state.ui.activeTool;
  els.stage.dataset.tool = tool;
  els.toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  if (els.toggleLightingPreview) {
    const enabled = currentRole() === "gm" && state.ui.gmLightingPreview !== false;
    els.toggleLightingPreview.classList.toggle("active", enabled);
    els.toggleLightingPreview.setAttribute("aria-pressed", String(enabled));
    els.toggleLightingPreview.title = enabled ? "Desligar prévia da visão dos Players" : "Ligar prévia da visão dos Players";
    const label = els.toggleLightingPreview.querySelector("em");
    if (label) label.textContent = enabled ? "Visão Player" : "Visão livre";
  }
  if (currentRole() === "gm") {
    const messages = {
      select: "Arraste o fundo para mover · roda para zoom",
      wall: wallDraftPoint
        ? `Escolha o segundo ponto · ${wallTypeLabel({ type: state.ui.wallType, open: false })}`
        : `Clique em dois pontos para desenhar · ${wallTypeLabel({ type: state.ui.wallType, open: false })}`,
      light: "Clique no mapa para adicionar uma luz",
      darkness: "Arraste no mapa para criar uma área escura · clique para uma área padrão",
      animation: "Clique em um token para ativar sua animação",
    };
    if (armedAttack) {
      const attack = getTokenAttackAction(armedAttack.attackType);
      els.toolStatus.textContent = `${attack?.name || "Ação"} preparado · arraste do token até o alvo`;
    } else {
      els.toolStatus.textContent = messages[tool] || messages.select;
    }
  }
}

function renderMap() {
  const map = state.library.maps.find((item) => item.id === currentScene().mapAssetId);
  if (map) {
    els.mapImage.src = map.dataUrl;
    els.mapImage.alt = map.name;
    els.mapImage.hidden = false;
    els.mapPlaceholder.hidden = true;
    els.stage.classList.add("map-active");
  } else {
    els.mapImage.hidden = true;
    els.mapImage.removeAttribute("src");
    els.mapPlaceholder.hidden = false;
    els.stage.classList.remove("map-active");
  }
  els.stageHint.hidden = Boolean(map || currentScene().tokens.length || currentRole() === "player");
}

function renderVisionRangeLayer() {
  if (els.visionRangeLayer) {
    const scene = currentScene();
    const rect = els.stage.getBoundingClientRect();
    const stageWidth = Math.max(1, rect.width);
    const stageHeight = Math.max(1, rect.height);
    const minDimension = Math.min(stageWidth, stageHeight);
    const selectedVisionToken = currentRole() === "gm"
      ? scene.tokens.find((token) => token.id === state.ui.selectedTokenId && isTokenVisibleToCurrentRole(token) && Number(token.visionRange) > 0)
      : null;
    if (selectedVisionToken) {
      const diameter = selectedVisionToken.visionRange * minDimension;
      els.visionRangeLayer.innerHTML = `<div class="vision-range" style="left:${selectedVisionToken.x * 100}%;top:${selectedVisionToken.y * 100}%;width:${(diameter / stageWidth) * 100}%;height:${(diameter / stageHeight) * 100}%;"><span>${Math.round(selectedVisionToken.visionRange * 100)}%</span></div>`;
    } else {
      els.visionRangeLayer.innerHTML = "";
    }
  }
}

function renderCanvasObjects() {
  const scene = currentScene();
  renderVisionRangeLayer();
  els.wallsLayer.innerHTML = currentRole() === "gm"
    ? scene.walls.map((wall) => {
      const type = normalizeWallType(wall.type);
      const selected = state.ui.selectedWallId === wall.id;
      const openClass = type === "door" && wall.open === true ? " open" : "";
      const status = wallTypeLabel(wall);
      return `
        <g class="wall-segment ${selected ? "selected" : ""}" data-wall-id="${escapeHtml(wall.id)}" tabindex="0" role="button" aria-label="${escapeHtml(status)}">
          <line class="wall-select-hit" x1="${wall.a.x}" y1="${wall.a.y}" x2="${wall.b.x}" y2="${wall.b.y}" />
          <line class="wall-edge wall-${type}${openClass}${selected ? " selected" : ""}" x1="${wall.a.x}" y1="${wall.a.y}" x2="${wall.b.x}" y2="${wall.b.y}" />
          <title>${escapeHtml(status)} · clique para selecionar</title>
        </g>`;
    }).join("")
    : "";

  els.darknessLayer.innerHTML = scene.darknessZones.map((zone) => `
    <div class="darkness-zone ${state.ui.selectedDarknessId === zone.id ? "selected" : ""}" data-darkness-id="${escapeHtml(zone.id)}" style="left:${zone.x * 100}%;top:${zone.y * 100}%;width:${zone.width * 100}%;height:${zone.height * 100}%;--darkness-opacity:${zone.opacity}" title="Área escura · arraste para mover" role="button" tabindex="0" aria-label="Área escura"></div>`).join("");

  const showLightMarkers = currentRole() === "gm";
  els.lightsLayer.hidden = !showLightMarkers;
  els.lightsLayer.innerHTML = showLightMarkers
    ? scene.lights.map((light) => `
      <button class="light-marker ${state.ui.selectedLightId === light.id ? "selected" : ""}" data-light-id="${escapeHtml(light.id)}" style="left:${light.x * 100}%;top:${light.y * 100}%;--light-color:${escapeHtml(normalizeHexColor(light.color))}" title="Luz ${escapeHtml(normalizeHexColor(light.color))} · arraste para mover" aria-label="Luz ${escapeHtml(normalizeHexColor(light.color))}, arraste para mover"><span>✦</span></button>`).join("")
    : "";

  // Animações novas pertencem aos tokens. O layer antigo fica vazio para não
  // deixar hotspots narrativos soltos no mapa depois da migração do beta.
  els.hotspotsLayer.innerHTML = "";

  els.tokensLayer.innerHTML = scene.tokens.filter(isTokenVisibleToCurrentRole).map((token) => {
    const blueprint = getBlueprint(token.blueprintId) || { name: "Token", images: [] };
    const animationFrame = getActiveTokenAnimationFrame(token);
    const image = animationFrame?.image ? { src: animationFrame.image } : getTokenImage(token);
    const isSelected = state.ui.selectedTokenId === token.id;
    const isOwned = token.ownerId === currentMemberId();
    const playback = activeTokenAnimations.get(token.id);
    const animation = getTokenAnimation(token, playback?.animationId);
    const impact = activeTokenImpacts.get(token.id);
    const contents = image
      ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(blueprint.name)}" draggable="false" />`
      : `<span class="token-fallback">${escapeHtml(blueprint.name.slice(0, 1).toUpperCase())}</span>`;
    const impactMarkup = impact
      ? `<span class="token-impact-effect token-impact-${escapeHtml(impact.attackType)}" aria-hidden="true"></span>`
      : "";
    const transformHandles = currentRole() === "gm" && isSelected
      ? `<span class="token-transform-ui" aria-hidden="true">
          <span class="token-resize-handle token-resize-nw" data-token-resize="nw"></span>
          <span class="token-resize-handle token-resize-ne" data-token-resize="ne"></span>
          <span class="token-resize-handle token-resize-sw" data-token-resize="sw"></span>
          <span class="token-resize-handle token-resize-se" data-token-resize="se"></span>
        </span>`
      : "";
    return `
      <div class="token ${isSelected ? "selected" : ""} ${isOwned ? "player-owned" : ""} ${playback ? "token-animation-playing" : ""} ${armedAttack?.attackerId === token.id ? "attack-source" : ""} ${activeAttackDrag?.targetId === token.id && activeAttackDrag?.attackerId !== token.id ? "attack-target" : ""} ${impact ? `token-impact-active token-impact-${escapeHtml(impact.attackType)}` : ""}" data-token-id="${escapeHtml(token.id)}" style="left:${token.x * 100}%;top:${token.y * 100}%;--token-size:${(token.size || blueprint.defaultSize || 0.08) * 100}%;transform:translate(-50%,-50%) rotate(${Number(token.rotation) || 0}deg)" tabindex="0" role="button" aria-label="Token ${escapeHtml(blueprint.name)}">
        <span class="token-body">${contents}</span>
        ${impactMarkup}
        ${animationFrame?.text ? `<span class="token-animation-caption">${escapeHtml(animationFrame.text)}</span>` : ""}
        ${playback && animation ? `<span class="token-animation-badge">▶ ${playback.frameIndex + 1}/${animation.frames.length}</span>` : ""}
        <span class="token-tag">${escapeHtml(blueprint.name)}</span>
        ${transformHandles}
      </div>`;
  }).join("");

  els.wallDraft.hidden = !wallDraftPoint;
  if (wallDraftPoint) {
    els.wallDraft.style.left = `${wallDraftPoint.x * 100}%`;
    els.wallDraft.style.top = `${wallDraftPoint.y * 100}%`;
  }
  els.darknessDraft.hidden = !activeDarknessDraw;
  bindWallInteractions();
  bindTokenInteractions();
  bindLightInteractions();
  bindDarknessInteractions();
  renderAttackLayer();
}

function renderFooter() {
  const selectedWall = currentRole() === "gm" && state.ui.selectedWallId ? getWall(state.ui.selectedWallId) : null;
  if (selectedWall) {
    const type = normalizeWallType(selectedWall.type);
    els.selectionAvatar.textContent = type === "door" ? "▣" : type === "window" ? "▤" : "╱";
    els.selectionName.textContent = wallTypeLabel(selectedWall);
    els.selectionDetail.textContent = "Arraste para mover · abra/edite no Inspector · Ctrl+X exclui";
    els.hotkeyStrip.innerHTML = '<span class="eyebrow">PAREDE</span><span class="hotkey-placeholder">Portas e janelas podem ser alteradas no Inspector</span>';
    return;
  }

  const selectedLight = currentRole() === "gm" && state.ui.selectedLightId ? getLight(state.ui.selectedLightId) : null;
  if (selectedLight) {
    els.selectionAvatar.textContent = "✦";
    els.selectionName.textContent = "Luz selecionada";
    els.selectionDetail.textContent = `${Math.round(selectedLight.radius * 100)}% de alcance · arraste para mover · Delete ou Ctrl+X para excluir`;
    els.hotkeyStrip.innerHTML = '<span class="eyebrow">LUZ</span><span class="hotkey-placeholder">Abra o Inspector para ajustar alcance, cor e intensidade</span>';
    return;
  }

  const selectedDarkness = currentRole() === "gm" && state.ui.selectedDarknessId ? getDarknessZone(state.ui.selectedDarknessId) : null;
  if (selectedDarkness) {
    els.selectionAvatar.textContent = "◼";
    els.selectionName.textContent = "Área escura selecionada";
    els.selectionDetail.textContent = `${Math.round(selectedDarkness.opacity * 100)}% de opacidade · arraste para mover · Delete ou Ctrl+X para excluir`;
    els.hotkeyStrip.innerHTML = '<span class="eyebrow">ESCURIDÃO</span><span class="hotkey-placeholder">Abra o Inspector para ajustar opacidade</span>';
    return;
  }

  const selectedToken = state.ui.selectedTokenId ? getToken(state.ui.selectedTokenId) : null;
  const token = selectedToken && isTokenVisibleToCurrentRole(selectedToken) ? selectedToken : null;
  if (!token) {
    els.selectionAvatar.textContent = "—";
    els.selectionName.textContent = "Nenhum token selecionado";
    els.selectionDetail.textContent = currentRole() === "gm" ? "O canvas está pronto." : "Selecione o seu token para ver os estados.";
    els.hotkeyStrip.innerHTML = '<span class="eyebrow">ESTADOS</span><span class="hotkey-placeholder">Selecione um token para usar 1–9</span>';
    return;
  }

  const blueprint = getBlueprint(token.blueprintId) || { name: "Token", images: [] };
  const animationFrame = getActiveTokenAnimationFrame(token);
  const image = animationFrame?.image ? { src: animationFrame.image } : getTokenImage(token);
  els.selectionAvatar.innerHTML = image ? `<img src="${escapeHtml(image.src)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:7px" />` : escapeHtml(blueprint.name.slice(0, 1).toUpperCase());
  els.selectionName.textContent = blueprint.name;
  const owner = state.members.find((member) => member.id === token.ownerId)?.name || "Mestre";
  const playback = activeTokenAnimations.get(token.id);
  const animation = getTokenAnimation(token, playback?.animationId);
  const animationStatus = playback && animation ? ` · animando ${playback.frameIndex + 1}/${animation.frames.length}` : "";
  els.selectionDetail.textContent = `${owner} · estado ${token.activeKey || "1"}${animationStatus} · ${canMoveToken(token) ? "pode mover" : "somente visualização"} · Ctrl+X exclui`;
  const images = blueprint.images || [];
  const animations = getTokenAnimations(token);
  const canEditToken = canChangeTokenImage(token);
  const stateButtons = canEditToken && images.length
    ? images.map((item) => `<button class="hotkey available state-hotkey ${String(token.activeKey) === String(item.key) ? "current" : ""}" data-action="select-state" data-id="${escapeHtml(token.id)}" data-state-key="${escapeHtml(item.key)}" title="Clique para usar ${escapeHtml(item.label || `Estado ${item.key}`)}"><img src="${escapeHtml(item.src)}" alt="" /><span>${escapeHtml(item.key)}</span></button>`).join("")
    : canEditToken
      ? '<span class="hotkey-placeholder">Adicione imagens ao token para habilitar 1–9</span>'
      : '<span class="hotkey-placeholder">Somente o dono ou o Mestre pode mudar este estado.</span>';
  const animationButtons = animations.length && canPlayTokenAnimation(token)
    ? `<span class="eyebrow">ANIMAÇÃO</span>${animations.map((item) => `<button class="hotkey available ${playback?.animationId === item.id ? "current" : ""}" data-action="play-token-animation" data-id="${escapeHtml(token.id)}" data-animation-id="${escapeHtml(item.id)}" title="Ativar ${escapeHtml(item.name)}">▶</button>`).join("")}`
    : "";
  const attackButtons = canUseTokenAttacks(token)
    ? `<span class="eyebrow">AÇÕES</span>${Object.entries(TOKEN_ATTACK_ACTIONS).map(([type, item]) => `<button class="attack-action ${armedAttack?.attackerId === token.id && armedAttack.attackType === type ? "armed" : ""}" data-attack-type="${type}" data-token-id="${escapeHtml(token.id)}" title="${escapeHtml(item.name)}: arraste do token até o alvo"><span class="attack-action-icon">${item.icon}</span><span class="attack-action-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.hint)}</small></span></button>`).join("")}<span class="attack-help">clique para preparar · arraste até o alvo</span>`
    : "";
  els.hotkeyStrip.innerHTML = `<span class="eyebrow">ESTADOS</span>${stateButtons}${animationButtons}${attackButtons}`;
}

function renderInspector() {
  if (currentRole() !== "gm") {
    els.inspectorTitle.textContent = "";
    els.inspectorContent.innerHTML = "";
    return;
  }
  const wall = state.ui.selectedWallId ? getWall(state.ui.selectedWallId) : null;
  if (wall) {
    const type = normalizeWallType(wall.type);
    els.inspectorTitle.textContent = "Parede / abertura";
    els.inspectorContent.innerHTML = `
      <div class="inspector-card">
        <div class="eyebrow">WALL SEGMENT</div>
        <div class="inspector-title">${escapeHtml(wallTypeLabel(wall))}</div>
        <div class="inspector-meta">Arraste o segmento para reposicionar. Ele continua salvo nesta cena mesmo quando o mapa for trocado.</div>
        <label class="field-label" for="selectedWallType">Tipo</label>
        <select class="text-input" id="selectedWallType" data-wall-control="type" data-wall-id="${escapeHtml(wall.id)}">
          <option value="wall" ${type === "wall" ? "selected" : ""}>Parede — bloqueia tudo</option>
          <option value="door" ${type === "door" ? "selected" : ""}>Porta — abre e libera passagem</option>
          <option value="window" ${type === "window" ? "selected" : ""}>Janela — passa visão e luz</option>
        </select>
        ${type === "door" ? `
          <label class="switch-row inspector-switch-row">
            <span><strong>Porta aberta</strong><small>Aberta libera movimento, visão e luz.</small></span>
            <input type="checkbox" ${wall.open === true ? "checked" : ""} data-wall-control="open" data-wall-id="${escapeHtml(wall.id)}" />
            <span class="switch-ui"></span>
          </label>` : type === "window" ? `
          <div class="permission-summary">
            <div><span>Movimento</span><b>bloqueado</b></div>
            <div><span>Visão / luz</span><b>liberadas</b></div>
          </div>` : `
          <div class="permission-summary">
            <div><span>Movimento</span><b>bloqueado</b></div>
            <div><span>Visão / luz</span><b>bloqueadas</b></div>
          </div>`}
        <button class="quiet-button full-width delete-button" data-action="delete-wall" data-id="${escapeHtml(wall.id)}">Excluir segmento</button>
      </div>`;
    return;
  }
  const light = currentRole() === "gm" && state.ui.selectedLightId ? getLight(state.ui.selectedLightId) : null;
  if (light) {
    els.inspectorTitle.textContent = "Fonte de luz";
    els.inspectorContent.innerHTML = `
      <div class="inspector-card">
        <div class="eyebrow">LIGHT SOURCE</div>
        <div class="inspector-title">Luz selecionada</div>
        <div class="inspector-meta">Arraste o marcador no mapa para reposicionar. As paredes bloqueiam esta luz durante o cálculo.</div>
        <label class="range-row inspector-range">
          <span><strong>Alcance</strong><output data-light-output="radius">${Math.round(light.radius * 100)}%</output></span>
          <input type="range" min="0.03" max="1.2" step="0.01" value="${light.radius}" data-light-control="radius" />
        </label>
        <label class="range-row inspector-range">
          <span><strong>Intensidade</strong><output data-light-output="intensity">${Math.round((light.intensity || 1) * 100)}%</output></span>
          <input type="range" min="0.1" max="1.5" step="0.05" value="${light.intensity || 1}" data-light-control="intensity" />
        </label>
        <label class="range-row inspector-range">
          <span><strong>Suavidade</strong><output data-light-output="falloff">${Math.round((light.falloff || 0.72) * 100)}%</output></span>
          <input type="range" min="0.2" max="0.95" step="0.01" value="${light.falloff || 0.72}" data-light-control="falloff" />
        </label>
        <label class="color-row"><span><strong>Cor da luz</strong><small>A cor também aparece no halo.</small></span><input class="color-input" type="color" value="${escapeHtml(light.color || "#f4c783")}" data-light-control="color" /></label>
        <button class="quiet-button full-width delete-button" data-action="delete-light" data-id="${escapeHtml(light.id)}">Excluir luz</button>
      </div>`;
    return;
  }

  const darkness = currentRole() === "gm" && state.ui.selectedDarknessId ? getDarknessZone(state.ui.selectedDarknessId) : null;
  if (darkness) {
    els.inspectorTitle.textContent = "Área escura";
    els.inspectorContent.innerHTML = `
      <div class="inspector-card">
        <div class="eyebrow">DARKNESS ZONE</div>
        <div class="inspector-title">Área escura selecionada</div>
        <div class="inspector-meta">Arraste a área no mapa para reposicionar. Ela fica por cima da iluminação e cria um bloqueio visual local.</div>
        <div class="permission-summary">
          <div><span>Tamanho</span><b>${Math.round(darkness.width * 100)}% × ${Math.round(darkness.height * 100)}%</b></div>
          <div><span>Posição</span><b>${Math.round(darkness.x * 100)}% / ${Math.round(darkness.y * 100)}%</b></div>
        </div>
        <label class="range-row inspector-range">
          <span><strong>Opacidade</strong><output data-darkness-output="opacity">${Math.round(darkness.opacity * 100)}%</output></span>
          <input type="range" min="0.1" max="1" step="0.01" value="${darkness.opacity}" data-darkness-control="opacity" />
        </label>
        <button class="quiet-button full-width delete-button" data-action="delete-darkness" data-id="${escapeHtml(darkness.id)}">Excluir área escura</button>
      </div>`;
    return;
  }

  const token = state.ui.selectedTokenId ? getToken(state.ui.selectedTokenId) : null;
  if (token) {
    const blueprint = getBlueprint(token.blueprintId) || { name: "Token", images: [] };
    const images = blueprint.images || [];
    const animations = getTokenAnimations(token);
    const playback = activeTokenAnimations.get(token.id);
    const activeAnimation = getTokenAnimation(token, playback?.animationId);
    const animationRows = animations.length
      ? animations.map((animation) => `
          <div class="animation-row">
            <div class="animation-row-copy"><strong>${escapeHtml(animation.name)}</strong><small>${animation.frames.length}/12 frames · ${escapeHtml(getTokenAnimationTrigger(animation).label)}${playback?.animationId === animation.id ? ` · <span class="animation-active-label">em andamento</span>` : ""}</small></div>
            <div class="animation-row-actions">
              <button class="quiet-button animation-play-button" data-action="play-token-animation" data-id="${escapeHtml(token.id)}" data-animation-id="${escapeHtml(animation.id)}" title="Ativar animação">▶ Ativar</button>
              <button class="icon-button animation-edit-button" data-action="edit-token-animation" data-id="${escapeHtml(token.id)}" data-animation-id="${escapeHtml(animation.id)}" title="Editar animação" aria-label="Editar animação">···</button>
            </div>
          </div>`).join("")
      : '<div class="empty-list">Nenhuma animação neste token ainda.</div>';
    els.inspectorTitle.textContent = blueprint.name;
    els.inspectorContent.innerHTML = `
      <div class="inspector-card">
        <div class="eyebrow">TOKEN INSTANCE</div>
        <div class="inspector-title">${escapeHtml(blueprint.name)}</div>
        <div class="inspector-meta">Arraste os cantos para redimensionar ou use a roda do mouse sobre o token. O modelo e seus estados continuam salvos na Biblioteca do Mestre.</div>
        <div class="permission-summary">
          <div><span>Dono</span><b>${escapeHtml(state.members.find((member) => member.id === token.ownerId)?.name || "Mestre")}</b></div>
          <div><span>Posição</span><b>${Math.round(token.x * 100)}% / ${Math.round(token.y * 100)}%</b></div>
         <div><span>Luz / visão</span><b>${token.visionRange ? `${Math.round(token.visionRange * 100)}%` : "desligada"}</b></div>
       </div>
        <label class="range-row inspector-range">
          <span><strong>Tamanho</strong><output data-token-output="size">${Math.round(token.size * 100)}%</output></span>
          <input type="range" min="3" max="50" step="1" value="${Math.round(token.size * 100)}" data-token-control="size" data-token-id="${escapeHtml(token.id)}" />
        </label>
        <label class="range-row inspector-range">
          <span><strong>Rotação</strong><output data-token-output="rotation">${Math.round(Number(token.rotation) || 0)}°</output></span>
          <input type="range" min="-180" max="180" step="1" value="${Math.round(Number(token.rotation) || 0)}" data-token-control="rotation" data-token-id="${escapeHtml(token.id)}" />
        </label>
        <label class="range-row inspector-range">
          <span><strong>Luz ao redor do token</strong><output data-token-output="visionRange">${token.visionRange ? `${Math.round(token.visionRange * 100)}%` : "desligada"}</output></span>
          <input type="range" min="0" max="200" step="1" value="${Math.round((Number(token.visionRange) || 0) * 100)}" data-token-control="visionRange" data-token-id="${escapeHtml(token.id)}" aria-label="Alcance da luz e visão do token" />
        </label>
        <small class="inspector-help">Arraste para ajustar o alcance. Zero desliga a luz; o círculo aparece quando o token está selecionado.</small>
        <label class="switch-row inspector-switch-row">
          <span><strong>Visível para Players</strong><small>Desative para esconder este token sem removê-lo da cena.</small></span>
          <input type="checkbox" ${token.visibleToPlayers !== false ? "checked" : ""} data-token-control="visibleToPlayers" data-token-id="${escapeHtml(token.id)}" />
          <span class="switch-ui"></span>
        </label>
        <button class="quiet-button full-width delete-button" data-action="delete-token" data-id="${escapeHtml(token.id)}">Excluir token da cena</button>
      </div>
      <div class="inspector-card">
        <div class="eyebrow">IMAGE STATES</div>
        <div class="inspector-meta">Clique diretamente numa imagem para aplicar o estado. As teclas 1–9 continuam disponíveis no canvas.</div>
        <div class="inspector-states">${images.length ? images.map((item) => `
          <button class="state-button ${String(token.activeKey) === String(item.key) ? "current" : ""}" data-action="select-state" data-id="${escapeHtml(token.id)}" data-state-key="${escapeHtml(item.key)}" title="Usar ${escapeHtml(item.label || `Estado ${item.key}`)}">
            <img src="${escapeHtml(item.src)}" alt="" /><span>${escapeHtml(item.key)} · ${escapeHtml(item.label || `Estado ${item.key}`)}</span>
          </button>`).join("") : '<div class="empty-list" style="grid-column:1/-1">Este token ainda usa o fallback de texto. Edite-o para adicionar imagens.</div>'}</div>
        <button class="quiet-button full-width" data-action="edit-token" data-id="${escapeHtml(token.blueprintId)}" style="margin-top:10px">Editar token na biblioteca</button>
      </div>`;
    els.inspectorContent.innerHTML += `
      <div class="inspector-card">
        <div class="eyebrow">TEMPORARY ANIMATION</div>
        <div class="inspector-title">Ativação do token</div>
        <div class="inspector-meta">A imagem e a frase passam neste token por até 12 frames. No fim, o estado ${escapeHtml(token.activeKey || "1")} é restaurado automaticamente.</div>
        <div class="animation-list">${animationRows}</div>
        <button class="primary-button full-width" data-action="edit-token-animation" data-id="${escapeHtml(token.id)}" style="margin-top:10px">＋ ${animations.length ? "Criar outra animação" : "Criar animação"}</button>
        ${playback && activeAnimation ? `<div class="inspector-meta" style="color:var(--violet)">▶ ${escapeHtml(activeAnimation.name)} · frame ${playback.frameIndex + 1}/${activeAnimation.frames.length}</div>` : ""}
      </div>`;
    const attackRows = canUseTokenAttacks(token)
      ? Object.entries(TOKEN_ATTACK_ACTIONS).map(([type, item]) => `<button class="attack-action-button ${armedAttack?.attackerId === token.id && armedAttack.attackType === type ? "armed" : ""}" data-attack-type="${type}" data-token-id="${escapeHtml(token.id)}" title="Preparar ${escapeHtml(item.name)}"><span class="attack-action-icon">${item.icon}</span><span class="attack-action-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.hint)} · depois arraste até o alvo</small></span></button>`).join("")
      : '<div class="empty-list">O Mestre não liberou ataques para este token.</div>';
    els.inspectorContent.innerHTML += `
      <div class="inspector-card">
        <div class="eyebrow">ATTACK ACTIONS</div>
        <div class="inspector-title">Escolher ataque</div>
        <div class="inspector-meta">Sem dados: selecione uma ação e arraste do token até o alvo. O resultado atual é um impacto visual temporário.</div>
        <div class="attack-action-list">${attackRows}</div>
      </div>`;
    return;
  }

  els.inspectorTitle.textContent = currentRole() === "gm" ? "Sala" : "Player";
  const scene = currentScene();
  els.inspectorContent.innerHTML = currentRole() === "gm"
    ? `
      <div class="inspector-card">
        <div class="eyebrow">PERSISTENT BANK</div>
        <div class="inspector-title">Biblioteca do Mestre</div>
        <div class="inspector-meta">Assets ficam fora da cena. Trocar o mapa não apaga tokens, imagens ou animações cadastradas.</div>
        <div class="permission-summary">
          <div><span>Mapas</span><b>${state.library.maps.length}</b></div>
          <div><span>Tokens salvos</span><b>${state.library.tokenBlueprints.length}</b></div>
          <div><span>Animações de token</span><b>${countTokenAnimations()}</b></div>
          <div><span>Tokens nesta cena</span><b>${scene.tokens.length}</b></div>
        </div>
      </div>
      <div class="inspector-card">
        <div class="eyebrow">SCENE STATUS</div>
        <div class="inspector-title">${escapeHtml(scene.name)}</div>
        <div class="inspector-meta">${scene.walls.length} barreiras · ${scene.lights.length} luzes · ${scene.darknessZones.length} áreas escuras · animações ficam nos tokens</div>
      </div>`
    : `
      <div class="inspector-card">
        <div class="eyebrow">PLAYER VIEW</div>
        <div class="inspector-title">Você está na sala</div>
        <div class="inspector-meta">O Mestre controla o mapa. Suas ações dependem das permissões liberadas para esta sala.</div>
        <div class="permission-summary">
          <div><span>Seu token</span><b>${state.permissions.moveOwnToken ? "movível" : "bloqueado"}</b></div>
          <div><span>Estados 1–9</span><b>${state.permissions.changeOwnImage ? "liberados" : "bloqueados"}</b></div>
          <div><span>Animações</span><b>${state.permissions.interactSequences ? "liberadas" : "bloqueadas"}</b></div>
          <div><span>Ataques</span><b>${state.permissions.useTokenAttacks ? "liberados" : "bloqueados"}</b></div>
        </div>
      </div>`;
}

function renderLighting() {
  const canvas = els.lightingCanvas;
  if (!canvas || !els.stage) return;
  const rect = els.stage.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const scene = currentScene();
  const timeOfDay = TIME_OF_DAY_PRESETS[scene.timeOfDay] || TIME_OF_DAY_PRESETS.day;
  const baseDarkness = clamp(Number.isFinite(Number(scene.darknessOpacity)) ? Number(scene.darknessOpacity) : 0.82, 0, 0.98);
  const ambientOpacity = clamp(baseDarkness * timeOfDay.darknessMultiplier, 0, 0.98);
  const sources = [];
  scene.tokens
    .filter((token) => {
      const isVisibleOwner = currentRole() === "player" ? token.ownerId === currentMemberId() : token.ownerId !== "gm";
      return isVisibleOwner && isTokenVisibleToCurrentRole(token) && Number(token.visionRange) > 0;
    })
    .forEach((token) => sources.push({
      x: token.x,
      y: token.y,
      range: token.visionRange,
      falloff: 0.58,
      intensity: 1,
      kind: "vision",
    }));
  scene.lights.filter((light) => light.providesVision !== false).forEach((light) => sources.push({
    x: light.x,
    y: light.y,
    range: light.radius,
    falloff: Number(light.falloff) || 0.72,
    intensity: Number(light.intensity) || 1,
    color: normalizeHexColor(light.color),
    kind: "light",
  }));

  const shouldPreview = isLightingPreviewActive();
  const shouldMask = shouldPreview && scene.visionMaskEnabled !== false && !scene.globalIllumination
    && ambientOpacity > 0.001 && (sources.length > 0 || scene.timeOfDay === "night");
  const shouldTint = shouldPreview && Boolean(timeOfDay.tint);
  if (!shouldMask && !shouldTint) {
    canvas.hidden = true;
    return;
  }
  canvas.hidden = false;
  context.globalCompositeOperation = "source-over";
  if (shouldTint) {
    context.fillStyle = timeOfDay.tint;
    context.fillRect(0, 0, width, height);
  }
  if (!shouldMask) return;
  context.fillStyle = "rgba(4, 7, 12, " + ambientOpacity + ")";
  context.fillRect(0, 0, width, height);

  sources.forEach((source) => {
    const points = visibilityPolygon(source, scene.walls);
    if (points.length < 3) return;
    const sourceX = source.x * width;
    const sourceY = source.y * height;
    const radius = source.range * Math.min(width, height);
    const falloff = clamp(Number(source.falloff) || 0.7, 0.2, 0.95);
    const fullLightStop = clamp(1 - falloff, 0.2, 0.82);
    const intensity = source.kind === "vision" ? 1 : clamp(Number(source.intensity) || 1, 0.1, 1.5);
    context.save();
    context.beginPath();
    points.forEach((point, index) => {
      const px = point.x * width;
      const py = point.y * height;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    context.clip();
    const gradient = context.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, Math.max(1, radius));
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(fullLightStop, "rgba(0,0,0,1)");
    gradient.addColorStop(Math.min(0.94, fullLightStop + falloff * 0.7), "rgba(0,0,0,0.72)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.globalCompositeOperation = "destination-out";
    context.globalAlpha = Math.min(1, intensity);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    if (source.kind === "light") {
      const color = hexToRgb(source.color);
      const glow = context.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, Math.max(1, radius * 0.78));
      glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.2 * Math.min(1, intensity)})`);
      glow.addColorStop(0.42, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.08 * Math.min(1, intensity)})`);
      glow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
    }
    context.restore();
  });
}

function hexToRgb(value) {
  const match = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return { r: 244, g: 199, b: 131 };
  const hex = match[1].length === 3
    ? match[1].split("").map((part) => part + part).join("")
    : match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function visibilityPolygon(source, walls) {
  const blockingWalls = walls.filter((wall) => {
    const blocks = source.kind === "vision" ? wallBlocksVision(wall) : wallBlocksLight(wall);
    return blocks && wall.a && wall.b && Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y) >= 0.004;
  });
  const angles = [];
  const sampleCount = 160;
  for (let index = 0; index < sampleCount; index += 1) {
    angles.push((Math.PI * 2 * index) / sampleCount);
  }
  blockingWalls.forEach((wall) => {
    [wall.a, wall.b].forEach((point) => {
      const angle = Math.atan2(point.y - source.y, point.x - source.x);
      angles.push(angle - 0.0001, angle, angle + 0.0001);
    });
  });
  angles.sort((a, b) => a - b);
  return angles.map((angle) => {
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    let distance = source.range;
    blockingWalls.forEach((wall) => {
      const hit = raySegmentDistance({ x: source.x, y: source.y }, direction, wall.a, wall.b);
      if (hit !== null && hit >= 0 && hit < distance) distance = hit;
    });
    return {
      x: source.x + direction.x * distance,
      y: source.y + direction.y * distance,
    };
  });
}

function raySegmentDistance(origin, direction, segmentStart, segmentEnd) {
  const segment = { x: segmentEnd.x - segmentStart.x, y: segmentEnd.y - segmentStart.y };
  const offset = { x: segmentStart.x - origin.x, y: segmentStart.y - origin.y };
  const denominator = cross(direction, segment);
  if (Math.abs(denominator) < 0.000001) return null;
  const distance = cross(offset, segment) / denominator;
  const alongSegment = cross(offset, direction) / denominator;
  if (distance >= 0 && alongSegment >= 0 && alongSegment <= 1) return distance;
  return null;
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function clientToStagePixels(event) {
  const rect = els.stage.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

function clientToScenePoint(event) {
  const pointer = clientToStagePixels(event);
  const camera = currentCamera();
  return {
    x: (pointer.x - camera.x) / (pointer.width * camera.zoom),
    y: (pointer.y - camera.y) / (pointer.height * camera.zoom),
  };
}

function clientToNormalized(event) {
  const point = clientToScenePoint(event);
  return {
    x: clamp(point.x, 0.01, 0.99),
    y: clamp(point.y, 0.01, 0.99),
  };
}

function resetCamera() {
  const camera = currentCamera();
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  renderCamera();
  renderLighting();
  saveState();
  showToast("Câmera centralizada e zoom restaurado.");
}

function scheduleCameraSave() {
  window.clearTimeout(cameraSaveTimer);
  cameraSaveTimer = window.setTimeout(() => saveState(), 180);
}

function handleStageWheel(event) {
  event.preventDefault();
  const pointer = clientToStagePixels(event);
  const scenePoint = clientToScenePoint(event);
  const camera = currentCamera();
  const zoomFactor = Math.pow(1.0018, -event.deltaY);
  const nextZoom = clamp(camera.zoom * zoomFactor, 0.5, 4);
  if (Math.abs(nextZoom - camera.zoom) < 0.0001) return;
  camera.zoom = nextZoom;
  camera.x = pointer.x - scenePoint.x * pointer.width * camera.zoom;
  camera.y = pointer.y - scenePoint.y * pointer.height * camera.zoom;
  renderCamera();
  renderLighting();
  scheduleCameraSave();
}

function handleStagePanStart(event) {
  if (![0, 1].includes(event.button)) return;
  const primaryPanAllowed = currentRole() === "player" || state.ui.activeTool === "select";
  if (event.button === 0 && !spaceHeld && !primaryPanAllowed) return;
  if (!spaceHeld && event.target.closest(".token, .hotspot, .wall-segment, .light-marker, .darkness-zone, .darkness-draft")) return;
  const camera = currentCamera();
  activePan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    cameraX: camera.x,
    cameraY: camera.y,
    moved: false,
  };
  els.stage.classList.add("pan-active");
  els.stage.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", handleStagePanMove);
  window.addEventListener("pointerup", finishStagePan);
  window.addEventListener("pointercancel", finishStagePan);
  event.preventDefault();
}

function handleStagePanMove(event) {
  if (!activePan || event.pointerId !== activePan.pointerId) return;
  const dx = event.clientX - activePan.startX;
  const dy = event.clientY - activePan.startY;
  if (!activePan.moved && Math.hypot(dx, dy) < 3) return;
  activePan.moved = true;
  suppressStageClick = true;
  const camera = currentCamera();
  camera.x = activePan.cameraX + dx;
  camera.y = activePan.cameraY + dy;
  renderCamera();
  renderLighting();
  event.preventDefault();
}

function finishStagePan(event) {
  if (!activePan || (event?.pointerId != null && event.pointerId !== activePan.pointerId)) return;
  window.removeEventListener("pointermove", handleStagePanMove);
  window.removeEventListener("pointerup", finishStagePan);
  window.removeEventListener("pointercancel", finishStagePan);
  els.stage.classList.remove("pan-active");
  if (activePan.moved) {
    saveState();
    window.setTimeout(() => { suppressStageClick = false; }, 0);
  }
  activePan = null;
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function orientation(a, b, c) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) + 0.000001 && b.x + 0.000001 >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) + 0.000001 && b.y + 0.000001 >= Math.min(a.y, c.y);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) return true;
  if (Math.abs(o1) < 0.000001 && onSegment(a, c, b)) return true;
  if (Math.abs(o2) < 0.000001 && onSegment(a, d, b)) return true;
  if (Math.abs(o3) < 0.000001 && onSegment(c, a, d)) return true;
  if (Math.abs(o4) < 0.000001 && onSegment(c, b, d)) return true;
  return false;
}

function distanceBetweenSegments(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distancePointToSegment(a, c, d),
    distancePointToSegment(b, c, d),
    distancePointToSegment(c, a, b),
    distancePointToSegment(d, a, b),
  );
}

function tokenCollisionRadius(token) {
  const rect = els.stage?.getBoundingClientRect?.() || { width: 1, height: 1 };
  const aspect = Math.max(0.01, (rect.width || 1) / (rect.height || 1));
  return (Number(token.size) || 0.08) * Math.max(1, aspect) / 2;
}

function movementWouldCollide(token, from, to) {
  const radius = tokenCollisionRadius(token);
  return currentScene().walls.some((wall) => {
    if (!wallBlocksMovement(wall) || !wall.a || !wall.b) return false;
    if (Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y) < 0.004) return false;
    const startDistance = distancePointToSegment(from, wall.a, wall.b);
    const endDistance = distancePointToSegment(to, wall.a, wall.b);
    const sweptDistance = distanceBetweenSegments(from, to, wall.a, wall.b);
    return segmentsIntersect(from, to, wall.a, wall.b)
      || endDistance <= radius
      || (startDistance > radius && sweptDistance <= radius);
  });
}

function updateSelectedTokenStyles() {
  $$(".token").forEach((element) => {
    element.classList.toggle("selected", element.dataset.tokenId === state.ui.selectedTokenId);
  });
}

function updateLightSelectionStyles() {
  $$(".light-marker").forEach((element) => {
    element.classList.toggle("selected", element.dataset.lightId === state.ui.selectedLightId);
  });
}

function updateDarknessSelectionStyles() {
  $$(".darkness-zone").forEach((element) => {
    element.classList.toggle("selected", element.dataset.darknessId === state.ui.selectedDarknessId);
  });
}

function updateWallSelectionStyles() {
  $$(".wall-segment").forEach((element) => {
    const selected = element.dataset.wallId === state.ui.selectedWallId;
    element.classList.toggle("selected", selected);
    element.querySelector(".wall-edge")?.classList.toggle("selected", selected);
  });
}

function updateTokenTransformPresentation(token, element = null) {
  const target = element || els.tokensLayer.querySelector(`[data-token-id="${CSS.escape(token.id)}"]`);
  if (target) {
    target.style.setProperty("--token-size", `${token.size * 100}%`);
    target.style.transform = `translate(-50%, -50%) rotate(${Number(token.rotation) || 0}deg)`;
  }
  const sizeOutput = els.inspectorContent.querySelector('[data-token-output="size"]');
  const rotationOutput = els.inspectorContent.querySelector('[data-token-output="rotation"]');
  if (sizeOutput) sizeOutput.textContent = `${Math.round(token.size * 100)}%`;
  if (rotationOutput) rotationOutput.textContent = `${Math.round(Number(token.rotation) || 0)}°`;
}

function scheduleTokenTransformSave() {
  window.clearTimeout(tokenTransformSaveTimer);
  tokenTransformSaveTimer = window.setTimeout(() => saveState(), 180);
}

function handleTokenWheel(event) {
  if (currentRole() !== "gm") return;
  const element = event.currentTarget;
  const token = getToken(element.dataset.tokenId);
  if (!token) return;
  event.preventDefault();
  event.stopPropagation();
  if (state.ui.selectedTokenId !== token.id) selectToken(token.id, { refreshObjects: false });
  token.size = clamp(token.size * Math.pow(1.0015, -event.deltaY), 0.025, 0.5);
  updateTokenTransformPresentation(token, element);
  renderFooter();
  scheduleTokenTransformSave();
}

function startTokenResize(event, token, element) {
  if (currentRole() !== "gm" || state.ui.selectedTokenId !== token.id) return false;
  const pointer = clientToStagePixels(event);
  const camera = currentCamera();
  const center = {
    x: camera.x + token.x * pointer.width * camera.zoom,
    y: camera.y + token.y * pointer.height * camera.zoom,
  };
  activeTokenResize = {
    tokenId: token.id,
    element,
    pointerId: event.pointerId,
    center,
    startDistance: Math.max(1, Math.hypot(pointer.x - center.x, pointer.y - center.y)),
    startSize: token.size,
    moved: false,
  };
  element.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", handleTokenResize);
  window.addEventListener("pointerup", finishTokenResize);
  window.addEventListener("pointercancel", finishTokenResize);
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function handleTokenResize(event) {
  if (!activeTokenResize || event.pointerId !== activeTokenResize.pointerId) return;
  const token = getToken(activeTokenResize.tokenId);
  if (!token) return;
  const pointer = clientToStagePixels(event);
  const distance = Math.max(1, Math.hypot(pointer.x - activeTokenResize.center.x, pointer.y - activeTokenResize.center.y));
  token.size = clamp(activeTokenResize.startSize * (distance / activeTokenResize.startDistance), 0.025, 0.5);
  activeTokenResize.moved = true;
  updateTokenTransformPresentation(token, activeTokenResize.element);
  renderFooter();
  event.preventDefault();
}

function finishTokenResize(event) {
  if (!activeTokenResize || (event?.pointerId != null && event.pointerId !== activeTokenResize.pointerId)) return;
  window.removeEventListener("pointermove", handleTokenResize);
  window.removeEventListener("pointerup", finishTokenResize);
  window.removeEventListener("pointercancel", finishTokenResize);
  const moved = activeTokenResize.moved;
  activeTokenResize = null;
  if (moved) {
    saveState();
    renderInspector();
  }
}

function updateWallPresentation(wall, element = null) {
  const group = element || els.wallsLayer.querySelector(`[data-wall-id="${CSS.escape(wall.id)}"]`);
  if (!group) return;
  const hit = group.querySelector(".wall-select-hit");
  const edge = group.querySelector(".wall-edge");
  [hit, edge].forEach((line) => {
    if (!line) return;
    line.setAttribute("x1", wall.a.x);
    line.setAttribute("y1", wall.a.y);
    line.setAttribute("x2", wall.b.x);
    line.setAttribute("y2", wall.b.y);
  });
  const type = normalizeWallType(wall.type);
  if (edge) {
    edge.setAttribute("class", `wall-edge wall-${type}${type === "door" && wall.open === true ? " open" : ""}${state.ui.selectedWallId === wall.id ? " selected" : ""}`);
  }
  group.setAttribute("aria-label", wallTypeLabel(wall));
  const title = group.querySelector("title");
  if (title) title.textContent = `${wallTypeLabel(wall)} · clique para selecionar`;
}

function bindWallInteractions() {
  if (currentRole() !== "gm") return;
  $$(".wall-segment").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectWall(element.dataset.wallId);
    });
    element.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleWallOpen(element.dataset.wallId);
    });
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || spaceHeld) return;
      event.stopPropagation();
      const wall = getWall(element.dataset.wallId);
      if (!wall) return;
      selectWall(wall.id, { refreshObjects: false });
      if (state.ui.activeTool !== "select") return;
      const point = clientToNormalized(event);
      activeWallDrag = {
        wallId: wall.id,
        element,
        pointerId: event.pointerId,
        startPoint: point,
        startA: { ...wall.a },
        startB: { ...wall.b },
        moved: false,
      };
      element.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handleWallDrag);
      window.addEventListener("pointerup", finishWallDrag);
      window.addEventListener("pointercancel", finishWallDrag);
      event.preventDefault();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectWall(element.dataset.wallId);
      }
    });
  });
}

function handleWallDrag(event) {
  if (!activeWallDrag || event.pointerId !== activeWallDrag.pointerId) return;
  const wall = getWall(activeWallDrag.wallId);
  if (!wall) return;
  const point = clientToNormalized(event);
  const rawDelta = {
    x: point.x - activeWallDrag.startPoint.x,
    y: point.y - activeWallDrag.startPoint.y,
  };
  const delta = {
    x: clamp(rawDelta.x, 0.01 - Math.min(activeWallDrag.startA.x, activeWallDrag.startB.x), 0.99 - Math.max(activeWallDrag.startA.x, activeWallDrag.startB.x)),
    y: clamp(rawDelta.y, 0.01 - Math.min(activeWallDrag.startA.y, activeWallDrag.startB.y), 0.99 - Math.max(activeWallDrag.startA.y, activeWallDrag.startB.y)),
  };
  wall.a = { x: activeWallDrag.startA.x + delta.x, y: activeWallDrag.startA.y + delta.y };
  wall.b = { x: activeWallDrag.startB.x + delta.x, y: activeWallDrag.startB.y + delta.y };
  activeWallDrag.moved = activeWallDrag.moved || Math.hypot(delta.x, delta.y) > 0.0005;
  updateWallPresentation(wall, activeWallDrag.element);
  renderLighting();
  event.preventDefault();
}

function finishWallDrag(event) {
  if (!activeWallDrag || (event?.pointerId != null && event.pointerId !== activeWallDrag.pointerId)) return;
  window.removeEventListener("pointermove", handleWallDrag);
  window.removeEventListener("pointerup", finishWallDrag);
  window.removeEventListener("pointercancel", finishWallDrag);
  const moved = activeWallDrag.moved;
  activeWallDrag = null;
  if (moved) {
    saveState();
    renderAll();
  }
}

function updateLightPresetStyles() {
  const selectedColor = normalizeHexColor(state.ui.newLightColor);
  $$('[data-light-preset]').forEach((button) => {
    const isSelected = normalizeHexColor(button.dataset.lightPreset) === selectedColor;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function bindTokenInteractions() {
  $$(".token").forEach((element) => {
    element.addEventListener("wheel", handleTokenWheel, { passive: false });
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      const token = getToken(element.dataset.tokenId);
      if (!token) return;
      if (armedAttack && token.id !== armedAttack.attackerId) {
        executeTokenAttack(armedAttack.attackerId, token.id, armedAttack.attackType);
        return;
      }
      if (currentRole() === "gm" && state.ui.activeTool === "animation") {
        const animation = getTokenAnimation(token);
        if (animation) playTokenAnimation(token.id, animation.id);
        else openTokenAnimationDialog(token.id);
        return;
      }
      selectToken(token.id);
    });
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || spaceHeld) return;
      event.stopPropagation();
      const token = getToken(element.dataset.tokenId);
      if (!token) return;
      if (event.target.closest("[data-token-resize]")) {
        selectToken(token.id, { refreshObjects: false });
        startTokenResize(event, token, element);
        return;
      }
      if (armedAttack) {
        selectToken(token.id, { refreshObjects: false });
        if (token.id === armedAttack.attackerId) startAttackDrag(event, token);
        return;
      }
      selectToken(token.id, { refreshObjects: false });
      if ((currentRole() !== "player" && state.ui.activeTool !== "select") || !canMoveToken(token)) return;
      const point = clientToNormalized(event);
      activeDrag = {
        tokenId: token.id,
        element,
        moved: false,
        blocked: false,
        pointerId: event.pointerId,
        offsetX: token.x - point.x,
        offsetY: token.y - point.y,
      };
      element.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handleTokenDrag);
      window.addEventListener("pointerup", finishTokenDrag);
      window.addEventListener("pointercancel", finishTokenDrag);
      event.preventDefault();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectToken(element.dataset.tokenId);
      }
    });
  });
}

function bindLightInteractions() {
  if (currentRole() !== "gm") return;
  $$(".light-marker").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLight(element.dataset.lightId);
    });
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || spaceHeld) return;
      event.stopPropagation();
      const light = getLight(element.dataset.lightId);
      if (!light) return;
      selectLight(light.id, { refreshObjects: false });
      const point = clientToNormalized(event);
      activeLightDrag = {
        lightId: light.id,
        element,
        pointerId: event.pointerId,
        offsetX: light.x - point.x,
        offsetY: light.y - point.y,
        moved: false,
      };
      element.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handleLightDrag);
      window.addEventListener("pointerup", finishLightDrag);
      window.addEventListener("pointercancel", finishLightDrag);
      event.preventDefault();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLight(element.dataset.lightId);
      }
    });
  });
}

function handleLightDrag(event) {
  if (!activeLightDrag || event.pointerId !== activeLightDrag.pointerId) return;
  const light = getLight(activeLightDrag.lightId);
  if (!light) return;
  const point = clientToNormalized(event);
  light.x = clamp(point.x + activeLightDrag.offsetX, 0.01, 0.99);
  light.y = clamp(point.y + activeLightDrag.offsetY, 0.01, 0.99);
  activeLightDrag.element.style.left = `${light.x * 100}%`;
  activeLightDrag.element.style.top = `${light.y * 100}%`;
  activeLightDrag.moved = true;
  renderLighting();
  event.preventDefault();
}

function finishLightDrag(event) {
  if (!activeLightDrag || (event?.pointerId != null && event.pointerId !== activeLightDrag.pointerId)) return;
  window.removeEventListener("pointermove", handleLightDrag);
  window.removeEventListener("pointerup", finishLightDrag);
  window.removeEventListener("pointercancel", finishLightDrag);
  if (activeLightDrag.moved) {
    saveState();
    renderFooter();
    renderInspector();
  }
  activeLightDrag = null;
}

function bindDarknessInteractions() {
  if (currentRole() !== "gm") return;
  $$(".darkness-zone").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectDarkness(element.dataset.darknessId);
    });
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || spaceHeld) return;
      event.stopPropagation();
      const zone = getDarknessZone(element.dataset.darknessId);
      if (!zone) return;
      selectDarkness(zone.id, { refreshObjects: false });
      const point = clientToNormalized(event);
      activeDarknessDrag = {
        zoneId: zone.id,
        element,
        pointerId: event.pointerId,
        offsetX: zone.x - point.x,
        offsetY: zone.y - point.y,
        moved: false,
      };
      element.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handleDarknessDrag);
      window.addEventListener("pointerup", finishDarknessDrag);
      window.addEventListener("pointercancel", finishDarknessDrag);
      event.preventDefault();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectDarkness(element.dataset.darknessId);
      }
    });
  });
}

function handleDarknessDrag(event) {
  if (!activeDarknessDrag || event.pointerId !== activeDarknessDrag.pointerId) return;
  const zone = getDarknessZone(activeDarknessDrag.zoneId);
  if (!zone) return;
  const point = clientToNormalized(event);
  zone.x = clamp(point.x + activeDarknessDrag.offsetX, 0.01, Math.max(0.01, 0.99 - zone.width));
  zone.y = clamp(point.y + activeDarknessDrag.offsetY, 0.01, Math.max(0.01, 0.99 - zone.height));
  activeDarknessDrag.element.style.left = `${zone.x * 100}%`;
  activeDarknessDrag.element.style.top = `${zone.y * 100}%`;
  activeDarknessDrag.moved = true;
  event.preventDefault();
}

function finishDarknessDrag(event) {
  if (!activeDarknessDrag || (event?.pointerId != null && event.pointerId !== activeDarknessDrag.pointerId)) return;
  window.removeEventListener("pointermove", handleDarknessDrag);
  window.removeEventListener("pointerup", finishDarknessDrag);
  window.removeEventListener("pointercancel", finishDarknessDrag);
  if (activeDarknessDrag.moved) {
    saveState();
    renderFooter();
    renderInspector();
  }
  activeDarknessDrag = null;
}

function renderDarknessDraft(start, end) {
  if (!els.darknessDraft) return;
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  els.darknessDraft.hidden = false;
  els.darknessDraft.style.left = `${x * 100}%`;
  els.darknessDraft.style.top = `${y * 100}%`;
  els.darknessDraft.style.width = `${width * 100}%`;
  els.darknessDraft.style.height = `${height * 100}%`;
}

function handleDarknessDrawStart(event) {
  if (currentRole() !== "gm" || state.ui.activeTool !== "darkness" || event.button !== 0 || spaceHeld) return;
  if (event.target.closest(".token, .hotspot, .wall-segment, .light-marker, .darkness-zone")) return;
  const start = clientToNormalized(event);
  activeDarknessDraw = { pointerId: event.pointerId, start, end: start };
  renderDarknessDraft(start, start);
  els.stage.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", handleDarknessDrawMove);
  window.addEventListener("pointerup", finishDarknessDraw);
  window.addEventListener("pointercancel", finishDarknessDraw);
  event.preventDefault();
}

function handleDarknessDrawMove(event) {
  if (!activeDarknessDraw || event.pointerId !== activeDarknessDraw.pointerId) return;
  activeDarknessDraw.end = clientToNormalized(event);
  renderDarknessDraft(activeDarknessDraw.start, activeDarknessDraw.end);
  event.preventDefault();
}

function finishDarknessDraw(event) {
  if (!activeDarknessDraw || (event?.pointerId != null && event.pointerId !== activeDarknessDraw.pointerId)) return;
  window.removeEventListener("pointermove", handleDarknessDrawMove);
  window.removeEventListener("pointerup", finishDarknessDraw);
  window.removeEventListener("pointercancel", finishDarknessDraw);
  const { start, end } = activeDarknessDraw;
  let x = Math.min(start.x, end.x);
  let y = Math.min(start.y, end.y);
  let width = Math.abs(end.x - start.x);
  let height = Math.abs(end.y - start.y);
  if (width < 0.025 || height < 0.025) {
    width = 0.18;
    height = 0.16;
    x = clamp(start.x - width / 2, 0.01, 0.99 - width);
    y = clamp(start.y - height / 2, 0.01, 0.99 - height);
  }
  const zone = {
    id: makeId("darkness"),
    x: clamp(x, 0.01, 0.99 - width),
    y: clamp(y, 0.01, 0.99 - height),
    width: clamp(width, 0.02, 0.98),
    height: clamp(height, 0.02, 0.98),
    opacity: 0.92,
  };
  currentScene().darknessZones.push(zone);
  activeDarknessDraw = null;
  suppressStageClick = true;
  saveState();
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = zone.id;
  renderAll();
  showToast("Área escura adicionada. Arraste para mover ou use Delete para excluir.");
}

function handleTokenDrag(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  const token = getToken(activeDrag.tokenId);
  if (!token) return;
  const cursor = clientToNormalized(event);
  const rawPoint = {
    x: clamp(cursor.x + activeDrag.offsetX, 0.01, 0.99),
    y: clamp(cursor.y + activeDrag.offsetY, 0.01, 0.99),
  };
  const point = snapPointToGrid(rawPoint);
  const previous = { x: token.x, y: token.y };
  if (movementWouldCollide(token, previous, point)) {
    activeDrag.blocked = true;
    els.toolStatus.textContent = "Colisão: a barreira impede esse movimento";
    return;
  }
  token.x = point.x;
  token.y = point.y;
  activeDrag.moved = true;
  activeDrag.element.style.left = `${token.x * 100}%`;
  activeDrag.element.style.top = `${token.y * 100}%`;
  renderVisionRangeLayer();
  renderLighting();
  event.preventDefault();
}

function finishTokenDrag(event) {
  if (!activeDrag || (event?.pointerId != null && event.pointerId !== activeDrag.pointerId)) return;
  window.removeEventListener("pointermove", handleTokenDrag);
  window.removeEventListener("pointerup", finishTokenDrag);
  window.removeEventListener("pointercancel", finishTokenDrag);
  if (activeDrag?.moved) {
    saveState();
    renderFooter();
    renderInspector();
  }
  if (activeDrag?.blocked) showToast("Movimento bloqueado pela barreira.", true);
  activeDrag = null;
  renderToolbar();
}

function selectToken(tokenId, options = {}) {
  state.ui.selectedTokenId = tokenId;
  state.ui.selectedWallId = null;
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = null;
  if (options.refreshObjects !== false) renderCanvasObjects();
  else {
    updateSelectedTokenStyles();
    updateWallSelectionStyles();
    updateLightSelectionStyles();
    updateDarknessSelectionStyles();
  }
  renderFooter();
  renderInspector();
}

function selectLight(lightId, options = {}) {
  if (currentRole() !== "gm" || !getLight(lightId)) return;
  if (activeAttackDrag) cancelAttackDrag();
  armedAttack = null;
  state.ui.selectedTokenId = null;
  state.ui.selectedWallId = null;
  state.ui.selectedLightId = lightId;
  state.ui.selectedDarknessId = null;
  if (options.refreshObjects !== false) renderCanvasObjects();
  else {
    updateSelectedTokenStyles();
    updateWallSelectionStyles();
    updateLightSelectionStyles();
    updateDarknessSelectionStyles();
  }
  renderFooter();
  renderInspector();
}

function selectDarkness(zoneId, options = {}) {
  if (currentRole() !== "gm" || !getDarknessZone(zoneId)) return;
  if (activeAttackDrag) cancelAttackDrag();
  armedAttack = null;
  state.ui.selectedTokenId = null;
  state.ui.selectedWallId = null;
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = zoneId;
  if (options.refreshObjects !== false) renderCanvasObjects();
  else {
    updateSelectedTokenStyles();
    updateWallSelectionStyles();
    updateLightSelectionStyles();
    updateDarknessSelectionStyles();
  }
  renderFooter();
  renderInspector();
}

function selectWall(wallId, options = {}) {
  if (currentRole() !== "gm" || !getWall(wallId)) return;
  if (activeAttackDrag) cancelAttackDrag();
  armedAttack = null;
  state.ui.selectedTokenId = null;
  state.ui.selectedWallId = wallId;
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = null;
  if (options.refreshObjects !== false) renderCanvasObjects();
  else {
    updateSelectedTokenStyles();
    updateWallSelectionStyles();
    updateLightSelectionStyles();
    updateDarknessSelectionStyles();
  }
  renderFooter();
  renderInspector();
}

function clearSelection() {
  if (activeAttackDrag) cancelAttackDrag();
  armedAttack = null;
  state.ui.selectedTokenId = null;
  state.ui.selectedWallId = null;
  state.ui.selectedLightId = null;
  state.ui.selectedDarknessId = null;
  renderCanvasObjects();
  renderFooter();
  renderInspector();
}

function deleteToken(tokenId = state.ui.selectedTokenId) {
  if (currentRole() !== "gm" || !tokenId) return;
  const scene = currentScene();
  const index = scene.tokens.findIndex((token) => token.id === tokenId);
  if (index < 0) return;
  const token = scene.tokens[index];
  stopTokenAnimation(token.id, { render: false, announce: false });
  activeTokenImpacts.forEach((impact, targetId) => {
    if (targetId !== token.id && impact.attackerId !== token.id) return;
    window.clearTimeout(impact.timer);
    activeTokenImpacts.delete(targetId);
  });
  if (armedAttack?.attackerId === token.id || activeAttackDrag?.attackerId === token.id || activeAttackDrag?.targetId === token.id) {
    clearArmedAttack({ render: false });
  }
  scene.tokens.splice(index, 1);
  state.ui.selectedTokenId = null;
  saveState();
  renderAll();
  showToast("Token excluído da cena.");
}

function deleteSelection() {
  if (currentRole() !== "gm") return;
  if (state.ui.selectedTokenId) return deleteToken();
  if (state.ui.selectedWallId) return deleteWall();
  if (state.ui.selectedLightId) return deleteLight();
  if (state.ui.selectedDarknessId) return deleteDarkness();
}

function deleteWall(wallId = state.ui.selectedWallId) {
  if (currentRole() !== "gm" || !wallId) return;
  const scene = currentScene();
  const index = scene.walls.findIndex((wall) => wall.id === wallId);
  if (index < 0) return;
  scene.walls.splice(index, 1);
  state.ui.selectedWallId = null;
  saveState();
  renderAll();
  showToast("Segmento excluído da cena.");
}

function deleteLight(lightId = state.ui.selectedLightId) {
  if (currentRole() !== "gm" || !lightId) return;
  const scene = currentScene();
  const index = scene.lights.findIndex((light) => light.id === lightId);
  if (index < 0) return;
  scene.lights.splice(index, 1);
  state.ui.selectedLightId = null;
  saveState();
  renderAll();
  showToast("Luz excluída da cena.");
}

function deleteDarkness(zoneId = state.ui.selectedDarknessId) {
  if (currentRole() !== "gm" || !zoneId) return;
  const scene = currentScene();
  const index = scene.darknessZones.findIndex((zone) => zone.id === zoneId);
  if (index < 0) return;
  scene.darknessZones.splice(index, 1);
  state.ui.selectedDarknessId = null;
  saveState();
  renderAll();
  showToast("Área escura excluída da cena.");
}

function toggleLightingPreview() {
  if (currentRole() !== "gm") return;
  state.ui.gmLightingPreview = state.ui.gmLightingPreview === false;
  saveState();
  renderAll();
  showToast(state.ui.gmLightingPreview ? "Prévia igual à visão dos Players." : "Prévia desligada; visão livre do Mestre.");
}

function handleLightControl(event) {
  if (currentRole() !== "gm") return;
  const input = event.target.closest("[data-light-control]");
  if (!input) return;
  const light = getLight(state.ui.selectedLightId);
  if (!light) return;
  const property = input.dataset.lightControl;
  light[property] = property === "color" ? input.value : Number(input.value);
  const output = els.inspectorContent.querySelector(`[data-light-output="${property}"]`);
  if (output) output.textContent = property === "color" ? input.value : `${Math.round(Number(input.value) * 100)}%`;
  const marker = els.lightsLayer.querySelector(`[data-light-id="${CSS.escape(light.id)}"]`);
  if (marker && property === "color") marker.style.setProperty("--light-color", light.color);
  renderLighting();
  saveState();
}

function handleDarknessControl(event) {
  if (currentRole() !== "gm") return;
  const input = event.target.closest("[data-darkness-control]");
  if (!input) return;
  const zone = getDarknessZone(state.ui.selectedDarknessId);
  if (!zone) return;
  zone[input.dataset.darknessControl] = Number(input.value);
  const output = els.inspectorContent.querySelector(`[data-darkness-output="${input.dataset.darknessControl}"]`);
  if (output) output.textContent = `${Math.round(Number(input.value) * 100)}%`;
  const element = els.darknessLayer.querySelector(`[data-darkness-id="${CSS.escape(zone.id)}"]`);
  if (element) element.style.setProperty("--darkness-opacity", zone.opacity);
  saveState();
}

function handleWallControl(event) {
  if (currentRole() !== "gm") return;
  const input = event.target.closest("[data-wall-control]");
  if (!input) return;
  const wall = getWall(input.dataset.wallId || state.ui.selectedWallId);
  if (!wall) return;
  const property = input.dataset.wallControl;
  if (property === "type") {
    wall.type = normalizeWallType(input.value);
    wall.open = false;
  }
  if (property === "open" && normalizeWallType(wall.type) === "door") wall.open = input.checked;
  syncWallBlocking(wall);
  saveState();
  renderAll();
  showToast(`${wallTypeLabel(wall)} atualizado.`);
}

function toggleWallOpen(wallId) {
  if (currentRole() !== "gm") return;
  const wall = getWall(wallId);
  if (!wall || normalizeWallType(wall.type) !== "door") return;
  wall.open = wall.open !== true;
  syncWallBlocking(wall);
  state.ui.selectedWallId = wall.id;
  saveState();
  renderAll();
  showToast(`${wallTypeLabel(wall)}.`);
}

function handleTokenControl(event) {
  if (currentRole() !== "gm") return;
  const input = event.target.closest("[data-token-control]");
  if (!input) return;
  const token = getToken(input.dataset.tokenId);
  if (!token) return;
  const property = input.dataset.tokenControl;
  if (property === "size") token.size = clamp(Number(input.value) / 100, 0.025, 0.5);
  if (property === "rotation") token.rotation = clamp(Number(input.value), -180, 180);
  if (property === "visionRange") token.visionRange = clamp(Number(input.value) / 100, 0, 2);
  if (property === "visibleToPlayers") token.visibleToPlayers = input.checked;
  if (property === "visibleToPlayers") {
    saveState();
    renderCanvasObjects();
    renderFooter();
    renderInspector();
    return;
  }
  const output = els.inspectorContent.querySelector('[data-token-output="' + property + '"]');
  if (output) {
    if (property === "size") output.textContent = Math.round(token.size * 100) + "%";
    if (property === "rotation") output.textContent = Math.round(token.rotation) + "°";
    if (property === "visionRange") output.textContent = token.visionRange ? Math.round(token.visionRange * 100) + "%" : "desligada";
  }
  const element = els.tokensLayer.querySelector('[data-token-id="' + CSS.escape(token.id) + '"]');
  if (element) {
    element.style.setProperty("--token-size", (token.size * 100) + "%");
    element.style.transform = "translate(-50%,-50%) rotate(" + token.rotation + "deg)";
  }
  if (property === "visionRange") renderCanvasObjects();
  renderLighting();
  saveState();
}

function togglePanel(panel) {
  if (currentRole() !== "gm") return;
  if (!state.ui.panels) state.ui.panels = { leftOpen: false, rightOpen: false };
  if (!(panel in state.ui.panels)) return;
  state.ui.panels[panel] = !state.ui.panels[panel];
  saveState();
  renderAll();
}

function closePanel(panel) {
  if (currentRole() !== "gm") return;
  if (!state.ui.panels) state.ui.panels = { leftOpen: false, rightOpen: false };
  state.ui.panels[panel] = false;
  saveState();
  renderAll();
}

function setTool(tool) {
  if (currentRole() !== "gm") return;
  if (activeAttackDrag) cancelAttackDrag();
  armedAttack = null;
  state.ui.activeTool = tool;
  wallDraftPoint = null;
  renderToolbar();
  renderCanvasObjects();
  renderFooter();
  renderInspector();
  els.stage.focus();
}

function handleStageClick(event) {
  if (suppressStageClick) {
    suppressStageClick = false;
    return;
  }
  if (event.target.closest(".token, .hotspot, .wall-segment, .light-marker, .darkness-zone")) return;
  if (currentRole() !== "gm") {
    clearSelection();
    return;
  }
  const point = clientToNormalized(event);
  const tool = state.ui.activeTool;
  if (tool === "wall") {
    if (!wallDraftPoint) {
      wallDraftPoint = point;
      renderCanvasObjects();
      renderToolbar();
      return;
    }
    const wall = {
      id: makeId("wall"),
      a: wallDraftPoint,
      b: point,
      type: normalizeWallType(state.ui.wallType),
      open: false,
    };
    syncWallBlocking(wall);
    currentScene().walls.push(wall);
    wallDraftPoint = null;
    state.ui.selectedTokenId = null;
    state.ui.selectedWallId = wall.id;
    state.ui.selectedLightId = null;
    state.ui.selectedDarknessId = null;
    saveState();
    renderAll();
    showToast(`${wallTypeLabel(wall)} salva na cena. Clique para editar ou arrastar.`);
    return;
  }
  if (tool === "light") {
    const color = normalizeHexColor(els.newLightColor?.value || state.ui.newLightColor);
    state.ui.newLightColor = color;
    const light = { id: makeId("light"), x: point.x, y: point.y, radius: 0.2, falloff: 0.72, intensity: 1, color, providesVision: true };
    currentScene().lights.push(light);
    state.ui.selectedTokenId = null;
    state.ui.selectedWallId = null;
    state.ui.selectedLightId = light.id;
    state.ui.selectedDarknessId = null;
    saveState();
    renderAll();
    showToast("Luz adicionada. Arraste para mover ou use Delete para excluir.");
    return;
  }
  if (tool === "darkness") {
    const zone = {
      id: makeId("darkness"),
      x: clamp(point.x - 0.09, 0.01, 0.81),
      y: clamp(point.y - 0.08, 0.01, 0.83),
      width: 0.18,
      height: 0.16,
      opacity: 0.92,
    };
    currentScene().darknessZones.push(zone);
    state.ui.selectedTokenId = null;
    state.ui.selectedWallId = null;
    state.ui.selectedLightId = null;
    state.ui.selectedDarknessId = zone.id;
    saveState();
    renderAll();
    showToast("Área escura adicionada. Arraste para mover ou use Delete para excluir.");
    return;
  }
  if (tool === "animation") {
    showToast("Clique diretamente em um token para ativar sua animação.", true);
    return;
  }
  clearSelection();
}

function addBlueprintToScene(blueprintId) {
  if (currentRole() !== "gm") return;
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) return;
  const scene = currentScene();
  const index = scene.tokens.length;
  const position = snapPointToGrid({
    x: clamp(0.34 + (index % 4) * 0.1, 0.08, 0.92),
    y: clamp(0.35 + Math.floor(index / 4) * 0.12, 0.08, 0.92),
  }, scene);
  const token = {
    id: makeId("token"),
    blueprintId,
    ownerId: blueprint.ownerId || PLAYER_ID,
    visibleToPlayers: true,
    x: position.x,
    y: position.y,
    size: blueprint.defaultSize || 0.08,
    activeKey: blueprint.defaultKey || blueprint.images?.[0]?.key || "1",
    rotation: 0,
    visionRange: blueprint.ownerId === PLAYER_ID ? 0.32 : 0,
  };
  scene.tokens.push(token);
  state.ui.selectedTokenId = token.id;
  saveState();
  renderAll();
  showToast(`${blueprint.name} adicionado à cena. O modelo continua salvo na biblioteca.`);
}

function setTokenState(tokenId, stateKey) {
  const token = getToken(tokenId);
  if (!token || !canChangeTokenImage(token)) {
    showToast("O Mestre não liberou a troca de estados para este token.", true);
    return;
  }
  if (activeTokenAnimations.has(token.id)) {
    showToast("Aguarde a animação terminar para trocar o estado do token.", true);
    return;
  }
  const blueprint = getBlueprint(token.blueprintId);
  if (!blueprint?.images?.some((image) => String(image.key) === String(stateKey))) {
    showToast("Esse estado ainda não existe neste token.", true);
    return;
  }
  token.activeKey = String(stateKey);
  saveState();
  renderCanvasObjects();
  renderFooter();
  renderInspector();
}

function openTokenDialog(blueprintId = null) {
  if (currentRole() !== "gm") return;
  editingBlueprintId = blueprintId;
  pendingTokenFiles = [];
  removedTokenImageKeys = new Set();
  const blueprint = blueprintId ? getBlueprint(blueprintId) : null;
  editingDefaultFrameId = blueprint?.images?.length
    ? `existing:${blueprint.defaultKey || blueprint.images[0].key}`
    : null;
  els.tokenDialogTitle.textContent = blueprint ? "Editar token" : "Novo token";
  els.tokenName.value = blueprint?.name || "";
  els.tokenOwner.value = blueprint?.ownerId || PLAYER_ID;
  els.tokenImages.value = "";
  renderFramePreview();
  els.tokenDialog.showModal();
}

function renderFramePreview() {
  const blueprint = editingBlueprintId ? getBlueprint(editingBlueprintId) : null;
  framePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  framePreviewUrls = [];
  const existing = (blueprint?.images || []).filter((image) => !removedTokenImageKeys.has(String(image.key)));
  const pending = pendingTokenFiles.map((file, index) => {
    const src = URL.createObjectURL(file);
    framePreviewUrls.push(src);
    return { id: `pending:${index}`, key: `+${index + 1}`, name: file.name, src, label: "" };
  });
  const frames = [
    ...existing.map((image) => ({ ...image, id: `existing:${image.key}`, name: image.fileName || "Estado salvo" })),
    ...pending,
  ];
  if (!editingDefaultFrameId || !frames.some((frame) => frame.id === editingDefaultFrameId)) {
    editingDefaultFrameId = frames[0]?.id || null;
  }
  els.framePreview.innerHTML = frames.map((frame, index) => `
    <div class="frame-preview-item ${editingDefaultFrameId === frame.id ? "selected" : ""}" data-frame-id="${escapeHtml(frame.id)}">
      <button class="frame-preview-image-button" type="button" data-frame-select="${escapeHtml(frame.id)}" title="Usar esta imagem como padrão">
        ${frame.src ? `<img src="${escapeHtml(frame.src)}" alt="Prévia do estado ${index + 1}" />` : '<span class="frame-preview-empty">＋</span>'}
      </button>
      <div class="frame-preview-copy">
        <strong>Estado ${index + 1}</strong>
        <small title="${escapeHtml(frame.name)}">${escapeHtml(frame.name)}${editingDefaultFrameId === frame.id ? " · padrão" : ""}</small>
        <input class="frame-label-input" data-frame-label="${escapeHtml(frame.id)}" type="text" maxlength="30" value="${escapeHtml(frame.label || `Estado ${index + 1}`)}" aria-label="Nome do estado ${index + 1}" />
      </div>
      <button class="remove-state-button" type="button" data-remove-frame="${escapeHtml(frame.id)}" title="Remover estado" aria-label="Remover estado ${index + 1}">×</button>
    </div>`).join("");
}

function createSequenceFrameDraft() {
  return {
    id: makeId("sequence-frame"),
    imageFile: null,
    imageSrc: null,
    imageName: "",
    text: "",
  };
}

function getSequenceFrameDraft(frameId) {
  return pendingSequenceFrames.find((frame) => frame.id === frameId);
}

function syncSequenceFrameTexts() {
  if (!els.sequenceFrameList) return;
  els.sequenceFrameList.querySelectorAll("[data-sequence-frame-text]").forEach((textarea) => {
    const frame = getSequenceFrameDraft(textarea.dataset.sequenceFrameText);
    if (frame) frame.text = textarea.value;
  });
}

function renderSequenceFrameEditor() {
  syncSequenceFrameTexts();
  els.sequenceFrameList.innerHTML = pendingSequenceFrames.map((frame, index) => {
    const frameNumber = String(index + 1).padStart(2, "0");
    const imagePreview = frame.imageSrc
      ? `<img class="sequence-frame-image-preview has-image" src="${escapeHtml(frame.imageSrc)}" alt="Imagem do frame ${index + 1}" />`
      : '<div class="sequence-frame-image-preview"><span>Sem imagem<br /><small>Opcional</small></span></div>';
    const imageName = frame.imageName || "Nenhuma imagem escolhida";
    return `
      <article class="sequence-frame-card" data-sequence-frame-id="${escapeHtml(frame.id)}">
        <div class="sequence-frame-head">
          <div class="sequence-frame-title">
            <span class="sequence-frame-number">${frameNumber}</span>
            <strong>Frame ${index + 1}</strong>
          </div>
          <div class="sequence-frame-actions">
            <button type="button" data-sequence-frame-move="${escapeHtml(frame.id)}" data-direction="-1" title="Mover frame para cima" aria-label="Mover frame ${index + 1} para cima" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-sequence-frame-move="${escapeHtml(frame.id)}" data-direction="1" title="Mover frame para baixo" aria-label="Mover frame ${index + 1} para baixo" ${index === pendingSequenceFrames.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" data-sequence-frame-remove="${escapeHtml(frame.id)}" title="Remover frame" aria-label="Remover frame ${index + 1}">×</button>
          </div>
        </div>
        <div class="sequence-frame-grid">
          <div class="sequence-frame-image">
            ${imagePreview}
            <div class="sequence-frame-image-copy"><strong>Imagem do frame</strong><small title="${escapeHtml(imageName)}">${escapeHtml(imageName)}</small></div>
            <label class="sequence-frame-image-button">${frame.imageSrc ? "Trocar imagem" : "Adicionar imagem"}<input type="file" accept="image/png,image/jpeg,image/webp" data-sequence-frame-image="${escapeHtml(frame.id)}" /></label>
          </div>
          <label class="sequence-frame-text"><span>Frase deste frame <small>(opcional)</small></span><textarea class="text-input text-area sequence-frame-textarea" maxlength="500" data-sequence-frame-text="${escapeHtml(frame.id)}" placeholder="O que os Players leem neste momento?">${escapeHtml(frame.text)}</textarea></label>
        </div>
        <div class="sequence-frame-help"><span>${frame.imageSrc ? "Imagem pronta" : "Você pode deixar sem imagem"}</span><span>${frame.text.length}/500</span></div>
      </article>`;
  }).join("");
}

function addSequenceFrame() {
  if (currentRole() !== "gm") return;
  syncSequenceFrameTexts();
  if (pendingSequenceFrames.length >= MAX_TOKEN_ANIMATION_FRAMES) {
    showToast(`Uma animação pode ter no máximo ${MAX_TOKEN_ANIMATION_FRAMES} frames.`, true);
    return;
  }
  pendingSequenceFrames.push(createSequenceFrameDraft());
  renderSequenceFrameEditor();
  const lastText = els.sequenceFrameList.querySelector(".sequence-frame-card:last-child [data-sequence-frame-text]");
  lastText?.focus();
}

function removeSequenceFrame(frameId) {
  if (currentRole() !== "gm") return;
  syncSequenceFrameTexts();
  pendingSequenceFrames = pendingSequenceFrames.filter((frame) => frame.id !== frameId);
  renderSequenceFrameEditor();
}

function moveSequenceFrame(frameId, direction) {
  if (currentRole() !== "gm") return;
  syncSequenceFrameTexts();
  const index = pendingSequenceFrames.findIndex((frame) => frame.id === frameId);
  const target = index + Number(direction);
  if (index < 0 || target < 0 || target >= pendingSequenceFrames.length) return;
  [pendingSequenceFrames[index], pendingSequenceFrames[target]] = [pendingSequenceFrames[target], pendingSequenceFrames[index]];
  renderSequenceFrameEditor();
}

async function handleSequenceImageChange(event) {
  if (currentRole() !== "gm") return;
  const input = event.target.closest("[data-sequence-frame-image]");
  if (!input) return;
  const frame = getSequenceFrameDraft(input.dataset.sequenceFrameImage);
  const file = input.files?.[0];
  input.value = "";
  if (!frame || !file) return;
  frame.imageFile = file;
  frame.imageName = file.name;
  try {
    frame.imageSrc = await fileToDataUrl(file);
    renderSequenceFrameEditor();
  } catch (error) {
    frame.imageFile = null;
    frame.imageName = "";
    renderSequenceFrameEditor();
    showToast(error.message || "Não foi possível carregar a imagem do frame.", true);
  }
}

function handleSequenceFrameInput(event) {
  if (currentRole() !== "gm") return;
  const textarea = event.target.closest("[data-sequence-frame-text]");
  if (!textarea) return;
  const frame = getSequenceFrameDraft(textarea.dataset.sequenceFrameText);
  if (frame) frame.text = textarea.value;
  const counter = textarea.closest(".sequence-frame-card")?.querySelector(".sequence-frame-help span:last-child");
  if (counter) counter.textContent = `${textarea.value.length}/500`;
}

function openTokenAnimationDialog(tokenId, animationId = null) {
  if (currentRole() !== "gm") return;
  const token = getToken(tokenId);
  if (!token) return;
  openBlueprintAnimationDialog(token.blueprintId, animationId, token.id);
}

function openBlueprintAnimationDialog(blueprintId, animationId = null, tokenId = null) {
  if (currentRole() !== "gm") return;
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) return;
  const animation = (blueprint.animations || []).find((item) => item.id === animationId) || null;
  editingTokenAnimation = { blueprintId: blueprint.id, animationId: animation?.id || null, tokenId };
  els.sequenceDialogTitle.textContent = animation ? "Editar animação do token" : "Nova animação do token";
  els.sequenceName.value = animation?.name || "";
  els.sequenceSpeaker.value = animation?.speaker || "Narrador";
  els.sequenceTrigger.value = animation?.trigger || "manual";
  pendingSequenceFrames = animation?.frames?.length
    ? animation.frames.slice(0, MAX_TOKEN_ANIMATION_FRAMES).map((frame, index) => ({
      id: makeId("sequence-frame"),
      imageFile: null,
      imageSrc: frame.image || null,
      imageName: frame.image ? `Imagem salva ${index + 1}` : "",
      text: frame.text || "",
    }))
    : [createSequenceFrameDraft()];
  renderSequenceFrameEditor();
  els.sequenceDialog.showModal();
}

function openSequence(sequenceId) {
  if (!canInteractWithSequences()) {
    showToast("O Mestre não liberou a interação com animações.", true);
    return;
  }
  const sequence = getSequence(sequenceId);
  if (!sequence || !sequence.frames?.length) return;
  sequencePlayback = { sequenceId, frameIndex: 0 };
  renderSequencePlayer();
  els.sequencePlayerDialog.showModal();
}

function renderSequencePlayer() {
  if (!sequencePlayback) return;
  const sequence = getSequence(sequencePlayback.sequenceId);
  if (!sequence) return;
  const frames = sequence.frames || [];
  const frame = frames[sequencePlayback.frameIndex] || frames[0];
  els.sequenceCounter.textContent = `FRAME ${String(sequencePlayback.frameIndex + 1).padStart(2, "0")} / ${String(frames.length).padStart(2, "0")}`;
  els.sequenceSpeakerView.textContent = sequence.speaker || "Narrador";
  els.sequenceText.textContent = frame.text || "";
  els.sequenceMedia.innerHTML = frame.image
    ? `<img src="${escapeHtml(frame.image)}" alt="Frame da sequência" />`
    : '<div class="sequence-media-placeholder">✦</div>';
  els.previousFrame.disabled = sequencePlayback.frameIndex === 0;
  els.nextFrame.innerHTML = sequencePlayback.frameIndex >= frames.length - 1 ? "Fechar" : 'Próximo <span>→</span>';
}

function advanceSequence(direction) {
  if (!sequencePlayback) return;
  const sequence = getSequence(sequencePlayback.sequenceId);
  if (!sequence) return;
  const next = sequencePlayback.frameIndex + direction;
  if (next < 0) return;
  if (next >= sequence.frames.length) {
    els.sequencePlayerDialog.close();
    sequencePlayback = null;
    return;
  }
  sequencePlayback.frameIndex = next;
  renderSequencePlayer();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error(`${file.name} é grande demais para o beta local.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

async function handleTokenSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (currentRole() !== "gm") return;
  const name = els.tokenName.value.trim();
  if (!name) return;
  els.saveToken.disabled = true;
  try {
    const existingBlueprint = editingBlueprintId ? getBlueprint(editingBlueprintId) : null;
    const labels = new Map(Array.from(els.framePreview.querySelectorAll("[data-frame-label]")).map((input) => [input.dataset.frameLabel, input.value.trim()]));
    const keptExisting = (existingBlueprint?.images || []).filter((image) => !removedTokenImageKeys.has(String(image.key)));
    const uploaded = await Promise.all(pendingTokenFiles.slice(0, Math.max(0, 9 - keptExisting.length)).map((file) => fileToDataUrl(file)));
    const images = [];
    const frameIds = [];
    const previousToNextKey = new Map();
    keptExisting.forEach((image) => {
      if (images.length >= 9) return;
      const nextKey = String(images.length + 1);
      previousToNextKey.set(String(image.key), nextKey);
      images.push({ ...image, key: nextKey, label: labels.get(`existing:${image.key}`) || image.label || `Estado ${nextKey}` });
      frameIds.push(`existing:${image.key}`);
    });
    uploaded.forEach((src, index) => {
      if (!src || images.length >= 9) return;
      const nextKey = String(images.length + 1);
      images.push({ key: nextKey, label: labels.get(`pending:${index}`) || `Estado ${nextKey}`, src, fileName: pendingTokenFiles[index]?.name || "imagem" });
      frameIds.push(`pending:${index}`);
    });
    const defaultImageIndex = frameIds.indexOf(editingDefaultFrameId);
    const defaultKey = images[defaultImageIndex]?.key || images[0]?.key || "1";

    if (existingBlueprint) {
      existingBlueprint.name = name;
      existingBlueprint.ownerId = els.tokenOwner.value;
      existingBlueprint.images = images;
      existingBlueprint.defaultKey = defaultKey;
      state.scenes.forEach((scene) => scene.tokens.forEach((token) => {
        if (token.blueprintId !== existingBlueprint.id) return;
        token.ownerId = existingBlueprint.ownerId;
        token.activeKey = previousToNextKey.get(String(token.activeKey)) || defaultKey;
      }));
    } else {
      const blueprint = { id: makeId("blueprint"), name, ownerId: els.tokenOwner.value, images, defaultKey, animations: [], defaultSize: 0.08 };
      state.library.tokenBlueprints.push(blueprint);
      const scene = currentScene();
      const position = snapPointToGrid({ x: 0.44, y: 0.5 }, scene);
      const token = {
        id: makeId("token"), blueprintId: blueprint.id, ownerId: blueprint.ownerId, visibleToPlayers: true,
        x: position.x, y: position.y, size: blueprint.defaultSize, activeKey: defaultKey, rotation: 0,
        visionRange: blueprint.ownerId === PLAYER_ID ? 0.32 : 0,
      };
      scene.tokens.push(token);
      state.ui.selectedTokenId = token.id;
    }
    saveState();
    els.tokenDialog.close();
    renderAll();
    showToast(existingBlueprint ? "Token atualizado e salvo na biblioteca." : "Token criado, salvo e colocado na cena.");
  } catch (error) {
    showToast(error.message || "Não foi possível salvar o token.", true);
  } finally {
    els.saveToken.disabled = false;
  }
}

async function handleMapUpload(event) {
  if (currentRole() !== "gm") return;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const dataUrl = await fileToDataUrl(file);
    state.library.maps.push({ id: makeId("map"), name: file.name, dataUrl });
   const map = state.library.maps[state.library.maps.length - 1];
   currentScene().mapAssetId = map.id;
   saveState();
   renderAll();
    showToast("Mapa importado. Os tokens desta cena foram preservados.");
  } catch (error) {
    showToast(error.message || "Não foi possível importar o mapa.", true);
  }
}

async function handleSequenceSubmit(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (currentRole() !== "gm" || !editingTokenAnimation) return;
  syncSequenceFrameTexts();
  const name = els.sequenceName.value.trim();
  if (!name) {
    els.sequenceName.focus();
    return;
  }
  const frames = pendingSequenceFrames
    .map((frame) => ({ ...frame, text: String(frame.text || "").trim() }))
    .filter((frame) => frame.imageSrc || frame.imageFile || frame.text)
    .slice(0, MAX_TOKEN_ANIMATION_FRAMES);
  if (!frames.length) {
    showToast("Adicione uma imagem ou frase em pelo menos um frame.", true);
    return;
  }
  try {
    const preparedFrames = await Promise.all(frames.map(async (frame) => ({
      image: frame.imageSrc || (frame.imageFile ? await fileToDataUrl(frame.imageFile) : null),
      text: frame.text,
    })));
    const blueprint = getBlueprint(editingTokenAnimation.blueprintId);
    if (!blueprint) return;
    if (!Array.isArray(blueprint.animations)) blueprint.animations = [];
    const isEditing = Boolean(editingTokenAnimation.animationId);
    const trigger = Object.prototype.hasOwnProperty.call(TOKEN_ANIMATION_TRIGGERS, els.sequenceTrigger.value)
      ? els.sequenceTrigger.value
      : "manual";
    const savedAnimation = {
      id: editingTokenAnimation.animationId || makeId("animation"),
      name,
      speaker: els.sequenceSpeaker.value.trim() || "Narrador",
      trigger,
      frameDuration: trigger === "manual" ? TOKEN_ANIMATION_FRAME_MS : TOKEN_ACTION_ANIMATION_FRAME_MS,
      frames: preparedFrames,
    };
    if (trigger !== "manual") {
      blueprint.animations = blueprint.animations.map((item) => item.id !== savedAnimation.id && item.trigger === trigger
        ? { ...item, trigger: "manual", frameDuration: TOKEN_ANIMATION_FRAME_MS }
        : item);
    }
    const animationIndex = blueprint.animations.findIndex((animation) => animation.id === savedAnimation.id);
    if (animationIndex >= 0) blueprint.animations[animationIndex] = savedAnimation;
    else blueprint.animations.push(savedAnimation);
    currentScene().tokens
      .filter((token) => token.blueprintId === blueprint.id && activeTokenAnimations.has(token.id))
      .forEach((token) => stopTokenAnimation(token.id, { render: false, announce: false }));
    state.ui.activeTool = "select";
    pendingSequenceFrames = [];
    editingTokenAnimation = null;
    saveState();
    els.sequenceDialog.close();
    renderAll();
    showToast(isEditing ? "Animação atualizada e salva no token." : "Animação salva no token. Use ▶ Ativar para testar.");
  } catch (error) {
    showToast(error.message || "Não foi possível salvar a animação.", true);
  }
}

function setMap(mapId) {
  if (currentRole() !== "gm") return;
  if (!state.library.maps.some((map) => map.id === mapId)) return;
 const scene = currentScene();
 scene.mapAssetId = mapId;
  saveState();
  renderAll();
  showToast("Mapa trocado; tokens e estados da cena continuam intactos.");
}

function createScene() {
  if (currentRole() !== "gm") return;
  const name = window.prompt("Nome da nova cena", `Cena ${state.scenes.length + 1}`)?.trim();
  if (!name) return;
 const scene = {
   id: makeId("scene"), name, mapAssetId: null, camera: { x: 0, y: 0, zoom: 1 }, globalIllumination: false, visionMaskEnabled: true, darknessOpacity: 0.82, timeOfDay: "day", grid: { enabled: true, snap: true, size: 0.05, opacity: 0.22 },
    tokens: [], walls: [], lights: [], darknessZones: [], hotspots: [],
  };
  state.scenes.push(scene);
  state.activeSceneId = scene.id;
  state.ui.selectedTokenId = null;
  saveState();
  renderAll();
  showToast("Nova cena criada. A Biblioteca do Mestre continua compartilhada.");
}

function renameRoom() {
  if (currentRole() !== "gm") return;
  const name = window.prompt("Nome da sala", state.room.name)?.trim();
  if (!name) return;
  state.room.name = name;
  saveState();
  renderShell();
  showToast("Sala renomeada.");
}

async function shareRoom() {
  if (currentRole() !== "gm") return;
  const roomId = realtime.roomId || readOnlineCredentials()?.roomId || "";
  if (!roomId) {
    showToast("A sala online ainda não foi criada. Aguarde a conexão antes de compartilhar.", true);
    return;
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({ room: roomId, mode: "player" });
  if (onlineServerBase && onlineServerBase !== window.location.origin) params.set("server", onlineServerBase);
  const url = `${base}?${params.toString()}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast(realtime.connected ? "Link online do Player copiado." : "Link copiado; o servidor online ainda não está conectado.");
  } catch {
    window.prompt("Copie o link do Player:", url);
  }
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("visible"), 3200);
}

function handleDelegatedClick(event) {
  const attackAction = event.target.closest("[data-attack-type]");
  if (attackAction) {
    event.preventDefault();
    setArmedAttack(attackAction.dataset.tokenId, attackAction.dataset.attackType);
    return;
  }
  const lightPreset = event.target.closest("[data-light-preset]");
  if (lightPreset) {
    event.preventDefault();
    if (currentRole() !== "gm") return;
    state.ui.newLightColor = normalizeHexColor(lightPreset.dataset.lightPreset);
    els.newLightColor.value = state.ui.newLightColor;
    updateLightPresetStyles();
    saveState();
    return;
  }
  const frameSelect = event.target.closest("[data-frame-select]");
  if (frameSelect) {
    event.preventDefault();
    if (currentRole() !== "gm") return;
    editingDefaultFrameId = frameSelect.dataset.frameSelect || null;
    renderFramePreview();
    return;
  }
  const frameMove = event.target.closest("[data-sequence-frame-move]");
  if (frameMove) {
    event.preventDefault();
    if (currentRole() !== "gm") return;
    moveSequenceFrame(frameMove.dataset.sequenceFrameMove, frameMove.dataset.direction);
    return;
  }
  const frameRemove = event.target.closest("[data-sequence-frame-remove]");
  if (frameRemove) {
    event.preventDefault();
    if (currentRole() !== "gm") return;
    removeSequenceFrame(frameRemove.dataset.sequenceFrameRemove);
    return;
  }
  const removeFrame = event.target.closest("[data-remove-frame]");
  if (removeFrame) {
    event.preventDefault();
    if (currentRole() !== "gm") return;
    const frameId = removeFrame.dataset.removeFrame || "";
    if (frameId.startsWith("pending:")) {
      pendingTokenFiles.splice(Number(frameId.split(":")[1]), 1);
    } else if (frameId.startsWith("existing:")) {
      removedTokenImageKeys.add(frameId.slice("existing:".length));
    }
    if (editingDefaultFrameId === frameId) editingDefaultFrameId = null;
    renderFramePreview();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const actionName = action.dataset.action;
  const id = action.dataset.id;
  if (actionName === "set-map") setMap(id);
  if (actionName === "add-token") addBlueprintToScene(id);
  if (actionName === "edit-token") openTokenDialog(id);
  if (actionName === "play-token-animation") playTokenAnimation(id, action.dataset.animationId);
  if (actionName === "edit-token-animation") openTokenAnimationDialog(id, action.dataset.animationId);
  if (actionName === "edit-blueprint-animation") openBlueprintAnimationDialog(id, action.dataset.animationId);
  if (actionName === "delete-wall") deleteWall(id);
  if (actionName === "delete-light") deleteLight(id);
  if (actionName === "delete-darkness") deleteDarkness(id);
  if (actionName === "delete-token") deleteToken(id);
  if (actionName === "select-state") setTokenState(id, action.dataset.stateKey);
  if (actionName === "open-sequence") {
    event.stopPropagation();
    openSequence(id);
  }
}

function handleKeydown(event) {
  const tagName = document.activeElement?.tagName;
  const inputType = document.activeElement?.type;
  const isTextEditing = tagName === "TEXTAREA" || tagName === "SELECT"
    || (tagName === "INPUT" && ["text", "search", "url", "email", "password"].includes(inputType));
  if (currentRole() === "gm" && !isTextEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
    event.preventDefault();
    deleteSelection();
    return;
  }
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;
  if (currentRole() === "gm" && (event.key === "Delete" || event.key === "Backspace")) {
    deleteSelection();
    return;
  }
  if (event.key === " ") {
    spaceHeld = true;
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    if (activeAttackDrag) cancelAttackDrag();
    armedAttack = null;
    if (activeDarknessDraw) {
      window.removeEventListener("pointermove", handleDarknessDrawMove);
      window.removeEventListener("pointerup", finishDarknessDraw);
      window.removeEventListener("pointercancel", finishDarknessDraw);
      activeDarknessDraw = null;
    }
    wallDraftPoint = null;
    state.ui.activeTool = "select";
    renderToolbar();
    renderCanvasObjects();
    renderFooter();
    renderInspector();
    return;
  }
  if (currentRole() === "gm" && event.key.toLowerCase() === "v") setTool("select");
  if (currentRole() === "gm" && event.key.toLowerCase() === "w") setTool("wall");
  if (currentRole() === "gm" && event.key.toLowerCase() === "l") setTool("light");
  if (currentRole() === "gm" && event.key.toLowerCase() === "d") setTool("darkness");
  if (currentRole() === "gm" && event.key.toLowerCase() === "h") setTool("animation");
  if (/^[1-9]$/.test(event.key) && state.ui.selectedTokenId) setTokenState(state.ui.selectedTokenId, event.key);
}

function handleKeyup(event) {
  if (event.key === " ") spaceHeld = false;
}

function init() {
  els.roleButtons.forEach((button) => button.addEventListener("click", () => {
    if (launchedAsPlayer) return;
    state.ui.role = button.dataset.roleChoice;
    state.ui.activeTool = "select";
    wallDraftPoint = null;
    renderAll();
  }));
  els.sideTabs.forEach((tab) => tab.addEventListener("click", () => {
    els.sideTabs.forEach((item) => item.classList.toggle("active", item === tab));
    els.sidePanels.forEach((panel) => panel.classList.toggle("active", panel.id === tab.dataset.panel));
  }));
  els.toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
  els.toggleLeftPanel.addEventListener("click", () => togglePanel("leftOpen"));
  els.toggleRightPanel.addEventListener("click", () => togglePanel("rightOpen"));
  els.toggleLightingPreview.addEventListener("click", toggleLightingPreview);
  els.closeLeftPanel.addEventListener("click", () => closePanel("leftOpen"));
  els.closeRightPanel.addEventListener("click", () => closePanel("rightOpen"));
  els.stage.addEventListener("pointerdown", handleStagePanStart);
  els.stage.addEventListener("pointerdown", handleDarknessDrawStart);
  els.stage.addEventListener("wheel", handleStageWheel, { passive: false });
  els.stage.addEventListener("click", handleStageClick);
  els.stage.addEventListener("contextmenu", (event) => event.preventDefault());
  els.mapInput.addEventListener("change", handleMapUpload);
  $("#newToken").addEventListener("click", () => openTokenDialog());
  $("#newScene").addEventListener("click", createScene);
  $("#renameRoom").addEventListener("click", renameRoom);
  $("#shareRoom").addEventListener("click", shareRoom);
  $("#resetView").addEventListener("click", resetCamera);
  $("#clearSelection").addEventListener("click", clearSelection);
  $("#closeBetaStrip").addEventListener("click", () => { els.betaStrip.hidden = true; });
  els.sceneName.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    const name = els.sceneName.value.trim();
    if (!name) return;
    currentScene().name = name;
    saveState();
    renderShell();
  });
  els.globalIllumination.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    currentScene().globalIllumination = els.globalIllumination.checked;
    saveState();
    renderAll();
  });
  els.visionMask.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    currentScene().visionMaskEnabled = els.visionMask.checked;
    saveState();
    renderAll();
  });
  els.gmLightingPreview.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    state.ui.gmLightingPreview = els.gmLightingPreview.checked;
    saveState();
    renderAll();
  });
  els.darknessOpacity.addEventListener("input", () => {
    if (currentRole() !== "gm") return;
    currentScene().darknessOpacity = Number(els.darknessOpacity.value) / 100;
    els.darknessOpacityValue.textContent = `${els.darknessOpacity.value}%`;
    renderLighting();
    saveState();
  });
  els.timeOfDay.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    const nextTime = Object.prototype.hasOwnProperty.call(TIME_OF_DAY_PRESETS, els.timeOfDay.value)
      ? els.timeOfDay.value
      : "day";
    currentScene().timeOfDay = nextTime;
    saveState();
    renderAll();
    showToast(`Cena em ${TIME_OF_DAY_PRESETS[nextTime].label.toLowerCase()} · ${TIME_OF_DAY_PRESETS[nextTime].hint}.`);
  });
  els.gridEnabled.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    const grid = normalizeGrid(currentScene().grid);
    grid.enabled = els.gridEnabled.checked;
    currentScene().grid = grid;
    saveState();
    renderAll();
  });
  els.gridSnap.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    const grid = normalizeGrid(currentScene().grid);
    grid.snap = els.gridSnap.checked;
    currentScene().grid = grid;
    saveState();
    renderAll();
    showToast(grid.snap ? "Tokens serão centralizados no grid ao mover." : "Encaixe no grid desligado.");
  });
  els.gridSize.addEventListener("input", () => {
    if (currentRole() !== "gm") return;
    const grid = normalizeGrid(currentScene().grid);
    grid.size = clamp(Number(els.gridSize.value) / 100, 0.03, 0.15);
    currentScene().grid = grid;
    els.gridSizeValue.textContent = `${Math.round(grid.size * 100)}%`;
    saveState();
    renderAll();
  });
  els.gridOpacity.addEventListener("input", () => {
    if (currentRole() !== "gm") return;
    const grid = normalizeGrid(currentScene().grid);
    grid.opacity = clamp(Number(els.gridOpacity.value) / 100, 0.05, 0.5);
    currentScene().grid = grid;
    els.gridOpacityValue.textContent = `${Math.round(grid.opacity * 100)}%`;
    renderGrid();
    saveState();
  });
  els.wallType.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    state.ui.wallType = normalizeWallType(els.wallType.value);
    saveState();
    renderToolbar();
  });
  els.newLightColor.addEventListener("input", () => {
   if (currentRole() !== "gm") return;
   state.ui.newLightColor = normalizeHexColor(els.newLightColor.value);
   updateLightPresetStyles();
   saveState();
 });
  els.inspectorContent.addEventListener("input", handleLightControl);
  els.inspectorContent.addEventListener("input", handleDarknessControl);
  els.inspectorContent.addEventListener("change", handleWallControl);
 els.inspectorContent.addEventListener("input", handleTokenControl);
  $$('[data-permission]').forEach((input) => input.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    state.permissions[input.dataset.permission] = input.checked;
    saveState();
    renderInspector();
    showToast("Permissão atualizada para o modo Player.");
  }));
  els.tokenImages.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    const room = Math.max(0, 9 - pendingTokenFiles.length - (editingBlueprintId ? (getBlueprint(editingBlueprintId)?.images || []).filter((image) => !removedTokenImageKeys.has(String(image.key))).length : 0));
    pendingTokenFiles = [...pendingTokenFiles, ...Array.from(els.tokenImages.files || []).slice(0, room)];
    els.tokenImages.value = "";
    renderFramePreview();
  });
  els.addTokenState.addEventListener("click", () => {
    if (currentRole() === "gm") els.tokenImages.click();
  });
  els.addSequenceFrame.addEventListener("click", addSequenceFrame);
  els.sequenceForm.addEventListener("change", handleSequenceImageChange);
  els.sequenceForm.addEventListener("input", handleSequenceFrameInput);
  els.tokenForm.addEventListener("submit", handleTokenSubmit);
  els.sequenceForm.addEventListener("submit", handleSequenceSubmit);
  els.sequenceDialog.addEventListener("close", () => {
    pendingSequenceFrames = [];
    editingTokenAnimation = null;
  });
  els.sequencePlayerDialog.addEventListener("close", () => { sequencePlayback = null; });
  $("#closeSequence").addEventListener("click", () => els.sequencePlayerDialog.close());
  els.previousFrame.addEventListener("click", () => advanceSequence(-1));
  els.nextFrame.addEventListener("click", () => advanceSequence(1));
  document.addEventListener("click", handleDelegatedClick);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  els.mapImage.addEventListener("load", renderLighting);
  window.addEventListener("resize", () => {
    renderGrid();
    renderVisionRangeLayer();
    renderLighting();
  });
  if (window.ResizeObserver) new ResizeObserver(() => {
    renderGrid();
    renderVisionRangeLayer();
    renderLighting();
  }).observe(els.stage);
  renderAuthGate();
  renderAll();
  initRealtime();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
