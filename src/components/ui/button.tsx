import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "xs" | "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet disabled:pointer-events-none disabled:opacity-40 rounded select-none";

    const variants = {
      primary: "bg-violet text-carbon-deep font-semibold hover:bg-violet-hover active:bg-violet-active shadow-sm",
      secondary: "bg-surface-elevated text-text-primary hover:bg-slate-panel border border-border-subtle hover:border-border-strong",
      outline: "border border-border-strong text-text-primary hover:bg-surface-elevated hover:border-border-strong",
      ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-elevated",
      destructive: "bg-status-error text-white hover:bg-status-error/90",
    };

    const sizes = {
      xs: "h-7 px-2.5 text-[11px] gap-1",
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-xs gap-2",
      lg: "h-10 px-5 text-sm gap-2",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
