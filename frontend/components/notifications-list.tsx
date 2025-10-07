"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Mail, Phone } from "lucide-react";
// import { Button as DayPickerButton } from "react-day-picker"
import { Button } from "@/components/ui/button";
import { Emoji, EmojiText } from "@/lib/emoji";

interface Notification {
  id: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  error_message?: string;
  sent_at: string;
  monitors?: {
    name: string;
    url: string;
  };
}

interface NotificationsListProps {
  notifications: Notification[];
}

export function NotificationsList({ notifications }: NotificationsListProps) {
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "found":
        return <Emoji char="🎯" />;
      case "not_found":
        return <Emoji char="❌" />;
      case "error":
        return <Emoji char="⚠️" />;
      default:
        return <Emoji char="🔔" />;
    }
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case "found":
        return "Pattern Match";
      case "not_found":
        return "Pattern Miss";
      case "error":
        return "Website Error";
      default:
        return "Notification";
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return (
          <Mail className="h-4 w-4 text-orange-600" data-testid="mail-icon" />
        );
      case "sms":
        return (
          <Phone className="h-4 w-4 text-orange-600" data-testid="phone-icon" />
        );
      default:
        return null;
    }
  };

  const getChannelName = (channel: string) => {
    switch (channel) {
      case "email":
        return "Email";
      case "sms":
        return "SMS";
      default:
        return "Unknown";
    }
  };

  const formatPhoneForPrivacy = (message: string, channel: string): string => {
    if (channel !== "sms") return message;

    // Extract phone number from message if it contains one
    // This is a simple approach - in production you might want more sophisticated parsing
    const phoneRegex = /\+\d{1,3}\d{10,14}/g;
    return message.replace(phoneRegex, (match) => {
      // Show first 3 digits and last 4 digits, mask the middle
      if (match.length > 7) {
        const start = match.substring(0, 3);
        const end = match.substring(match.length - 4);
        const middle = "*".repeat(match.length - 7);
        return `${start}${middle}${end}`;
      }
      return match;
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "sent":
        return "default";
      case "failed":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "";
    }
  };

  // Filter notifications based on selected channel
  const filteredNotifications = notifications.filter((notification) => {
    if (channelFilter === "all") return true;
    return notification.channel === channelFilter;
  });

  // Get channel counts for filter options
  const channelCounts = notifications.reduce((acc, notification) => {
    acc[notification.channel] = (acc[notification.channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-orange-700">
            Filter by channel:
          </span>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All channels ({notifications.length})
              </SelectItem>
              {channelCounts.email && (
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email ({channelCounts.email})
                  </div>
                </SelectItem>
              )}
              {channelCounts.sms && (
                <SelectItem value="sms">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    SMS ({channelCounts.sms})
                  </div>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length > 0
        ? (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <Card key={notification.id} className="border-orange-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg text-orange-800">
                          {getNotificationTitle(notification.type)}
                        </CardTitle>
                        <CardDescription className="text-orange-600">
                          {notification.monitors?.name} •{" "}
                          {formatDate(notification.sent_at)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={getStatusBadgeVariant(notification.status)}
                        className={getStatusBadgeClass(notification.status)}
                      >
                        {notification.status}
                      </Badge>
                      {getChannelIcon(notification.channel)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="bg-orange-50 rounded-md p-3">
                    <pre className="text-sm text-orange-800 whitespace-pre-wrap font-sans">
                    <EmojiText text={formatPhoneForPrivacy(notification.message, notification.channel)} />
                    </pre>
                  </div>

                  {/* Show error message if notification failed */}
                  {notification.status === "failed" &&
                    notification.error_message && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Delivery Failed
                        </span>
                      </div>
                      <p className="text-sm text-red-600 mt-1">
                        {notification.error_message}
                      </p>
                    </div>
                  )}

                  {/* Show channel-specific details */}
                  <div className="mt-3 flex items-center gap-4 text-sm text-orange-600">
                    <div className="flex items-center gap-1">
                      {getChannelIcon(notification.channel)}
                      <span className="capitalize">
                        {getChannelName(notification.channel)}
                      </span>
                    </div>

                    {notification.monitors?.url && (
                      <div>
                        <strong>Website:</strong>{" "}
                        <a
                          href={notification.monitors.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-700 hover:underline"
                        >
                          {notification.monitors.url}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
        : (
          /* No Results State */
          <div className="text-center py-16">
            <div className="text-6xl mb-6">
              <Emoji char="🔍" />
            </div>
            <h2 className="text-2xl font-bold text-orange-800 mb-4">
              No Notifications Found
            </h2>
            <p className="text-orange-600 mb-8 max-w-md mx-auto">
              {channelFilter === "all"
                ? "No notifications match your current filter."
                : `No ${channelFilter} notifications found.`}
            </p>
            {channelFilter !== "all" && (
              <Button
                variant="outline"
                onClick={() => setChannelFilter("all")}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                Show All Notifications
              </Button>
            )}
          </div>
        )}
    </div>
  );
}
