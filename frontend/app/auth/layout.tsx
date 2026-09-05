import type React from "react";
import StatusTag from "@/components/status-tag";

/** Same shell as the dashboard: gradient page, then the status strip on it. */
export default function AuthLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <>
      {children}
      <StatusTag />
    </>
  );
}
