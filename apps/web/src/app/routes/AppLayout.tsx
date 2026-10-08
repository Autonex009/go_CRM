import { useIsFetching } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,

  TrendingUp,
  Handshake,
  FileText,
  Receipt,
  Wrench,
  Users,
  ChartColumnBig,
  Settings,
  Search,
  Plus,
  ChevronDown,
  LogOut,
  User,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Inbox,
} from "lucide-react";

import { endSession } from "../auth/session";
import { useAuthStore } from "../auth/store";
import { NotificationBell } from "../notifications/NotificationBell";
import { usePendingRequestCount } from "../implementation/useRequestCounts";
import { useWorkspaceStore, useWorkspaceSync } from "../org/workspace";

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
    /** Omitted for everyone; set to restrict to specific profiles.role values. */
    roles?: string[];
    /** Shows a count beside the label, e.g. pending requests. */
    badge?: "pendingRequests";
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
    group: "Engineering",
    items: [
      { to: "/implementation", label: "My Tasks", icon: Wrench, end: true, roles: ["engineer"] },
    ],
  },
  {
    group: "CRM & Pipeline",
    items: [
      { to: "/accounts", label: "Companies", icon: Building2, roles: ["owner", "admin", "sales", "account_manager"] },
      { to: "/leads", label: "Leads", icon: TrendingUp, roles: ["owner", "admin", "sales", "account_manager"] },
      { to: "/deals", label: "Deals", icon: Handshake, roles: ["owner", "admin", "sales", "account_manager"] },
      { to: "/requests", label: "Ask Requests", icon: Inbox, roles: ["owner", "admin", "sales", "account_manager"], badge: "pendingRequests" },
      { to: "/implementation", label: "Implementation", icon: Wrench, end: true, roles: ["owner", "admin", "sales", "account_manager", "manager"] },
      { to: "/implementation/team-tasks", label: "Engineer Tasks", icon: Users, end: true, roles: ["owner", "admin", "sales", "account_manager", "manager"] },
    ],
  },
  {
    group: "Sales & Billing",
    items: [
      { to: "/quotes", label: "Quotes", icon: FileText, roles: ["owner", "admin", "sales", "account_manager"] },
      { to: "/invoices", label: "Invoices", icon: Receipt, roles: ["owner", "admin", "sales", "account_manager"] },
      { to: "/metrics", label: "Analytics", icon: ChartColumnBig, roles: ["owner", "admin", "sales", "account_manager"] },
    ],
  },
  {
    group: "System",
    items: [
      { to: "/team", label: "Team & Settings", icon: Settings, roles: ["owner", "admin", "manager", "sales", "account_manager"] },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/accounts": "Companies",
  "/leads": "Leads",
  "/deals": "Deals",
  "/requests": "Ask Requests",
  "/implementation": "Implementation",
  "/implementation/team-tasks": "Engineer Task Allocations",
  "/quotes": "Quotes Workbench",
  "/invoices": "Tax Invoices",
  "/metrics": "Sales Analytics",
  "/team": "Team & Settings",
};

export default function AppLayout() {
  useWorkspaceSync();

  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);

  const { pathname } = useLocation();
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);

  // Global Ctrl+B / Cmd+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const getPageTitle = () => {
    if (TITLES[pathname]) return TITLES[pathname];
    const segment = pathname.split("/")[1];
    if (!segment) return "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  useEffect(() => {
    const pageTitle = getPageTitle();
    document.title = `${pageTitle} · DealBridge`;
  }, [pathname]);

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas text-fg">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line/80 bg-surface/95 backdrop-blur-md transition-[width] duration-200 select-none lg:flex ${
          sidebarOpen ? "w-64" : "w-16"
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
          className={`absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface shadow-2xl transition-transform duration-200 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar collapsed={false} onNavigate={closeDrawer} />
        </aside>
      </div>

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${
          sidebarOpen ? "lg:pl-64" : "lg:pl-16"
        }`}
      >
        <Topbar
          title={getPageTitle()}
          onOpenSearch={() => setCommandSearchOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1780px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
  const location = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const pendingRequests = usePendingRequestCount();
  const workspaceName = useWorkspaceStore((s) => s.name);

  return (
    <>
      {/* Brand Header */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line/80 transition-all duration-200 ${
          collapsed ? "justify-center px-2" : "justify-start px-4"
        }`}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className={`group flex items-center gap-3 overflow-hidden ${collapsed ? "justify-center" : ""}`}
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-line-strong/30 bg-surface shadow-xs transition-transform duration-200 group-hover:scale-105">
            <img src="/autonex_ai_logo.jpeg" alt="DealBridge" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col transition-opacity duration-200">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-fg leading-none">
                  DealBridge
                </span>
                <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  CRM
                </span>
              </div>
              <span className="text-[10px] font-medium text-fg-subtle truncate mt-0.5">
                Workspace Hub
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3.5">
        {NAV_GROUPS.map((group, idx) => {
          const badgeCount = (b?: string) => (b === "pendingRequests" ? pendingRequests : 0);
          const items = group.items.filter((item) => !item.roles || (!!role && item.roles.includes(role)));
          if (items.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {!collapsed ? (
                <div className="px-2.5 pt-2 pb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle/80">
                    {group.group}
                  </span>
                </div>
              ) : (
                <div className="my-2 mx-1.5 h-px bg-line/60" />
              )}
              {items.map((item) => {
                const IconComp = item.icon;
                const isActive =
                  item.end || item.to === "/"
                    ? location.pathname === item.to
                    : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? `${item.label} (${group.group})` : undefined}
                    className={`group relative flex items-center transition-all duration-150 ${
                      collapsed
                        ? "h-10 w-10 mx-auto justify-center rounded-xl"
                        : "gap-3 rounded-xl px-3 py-2 text-sm font-medium"
                    } ${
                      isActive
                        ? "bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200/60 dark:border-indigo-800/40 shadow-xs"
                        : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                    }`}
                  >
                    {isActive && !collapsed && (
                      <span
                        aria-hidden
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-1 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                      />
                    )}
                    <IconComp
                      className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                        isActive
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-fg-subtle group-hover:text-fg"
                      }`}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {badgeCount(item.badge) > 0 &&
                      (collapsed ? (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" aria-label={`${badgeCount(item.badge)} pending`} />
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                          {badgeCount(item.badge)}
                        </span>
                      ))}

                    {/* Collapsed Tooltip on Hover */}
                    {collapsed && (
                      <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-fg shadow-lg group-hover:block whitespace-nowrap">
                        {item.label}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer: Workspace & Role Card */}
      {!collapsed ? (
        <div className="shrink-0 border-t border-line/80 p-2.5">
          <Link
            to="/team"
            onClick={onNavigate}
            className="group flex items-center gap-2.5 rounded-xl border border-line/70 bg-surface-muted/30 p-2 transition-all duration-150 hover:border-line-strong hover:bg-surface-hover shadow-2xs"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-xs">
              {(workspaceName || "W").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-xs font-semibold text-fg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {workspaceName || "Workspace"}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-fg-muted capitalize">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">{role ? role.replace(/_/g, " ") : "Member"}</span>
              </span>
            </div>
            <Settings className="h-3.5 w-3.5 text-fg-subtle group-hover:text-fg group-hover:rotate-45 transition-all shrink-0 mr-0.5" />
          </Link>
        </div>
      ) : (
        <div className="shrink-0 border-t border-line/80 p-2.5 flex justify-center">
          <Link
            to="/team"
            onClick={onNavigate}
            title={`${workspaceName || "Workspace"} (${role || "Member"})`}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-xs hover:opacity-90 transition-opacity"
          >
            {(workspaceName || "W").slice(0, 2).toUpperCase()}
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-fg shadow-lg group-hover:block whitespace-nowrap">
              <p className="font-bold text-fg">{workspaceName || "Workspace"}</p>
              <p className="text-[10px] capitalize text-fg-muted">{role ? role.replace(/_/g, " ") : "Member"}</p>
            </div>
          </Link>
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
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const onSignOut = useCallback(async () => {
    await endSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  const fullName = user?.name?.trim() || user?.email || "User";

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface/90 backdrop-blur-md px-4 sm:px-6 shadow-xs">
      {/* Left: Mobile Menu, Desktop Sidebar Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Desktop Sidebar Toggle Button in Header */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          title={sidebarOpen ? "Collapse Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4 text-indigo-500" />}
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

        {/* Quick Actions Dropdown (shielded from engineers) */}
        {user?.role !== "engineer" && (
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
                  onClick={() => { setQuickMenuOpen(false); navigate("/leads", { state: { new: true } }); }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
                >
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span>New Lead</span>
                </button>
                <button
                  onClick={() => { setQuickMenuOpen(false); navigate("/deals", { state: { new: true } }); }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
                >
                  <Handshake className="h-4 w-4 text-emerald-500" />
                  <span>New Deal</span>
                </button>
                <button
                  onClick={() => { setQuickMenuOpen(false); navigate("/quotes/new"); }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
                >
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span>New Quote</span>
                </button>
                <button
                  onClick={() => { setQuickMenuOpen(false); navigate("/accounts", { state: { new: true } }); }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition"
                >
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span>New Company</span>
                </button>
              </div>
            )}
          </div>
        )}
        <div className="h-4 w-px bg-line my-auto mx-0.5" />

        {/* Notifications */}
        <NotificationBell />

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
              <p className="text-[10px] capitalize text-fg-muted">
                {user?.role ? user.role.replace("_", " ") : "Member"}
              </p>
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

