import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Repeat, BookText, Languages,
  Search, MessageCircle, Settings as SettingsIcon, Menu, X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/learn", icon: BookOpen, label: "Apprendre" },
  { to: "/review", icon: Repeat, label: "Réviser", badge: true },
  { to: "/grammar", icon: BookText, label: "Grammaire" },
  { to: "/conjugation", icon: Languages, label: "Conjugaison" },
  { to: "/dictionary", icon: Search, label: "Dictionnaire" },
  { to: "/chat", icon: MessageCircle, label: "Chat IA" },
];

export default function Layout() {
  const { settings, activePair } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    if (activePair) {
      bridge.getDueCount(activePair.id).then(setDueCount).catch(() => {});
    }
  }, [activePair]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 text-gray-600 dark:text-gray-400">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Omnilingo</h1>
        <div className="w-6" />
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 lg:transform-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex flex-col`}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Omnilingo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {activePair ? `${activePair.source_flag} ${activePair.source_name} → ${activePair.target_flag} ${activePair.target_name}` : "Apprendre les langues"}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
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
              <span>{item.label}</span>
              {item.badge && dueCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {dueCount}
                </span>
              )}
            </NavLink>
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
            <span>Parametres</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Niveau <strong className="text-amber-600 dark:text-amber-400">{settings?.level || "A2"}</strong></span>
            <span>Serie <strong className="text-emerald-600 dark:text-emerald-400">{settings?.streak || 0}</strong> j</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-5xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
