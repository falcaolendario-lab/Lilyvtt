"use strict";

/*
 * Tabletop RPG — beta local
 *
 * A cena guarda apenas instâncias posicionadas. A biblioteca guarda os assets
 * reutilizáveis. Essa separação é o que permite trocar o mapa sem perder os
 * tokens, estados e imagens que o Mestre já preparou.
 */

const STORAGE_KEY = "tabletop-rpg-beta-state-v1";
const STATE_SCHEMA_VERSION = 2;
const PLAYER_ID = "player-1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  body: document.body,
  roomName: $("#roomName"),
  saveIndicator: $("#saveIndicator"),
  betaStrip: $("#betaStrip"),
  roleButtons: $$("[data-role-choice]"),
  sideTabs: $$(".side-tab"),
  sidePanels: $$(".side-panel"),
  toolButtons: $$("[data-tool]"),
  stage: $("#stage"),
  sceneViewport: $("#sceneViewport"),
  mapImage: $("#mapImage"),
  mapPlaceholder: $("#mapPlaceholder"),
  wallsLayer: $("#wallsLayer"),
  lightingCanvas: $("#lightingCanvas"),
  lightsLayer: $("#lightsLayer"),
  hotspotsLayer: $("#hotspotsLayer"),
  tokensLayer: $("#tokensLayer"),
  wallDraft: $("#wallDraft"),
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
  framePreview: $("#framePreview"),
  replaceImagesRow: $("#replaceImagesRow"),
  replaceImages: $("#replaceImages"),
  saveToken: $("#saveToken"),
  sequenceDialog: $("#sequenceDialog"),
  sequenceForm: $("#sequenceForm"),
  sequenceName: $("#sequenceName"),
  sequenceSpeaker: $("#sequenceSpeaker"),
  sequenceLines: $("#sequenceLines"),
  sequenceImages: $("#sequenceImages"),
  sequencePlayerDialog: $("#sequencePlayerDialog"),
  sequenceMedia: $("#sequenceMedia"),
  sequenceCounter: $("#sequenceCounter"),
  sequenceSpeakerView: $("#sequenceSpeakerView"),
  sequenceText: $("#sequenceText"),
  previousFrame: $("#previousFrame"),
  nextFrame: $("#nextFrame"),
  toast: $("#toast"),
};

const launchedAsPlayer = new URLSearchParams(window.location.search).get("mode") === "player";
const initialRole = launchedAsPlayer ? "player" : "gm";
let state = loadState();
let editingBlueprintId = null;
let pendingTokenFiles = [];
let pendingSequenceFiles = [];
let sequencePlacement = null;
let sequencePlayback = null;
let wallDraftPoint = null;
let activeDrag = null;
let activePan = null;
let suppressStageClick = false;
let spaceHeld = false;
let cameraSaveTimer = null;
let toastTimer = null;

if (new URLSearchParams(window.location.search).get("mode") === "player") {
  state.ui.role = "player";
  state.ui.activeTool = "select";
}

function makeId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
        camera: { x: 0, y: 0, zoom: 1 },
        tokens: [],
        walls: [],
        lights: [],
        hotspots: [],
      },
    ],
    activeSceneId: "scene-main",
    ui: {
      role: initialRole,
      activeTool: "select",
      selectedTokenId: null,
    },
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
      ...normalizePoint(token),
      size: clamp(Number(token.size) || 0.08, 0.025, 0.5),
      activeKey: String(token.activeKey || "1"),
      rotation: Number.isFinite(Number(token.rotation)) ? Number(token.rotation) : 0,
      visionRange: clamp(Number(token.visionRange) || 0, 0, 2),
    });
    return normalizedTokens;
  }, []);
}

