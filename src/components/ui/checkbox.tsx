"use client";

import { forwardRef, InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, id, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s/g, "-");

    return (
      <label htmlFor={checkboxId} className="inline-flex items-center cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className={`w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 ${className}`}
          {...props}
        />
        {label && (
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{label}</span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
