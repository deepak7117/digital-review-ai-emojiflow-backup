import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-verified ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-[var(--radius-sm)] border bg-paper-raised px-3.5 py-2.5 text-sm text-ink shadow-xs placeholder:text-slate/70 transition-all focus:outline-none focus:ring-4 focus:ring-verified/15 ${
          invalid
            ? "border-danger focus:border-danger"
            : "border-border-strong focus:border-verified"
        } ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