function normalizeWalls(walls) {
  const sampleWallIds = new Set(["wall-a", "wall-b", "wall-c", "wall-d", "wall-divider", "wall-divider-2"]);
  const seenIds = new Set();
  return walls.reduce((normalizedWalls, wall) => {
    if (!wall || typeof wall !== "object" || sampleWallIds.has(wall.id)) return normalizedWalls;
    const a = normalizePoint(wall.a);
    const b = normalizePoint(wall.b);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.004) return normalizedWalls;
    let id = String(wall.id || makeId("wall"));
    if (seenIds.has(id)) id = makeId("wall");
    seenIds.add(id);
    normalizedWalls.push({
      ...wall,
      id,
      a,
      b,
      blocksMovement: wall.blocksMovement !== false,
      blocksVision: wall.blocksVision !== false,
      blocksLight: wall.blocksLight !== false,
    });
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
      color: String(light.color || "#f4c783"),
    });
    return normalizedLights;
  }, []);
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
      tokenBlueprints: Array.isArray(loaded.library?.tokenBlueprints) ? loaded.library.tokenBlueprints : base.library.tokenBlueprints,
      sequences: Array.isArray(loaded.library?.sequences) ? loaded.library.sequences : base.library.sequences,
    },
    scenes: Array.isArray(loaded.scenes) && loaded.scenes.length ? loaded.scenes : base.scenes,
    ui: { ...base.ui, ...(loaded.ui || {}) },
  };

  normalized.scenes = normalized.scenes.map((scene) => ({
    ...scene,
    camera: normalizeCamera(scene.camera),
    tokens: normalizeTokens((Array.isArray(scene.tokens) ? scene.tokens : [])
      .filter((token) => token?.id !== "token-example-player" && token?.id !== "token-example-gm")),
    walls: normalizeWalls(Array.isArray(scene.walls) ? scene.walls : []),
    lights: normalizeLights(Array.isArray(scene.lights) ? scene.lights : []),
    hotspots: (Array.isArray(scene.hotspots) ? scene.hotspots : [])
      .filter((hotspot) => hotspot?.id !== "hotspot-example")
      .map((hotspot) => ({ ...hotspot, ...normalizePoint(hotspot), visible: hotspot.visible !== false })),
    globalIllumination: Boolean(scene.globalIllumination),
    visionMaskEnabled: scene.visionMaskEnabled !== false,
  }));

  normalized.schemaVersion = STATE_SCHEMA_VERSION;

  if (!normalized.scenes.some((scene) => scene.id === normalized.activeSceneId)) {
    normalized.activeSceneId = normalized.scenes[0].id;
  }
  return normalized;
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveIndicator.innerHTML = '<span class="status-dot"></span> salvo localmente';
  } catch (error) {
    els.saveIndicator.innerHTML = '<span class="status-dot" style="background:var(--rose)"></span> armazenamento cheio';
    showToast("O armazenamento local atingiu o limite. Use imagens menores no beta.", true);
    console.warn("Não foi possível salvar o estado local.", error);
  }
}

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

function getSequence(sequenceId) {
  return state.library.sequences.find((sequence) => sequence.id === sequenceId);
}

function getTokenImage(token) {
  const blueprint = getBlueprint(token.blueprintId);
  return blueprint?.images?.find((image) => image.key === String(token.activeKey)) || blueprint?.images?.[0] || null;
}

function canMoveToken(token) {
  if (currentRole() === "gm") return true;
  return Boolean(state.permissions.moveOwnToken && token.ownerId === currentMemberId());
}

function canChangeTokenImage(token) {
  if (currentRole() === "gm") return true;
  return Boolean(state.permissions.changeOwnImage && token.ownerId === currentMemberId());
}

function canInteractWithSequences() {
  return currentRole() === "gm" || Boolean(state.permissions.interactSequences);
}

function renderAll() {
  renderShell();
  renderSidebar();
  renderToolbar();
  renderCamera();
  renderMap();
  renderCanvasObjects();
  renderFooter();
  renderInspector();
  window.requestAnimationFrame(renderLighting);
}

function renderShell() {
  const role = currentRole();
  const scene = currentScene();
  els.body.dataset.role = role;
  els.body.classList.toggle("linked-player", launchedAsPlayer);
  els.roomName.textContent = state.room.name;
  els.sceneChip.textContent = scene.name.toUpperCase();
  els.roleButtons.forEach((button) => button.classList.toggle("active", button.dataset.roleChoice === role));
  if (role === "player") {
    els.toolStatus.textContent = "Modo Player · mova apenas o que for permitido";
  }
}

