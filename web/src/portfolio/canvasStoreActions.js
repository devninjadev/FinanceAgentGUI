import {
  clonePortfolioJson,
  createPortfolioCanvas,
  defaultPortfolioWorkspaceState,
  nextPortfolioCanvasIndex,
  normalizePortfolioCanvasMode,
  normalizePortfolioCanvasStore,
  portfolioCanvasDefaultName,
} from "./workspaceState.js";
import { cleanPortfolioWidgetText } from "./widgetIdentity.js";

export function buildPortfolioCanvasWorkspaceUpdateState(store = {}, workspace, canvasId = "") {
  const current = normalizePortfolioCanvasStore(store);
  const targetCanvasId = String(canvasId || current.activeCanvasId || "").trim();
  if (!targetCanvasId) return current;
  const now = new Date().toISOString();
  return normalizePortfolioCanvasStore({
    ...current,
    canvases: current.canvases.map((canvas) =>
      canvas.id === targetCanvasId
        ? {
            ...canvas,
            workspace,
            updatedAt: now,
          }
        : canvas
    ),
  });
}

export function buildPortfolioCanvasCreateState(store = {}, mode = "") {
  const current = normalizePortfolioCanvasStore(store);
  const canvasMode = normalizePortfolioCanvasMode(mode);
  const index = nextPortfolioCanvasIndex(current.canvases, canvasMode);
  const canvas = createPortfolioCanvas({ index, mode: canvasMode });
  return {
    store: normalizePortfolioCanvasStore({
      canvases: [...current.canvases, canvas],
      activeCanvasId: canvas.id,
    }),
    canvasId: canvas.id,
  };
}

export function buildPortfolioCanvasSelectState(store = {}, canvasId = "") {
  const current = normalizePortfolioCanvasStore(store);
  return normalizePortfolioCanvasStore({
    ...current,
    activeCanvasId: canvasId,
  });
}

export function buildPortfolioCanvasRenameState(store = {}, canvasId = "", nextName = "") {
  const current = normalizePortfolioCanvasStore(store);
  const cleanName = cleanPortfolioWidgetText(nextName, 80);
  if (!canvasId || !cleanName) {
    return {
      store: current,
      renamed: false,
      cleanName,
    };
  }
  return {
    store: normalizePortfolioCanvasStore({
      ...current,
      canvases: current.canvases.map((canvas) =>
        canvas.id === canvasId && canvas.name !== cleanName
          ? {
              ...canvas,
              name: cleanName,
              updatedAt: new Date().toISOString(),
            }
          : canvas
      ),
    }),
    renamed: true,
    cleanName,
  };
}

export function buildPortfolioCanvasDuplicateState(store = {}, sourceCanvas = null) {
  const current = normalizePortfolioCanvasStore(store);
  if (!sourceCanvas) {
    return {
      store: current,
      canvasId: "",
      duplicated: false,
    };
  }
  const mode = normalizePortfolioCanvasMode(sourceCanvas.mode);
  const index = nextPortfolioCanvasIndex(current.canvases, mode);
  const duplicatedCanvas = createPortfolioCanvas({
    index,
    mode,
    name: `${sourceCanvas.name || portfolioCanvasDefaultName(index, mode)} 복사본`,
    workspace: clonePortfolioJson(sourceCanvas.workspace, defaultPortfolioWorkspaceState({ workspaceStarted: true })),
    chatMessages: clonePortfolioJson(sourceCanvas.chatMessages, []),
  });
  return {
    store: normalizePortfolioCanvasStore({
      canvases: [...current.canvases, duplicatedCanvas],
      activeCanvasId: duplicatedCanvas.id,
    }),
    canvasId: duplicatedCanvas.id,
    duplicated: true,
  };
}

export function buildPortfolioCanvasDeleteState(store = {}, targetId = "") {
  const current = normalizePortfolioCanvasStore(store);
  if (!targetId) {
    return {
      store: current,
      deleted: false,
      deletedActive: false,
      nextActiveCanvasId: current.activeCanvasId,
    };
  }
  const nextCanvases = current.canvases.filter((canvas) => canvas.id !== targetId);
  const deletedActive = current.activeCanvasId === targetId;
  const nextActiveCanvasId = deletedActive ? nextCanvases[0]?.id || "" : current.activeCanvasId;
  return {
    store: normalizePortfolioCanvasStore({
      canvases: nextCanvases,
      activeCanvasId: nextActiveCanvasId,
    }),
    deleted: nextCanvases.length !== current.canvases.length,
    deletedActive,
    nextActiveCanvasId,
  };
}
