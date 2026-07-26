import { memo, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/store";
import { useAppStore } from "../store";
import { Avatar, Icon, IconButton, type IconName } from "../ui";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/leads", label: "Leads", icon: "leads", end: false },
  { to: "/contacts", label: "Contacts", icon: "contacts", end: false },
  { to: "/team", label: "Team", icon: "team", end: false },
];

/** Page titles for the topbar, keyed by route. */
const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/contacts": "Contacts",
  "/team": "Team",
};

/**
 * Portal shell: fixed sidebar + topbar, content in the remaining space.
 *
 * Responsiveness is CSS-driven — Tailwind breakpoints decide whether the sidebar
 * is a rail or a drawer. No resize listeners, no width state, so a window resize
 * costs zero React renders.
 */
export default function AppLayout() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);

  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "go-CRM";

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Desktop rail: collapses to icons, width is the only animated property. */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-neutral-200 bg-white transition-[width] duration-150 lg:flex ${
          sidebarOpen ? "w-sidebarWidth" : "w-sidebarCollapsedWidth"
        }`}
      >
        <Sidebar collapsed={!sidebarOpen} />
      </aside>

      {/* Mobile drawer: same Sidebar, translated in. */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={closeDrawer}
          className={`absolute inset-0 bg-neutral-900/30 transition-opacity duration-150 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-sidebarWidth flex-col border-r border-neutral-200 bg-white shadow-lg transition-transform duration-150 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar collapsed={false} onNavigate={closeDrawer} />
        </aside>
      </div>

      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-150 ${
          sidebarOpen ? "lg:pl-sidebarWidth" : "lg:pl-sidebarCollapsedWidth"
        }`}
      >
        <Topbar title={title} />
        <main className="mx-auto w-full max-w-contentMaxWidth flex-1 px-md py-lg sm:px-lg">
          <Outlet />
        </main>
      </div>
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

  return (
    <>
      <div
        className={`flex h-topbarHeight shrink-0 items-center border-b border-neutral-200 ${
          collapsed ? "justify-center px-sm" : "justify-between px-md"
        }`}
      >
        {collapsed ? (
          <span className="flex h-[28px] w-[28px] items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
            g
          </span>
        ) : (
          <>
            <span className="flex items-center gap-sm">
              <span className="flex h-[28px] w-[28px] items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
                g
              </span>
              <span className="text-sm font-semibold tracking-[-0.01em]">go-CRM</span>
            </span>
            <IconButton
              name="chevronLeft"
              label="Collapse sidebar"
              onClick={toggleSidebar}
              className="hidden lg:inline-flex"
            />
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-[2px] p-sm">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex h-[36px] items-center gap-sm rounded-md text-sm font-medium transition-colors duration-100 ${
                collapsed ? "justify-center px-0" : "px-md"
              } ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`
            }
          >
            <Icon name={item.icon} size={17} />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {collapsed && (
        <div className="p-sm">
          <IconButton name="menu" label="Expand sidebar" onClick={toggleSidebar} />
        </div>
      )}
    </>
  );
});

const Topbar = memo(function Topbar({ title }: { title: string }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);

  const onSignOut = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const label = user?.name?.trim() || user?.email || "";

  return (
    // `sticky` keeps the bar in flow, so it never overlaps content or needs a
    // spacer element the way `fixed` would.
    <header className="sticky top-0 z-20 flex h-topbarHeight shrink-0 items-center gap-md border-b border-neutral-200 bg-white/90 px-md backdrop-blur sm:px-lg">
      <IconButton
        name="menu"
        label="Open menu"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden"
      />
      <h1 className="truncate text-sm font-semibold tracking-[-0.01em]">{title}</h1>

      <div className="ml-auto flex items-center gap-sm">
        {label && (
          <span className="hidden text-xs text-neutral-500 sm:inline" title={user?.email}>
            {label}
          </span>
        )}
        {label && <Avatar name={label} title={user?.email} size="sm" />}
        <IconButton name="logout" label="Sign out" onClick={onSignOut} />
      </div>
    </header>
  );
});
