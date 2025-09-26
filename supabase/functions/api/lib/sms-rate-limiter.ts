import { createServiceClient } from "./supabase.ts";
import { config, logger } from "./config.ts";

interface SMSUsage {
  userId: string;
  hourlyCount: number;
  dailyCount: number;
  monthlyCount: number;
  monthlyCostUSD: number;
  lastResetHour: Date;
  lastResetDay: Date;
  lastResetMonth: Date;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remainingHourly?: number;
  remainingDaily?: number;
  estimatedMonthlyCost?: number;
}

export class SMSRateLimiter {
  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    try {
      const usage = await this.getUserUsage(userId);
      const now = new Date();

      const updatedUsage = this.resetCountersIfNeeded(usage, now);

      if (updatedUsage.hourlyCount >= config.smsLimits.maxSMSPerUserPerHour) {
        return {
          allowed: false,
          reason:
            `Hourly SMS limit exceeded (${config.smsLimits.maxSMSPerUserPerHour} messages/hour)`,
          remainingHourly: 0,
        };
      }

      if (updatedUsage.dailyCount >= config.smsLimits.maxSMSPerUserPerDay) {
        return {
          allowed: false,
          reason:
            `Daily SMS limit exceeded (${config.smsLimits.maxSMSPerUserPerDay} messages/day)`,
          remainingDaily: 0,
        };
      }

      const projectedCost = updatedUsage.monthlyCostUSD +
        config.smsLimits.costPerSMSUSD;
      if (projectedCost > config.smsLimits.maxMonthlyCostUSD) {
        return {
          allowed: false,
          reason:
            `Monthly SMS cost limit would be exceeded ($${config.smsLimits.maxMonthlyCostUSD})`,
          estimatedMonthlyCost: projectedCost,
        };
      }

      return {
        allowed: true,
        remainingHourly: config.smsLimits.maxSMSPerUserPerHour -
          updatedUsage.hourlyCount,
        remainingDaily: config.smsLimits.maxSMSPerUserPerDay -
          updatedUsage.dailyCount,
        estimatedMonthlyCost: projectedCost,
      };
    } catch (error) {
      logger.error("Rate limit check failed:", error);
      return {
        allowed: false,
        reason: "Unable to verify SMS limits. Please try again later.",
      };
    }
  }

  async recordSMSUsage(userId: string): Promise<void> {
    try {
      const supabase = createServiceClient();
      const now = new Date();
      const cost = config.smsLimits.costPerSMSUSD;

      const { error } = await supabase
        .from("sms_usage")
        .upsert({
          user_id: userId,
          hourly_count: 1,
          daily_count: 1,
          monthly_count: 1,
          monthly_cost_usd: cost,
          last_reset_hour: this.getHourStart(now),
          last_reset_day: this.getDayStart(now),
          last_reset_month: this.getMonthStart(now),
          updated_at: now.toISOString(),
        }, {
          onConflict: "user_id",
          ignoreDuplicates: false,
        });

      if (error) {
        logger.error("Failed to record SMS usage:", error);
      }
    } catch (error) {
      logger.error("SMS usage recording error:", error);
    }
  }

  private async getUserUsage(userId: string): Promise<SMSUsage> {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("sms_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      const now = new Date();
      return {
        userId,
        hourlyCount: 0,
        dailyCount: 0,
        monthlyCount: 0,
        monthlyCostUSD: 0,
        lastResetHour: this.getHourStart(now),
        lastResetDay: this.getDayStart(now),
        lastResetMonth: this.getMonthStart(now),
      };
    }

    return {
      userId: data.user_id,
      hourlyCount: data.hourly_count || 0,
      dailyCount: data.daily_count || 0,
      monthlyCount: data.monthly_count || 0,
      monthlyCostUSD: data.monthly_cost_usd || 0,
      lastResetHour: new Date(data.last_reset_hour),
      lastResetDay: new Date(data.last_reset_day),
      lastResetMonth: new Date(data.last_reset_month),
    };
  }

  private resetCountersIfNeeded(usage: SMSUsage, now: Date): SMSUsage {
    const currentHour = this.getHourStart(now);
    const currentDay = this.getDayStart(now);
    const currentMonth = this.getMonthStart(now);

    let updated = { ...usage };

    if (currentHour > usage.lastResetHour) {
      updated.hourlyCount = 0;
      updated.lastResetHour = currentHour;
    }

    if (currentDay > usage.lastResetDay) {
      updated.dailyCount = 0;
      updated.lastResetDay = currentDay;
    }

    if (currentMonth > usage.lastResetMonth) {
      updated.monthlyCount = 0;
      updated.monthlyCostUSD = 0;
      updated.lastResetMonth = currentMonth;
    }

    return updated;
  }

  private getHourStart(date: Date): Date {
    const start = new Date(date);
    start.setMinutes(0, 0, 0);
    return start;
  }

  private getDayStart(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getMonthStart(date: Date): Date {
    const start = new Date(date);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  async getUserUsageStats(userId: string): Promise<SMSUsage | null> {
    try {
      const usage = await this.getUserUsage(userId);
      const now = new Date();
      return this.resetCountersIfNeeded(usage, now);
    } catch (error) {
      logger.error("Failed to get usage stats:", error);
      return null;
    }
  }
}
