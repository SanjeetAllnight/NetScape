import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "error"
    | "stale"
    | "info"
    | "violet";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium tracking-tight select-none";
  const variants = {
    default: "bg-violet/10 text-violet border border-violet/30",
    secondary: "bg-surface-elevated text-text-secondary border border-border-subtle",
    outline: "text-text-primary border border-border-strong",
    success: "bg-status-success/15 text-status-success border border-status-success/30",
    warning: "bg-status-warning/15 text-status-warning border border-status-warning/30",
    error: "bg-status-error/15 text-status-error border border-status-error/30",
    stale: "bg-status-warning/15 text-status-warning border border-status-warning/30",
    info: "bg-status-info/15 text-status-info border border-status-info/30",
    violet: "bg-violet/10 text-violet border border-violet/30",
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}
