import type React from "react";
import { cn } from "@/lib/utils";

/**
 * The chrome every signed-in page repeats: a bordered, translucent bar that
 * sits on the root layout's gradient. Only the frame lives here -- what goes
 * inside genuinely differs per page.
 */
export function DashboardHeader({
  children,
  sticky = false,
}: {
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        "border-b bg-surface-raised backdrop-blur-sm",
        sticky && "sticky top-0 z-50",
      )}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {children}
      </div>
    </header>
  );
}

/** The emoji + title + subtitle triple each header leads with. */
export function HeaderTitle({
  emoji,
  title,
  subtitle,
  size = "default",
}: {
  emoji: React.ReactNode;
  title: string;
  subtitle: string;
  size?: "default" | "lg";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={size === "lg" ? "text-3xl" : "text-2xl"}>{emoji}</div>
      <div>
        <h1
          className={cn(
            "font-bold text-foreground",
            size === "lg" ? "text-2xl" : "text-xl",
          )}
        >
          {title}
        </h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
