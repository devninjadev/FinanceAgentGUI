import React from "react";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3.js";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.js";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.js";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.js";
import Database from "lucide-react/dist/esm/icons/database.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import Home from "lucide-react/dist/esm/icons/home.js";
import Landmark from "lucide-react/dist/esm/icons/landmark.js";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.js";
import Newspaper from "lucide-react/dist/esm/icons/newspaper.js";
import PieChart from "lucide-react/dist/esm/icons/chart-pie.js";
import Settings from "lucide-react/dist/esm/icons/settings.js";
import { newsFeedHealthState } from "../news/newsFeedStatus.js";
import { PortfolioCanvasNavList } from "../portfolio/PortfolioCanvasNavList.jsx";

const leftSidebarSections = [
  {
    title: "작업",
    items: [
      { label: "주식채널", icon: Home, view: "stock", statusKey: "arcaNotifications" },
      { label: "World Memory", icon: Database, view: "world-memory" },
      { label: "News Feed", icon: Newspaper, view: "news-feed", statusKey: "newsFeed" },
      { label: "Earning Calendar", icon: CalendarDays, view: "earning-calendar" },
      { label: "Economic Calendar", icon: Landmark, view: "economic-calendar" },
      { label: "채팅", icon: MessageSquare, view: "chat" },
      { label: "보고서", icon: FileText, view: "reports" },
      { label: "포트폴리오", icon: PieChart, view: "portfolio" },
    ],
  },
];

const sidebarUtilityItems = [
  { label: "설정", icon: Settings, view: "settings" },
];

function NavStatusDot({ health }) {
  if (!health || health.showSidebarDot === false) return null;
  return (
    <span
      className={[
        "nav-status-dot",
        health.level === "online" ? "is-online" : "",
        health.level === "warning" ? "is-warning" : "",
        health.level === "error" ? "is-error" : "",
        health.isCollecting ? "is-collecting" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={health.ariaLabel}
    />
  );
}

function formatUnreadBadgeCount(value) {
  const count = Math.max(0, Math.trunc(Number(value || 0)));
  return count.toLocaleString("ko-KR");
}

export function AppNavigation({
  activePortfolioCanvas,
  activeView,
  arcaNotificationHealth,
  editingPortfolioCanvasId,
  nameInputRef,
  newsFeedStatus,
  onDraftChange,
  onDraftKeyDown,
  onDuplicateCanvas,
  onMenuToggle,
  onRenameCanvas,
  onRequestDeleteCanvas,
  onSaveDraft,
  onSelectCanvas,
  onSelectItem,
  onSelectUtility,
  portfolioCanvasModeMeta,
  portfolioCanvasNameDraft,
  portfolioCanvasMenuId,
  portfolioCanvases,
  portfolioSidebarOpen,
  worldMemoryEnabled = false,
}) {
  const PortfolioChevron = portfolioSidebarOpen ? ChevronDown : ChevronRight;

  return (
    <aside className="app-sidebar" aria-label="FinanceAgentGUI navigation">
      <div className="app-sidebar-brand">
        <span className="brand-mark" aria-hidden="true">
          <BarChart3 size={15} strokeWidth={2.3} />
        </span>
        <span>주식채널+</span>
      </div>

      <nav className="app-sidebar-nav" aria-label="주요 작업">
        {leftSidebarSections.map((section) => (
          <section className="nav-section" key={section.title}>
            <h2>{section.title}</h2>
            <div className="nav-list">
              {section.items
                .filter((item) => item.view !== "world-memory" || worldMemoryEnabled)
                .map((item) => {
                  const Icon = item.icon;
                  const itemStatusHealth =
                    item.statusKey === "newsFeed"
                      ? newsFeedHealthState(newsFeedStatus)
                      : item.statusKey === "arcaNotifications"
                        ? arcaNotificationHealth
                        : null;
                  const isPortfolioItem = item.view === "portfolio";
                  const isPortfolioSurface = activeView === "portfolio" || activeView === "portfolio-canvas";
                  const isActiveItem = isPortfolioItem ? isPortfolioSurface : item.view === activeView;
                  const showNewsFeedUnreadBadge = item.statusKey === "newsFeed" && !isActiveItem;
                  const newsFeedUnreadCount =
                    showNewsFeedUnreadBadge
                      ? Math.max(0, Math.trunc(Number(newsFeedStatus?.readState?.unreadTranslatedCount || 0)))
                      : 0;
                  const newsFeedUnreadText =
                    newsFeedUnreadCount > 0 ? `+${formatUnreadBadgeCount(newsFeedUnreadCount)}` : "0";
                  return (
                    <React.Fragment key={item.label}>
                      <button
                        className={[
                          "nav-item",
                          isActiveItem ? "is-active" : "",
                          isPortfolioItem ? "has-children" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        onClick={() => onSelectItem(item)}
                        title={itemStatusHealth ? itemStatusHealth.title : item.label}
                        aria-expanded={isPortfolioItem ? portfolioSidebarOpen : undefined}
                      >
                        <Icon size={16} strokeWidth={2} />
                        <span className="nav-item-label">
                          <span className="nav-item-text">{item.label}</span>
                          {showNewsFeedUnreadBadge ? (
                            <span
                              className="nav-unread-count"
                              aria-label={`안 읽은 News Feed ${formatUnreadBadgeCount(newsFeedUnreadCount)}개`}
                            >
                              {newsFeedUnreadText}
                            </span>
                          ) : null}
                        </span>
                        <NavStatusDot health={itemStatusHealth} />
                        {isPortfolioItem ? (
                          <PortfolioChevron className="nav-item-chevron" size={15} strokeWidth={2.2} />
                        ) : null}
                      </button>
                      {isPortfolioItem && portfolioSidebarOpen ? (
                        <PortfolioCanvasNavList
                          activeCanvasId={activePortfolioCanvas?.id || ""}
                          activeView={activeView}
                          canvases={portfolioCanvases}
                          editingCanvasId={editingPortfolioCanvasId}
                          menuCanvasId={portfolioCanvasMenuId}
                          nameDraft={portfolioCanvasNameDraft}
                          nameInputRef={nameInputRef}
                          onDraftChange={onDraftChange}
                          onDraftKeyDown={onDraftKeyDown}
                          onDuplicateCanvas={onDuplicateCanvas}
                          onMenuToggle={onMenuToggle}
                          onRenameCanvas={onRenameCanvas}
                          onRequestDeleteCanvas={onRequestDeleteCanvas}
                          onSaveDraft={onSaveDraft}
                          onSelectCanvas={onSelectCanvas}
                          portfolioCanvasModeMeta={portfolioCanvasModeMeta}
                        />
                      ) : null}
                    </React.Fragment>
                  );
                })}
            </div>
          </section>
        ))}
      </nav>

      <nav className="app-sidebar-footer" aria-label="설정">
        {sidebarUtilityItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={item.view === activeView ? "nav-item is-active" : "nav-item"}
              type="button"
              key={item.label}
              onClick={() => onSelectUtility(item)}
            >
              <Icon size={16} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
