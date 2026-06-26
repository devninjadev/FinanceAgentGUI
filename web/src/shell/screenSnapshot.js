import { cleanPortfolioWidgetText as cleanPortfolioWidgetPrompt } from "../portfolio/widgetIdentity.js";

export function compactVisibleScreenText(value, maxLength = 180) {
  return cleanPortfolioWidgetPrompt(String(value || "").replace(/\s+/g, " "), maxLength);
}

function isVisibleScreenElement(element) {
  if (!element || typeof window === "undefined") return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || 1) !== 0
  );
}

function collectVisibleTableSnapshot(table, maxRows = 8, maxCells = 6) {
  if (!table) return null;
  const headers = [...table.querySelectorAll("thead th")]
    .map((cell) => compactVisibleScreenText(cell.textContent, 60))
    .filter(Boolean)
    .slice(0, maxCells);
  const rows = [...table.querySelectorAll("tbody tr")]
    .filter(isVisibleScreenElement)
    .slice(0, maxRows)
    .map((row) =>
      [...row.querySelectorAll("td")]
        .map((cell) => compactVisibleScreenText(cell.textContent, 80))
        .filter(Boolean)
        .slice(0, maxCells)
    )
    .filter((row) => row.length);
  return rows.length || headers.length ? { headers, rows } : null;
}

export function collectVisibleScreenSnapshot(screen = "") {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const main = document.querySelector(".mockup-stage") || document.body;
  const activeNavItems = [...document.querySelectorAll(".nav-item.is-active, .nav-sub-item.is-active")]
    .filter(isVisibleScreenElement)
    .map((item) => compactVisibleScreenText(item.textContent, 120))
    .filter(Boolean)
    .slice(0, 8);
  const headings = [...main.querySelectorAll("h1, h2, h3")]
    .filter(isVisibleScreenElement)
    .map((heading) => ({
      level: heading.tagName.toLowerCase(),
      text: compactVisibleScreenText(heading.textContent, 140),
    }))
    .filter((item) => item.text)
    .slice(0, 18);
  const visibleButtons = [...main.querySelectorAll("button, [role='button'], a[href]")]
    .filter(isVisibleScreenElement)
    .map((button) => ({
      text: compactVisibleScreenText(button.getAttribute("aria-label") || button.textContent, 120),
      disabled: Boolean(button.disabled || button.getAttribute("aria-disabled") === "true"),
    }))
    .filter((item) => item.text)
    .slice(0, 40);
  const dialogs = [...document.querySelectorAll("[role='dialog']")]
    .filter(isVisibleScreenElement)
    .map((dialog) => ({
      title: compactVisibleScreenText(dialog.querySelector("h1, h2, h3")?.textContent || "", 140),
      text: compactVisibleScreenText(dialog.textContent, 360),
      buttons: [...dialog.querySelectorAll("button")]
        .filter(isVisibleScreenElement)
        .map((button) => compactVisibleScreenText(button.textContent || button.getAttribute("aria-label"), 80))
        .filter(Boolean)
        .slice(0, 8),
    }))
    .slice(0, 4);
  const portfolioWidgets = [...document.querySelectorAll(".portfolio-widget-card")]
    .filter(isVisibleScreenElement)
    .slice(0, 12)
    .map((card) => {
      const table = collectVisibleTableSnapshot(card.querySelector(".portfolio-widget-table"), 10, 5);
      return {
        title: compactVisibleScreenText(card.querySelector("h3")?.textContent, 140),
        header: compactVisibleScreenText(card.querySelector("header span")?.textContent, 160),
        relation: compactVisibleScreenText(card.querySelector(".portfolio-widget-relation-meta")?.textContent, 220),
        footer: compactVisibleScreenText(card.querySelector(".portfolio-widget-card-footer span")?.textContent, 180),
        footerButton: compactVisibleScreenText(card.querySelector(".portfolio-widget-card-footer button")?.textContent, 80),
        statusClass: compactVisibleScreenText(card.className, 120),
        hasTable: Boolean(table),
        hasChart: Boolean(card.querySelector(".portfolio-widget-echart")),
        table,
        visibleText: compactVisibleScreenText(card.textContent, 420),
      };
    });
  const runtimeError = document.querySelector(".app-runtime-failure, .runtime-error-overlay");

  return {
    source: "visible-dom",
    capturedAt: new Date().toISOString(),
    screen,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: Math.round(window.scrollX || 0),
      scrollY: Math.round(window.scrollY || 0),
    },
    activeNavItems,
    headings,
    visibleButtons,
    dialogs,
    runtimeError: runtimeError ? compactVisibleScreenText(runtimeError.textContent, 500) : "",
    portfolio: document.querySelector(".portfolio-shell")
      ? {
          headerTitle: compactVisibleScreenText(document.querySelector(".portfolio-header h1")?.textContent, 160),
          headerSubtitle: compactVisibleScreenText(document.querySelector(".portfolio-header p")?.textContent, 220),
          widgetCount: portfolioWidgets.length,
          emptyWidgetCells: [...document.querySelectorAll(".portfolio-widget-add-cell")].filter(isVisibleScreenElement).length,
          widgets: portfolioWidgets,
        }
      : null,
    rightSidebar: document.querySelector(".codex-sidebar")
      ? {
          status: compactVisibleScreenText(document.querySelector(".sidebar-probe-status")?.textContent, 160),
          composerPlaceholder: compactVisibleScreenText(document.querySelector(".codex-sidebar textarea")?.getAttribute("placeholder"), 120),
        }
      : null,
  };
}
