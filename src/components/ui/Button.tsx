import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-verified text-white shadow-sm hover:bg-verified-dark hover:shadow-premium active:scale-[0.98] disabled:hover:bg-verified disabled:hover:shadow-sm disabled:active:scale-100",
  secondary:
    "bg-paper-raised text-ink border border-border-strong shadow-xs hover:border-ink hover:shadow-sm active:scale-[0.98] disabled:hover:border-border-strong disabled:active:scale-100",
  ghost: "bg-transparent text-ink-soft hover:bg-ink/5 active:scale-[0.98] disabled:active:scale-100",
  danger: "bg-danger text-white shadow-sm hover:brightness-95 hover:shadow-md active:scale-[0.98] disabled:active:scale-100",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-sm px-3.5 py-1.5 rounded-[var(--radius-sm)]",
  md: "text-sm px-5 py-2.5 rounded-[var(--radius-md)]",
  lg: "text-base px-7 py-3.5 rounded-[var(--radius-md)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, className = "", children, disabled, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