function renderSidebar() {
  const maps = state.library.maps;
  const blueprints = state.library.tokenBlueprints;
  const sequences = state.library.sequences;
  els.assetCount.textContent = maps.length + blueprints.length + sequences.length;
  els.mapCount.textContent = maps.length;
  els.tokenCount.textContent = blueprints.length;
  els.sequenceCount.textContent = sequences.length;

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

  els.sequenceList.innerHTML = sequences.length
    ? sequences.map((sequence) => `
      <button class="asset-row" data-action="open-sequence" data-id="${escapeHtml(sequence.id)}" title="Testar sequência">
        <span class="asset-thumb" style="color:var(--violet);border-color:rgba(185,169,255,.28)">✦</span>
        <span class="asset-row-copy"><strong>${escapeHtml(sequence.name)}</strong><small>${sequence.frames?.length || 0} frames · testar</small></span>
      </button>`).join("")
    : '<div class="empty-list">Nenhuma sequência criada ainda.</div>';

  els.sceneName.value = currentScene().name;
  els.globalIllumination.checked = Boolean(currentScene().globalIllumination);
  els.visionMask.checked = currentScene().visionMaskEnabled !== false;
  $$('[data-permission]').forEach((input) => {
    input.checked = Boolean(state.permissions[input.dataset.permission]);
  });
}

