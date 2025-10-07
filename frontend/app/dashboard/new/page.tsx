"use client";

import React from "react";

import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/sign-out-button";
import {
  type NotificationChannel,
  NotificationChannels,
} from "@/components/notification-channels";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewMonitorPage() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [pattern, setPattern] = useState("");
  const [patternType, setPatternType] = useState("contains");
  const [checkInterval, setCheckInterval] = useState("300");
  const [notificationChannels, setNotificationChannels] = useState<
    NotificationChannel[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate URL
      try {
        new URL(url);
      } catch {
        throw new Error("Please enter a valid URL");
      }

      // Validate required fields
      if (!name.trim()) {
        throw new Error("Monitor name is required");
      }
      if (!pattern.trim()) {
        throw new Error("Pattern to watch is required");
      }

      // Validate notification channels
      if (notificationChannels.length === 0) {
        throw new Error("At least one notification channel is required");
      }

      // Prepare notification channels for database
      const channelsForDb = notificationChannels.map((channel) => ({
        type: channel.type,
        address: channel.address.trim(),
      }));

      // Create monitor using the new API endpoint
      await api.post("/monitors", {
        name: name.trim(),
        url: url.trim(),
        pattern: pattern.trim(),
        pattern_type: patternType,
        check_interval: Number.parseInt(checkInterval),
        notification_channels: channelsForDb,
      });

      router.push("/dashboard");
    } catch (error: unknown) {
      if (
        (error instanceof ApiError && error.status === 401) ||
        (error instanceof Error && error.message.includes("401"))
      ) {
        router.push("/auth/login");
        return;
      }
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="border-b border-orange-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-orange-700"
            >
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="text-2xl">🐕</div>
              <div>
                <h1 className="text-xl font-bold text-orange-800">
                  New Watcher
                </h1>
                <p className="text-xs text-orange-600">
                  Set up a new website monitor
                </p>
              </div>
            </div>
          </div>
          <SignOutButton className="border-orange-300 text-orange-700" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-orange-200 shadow-lg">
            <CardHeader className="text-center">
              <div className="text-4xl mb-4">👀</div>
              <CardTitle className="text-2xl text-orange-800">
                Create a New Watcher
              </CardTitle>
              <CardDescription className="text-orange-600">
                Tell your faithful pup what to watch for on the web
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Monitor Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-orange-700 font-medium">
                    Watcher Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="e.g., iPhone 15 Stock Check"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-orange-200 focus:border-orange-400"
                  />
                  <p className="text-xs text-orange-600">
                    Give your watcher a memorable name
                  </p>
                </div>

                {/* Website URL */}
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-orange-700 font-medium">
                    Website URL
                  </Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/product-page"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="border-orange-200 focus:border-orange-400"
                  />
                  <p className="text-xs text-orange-600">
                    The webpage you want to monitor
                  </p>
                </div>

                {/* Pattern to Watch */}
                <div className="space-y-2">
                  <Label
                    htmlFor="pattern"
                    className="text-orange-700 font-medium"
                  >
                    What to Watch For
                  </Label>
                  <Textarea
                    id="pattern"
                    placeholder="e.g., Buy Now, In Stock, Available"
                    required
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    className="border-orange-200 focus:border-orange-400 min-h-[80px]"
                  />
                  <p className="text-xs text-orange-600">
                    Text or pattern that should trigger an alert
                  </p>
                </div>

                {/* Pattern Type */}
                <div className="space-y-2">
                  <Label className="text-orange-700 font-medium">
                    Pattern Type
                  </Label>
                  <Select value={patternType} onValueChange={setPatternType}>
                    <SelectTrigger className="border-orange-200 focus:border-orange-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains Text</SelectItem>
                      <SelectItem value="not_contains">
                        Does Not Contain
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {patternType === "contains" && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        Alert when text appears
                      </Badge>
                    )}
                    {patternType === "not_contains" && (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-700"
                      >
                        Alert when text disappears
                      </Badge>
                    )}
                    {patternType === "regex" && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700"
                      >
                        Advanced pattern matching
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Check Interval */}
                <div className="space-y-2">
                  <Label className="text-orange-700 font-medium">
                    Check Frequency
                  </Label>
                  <Select
                    value={checkInterval}
                    onValueChange={setCheckInterval}
                  >
                    <SelectTrigger className="border-orange-200 focus:border-orange-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300">Every 5 minutes</SelectItem>
                      <SelectItem value="900">Every 15 minutes</SelectItem>
                      <SelectItem value="1800">Every 30 minutes</SelectItem>
                      <SelectItem value="3600">Every hour</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-orange-600">
                    How often should we check for changes?
                  </p>
                </div>

                {/* Notification Channels */}
                <div className="space-y-2">
                  <Label className="text-orange-700 font-medium">
                    Notification Channels
                  </Label>
                  <NotificationChannels
                    channels={notificationChannels}
                    onChange={setNotificationChannels}
                    maxChannels={5}
                    maxEmailChannels={3}
                    maxSmsChannels={3}
                    className="border-orange-200"
                  />
                  <p className="text-xs text-orange-600">
                    Add email and SMS channels to receive alerts when patterns
                    are detected
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={isLoading || notificationChannels.length === 0}
                  >
                    {isLoading ? "Creating Watcher..." : "🐕 Start Watching"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    className="border-orange-300 text-orange-700 bg-transparent"
                  >
                    <Link href="/dashboard">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card className="mt-8 border-orange-200">
            <CardHeader>
              <CardTitle className="text-lg text-orange-800 flex items-center gap-2">
                <span>💡</span>
                Tips for Better Watching
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-orange-700">
              <div>
                <strong>URL Tips:</strong>{" "}
                Use the exact page URL where the content appears. Avoid
                redirects when possible.
              </div>
              <div>
                <strong>Pattern Tips:</strong>{" "}
                Be specific but not too narrow. &quot;Buy Now&quot; is better
                than &quot;Buy Now - Free Shipping&quot;.
              </div>
              <div>
                <strong>Notifications:</strong>{" "}
                Add both email and SMS channels for reliable alerts. Phone
                numbers are validated and formatted automatically.
              </div>
              <div>
                <strong>Frequency:</strong>{" "}
                More frequent checks use more resources. 5-15 minutes is usually
                perfect.
              </div>
              <div>
                <strong>Testing:</strong>{" "}
                Start with a longer interval and adjust based on how often the
                site actually changes.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
