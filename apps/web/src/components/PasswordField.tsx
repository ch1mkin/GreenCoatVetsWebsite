"use client";

import { useId, useState, type ChangeEvent } from "react";

type Props = {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  name?: string;
  /** Full class list for the input (right padding for the eye is applied automatically). */
  inputClassName: string;
  /** Classes for the toggle button (theme-specific). */
  toggleClassName?: string;
};

/**
 * Password input with show/hide toggle for accessibility and UX.
 */
export function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  required,
  autoComplete = "current-password",
  name,
  inputClassName,
  toggleClassName = "text-on-surface-variant hover:bg-white/30 hover:text-on-background focus-visible:ring-primary/40",
}: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="relative w-full">
      <input
        id={id}
        name={name}
        className={`${inputClassName} pr-12`}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 focus:outline-none focus-visible:ring-2 ${toggleClassName}`}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={id}
        tabIndex={0}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