function renderToolbar() {
  const tool = state.ui.activeTool;
  els.stage.dataset.tool = tool;
  els.toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  if (currentRole() === "gm") {
    const messages = {
      select: "Arraste o fundo para mover · roda para zoom",
      wall: wallDraftPoint ? "Escolha o segundo ponto da barreira" : "Clique em dois pontos para desenhar uma barreira",
      light: "Clique no mapa para adicionar uma luz",
      hotspot: "Clique no mapa para criar uma sequência narrativa",
    };
    els.toolStatus.textContent = messages[tool] || messages.select;
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

function renderCanvasObjects() {
  const scene = currentScene();
  els.wallsLayer.innerHTML = scene.walls.map((wall) => `
    <line x1="${wall.a.x}" y1="${wall.a.y}" x2="${wall.b.x}" y2="${wall.b.y}" />`).join("");

  els.lightsLayer.innerHTML = currentRole() === "gm"
    ? scene.lights.map((light) => `
      <div class="light-marker" style="left:${light.x * 100}%;top:${light.y * 100}%;--light-color:${escapeHtml(light.color || "#f4c783")}" title="Luz"></div>`).join("")
    : "";

  els.hotspotsLayer.innerHTML = scene.hotspots.filter((hotspot) => hotspot.visible !== false).map((hotspot) => {
    const sequence = getSequence(hotspot.sequenceId);
    return `<button class="hotspot" style="left:${hotspot.x * 100}%;top:${hotspot.y * 100}%" data-action="open-sequence" data-id="${escapeHtml(hotspot.sequenceId)}" title="${escapeHtml(sequence?.name || "Interagir")}" aria-label="Abrir sequência ${escapeHtml(sequence?.name || "narrativa")}">✦</button>`;
  }).join("");

  els.tokensLayer.innerHTML = scene.tokens.map((token) => {
    const blueprint = getBlueprint(token.blueprintId) || { name: "Token", images: [] };
    const image = getTokenImage(token);
    const isSelected = state.ui.selectedTokenId === token.id;
    const isOwned = token.ownerId === currentMemberId();
    const contents = image
      ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(blueprint.name)}" draggable="false" />`
      : `<span class="token-fallback">${escapeHtml(blueprint.name.slice(0, 1).toUpperCase())}</span>`;
    return `
      <div class="token ${isSelected ? "selected" : ""} ${isOwned ? "player-owned" : ""}" data-token-id="${escapeHtml(token.id)}" style="left:${token.x * 100}%;top:${token.y * 100}%;--token-size:${(token.size || blueprint.defaultSize || 0.08) * 100}%;transform:translate(-50%,-50%) rotate(${Number(token.rotation) || 0}deg)" tabindex="0" role="button" aria-label="Token ${escapeHtml(blueprint.name)}">
        ${contents}
        <span class="token-tag">${escapeHtml(blueprint.name)}</span>
      </div>`;
  }).join("");

  els.wallDraft.hidden = !wallDraftPoint;
  if (wallDraftPoint) {
    els.wallDraft.style.left = `${wallDraftPoint.x * 100}%`;
    els.wallDraft.style.top = `${wallDraftPoint.y * 100}%`;
  }
  bindTokenInteractions();
}

function renderFooter() {
  const token = state.ui.selectedTokenId ? getToken(state.ui.selectedTokenId) : null;
  if (!token) {
    els.selectionAvatar.textContent = "—";
    els.selectionName.textContent = "Nenhum token selecionado";
    els.selectionDetail.textContent = currentRole() === "gm" ? "O canvas está pronto." : "Selecione o seu token para ver os estados.";
    els.hotkeyStrip.innerHTML = '<span class="eyebrow">ESTADOS</span><span class="hotkey-placeholder">Selecione um token para usar 1–9</span>';
    return;
  }

  const blueprint = getBlueprint(token.blueprintId) || { name: "Token", images: [] };
  const image = getTokenImage(token);
  els.selectionAvatar.innerHTML = image ? `<img src="${escapeHtml(image.src)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:7px" />` : escapeHtml(blueprint.name.slice(0, 1).toUpperCase());
  els.selectionName.textContent = blueprint.name;
  const owner = state.members.find((member) => member.id === token.ownerId)?.name || "Mestre";
  els.selectionDetail.textContent = `${owner} · estado ${token.activeKey || "1"} · ${canMoveToken(token) ? "pode mover" : "somente visualização"}`;
  const images = blueprint.images || [];
  els.hotkeyStrip.innerHTML = `<span class="eyebrow">ESTADOS</span>${images.length ? images.map((item) => `<button class="hotkey available ${String(token.activeKey) === String(item.key) ? "current" : ""}" data-action="select-state" data-id="${escapeHtml(token.id)}" data-state-key="${escapeHtml(item.key)}" title="${escapeHtml(item.label || `Estado ${item.key}`)}">${escapeHtml(item.key)}</button>`).join("") : '<span class="hotkey-placeholder">Adicione imagens ao token para habilitar 1–9</span>'}`;
}

function renderInspector() {
  const token = state.ui.selectedTokenId ? getToken(state.ui.selectedTokenId) : null;
  if (token) {
    const blueprint = getBlueprint(token.blueprintId) || { name: "Token", images: [] };
    const images = blueprint.images || [];
    els.inspectorTitle.textContent = blueprint.name;
    els.inspectorContent.innerHTML = `
      <div class="inspector-card">
        <div class="eyebrow">TOKEN INSTANCE</div>
        <div class="inspector-title">${escapeHtml(blueprint.name)}</div>
        <div class="inspector-meta">Esta instância pertence à cena atual. O modelo e seus estados continuam salvos na Biblioteca do Mestre.</div>
        <div class="permission-summary">
          <div><span>Dono</span><b>${escapeHtml(state.members.find((member) => member.id === token.ownerId)?.name || "Mestre")}</b></div>
          <div><span>Posição</span><b>${Math.round(token.x * 100)}% / ${Math.round(token.y * 100)}%</b></div>
          <div><span>Visão</span><b>${token.visionRange ? `${Math.round(token.visionRange * 100)}u` : "desligada"}</b></div>
        </div>
      </div>
      <div class="inspector-card">
        <div class="eyebrow">IMAGE STATES</div>
        <div class="inspector-meta">Use as teclas numéricas no canvas ou selecione um estado.</div>
        <div class="inspector-states">${images.length ? images.map((item) => `
          <button class="state-button ${String(token.activeKey) === String(item.key) ? "current" : ""}" data-action="select-state" data-id="${escapeHtml(token.id)}" data-state-key="${escapeHtml(item.key)}">
            <img src="${escapeHtml(item.src)}" alt="" /><span>${escapeHtml(item.key)}</span>
          </button>`).join("") : '<div class="empty-list" style="grid-column:1/-1">Este token ainda usa o fallback de texto. Edite-o para adicionar imagens.</div>'}</div>
        <button class="quiet-button full-width" data-action="edit-token" data-id="${escapeHtml(token.blueprintId)}" style="margin-top:10px">Editar token na biblioteca</button>
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
        <div class="inspector-meta">Assets ficam fora da cena. Trocar o mapa não apaga tokens, imagens ou sequências cadastradas.</div>
        <div class="permission-summary">
          <div><span>Mapas</span><b>${state.library.maps.length}</b></div>
          <div><span>Tokens salvos</span><b>${state.library.tokenBlueprints.length}</b></div>
          <div><span>Sequências</span><b>${state.library.sequences.length}</b></div>
          <div><span>Tokens nesta cena</span><b>${scene.tokens.length}</b></div>
        </div>
      </div>
      <div class="inspector-card">
        <div class="eyebrow">SCENE STATUS</div>
        <div class="inspector-title">${escapeHtml(scene.name)}</div>
        <div class="inspector-meta">${scene.walls.length} barreiras · ${scene.lights.length} luzes · ${scene.hotspots.length} hotspots</div>
      </div>`
    : `
      <div class="inspector-card">
        <div class="eyebrow">PLAYER VIEW</div>
        <div class="inspector-title">Você está na sala</div>
        <div class="inspector-meta">O Mestre controla o mapa. Suas ações dependem das permissões liberadas para esta sala.</div>
        <div class="permission-summary">
          <div><span>Seu token</span><b>${state.permissions.moveOwnToken ? "movível" : "bloqueado"}</b></div>
          <div><span>Estados 1–9</span><b>${state.permissions.changeOwnImage ? "liberados" : "bloqueados"}</b></div>
          <div><span>Hotspots</span><b>${state.permissions.interactSequences ? "liberados" : "bloqueados"}</b></div>
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
  const shouldMask = currentRole() === "player" && scene.visionMaskEnabled !== false && !scene.globalIllumination;
  if (!shouldMask) {
    canvas.hidden = true;
    return;
  }
  canvas.hidden = false;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "rgba(4, 7, 12, 0.94)";
  context.fillRect(0, 0, width, height);

  const sources = [];
  scene.tokens
    .filter((token) => token.ownerId === currentMemberId() && Number(token.visionRange) > 0)
    .forEach((token) => sources.push({
      x: token.x,
      y: token.y,
      range: token.visionRange,
      falloff: 0.58,
      kind: "vision",
    }));
  scene.lights.forEach((light) => sources.push({
    x: light.x,
    y: light.y,
    range: light.radius,
    falloff: Number(light.falloff) || 0.72,
    color: light.color || "#f4c783",
    kind: "light",
  }));

  sources.forEach((source) => {
    const points = visibilityPolygon(source, scene.walls);
    if (points.length < 3) return;
    const sourceX = source.x * width;
    const sourceY = source.y * height;
    const radius = source.range * Math.min(width, height);
    const falloff = clamp(Number(source.falloff) || 0.7, 0.2, 0.95);
    const fullLightStop = clamp(1 - falloff, 0.2, 0.82);
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
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    if (source.kind === "light") {
      const color = hexToRgb(source.color);
      const glow = context.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, Math.max(1, radius * 0.78));
      glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.16)`);
      glow.addColorStop(0.42, `rgba(${color.r}, ${color.g}, ${color.b}, 0.07)`);
      glow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
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
    const blocks = source.kind === "vision" ? wall.blocksVision !== false : wall.blocksLight !== false;
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
  if (event.target.closest(".token") || event.target.closest(".hotspot")) return;
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

function movementWouldCollide(token, from, to) {
  const radius = (Number(token.size) || 0.08) / 2;
  return currentScene().walls.some((wall) => {
    if (wall.blocksMovement === false || !wall.a || !wall.b) return false;
    if (Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y) < 0.004) return false;
    return segmentsIntersect(from, to, wall.a, wall.b) || distancePointToSegment(to, wall.a, wall.b) < radius;
  });
}

function updateSelectedTokenStyles() {
  $$(".token").forEach((element) => {
    element.classList.toggle("selected", element.dataset.tokenId === state.ui.selectedTokenId);
  });
}

function bindTokenInteractions() {
  $$(".token").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectToken(element.dataset.tokenId);
    });
    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.button !== 0) return;
      const token = getToken(element.dataset.tokenId);
      if (!token) return;
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

