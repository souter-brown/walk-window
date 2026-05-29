"use client";

import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { SafetyStatus } from "@/types/weather";

interface StatusBadgeProps {
  status: SafetyStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${STATUS_COLORS[status] ?? STATUS_COLORS.unsafe}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
