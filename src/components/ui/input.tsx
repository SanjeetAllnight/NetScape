import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded border border-border-subtle bg-surface-input px-3 py-1 text-xs text-text-primary shadow-inner transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:border-violet focus-visible:ring-1 focus-visible:ring-violet disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
