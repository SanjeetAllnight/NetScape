import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-electric disabled:pointer-events-none disabled:opacity-50 rounded";

    const variants = {
      primary: "bg-brand-electric text-white hover:bg-brand-electric/90",
      secondary: "bg-surface-elevated text-text-primary hover:bg-surface-elevated/80",
      outline: "border border-border-strong text-text-primary hover:bg-surface-elevated",
      ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-panel",
      destructive: "bg-status-error text-white hover:bg-status-error/90",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 text-sm",
      lg: "h-10 px-5 text-base",
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
