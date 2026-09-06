/**
 * Scheduling helpers shared by every place that creates, re-creates or removes
 * a monitor's pg_cron job.
 *
 * These were previously inline in the "new monitor" page, which meant nothing
 * else could reschedule a job consistently.
 */

/**
 * The pg_cron job name for a monitor. Must match exactly everywhere, since it
 * is the only handle we have on the scheduled job.
 */
export function monitorJobName(monitorId: string): string {
  return `monitor_check_${monitorId.replace(/-/g, "_")}`;
}

/**
 * Convert a check interval in seconds into a cron expression.
 *
 * pg_cron has a one-minute floor, and only divisors of 60 tile cleanly across
 * an hour, so intervals that do not divide evenly fall back to every 5 minutes
 * rather than drifting.
 */
export function monitorCronExpression(intervalSeconds: number): string {
  const minutes = Math.floor(intervalSeconds / 60);

  if (minutes <= 1) return "* * * * *";

  if (minutes < 60) {
    return 60 % minutes === 0 ? `*/${minutes} * * * *` : "*/5 * * * *";
  }

  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "0 * * * *" : `0 */${Math.min(hours, 12)} * * *`;
}
