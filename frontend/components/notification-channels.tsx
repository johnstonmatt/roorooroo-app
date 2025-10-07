"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PhoneValidationResult,
  validatePhoneNumber,
} from "@/lib/phone-validation";

export interface NotificationChannel {
  type: "email" | "sms";
  address: string;
  id?: string; // Optional ID for tracking
}

export interface NotificationChannelsProps {
  channels: NotificationChannel[];
  onChange: (channels: NotificationChannel[]) => void;
  maxChannels?: number;
  maxEmailChannels?: number;
  maxSmsChannels?: number;
  className?: string;
  disabled?: boolean;
}

interface ChannelInputState {
  email: string;
  phone: string;
  emailError?: string;
  phoneError?: string;
  phoneValidation?: PhoneValidationResult;
}

export function NotificationChannels({
  channels = [],
  onChange,
  maxChannels = 10,
  maxEmailChannels = 5,
  maxSmsChannels = 5,
  className,
  disabled = false,
}: NotificationChannelsProps) {
  const [inputState, setInputState] = React.useState<ChannelInputState>({
    email: "",
    phone: "",
  });

  // Calculate current channel counts
  const emailChannels = channels.filter((c) => c.type === "email");
  const smsChannels = channels.filter((c) => c.type === "sms");
  const canAddEmail = emailChannels.length < maxEmailChannels &&
    channels.length < maxChannels;
  const canAddSms = smsChannels.length < maxSmsChannels &&
    channels.length < maxChannels;

  // Validate email format
  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return undefined;
  };

  // Check for duplicate channels
  const isDuplicateChannel = (
    type: "email" | "sms",
    address: string,
  ): boolean => {
    return channels.some((channel) =>
      channel.type === type &&
      channel.address.toLowerCase() === address.toLowerCase()
    );
  };

  // Add email channel
  const addEmailChannel = () => {
    const email = inputState.email.trim();
    const emailError = validateEmail(email);

    if (emailError) {
      setInputState((prev) => ({ ...prev, emailError }));
      return;
    }

    if (isDuplicateChannel("email", email)) {
      setInputState((prev) => ({
        ...prev,
        emailError: "This email is already added",
      }));
      return;
    }

    if (!canAddEmail) {
      setInputState((prev) => ({
        ...prev,
        emailError: `Maximum ${maxEmailChannels} email channels allowed`,
      }));
      return;
    }

    const newChannel: NotificationChannel = {
      type: "email",
      address: email,
      id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    onChange([...channels, newChannel]);
    setInputState((prev) => ({ ...prev, email: "", emailError: undefined }));
  };

  // Add SMS channel
  const addSmsChannel = () => {
    const phoneValidation = inputState.phoneValidation;

    if (!phoneValidation?.isValid || !phoneValidation.normalizedNumber) {
      setInputState((prev) => ({
        ...prev,
        phoneError: phoneValidation?.error ||
          "Please enter a valid phone number",
      }));
      return;
    }

    if (isDuplicateChannel("sms", phoneValidation.normalizedNumber)) {
      setInputState((prev) => ({
        ...prev,
        phoneError: "This phone number is already added",
      }));
      return;
    }

    if (!canAddSms) {
      setInputState((prev) => ({
        ...prev,
        phoneError: `Maximum ${maxSmsChannels} SMS channels allowed`,
      }));
      return;
    }

    const newChannel: NotificationChannel = {
      type: "sms",
      address: phoneValidation.normalizedNumber,
      id: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    onChange([...channels, newChannel]);
    setInputState((prev) => ({
      ...prev,
      phone: "",
      phoneError: undefined,
      phoneValidation: undefined,
    }));
  };

  // Remove channel
  const removeChannel = (index: number) => {
    const newChannels = channels.filter((_, i) => i !== index);
    onChange(newChannels);
  };

  // Handle email input change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setInputState((prev) => ({
      ...prev,
      email,
      emailError: undefined,
    }));
  };

  // Handle phone input change
  const handlePhoneChange = (
    value: string,
    validation: PhoneValidationResult,
  ) => {
    setInputState((prev) => ({
      ...prev,
      phone: value,
      phoneError: undefined,
      phoneValidation: validation,
    }));
  };

  // Handle Enter key press
  const handleEmailKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !disabled) {
      e.preventDefault();
      addEmailChannel();
    }
  };

  // Handle phone Enter key press
  const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !disabled) {
      e.preventDefault();
      addSmsChannel();
    }
  };

  // Format phone number for display
  const formatPhoneForDisplay = (phoneNumber: string): string => {
    const validation = validatePhoneNumber(phoneNumber);
    return validation.formattedNumber || phoneNumber;
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Notification Channels
          <Badge variant="secondary" className="text-xs">
            {channels.length}/{maxChannels}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Channel Input */}
        <div className="space-y-2">
          <Label htmlFor="email-input" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Notifications
            <Badge variant="outline" className="text-xs">
              {emailChannels.length}/{maxEmailChannels}
            </Badge>
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="email-input"
                type="email"
                placeholder="Enter email address"
                value={inputState.email}
                onChange={handleEmailChange}
                onKeyPress={handleEmailKeyPress}
                disabled={disabled}
                className={inputState.emailError ? "border-destructive" : ""}
              />
              {inputState.emailError && (
                <p className="mt-1 text-sm text-destructive">
                  {inputState.emailError}
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={addEmailChannel}
              disabled={disabled || !canAddEmail || !inputState.email.trim()}
              size="sm"
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* SMS Channel Input */}
        <div className="space-y-2">
          <Label htmlFor="phone-input" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            SMS Notifications
            <Badge variant="outline" className="text-xs">
              {smsChannels.length}/{maxSmsChannels}
            </Badge>
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <PhoneInput
                id="phone-input"
                value={inputState.phone}
                onChange={handlePhoneChange}
                onKeyDown={handlePhoneKeyDown}
                error={inputState.phoneError}
                disabled={disabled}
                placeholder="Enter phone number"
              />
            </div>
            <Button
              type="button"
              onClick={addSmsChannel}
              disabled={disabled || !canAddSms ||
                !inputState.phoneValidation?.isValid}
              size="sm"
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Channel List */}
        {channels.length > 0 && (
          <div className="space-y-2">
            <Label>Active Channels</Label>
            <div className="space-y-2">
              {channels.map((channel, index) => (
                <div
                  key={channel.id || `${channel.type}-${index}`}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {channel.type === "email"
                      ? <Mail className="h-4 w-4 text-blue-500" />
                      : <Phone className="h-4 w-4 text-green-500" />}
                    <div>
                      <p className="font-medium">
                        {channel.type === "email"
                          ? channel.address
                          : formatPhoneForDisplay(channel.address)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {channel.type} notification
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChannel(index)}
                    disabled={disabled}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channel Limits Info */}
        {(channels.length >= maxChannels ||
          emailChannels.length >= maxEmailChannels ||
          smsChannels.length >= maxSmsChannels) && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              {channels.length >= maxChannels
                ? `Maximum of ${maxChannels} total notification channels allowed.`
                : emailChannels.length >= maxEmailChannels
                ? `Maximum of ${maxEmailChannels} email channels allowed.`
                : `Maximum of ${maxSmsChannels} SMS channels allowed.`}
            </p>
          </div>
        )}

        {/* Empty State */}
        {channels.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p>No notification channels configured</p>
            <p className="text-sm">
              Add email or SMS channels to receive alerts
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
