import {
  PORTFOLIO_WIDGET_GRID_COLUMNS,
  PORTFOLIO_WIDGET_GRID_EXTRA_ROWS,
  PORTFOLIO_WIDGET_MAX_HEIGHT,
  PORTFOLIO_WIDGET_MAX_ROWS,
  PORTFOLIO_WIDGET_MAX_SPAN,
} from "./workspaceState.js";
import { clampPortfolioWidgetNumber } from "./widgetIdentity.js";

function portfolioWidgetCells(widget) {
  const cells = [];
  for (let row = widget.y; row < widget.y + widget.h; row += 1) {
    for (let col = widget.x; col < widget.x + widget.w; col += 1) {
      cells.push(`${col}:${row}`);
    }
  }
  return cells;
}

export function canPlacePortfolioWidget(widgets, candidate, ignoreId = "") {
  if (candidate.x < 0 || candidate.y < 0) return false;
  if (candidate.w < 1 || candidate.h < 1) return false;
  if (candidate.w > PORTFOLIO_WIDGET_MAX_SPAN || candidate.h > PORTFOLIO_WIDGET_MAX_HEIGHT) return false;
  if (candidate.x + candidate.w > PORTFOLIO_WIDGET_GRID_COLUMNS) return false;
  if (candidate.y + candidate.h > PORTFOLIO_WIDGET_MAX_ROWS) return false;
  const occupied = new Set();
  widgets
    .filter((widget) => widget.id !== ignoreId)
    .forEach((widget) => portfolioWidgetCells(widget).forEach((cell) => occupied.add(cell)));
  return portfolioWidgetCells(candidate).every((cell) => !occupied.has(cell));
}

export function findPortfolioWidgetPlacement(widgets = [], width = 1, height = 1) {
  const w = clampPortfolioWidgetNumber(width, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1);
  const h = clampPortfolioWidgetNumber(height, 1, PORTFOLIO_WIDGET_MAX_HEIGHT, 1);
  const maxBottom = widgets.reduce((bottom, widget) => Math.max(bottom, widget.y + widget.h), 0);
  const searchRows = Math.min(PORTFOLIO_WIDGET_MAX_ROWS, Math.max(8, maxBottom + PORTFOLIO_WIDGET_GRID_EXTRA_ROWS));
  for (let y = 0; y < searchRows; y += 1) {
    for (let x = 0; x <= PORTFOLIO_WIDGET_GRID_COLUMNS - w; x += 1) {
      const candidate = { x, y, w, h };
      if (canPlacePortfolioWidget(widgets, candidate)) return candidate;
    }
  }
  return { x: 0, y: Math.max(0, Math.min(PORTFOLIO_WIDGET_MAX_ROWS - h, maxBottom)), w, h };
}

export function portfolioGridModel(widgets) {
  const occupied = new Set();
  let maxBottom = 0;
  widgets.forEach((widget) => {
    maxBottom = Math.max(maxBottom, widget.y + widget.h);
    portfolioWidgetCells(widget).forEach((cell) => occupied.add(cell));
  });
  const rowCount = Math.min(PORTFOLIO_WIDGET_MAX_ROWS, Math.max(8, maxBottom + PORTFOLIO_WIDGET_GRID_EXTRA_ROWS));
  const emptyCells = [];
  for (let y = 0; y < rowCount; y += 1) {
    for (let x = 0; x < PORTFOLIO_WIDGET_GRID_COLUMNS; x += 1) {
      if (!occupied.has(`${x}:${y}`)) {
        emptyCells.push({ x, y });
      }
    }
  }
  return { emptyCells, rowCount };
}
