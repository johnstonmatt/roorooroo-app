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
  Clock,
  ExternalLink,
  Globe,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

interface Monitor {
  id: string;
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

interface MonitorCardProps {
  monitor: Monitor;
  onChanged?: () => Promise<void> | void;
}

export function MonitorCard({ monitor, onChanged }: MonitorCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const supabase = createClient();

  const toggleActive = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ is_active: !monitor.is_active })
        .eq("id", monitor.id);
      if (error) throw error;
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
      const { error } = await supabase
        .from("monitors")
        .delete()
        .eq("id", monitor.id);
      if (error) throw error;
      // Best-effort: unschedule associated cron job
      try {
        const jobName = `monitor_check_${monitor.id.replace(/-/g, "_")}`;
        await supabase.rpc("delete_monitor_cron_job", { job_name: jobName });
      } catch {}
      if (onChanged) await onChanged();
    } catch (error) {
      console.error("Error deleting monitor:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const queueMonitor = async () => {
    setIsQueuing(true);
    try {
      const { error } = await supabase
        .from("monitors")
        .update({ last_status: "pending" })
        .eq("id", monitor.id);
      if (error) throw error;
      if (onChanged) await onChanged();
    } catch (error) {
      console.error("Error queueing monitor recheck:", error);
      alert("Failed to queue recheck");
    } finally {
      setIsQueuing(false);
    }
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
              onClick={queueMonitor}
              disabled={isQueuing}
              className="text-blue-600 hover:text-blue-800"
              title="Queue recheck"
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
        </div>
      </CardContent>
    </Card>
  );
}
