import { useIsFetching } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  Handshake,
  FileText,
  Receipt,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Shield,
  Menu,
} from "lucide-react";

import { endSession } from "../auth/session";
import { useAuthStore } from "../auth/store";
import { useWorkspaceSync } from "../org/workspace";
import { useAppStore } from "../store";
import { Avatar, Spinner, ThemeToggle } from "../ui";
import { CommandPalette } from "../ui/CommandPalette";

interface NavGroup {
  group: string;
  items: {
    to: string;
    label: string;
    icon: React.ElementType;
    end?: boolean;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: "CRM & Pipeline",
    items: [
      { to: "/accounts", label: "Companies", icon: Building2 },
      { to: "/contacts", label: "Contacts", icon: Users },
      { to: "/leads", label: "Leads", icon: TrendingUp },
      { to: "/deals", label: "Deals", icon: Handshake },
    ],
  },
  {
    group: "Sales & Billing",
    items: [
      { to: "/quotes", label: "Quotes", icon: FileText },
      { to: "/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    group: "System",
    items: [
      { to: "/team", label: "Team & Settings", icon: Settings },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/accounts": "Companies",
  "/contacts": "Contacts",
  "/leads": "Leads",
  "/deals": "Deals",
  "/quotes": "Quotes Workbench",
  "/invoices": "Tax Invoices",
  "/team": "Team & Settings",
};

export default function AppLayout() {
  useWorkspaceSync();

  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);

  const { pathname } = useLocation();
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);

  const getPageTitle = () => {
    if (TITLES[pathname]) return TITLES[pathname];
    const segment = pathname.split("/")[1];
    if (!segment) return "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas text-fg">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface/95 backdrop-blur-md transition-[width] duration-200 select-none lg:flex ${
          sidebarOpen ? "w-60" : "w-16"
        }`}
      >
        <Sidebar collapsed={!sidebarOpen} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={closeDrawer}
          className={`absolute inset-0 bg-overlay/40 transition-opacity duration-150 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-60 flex-col border-r border-line bg-surface shadow-lg transition-transform duration-200 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar collapsed={false} onNavigate={closeDrawer} />
        </aside>
      </div>

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
          sidebarOpen ? "lg:pl-60" : "lg:pl-16"
        }`}
      >
        <Topbar
          title={getPageTitle()}
          onOpenSearch={() => setCommandSearchOpen(true)}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Global Command Search */}
      <CommandPalette
        isOpen={commandSearchOpen}
        onClose={() => setCommandSearchOpen(false)}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const Sidebar = memo(function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const location = useLocation();

  return (
    <>
      {/* Brand Header */}
      <div className={`flex h-16 items-center border-b border-line px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-line bg-surface shadow-xs">
            <img src="/autonex_ai_logo.jpeg" alt="Autonex AI" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="flex flex-col transition-opacity duration-200">
              <span className="text-base font-bold tracking-tight text-fg">
                DealBridge
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                CRM Portal
              </span>
            </div>
          )}
        </Link>

        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-fg-subtle/80 mb-1.5">
                {group.group}
              </h3>
            )}
            {group.items.map((item) => {
              const IconComp = item.icon;
              const isActive =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-500/30"
                      : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                  }`}
                >
                  <IconComp
                    className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                      isActive ? "text-white" : "text-fg-muted group-hover:text-fg"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {collapsed && (
        <div className="p-3 flex justify-center border-t border-line">
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Footer Workspace Badge */}
      {!collapsed && (
        <div className="border-t border-line p-3 bg-surface-muted/40">
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-fg">Autonex Workspace</span>
              <span className="text-[11px] text-fg-muted">Pro Plan · Active</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

const Topbar = memo(function Topbar({
  title,
  onOpenSearch,
}: {
  title: string;
  onOpenSearch: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const onSignOut = useCallback(async () => {
    await endSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  const fullName = user?.name?.trim() || user?.email || "User";
  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface/90 backdrop-blur-md px-4 sm:px-6 shadow-xs">
      {/* Left: Mobile Menu & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm font-medium text-fg-muted">
          <span>DealBridge</span>
          <span>/</span>
          <span className="font-semibold text-fg">{title}</span>
        </div>
        <BusyIndicator />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted/50 px-3 py-1.5 text-xs text-fg-muted transition-all hover:bg-surface-hover hover:text-fg sm:w-60"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search CRM...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-line bg-surface px-1.5 font-mono text-[10px] font-medium opacity-80">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        {/* Quick Actions Dropdown */}
        <div className="relative">
          <button
            onClick={() => setQuickMenuOpen(!quickMenuOpen)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>

          {quickMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-surface p-1 shadow-xl z-50 animate-in fade-in-0 zoom-in-95"
              onClick={() => setQuickMenuOpen(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-bold text-fg-subtle uppercase">
                Quick Actions
              </div>
              <div className="h-px bg-line my-1" />
              <button
                onClick={() => navigate("/leads")}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
              >
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span>New Lead</span>
              </button>
              <button
                onClick={() => navigate("/deals")}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
              >
                <Handshake className="h-4 w-4 text-emerald-500" />
                <span>New Deal</span>
              </button>
              <button
                onClick={() => navigate("/quotes/new")}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
              >
                <FileText className="h-4 w-4 text-amber-500" />
                <span>New Quote</span>
              </button>
              <button
                onClick={() => navigate("/accounts")}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
              >
                <Building2 className="h-4 w-4 text-blue-500" />
                <span>New Company</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-line my-auto mx-0.5" />

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-surface" />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        <div className="h-4 w-px bg-line my-auto mx-0.5" />

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-surface-hover"
          >
            <Avatar name={fullName} size="sm" />
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold leading-tight text-fg">{fullName}</p>
              <p className="text-[10px] capitalize text-fg-muted">Admin</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-fg-muted" />
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-1 shadow-xl z-50 animate-in fade-in-0 zoom-in-95"
              onClick={() => setUserMenuOpen(false)}
            >
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-fg">{fullName}</p>
                <p className="text-xs text-fg-muted">{user?.email || "admin@autonex.ai"}</p>
              </div>
              <div className="h-px bg-line my-1" />
              <button
                onClick={() => navigate("/team")}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
              >
                <User className="h-4 w-4 text-fg-muted" />
                <span>Profile & Settings</span>
              </button>
              <div className="h-px bg-line my-1" />
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-500/10 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

function BusyIndicator() {
  const fetching = useIsFetching();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!fetching) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, [fetching]);

  if (!visible) return null;
  return <Spinner size={14} className="opacity-70" />;
}

