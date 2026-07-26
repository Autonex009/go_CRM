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
  | "drag";

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
