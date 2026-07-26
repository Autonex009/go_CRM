import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Form controls. One `control` string shared by input/select/textarea, so they
 * can't drift apart and the browser reuses a single style rule for all of them.
 */
const control =
  "w-full rounded-md border border-neutral-200 bg-white px-md text-sm text-neutral-900 transition-colors duration-100 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-500/20";

const inputHeight = "h-[36px]";

function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-neutral-600">
      {children}
    </label>
  );
}

function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-danger-600">
      {children}
    </p>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, id, name, className = "", ...props },
  ref,
) {
  const inputId = id ?? name;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-xs">
      <Label htmlFor={inputId}>{label}</Label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`${control} ${inputHeight} ${className}`}
        {...props}
      />
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
});

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, id, name, children, className = "", ...props },
  ref,
) {
  const inputId = id ?? name;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-xs">
      <Label htmlFor={inputId}>{label}</Label>
      <select
        id={inputId}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`${control} ${inputHeight} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
});

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField({ label, error, id, name, className = "", ...props }, ref) {
    const inputId = id ?? name;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-xs">
        <Label htmlFor={inputId}>{label}</Label>
        <textarea
          id={inputId}
          name={name}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`${control} resize-y py-sm ${className}`}
          {...props}
        />
        {error && <ErrorText id={errorId}>{error}</ErrorText>}
      </div>
    );
  },
);
