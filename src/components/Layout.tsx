import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen, BookText, Languages, Layers, MessageSquare,
  RefreshCw, SpellCheck, ArrowRightLeft, FileSearch,
  Settings as SettingsIcon, Menu, X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";

const navSections = [
  {
    items: [
      { to: "/dictionary", icon: BookOpen, labelKey: "nav.dictionary" },
      { to: "/grammar", icon: BookText, labelKey: "nav.grammar" },
      { to: "/conjugation", icon: Languages, labelKey: "nav.conjugation" },
      { to: "/flashcards", icon: Layers, labelKey: "nav.flashcards", badge: true },
      { to: "/conversation", icon: MessageSquare, labelKey: "nav.conversation" },
    ],
  },
  {
    items: [
      { to: "/rephrase", icon: RefreshCw, labelKey: "nav.rephrase" },
      { to: "/corrector", icon: SpellCheck, labelKey: "nav.corrector" },
      { to: "/synonyms", icon: ArrowRightLeft, labelKey: "nav.synonyms" },
      { to: "/text-analysis", icon: FileSearch, labelKey: "nav.textAnalysis" },
    ],
  },
];

export default function Layout() {
  const { t } = useTranslation();
  const { languagePairs, loading } = useApp();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    if (languagePairs.length === 0) return;

    const refresh = async () => {
      try {
        const counts = await Promise.all(
          languagePairs.map((p) => bridge.getDueCount(p.id).catch(() => 0)),
        );
        setDueCount(counts.reduce((a, b) => a + b, 0));
      } catch { /* ignore */ }
    };

    refresh();
    const interval = setInterval(refresh, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [languagePairs]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 text-gray-600 dark:text-gray-400">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t("app.name")}</h1>
        <div className="w-6" />
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 lg:transform-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex flex-col`}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t("app.name")}</h1>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={si}>
              {si > 0 && <div className="my-3 border-t border-gray-200 dark:border-gray-800" />}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    }`
                  }
                >
                  <item.icon size={20} />
                  <span>{t(item.labelKey)}</span>
                  {item.badge && dueCount > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                      {dueCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="my-3 border-t border-gray-200 dark:border-gray-800" />

          <NavLink
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              }`
            }
          >
            <SettingsIcon size={20} />
            <span>{t("nav.settings")}</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-5xl mx-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">{t("common.loading")}</p>
              </div>
            </div>
          ) : (
            <div key={location.pathname} className="animate-fadeIn">
              <Outlet />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
