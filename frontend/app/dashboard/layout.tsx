import type React from "react";
import StatusTag from "@/components/status-tag";

/**
 * The signed-in shell. Pages here end on the layout gradient, so the status
 * strip sits directly on it with no surface of its own.
 */
export default function DashboardLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <>
      {children}
      <StatusTag />
    </>
  );
}
