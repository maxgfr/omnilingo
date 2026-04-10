import { useState, useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen, BookText, Languages, MessageSquare,
  RefreshCw, SpellCheck, ArrowRightLeft, FileSearch,
  Settings as SettingsIcon, Menu, X, ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";

const navSections = [
  {
    items: [
      { to: "/dictionary", icon: BookOpen, labelKey: "nav.dictionary" },
      { to: "/grammar", icon: BookText, labelKey: "nav.grammar" },
      { to: "/conjugation", icon: Languages, labelKey: "nav.conjugation" },

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

// Group reverse pairs: if both fr->de and de->fr exist, show as one bidirectional entry
function groupPairs(pairs: ReturnType<typeof useAppStore.getState>["languagePairs"]) {
  const seen = new Set<number>();
  const groups: Array<{
    ids: number[];
    label: string;
    primaryId: number;
  }> = [];

  for (const pair of pairs) {
    if (seen.has(pair.id)) continue;
    seen.add(pair.id);

    const reverse = pairs.find(
      (p) => p.source_lang === pair.target_lang && p.target_lang === pair.source_lang && !seen.has(p.id),
    );

    if (reverse) {
      seen.add(reverse.id);
      groups.push({
        ids: [pair.id, reverse.id],
        label: `${pair.source_flag} ${pair.source_name} ↔ ${pair.target_flag} ${pair.target_name}`,
        primaryId: pair.id,
      });
    } else {
      groups.push({
        ids: [pair.id],
        label: `${pair.source_flag} ${pair.source_name} → ${pair.target_flag} ${pair.target_name}`,
        primaryId: pair.id,
      });
    }
  }

  return groups;
}

export default function Layout() {
  const { t } = useTranslation();
  const languagePairs = useAppStore((s) => s.languagePairs);
  const loading = useAppStore((s) => s.loading);
  const activePairId = useAppStore((s) => s.activePairId);
  const switchPair = useAppStore((s) => s.switchPair);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pairGroups = useMemo(() => groupPairs(languagePairs), [languagePairs]);

  // Find the group that contains the active pair
  const activeGroup = pairGroups.find((g) => g.ids.includes(activePairId ?? -1));
  const resolvedGroupPrimaryId = activeGroup?.primaryId ?? pairGroups[0]?.primaryId ?? null;

  const handleGlobalSwitch = (primaryId: number) => {
    switchPair(primaryId);
  };

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

        {/* Global language pair selector */}
        {pairGroups.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <select
                value={resolvedGroupPrimaryId ?? ""}
                onChange={(e) => handleGlobalSwitch(Number(e.target.value))}
                className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all cursor-pointer"
              >
                {pairGroups.map((group) => (
                  <option key={group.primaryId} value={group.primaryId}>
                    {group.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        )}

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
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">{t("common.loading")}</p>
              </div>
            </div>
          ) : (
            <div>
              <Outlet />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
