import { memo, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { endSession } from "../auth/session";
import { useAuthStore } from "../auth/store";
import { useWorkspaceSync } from "../org/workspace";
import { useAppStore } from "../store";
import { Avatar, Icon, IconButton, ThemeToggle, type IconName } from "../ui";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/leads", label: "Leads", icon: "leads", end: false },
  { to: "/deals", label: "Deals", icon: "deals", end: false },
  { to: "/quotes", label: "Quotes", icon: "deals", end: false },
  { to: "/invoices", label: "Invoices", icon: "building", end: false },
  { to: "/accounts", label: "Accounts", icon: "building", end: false },
  { to: "/contacts", label: "Contacts", icon: "contacts", end: false },
  { to: "/team", label: "Team", icon: "team", end: false },
];

/** Page titles for the topbar, derived from the nav so the two can't drift. */
const TITLES: Record<string, string> = Object.fromEntries(
  NAV.map((item) => [item.to, item.label]),
);

/**
 * Portal shell: fixed sidebar + topbar, content in the remaining space.
 *
 * Responsiveness is CSS-driven — Tailwind breakpoints decide whether the sidebar
 * is a rail or a drawer. No resize listeners, no width state, so a window resize
 * costs zero React renders.
 */
export default function AppLayout() {
  // Loads the workspace once (name + currency) and hydrates the store every
  // money-formatting component reads from.
  useWorkspaceSync();

  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const closeDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);

  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "go-CRM";

  return (
    <div className="min-h-screen bg-canvas text-fg">
      {/* Desktop rail: collapses to icons, width is the only animated property. */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-150 lg:flex ${
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
          className={`absolute inset-0 bg-overlay/40 transition-opacity duration-150 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-sidebarWidth flex-col border-r border-line bg-surface shadow-lg transition-transform duration-150 ${
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
        className={`flex h-topbarHeight shrink-0 items-center border-b border-line ${
          collapsed ? "justify-center px-sm" : "justify-between px-md"
        }`}
      >
        {collapsed ? (
          <span className="flex h-[28px] w-[28px] items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
            g
          </span>
        ) : (
          <>
            <span className="flex items-center gap-sm">
              <span className="flex h-[28px] w-[28px] items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
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
                  ? "bg-accent-soft text-accent-on"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg"
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

  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);

  const onSignOut = useCallback(async () => {
    // Revokes the refresh token server-side, so the session is dead even if a
    // copy of the cookie survives somewhere.
    await endSession();
    navigate("/login", { replace: true });
  }, [navigate]);

  const label = user?.name?.trim() || user?.email || "";

  return (
    // `sticky` keeps the bar in flow, so it never overlaps content or needs a
    // spacer element the way `fixed` would.
    <header className="sticky top-0 z-20 flex h-topbarHeight shrink-0 items-center gap-md border-b border-line bg-surface/85 px-md backdrop-blur sm:px-lg">
      <IconButton
        name="menu"
        label="Open menu"
        onClick={() => setDrawerOpen(true)}
        className="lg:hidden"
      />
      <h1 className="truncate text-sm font-semibold tracking-[-0.01em]">{title}</h1>

      <div className="ml-auto flex items-center gap-sm">
        <ThemeToggle />
        {label && (
          <span className="hidden text-xs text-fg-muted sm:inline" title={user?.email}>
            {label}
          </span>
        )}
        {label && <Avatar name={label} title={user?.email} size="sm" />}
        <IconButton name="logout" label="Sign out" onClick={onSignOut} />
      </div>
    </header>
  );
});
