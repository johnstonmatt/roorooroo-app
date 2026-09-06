import type React from "react";
import StatusTag from "@/components/status-tag";

/**
 * The signed-out shell: a centred column on the root layout's gradient, then
 * the status strip. Every auth page used to restate this frame, including a
 * second gradient of its own that painted over the root one.
 */
export default function AuthLayout(
  { children }: { children: React.ReactNode },
) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <StatusTag className="pb-4" />
    </div>
  );
}
