import { forwardRef, memo } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

/**
 * Variant styles as a static lookup, not a runtime string builder.
 *
 * These are plain constants so Tailwind's scanner sees every class literally and
 * the browser reuses the same style rules across every button on the page —
 * nothing is computed per render.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  secondary:
    "bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 active:bg-neutral-100",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "bg-white text-danger-600 border border-danger-500/30 hover:bg-danger-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-[30px] px-md text-xs gap-xs",
  md: "h-[36px] px-md text-sm gap-sm",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-70";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}

export function buttonClass({
  variant = "primary",
  size = "md",
  className = "",
}: Pick<CommonProps, "variant" | "size" | "className">) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, children, className, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});

type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>;

/** Same chrome for a real anchor — used by the SSO buttons, which must navigate. */
export const LinkButton = memo(function LinkButton({
  variant = "secondary",
  size,
  icon,
  children,
  className,
  ...props
}: LinkButtonProps) {
  return (
    <a className={buttonClass({ variant, size, className })} {...props}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </a>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName;
  /** Required: an icon-only control needs an accessible name. */
  label: string;
  variant?: Variant;
}

export const IconButton = memo(function IconButton({
  name,
  label,
  variant = "ghost",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${BASE} ${VARIANTS[variant]} h-[32px] w-[32px] shrink-0 ${className}`}
      {...props}
    >
      <Icon name={name} size={16} />
    </button>
  );
});