function handleTokenDrag(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  const token = getToken(activeDrag.tokenId);
  if (!token) return;
  const cursor = clientToNormalized(event);
  const point = {
    x: clamp(cursor.x + activeDrag.offsetX, 0.01, 0.99),
    y: clamp(cursor.y + activeDrag.offsetY, 0.01, 0.99),
  };
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
  if (options.refreshObjects !== false) renderCanvasObjects();
  else updateSelectedTokenStyles();
  renderFooter();
  renderInspector();
}

function clearSelection() {
  state.ui.selectedTokenId = null;
  renderCanvasObjects();
  renderFooter();
  renderInspector();
}

function setTool(tool) {
  if (currentRole() !== "gm") return;
  state.ui.activeTool = tool;
  wallDraftPoint = null;
  renderToolbar();
  renderCanvasObjects();
  els.stage.focus();
}

function handleStageClick(event) {
  if (suppressStageClick) {
    suppressStageClick = false;
    return;
  }
  if (event.target.closest(".token") || event.target.closest(".hotspot")) return;
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
    currentScene().walls.push({
      id: makeId("wall"),
      a: wallDraftPoint,
      b: point,
      blocksMovement: true,
      blocksVision: true,
      blocksLight: true,
    });
    wallDraftPoint = null;
    saveState();
    renderAll();
    showToast("Barreira salva na cena.");
    return;
  }
  if (tool === "light") {
    currentScene().lights.push({ id: makeId("light"), x: point.x, y: point.y, radius: 0.2, falloff: 0.72, color: "#f4c783" });
    saveState();
    renderAll();
    showToast("Luz adicionada. Ela será bloqueada pelas barreiras.");
    return;
  }
  if (tool === "hotspot") {
    sequencePlacement = point;
    openSequenceDialog();
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
  const token = {
    id: makeId("token"),
    blueprintId,
    ownerId: blueprint.ownerId || PLAYER_ID,
    x: clamp(0.34 + (index % 4) * 0.1, 0.08, 0.92),
    y: clamp(0.35 + Math.floor(index / 4) * 0.12, 0.08, 0.92),
    size: blueprint.defaultSize || 0.08,
    activeKey: blueprint.images?.[0]?.key || "1",
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
  editingBlueprintId = blueprintId;
  pendingTokenFiles = [];
  const blueprint = blueprintId ? getBlueprint(blueprintId) : null;
  els.tokenDialogTitle.textContent = blueprint ? "Editar token" : "Novo token";
  els.tokenName.value = blueprint?.name || "";
  els.tokenOwner.value = blueprint?.ownerId || PLAYER_ID;
  els.tokenImages.value = "";
  els.replaceImages.checked = false;
  els.replaceImagesRow.hidden = !blueprint;
  renderFramePreview();
  els.tokenDialog.showModal();
}

function renderFramePreview() {
  const blueprint = editingBlueprintId ? getBlueprint(editingBlueprintId) : null;
  const existing = blueprint?.images || [];
  const pending = pendingTokenFiles.map((file, index) => ({ key: `+${index + 1}`, name: file.name, src: null }));
  const frames = [...existing, ...pending];
  els.framePreview.innerHTML = frames.map((frame) => `
    <div class="frame-preview-item">${frame.src ? `<img src="${escapeHtml(frame.src)}" alt="" />` : ""}<span>${escapeHtml(frame.key)}</span></div>`).join("");
}

function openSequenceDialog() {
  els.sequenceName.value = "";
  els.sequenceSpeaker.value = "Narrador";
  els.sequenceLines.value = "";
  els.sequenceImages.value = "";
  pendingSequenceFiles = [];
  els.sequenceDialog.showModal();
}

function openSequence(sequenceId) {
  if (!canInteractWithSequences()) {
    showToast("O Mestre não liberou a interação com hotspots.", true);
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
  const name = els.tokenName.value.trim();
  if (!name) return;
  els.saveToken.disabled = true;
  try {
    const uploaded = await Promise.all(pendingTokenFiles.slice(0, 9).map((file) => fileToDataUrl(file)));
    const existingBlueprint = editingBlueprintId ? getBlueprint(editingBlueprintId) : null;
    let images = els.replaceImages.checked ? [] : [...(existingBlueprint?.images || [])];
    uploaded.forEach((src, index) => {
      if (src && images.length < 9) {
        images.push({ key: String(images.length + 1), label: `Estado ${images.length + 1}`, src, fileName: pendingTokenFiles[index]?.name || "imagem" });
      }
    });

    if (existingBlueprint) {
      existingBlueprint.name = name;
      existingBlueprint.ownerId = els.tokenOwner.value;
      existingBlueprint.images = images;
    } else {
      const blueprint = { id: makeId("blueprint"), name, ownerId: els.tokenOwner.value, images, defaultSize: 0.08 };
      state.library.tokenBlueprints.push(blueprint);
      const scene = currentScene();
      const token = {
        id: makeId("token"), blueprintId: blueprint.id, ownerId: blueprint.ownerId,
        x: 0.44, y: 0.5, size: blueprint.defaultSize, activeKey: images[0]?.key || "1", rotation: 0,
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
  const name = els.sequenceName.value.trim();
  const lines = els.sequenceLines.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!name || (!lines.length && !pendingSequenceFiles.length)) return;
  try {
    const uploaded = await Promise.all(pendingSequenceFiles.slice(0, 12).map((file) => fileToDataUrl(file)));
    const length = Math.max(lines.length, uploaded.length, 1);
    const frames = Array.from({ length }, (_, index) => ({ image: uploaded[index] || null, text: lines[index] || "" }));
    const sequence = { id: makeId("sequence"), name, speaker: els.sequenceSpeaker.value.trim() || "Narrador", frames };
    state.library.sequences.push(sequence);
    currentScene().hotspots.push({ id: makeId("hotspot"), sequenceId: sequence.id, x: sequencePlacement?.x || 0.5, y: sequencePlacement?.y || 0.5, visible: true });
    sequencePlacement = null;
    state.ui.activeTool = "select";
    saveState();
    els.sequenceDialog.close();
    renderAll();
    showToast("Hotspot narrativo criado. Clique nele para testar a sequência.");
  } catch (error) {
    showToast(error.message || "Não foi possível criar a sequência.", true);
  }
}

function setMap(mapId) {
  if (currentRole() !== "gm") return;
  if (!state.library.maps.some((map) => map.id === mapId)) return;
  currentScene().mapAssetId = mapId;
  saveState();
  renderAll();
  showToast("Mapa trocado; tokens e estados da cena continuam intactos.");
}

function createScene() {
  if (currentRole() !== "gm") return;
  const name = window.prompt("Nome da nova cena", `Cena ${state.scenes.length + 1}`)?.trim();
  if (!name) return;
  const scene = {
    id: makeId("scene"), name, mapAssetId: null, camera: { x: 0, y: 0, zoom: 1 }, globalIllumination: false, visionMaskEnabled: true,
    tokens: [], walls: [], lights: [], hotspots: [],
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
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}?room=${encodeURIComponent(state.room.id)}&mode=player`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link de demonstração do Player copiado.");
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
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const actionName = action.dataset.action;
  const id = action.dataset.id;
  if (actionName === "set-map") setMap(id);
  if (actionName === "add-token") addBlueprintToScene(id);
  if (actionName === "edit-token") openTokenDialog(id);
  if (actionName === "select-state") setTokenState(id, action.dataset.stateKey);
  if (actionName === "open-sequence") {
    event.stopPropagation();
    openSequence(id);
  }
}

function handleKeydown(event) {
  const tagName = document.activeElement?.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;
  if (event.key === " ") {
    spaceHeld = true;
    event.preventDefault();
    return;
  }
  if (event.key === "Escape") {
    wallDraftPoint = null;
    state.ui.activeTool = "select";
    renderToolbar();
    renderCanvasObjects();
    return;
  }
  if (currentRole() === "gm" && event.key.toLowerCase() === "v") setTool("select");
  if (currentRole() === "gm" && event.key.toLowerCase() === "w") setTool("wall");
  if (currentRole() === "gm" && event.key.toLowerCase() === "l") setTool("light");
  if (currentRole() === "gm" && event.key.toLowerCase() === "h") setTool("hotspot");
  if (/^[1-9]$/.test(event.key) && state.ui.selectedTokenId) setTokenState(state.ui.selectedTokenId, event.key);
}

function handleKeyup(event) {
  if (event.key === " ") spaceHeld = false;
}

function init() {
  els.roleButtons.forEach((button) => button.addEventListener("click", () => {
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
  els.stage.addEventListener("pointerdown", handleStagePanStart);
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
  $$('[data-permission]').forEach((input) => input.addEventListener("change", () => {
    if (currentRole() !== "gm") return;
    state.permissions[input.dataset.permission] = input.checked;
    saveState();
    renderInspector();
    showToast("Permissão atualizada para o modo Player.");
  }));
  els.tokenImages.addEventListener("change", () => {
    pendingTokenFiles = Array.from(els.tokenImages.files || []);
    renderFramePreview();
  });
  els.sequenceImages.addEventListener("change", () => {
    pendingSequenceFiles = Array.from(els.sequenceImages.files || []);
  });
  els.tokenForm.addEventListener("submit", handleTokenSubmit);
  els.sequenceForm.addEventListener("submit", handleSequenceSubmit);
  els.sequencePlayerDialog.addEventListener("close", () => { sequencePlayback = null; });
  $("#closeSequence").addEventListener("click", () => els.sequencePlayerDialog.close());
  els.previousFrame.addEventListener("click", () => advanceSequence(-1));
  els.nextFrame.addEventListener("click", () => advanceSequence(1));
  document.addEventListener("click", handleDelegatedClick);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  window.addEventListener("resize", renderLighting);
  if (window.ResizeObserver) new ResizeObserver(renderLighting).observe(els.stage);
  renderAll();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
