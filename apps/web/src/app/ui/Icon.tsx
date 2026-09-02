import { memo } from "react";

/**
 * Hand-rolled icon set: 24×24, currentColor, single stroke path each.
 *
 * Deliberately not an icon library. lucide-react/react-icons pull 50–200 kB of
 * component wrappers for the dozen glyphs a portal actually uses, and tree
 * shaking only helps if every import site cooperates. These are ~200 bytes each
 * after minification.
 */
export type IconName =
  | "dashboard"
  | "leads"
  | "contacts"
  | "team"
  | "plus"
  | "search"
  | "close"
  | "menu"
  | "chevronLeft"
  | "logout"
  | "mail"
  | "phone"
  | "building"
  | "trend"
  | "check"
  | "drag"
  | "deals"
  | "sun"
  | "moon"
  | "monitor"
  | "printer"
  | "download"
  | "edit"
  | "arrowLeft"
  | "globe";

const PATHS: Record<IconName, string> = {
  dashboard: "M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z",
  leads: "M4 5h16M4 12h10M4 19h6",
  contacts:
    "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11l2 2 4-4",
  team: "M15 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M8.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 4.5a3.5 3.5 0 0 1 0 7M22 19v-1a4 4 0 0 0-3-3.87",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  close: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  chevronLeft: "m14 6-6 6 6 6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  mail: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 .5 9 6 9-6",
  phone:
    "M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z",
  building: "M4 21V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15M15 11h4a1 1 0 0 1 1 1v9M8 9h3M8 13h3M8 17h3",
  trend: "m3 17 6-6 4 4 8-8M21 7v6h-6",
  check: "m4 12 5 5L20 6",
  drag: "M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01",
  deals:
    "M12 3v18M16.5 7.5A3.5 3.5 0 0 0 13 5h-1.5a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6H11a3.5 3.5 0 0 1-3.5-2.5",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z",
  monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
  printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  arrowLeft: "M19 12H5M12 19l-7-7 7-7",
  globe: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z",
};


interface IconProps {
  name: IconName;
  /** Pixel size; 16 for inline, 18–20 for nav, 24 for feature. */
  size?: number;
  className?: string;
}

export const Icon = memo(function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
});
