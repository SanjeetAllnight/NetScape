import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "error" | "stale";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold";
  const variants = {
    default: "bg-surface-elevated text-brand-electric border border-border-strong",
    secondary: "bg-surface-panel text-text-secondary border border-border-subtle",
    outline: "text-text-primary border border-border-strong",
    success: "bg-status-success/15 text-status-success border border-status-success/30",
    warning: "bg-status-warning/15 text-status-warning border border-status-warning/30",
    error: "bg-status-error/15 text-status-error border border-status-error/30",
    stale: "bg-brand-cantaloupe/15 text-brand-cantaloupe border border-brand-cantaloupe/30",
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}

