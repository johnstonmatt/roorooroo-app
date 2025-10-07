/**
 * Supabase cron job management utilities
 * Handles creation, updating, and deletion of cron jobs for monitor scheduling
 */

import { createServiceClient } from "./supabase.ts";

export interface CronJobConfig {
  monitorId: string;
  checkInterval: number; // seconds
  userId: string;
}

export interface CronJobInfo {
  jobName: string;
  cronExpression: string;
  monitorId: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface CronJobResult {
  success: boolean;
  jobName?: string;
  error?: string;
  details?: string;
}

export function intervalToCronExpression(intervalSeconds: number): string {
  if (typeof intervalSeconds !== "number" || intervalSeconds < 60) {
    throw new Error("Check interval must be at least 60 seconds");
  }

  const minutes = Math.floor(intervalSeconds / 60);

  if (minutes < 1) {
    return "* * * * *";
  } else if (minutes === 1) {
    return "* * * * *";
  } else if (minutes < 60) {
    if (60 % minutes === 0) {
      return `*/${minutes} * * * *`;
    } else {
      const closestInterval = findClosestDivisibleInterval(minutes);
      return `*/${closestInterval} * * * *`;
    }
  } else {
    const hours = Math.floor(minutes / 60);
    if (hours === 1) {
      return "0 * * * *";
    } else if (hours < 24) {
      if (24 % hours === 0) {
        return `0 */${hours} * * *`;
      } else {
        const closestInterval = findClosestDivisibleHourInterval(hours);
        return `0 */${closestInterval} * * *`;
      }
    } else {
      const days = Math.floor(hours / 24);
      if (days === 1) {
        return "0 0 * * *";
      } else if (days <= 7) {
        return "0 0 * * *";
      } else {
        return "0 0 * * *";
      }
    }
  }
}

function findClosestDivisibleInterval(minutes: number): number {
  const divisors = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30];
  let closest = 1;
  let minDiff = Math.abs(minutes - 1);

  for (const divisor of divisors) {
    const diff = Math.abs(minutes - divisor);
    if (diff < minDiff) {
      minDiff = diff;
      closest = divisor;
    }
  }

  return closest;
}

function findClosestDivisibleHourInterval(hours: number): number {
  const divisors = [1, 2, 3, 4, 6, 8, 12];
  let closest = 1;
  let minDiff = Math.abs(hours - 1);

  for (const divisor of divisors) {
    const diff = Math.abs(hours - divisor);
    if (diff < minDiff) {
      minDiff = diff;
      closest = divisor;
    }
  }

  return closest;
}

export function generateCronJobName(monitorId: string): string {
  return `monitor_check_${monitorId.replace(/-/g, "_")}`;
}

export async function createMonitorCronJob(
  config: CronJobConfig,
): Promise<CronJobResult> {
  try {
    const validationErrors = validateCronJobConfig(config);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: "Validation failed",
        details: validationErrors.join(", "),
      };
    }

    const supabase = createServiceClient();
    const cronExpression = intervalToCronExpression(config.checkInterval);
    const jobName = generateCronJobName(config.monitorId);

    const exists = await cronJobExists(config.monitorId);
    if (exists) {
      return {
        success: false,
        jobName,
        error: "Cron job already exists",
        details:
          `Job ${jobName} already exists for monitor ${config.monitorId}`,
      };
    }

    const { error } = await supabase.rpc("create_monitor_cron_job", {
      job_name: jobName,
      cron_schedule: cronExpression,
      monitor_id: config.monitorId,
      user_id: config.userId,
    });

    if (error) {
      console.error("Failed to create cron job:", error);
      return {
        success: false,
        jobName,
        error: "Database error",
        details: error.message,
      };
    }

    console.log(`Created cron job ${jobName} with schedule ${cronExpression}`);

    return {
      success: true,
      jobName,
      details: `Created cron job with schedule: ${cronExpression}`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteMonitorCronJob(
  monitorId: string,
): Promise<CronJobResult> {
  try {
    if (!monitorId) return { success: false, error: "Invalid monitorId" };
    const supabase = createServiceClient();
    const jobName = generateCronJobName(monitorId);

    const { error } = await supabase.rpc("delete_monitor_cron_job", {
      job_name: jobName,
    });

    if (error) {
      console.error("Failed to delete cron job:", error);
      return {
        success: false,
        jobName,
        error: "Database error",
        details: error.message,
      };
    }

    console.log(`Deleted cron job ${jobName}`);
    return { success: true, jobName };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function cronJobExists(monitorId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const jobName = generateCronJobName(monitorId);

    // Use RPC that queries pg_cron (cron.job) instead of a non-existent table
    const { data, error } = await supabase.rpc("check_cron_job_exists", {
      job_name: jobName,
    });

    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export function validateCronJobConfig(config: CronJobConfig): string[] {
  const errors: string[] = [];

  if (!config.monitorId || typeof config.monitorId !== "string") {
    errors.push("Invalid monitorId");
  }

  if (
    !config.checkInterval ||
    typeof config.checkInterval !== "number" ||
    config.checkInterval < 60
  ) {
    errors.push("checkInterval must be at least 60 seconds");
  }

  if (!config.userId || typeof config.userId !== "string") {
    errors.push("Invalid userId");
  }

  return errors;
}
