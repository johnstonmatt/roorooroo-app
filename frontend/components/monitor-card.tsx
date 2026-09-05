"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BugPlay,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";
import { monitorCronExpression, monitorJobName } from "@/lib/monitor-schedule";
import { useState } from "react";
import Link from "next/link";

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  pattern: string;
  pattern_type: string;
  check_interval: number;
  is_active: boolean;
  last_checked: string | null;
  last_status: string;
  created_at: string;
  notification_channels: Array<{ type: string; address: string }>;
}

interface MonitorLog {
  id: string;
  status: string;
  response_time: number | null;
  error_message: string | null;
  content_snippet: string | null;
  checked_at: string;
}

interface MonitorCardProps {
  monitor: Monitor;
  onChanged?: () => Promise<void> | void;
}

export function MonitorCard({ monitor, onChanged }: MonitorCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<MonitorLog[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const supabase = createClient();

  const toggleActive = async () => {
    setIsLoading(true);
    const nextActive = !monitor.is_active;
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ is_active: nextActive })
        .eq("id", monitor.id);
      if (error) throw error;

      // Keep the pg_cron job in step with the monitor. Without this a paused
      // monitor keeps firing its job every interval indefinitely -- the check
      // returns early on is_active, but the invocation still happens.
      const jobName = monitorJobName(monitor.id);
      const { data: scheduled, error: cronError } = nextActive
        ? await supabase.rpc("create_monitor_cron_job", {
          job_name: jobName,
          cron_schedule: monitorCronExpression(monitor.check_interval),
          monitor_id: monitor.id,
          user_id: monitor.user_id,
        })
        : await supabase.rpc("delete_monitor_cron_job", { job_name: jobName });

      // These functions swallow their own exceptions and report failure by
      // returning false, so the return value matters as much as the error.
      if (cronError || scheduled === false) {
        console.error(
          `Monitor ${nextActive ? "resumed" : "paused"} but its schedule was ` +
            `not updated:`,
          cronError,
        );
      }

      if (onChanged) await onChanged();
    } catch (error) {
      console.error("Error toggling monitor:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMonitor = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this watcher? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      // Unschedule first. If the row is removed first and this fails, the job
      // is orphaned: it keeps firing forever against a monitor that no longer
      // exists, and nothing is left in the UI to clean it up.
      const jobName = monitorJobName(monitor.id);
      const { data: unscheduled, error: cronError } = await supabase.rpc(
        "delete_monitor_cron_job",
        { job_name: jobName },
      );
      if (cronError || unscheduled === false) {
        // Also returns false when there was simply no job to remove, which is
        // not distinguishable here -- so log it and still delete the monitor,
        // since leaving the row behind would not help either.
        console.warn(
          `No cron job was unscheduled for monitor ${monitor.id}:`,
          cronError,
        );
      }

      const { error } = await supabase
        .from("monitors")
        .delete()
        .eq("id", monitor.id);
      if (error) throw error;

      if (onChanged) await onChanged();
    } catch (error) {
      console.error("Error deleting monitor:", error);
      alert("Failed to delete watcher");
    } finally {
      setIsDeleting(false);
    }
  };

  // Debug affordance: exercises the whole pipeline end to end, including the
  // notification send, rather than only reporting whether the pattern matched.
  const debugCheck = async () => {
    setIsQueuing(true);
    try {
      // `force` makes the check notify even when the status has not changed,
      // without writing anything first. An earlier version armed this by
      // setting last_status to "pending"; that persisted, so a failed request
      // left the monitor primed to fire a bogus "setup" alert on its next
      // scheduled check.
      const result = await api.post("/check-endpoint", {
        monitor_id: monitor.id,
        force: true,
      });

      const data = result?.data ?? {};
      alert(
        [
          `Status: ${data.status ?? "unknown"}`,
          `Response time: ${data.responseTime ?? "n/a"}ms`,
          `Notification sent: ${data.didNotify ? "yes" : "no"}`,
          result?.message ? `\n${result.message}` : "",
        ].filter(Boolean).join("\n"),
      );

      // The check wrote new rows, so drop any cached history.
      setLogs(null);
      if (showHistory) await loadHistory();
      if (onChanged) await onChanged();
    } catch (error) {
      console.error("Error running debug check:", error);
      alert(
        `Debug check failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    } finally {
      setIsQueuing(false);
    }
  };

  const loadHistory = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("monitor_logs")
        .select(
          "id, status, response_time, error_message, content_snippet, checked_at",
        )
        .eq("monitor_id", monitor.id)
        .order("checked_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setLogs(data ?? []);
    } catch (error) {
      console.error("Error loading check history:", error);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && logs === null) await loadHistory();
  };

  const getStatusBadge = () => {
    switch (monitor.last_status) {
      case "found":
        return (
          <Badge className="bg-green-100 text-green-700">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            Match Found
          </Badge>
        );
      case "not_found":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            <span className="w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
            No Match Found
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-700">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
            Pending
          </Badge>
        );
    }
  };

  const getIntervalText = () => {
    const minutes = Math.floor(monitor.check_interval / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    return `${Math.floor(minutes / 60)}h`;
  };

  const formatLastChecked = () => {
    if (!monitor.last_checked) return "Never";
    const date = new Date(monitor.last_checked);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <Card
      className={`border-orange-200 ${!monitor.is_active ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg text-orange-800">
                {monitor.name}
              </CardTitle>
              {!monitor.is_active && <Badge variant="secondary">Paused</Badge>}
            </div>
            <CardDescription className="flex items-center gap-2 text-orange-600">
              <Globe className="h-4 w-4" />
              <span className="truncate">{monitor.url}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-orange-600 hover:text-orange-800"
              >
                <Link
                  href={monitor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={debugCheck}
              disabled={isQueuing}
              className="text-blue-600 hover:text-blue-800"
              title="Debug: run a check now and force a notification"
            >
              <BugPlay className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleActive}
              disabled={isLoading}
              className="text-orange-600 hover:text-orange-800"
            >
              {monitor.is_active
                ? <Pause className="h-4 w-4" />
                : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteMonitor}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Pattern Info */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-orange-600">Watching for:</span>
            <Badge variant="outline" className="text-xs">
              {monitor.pattern_type.replace("_", " ")}
            </Badge>
            <code className="bg-orange-50 text-orange-800 px-2 py-1 rounded text-xs">
              {monitor.pattern}
            </code>
          </div>

          {/* Status and Timing */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getStatusBadge()}
              <div className="flex items-center gap-1 text-sm text-orange-600">
                <Clock className="h-4 w-4" />
                <span>Every {getIntervalText()}</span>
              </div>
            </div>
            <div className="text-sm text-orange-600">
              Last checked: {formatLastChecked()}
            </div>
          </div>

          {/* Notifications */}
          {monitor.notification_channels &&
            monitor.notification_channels.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <span>🔔</span>
              <span>
                {monitor.notification_channels.length} notification
                {monitor.notification_channels.length !== 1 ? "s" : ""}{" "}
                configured
              </span>
            </div>
          )}

          {
            /* Check history -- monitor_logs is written on every check and is
              readable by the owner under RLS, but had no UI until now. */
          }
          <div className="border-t border-orange-100 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHistory}
              className="h-auto p-0 text-sm text-orange-600 hover:text-orange-800"
            >
              {showHistory
                ? <ChevronDown className="h-4 w-4 mr-1" />
                : <ChevronRight className="h-4 w-4 mr-1" />}
              Check history
            </Button>

            {showHistory && (
              <div className="mt-3 space-y-2">
                {logsLoading && (
                  <p className="text-sm text-orange-600">Fetching history...</p>
                )}

                {!logsLoading && logs !== null && logs.length === 0 && (
                  <p className="text-sm text-orange-600">
                    No checks recorded yet.
                  </p>
                )}

                {!logsLoading && logs?.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 text-xs bg-orange-50 rounded-md px-2 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {log.status}
                        </Badge>
                        <span className="text-orange-700">
                          {new Date(log.checked_at).toLocaleString()}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-red-600 mt-1 break-words">
                          {log.error_message}
                        </p>
                      )}
                      {log.content_snippet && (
                        <code className="block text-orange-800 mt-1 truncate">
                          {log.content_snippet}
                        </code>
                      )}
                    </div>
                    {log.response_time !== null && (
                      <span className="text-orange-600 whitespace-nowrap">
                        {log.response_time}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
