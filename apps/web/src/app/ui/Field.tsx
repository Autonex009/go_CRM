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
  "w-full rounded-md border border-line bg-surface px-md text-sm text-fg transition-colors duration-100 placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 aria-[invalid=true]:border-bad-solid aria-[invalid=true]:ring-bad-solid/25";

const inputHeight = "h-[36px]";

function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted">
      {children}
    </label>
  );
}

function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-bad-fg">
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
