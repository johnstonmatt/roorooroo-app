# Cron Job Management Utilities

This module provides utilities for managing Supabase cron jobs for monitor scheduling.

## Features

- **Cron Expression Generation**: Convert check intervals (in seconds) to valid cron expressions
- **Job Management**: Create, update, and delete monitor-specific cron jobs
- **Validation**: Comprehensive validation for cron job configurations and expressions
- **Error Handling**: Robust error handling with detailed error messages
- **Batch Operations**: Support for batch creation and deletion of cron jobs
- **Cleanup**: Utilities to clean up orphaned cron jobs

## Core Functions

### `createMonitorCronJob(config: CronJobConfig): Promise<CronJobResult>`

Creates a new cron job for a monitor.

```typescript
const result = await createMonitorCronJob({
  monitorId: '123e4567-e89b-12d3-a456-426614174000',
  userId: '987fcdeb-51a2-43d1-9f12-123456789abc',
  checkInterval: 300 // 5 minutes
})

if (result.success) {
  console.log(`Created job: ${result.jobName}`)
} else {
  console.error(`Failed: ${result.error}`)
}
```

### `updateMonitorCronJob(config: CronJobConfig): Promise<CronJobResult>`

Updates an existing cron job with new schedule.

### `deleteMonitorCronJob(monitorId: string): Promise<CronJobResult>`

Deletes a cron job for a monitor.

### `intervalToCronExpression(intervalSeconds: number): string`

Converts a check interval in seconds to a cron expression.

```typescript
intervalToCronExpression(300)   // "*/5 * * * *" (every 5 minutes)
intervalToCronExpression(3600)  // "0 * * * *" (every hour)
intervalToCronExpression(86400) // "0 0 * * *" (daily)
```

## Utility Functions

### `validateCronJobConfig(config: CronJobConfig): string[]`

Validates a cron job configuration and returns any validation errors.

### `isValidCronExpression(cronExpression: string): boolean`

Validates if a cron expression is properly formatted.

### `describeCronExpression(cronExpression: string): string`

Converts a cron expression to human-readable description.

### `getCronJobInfo(monitorId: string): Promise<CronJobInfo | null>`

Gets detailed information about a monitor's cron job.

### `cleanupOrphanedCronJobs(userId: string): Promise<CronJobResult>`

Cleans up cron jobs that exist but have no corresponding monitor.

## Batch Operations

### `batchCreateCronJobs(configs: CronJobConfig[]): Promise<CronJobResult[]>`

Creates multiple cron jobs with proper rate limiting.

### `batchDeleteCronJobs(monitorIds: string[]): Promise<CronJobResult[]>`

Deletes multiple cron jobs with proper rate limiting.

## Error Handling

All functions return structured results with success status and detailed error information:

```typescript
interface CronJobResult {
  success: boolean
  jobName?: string
  error?: string
  details?: string
}
```

## Database Functions

The utilities rely on PostgreSQL functions created by the migration:

- `create_monitor_cron_job(job_name, cron_schedule, monitor_id, user_id)`
- `update_monitor_cron_job(job_name, cron_schedule, monitor_id)`
- `delete_monitor_cron_job(job_name)`
- `check_cron_job_exists(job_name)`
- `list_user_cron_jobs(user_id)`
- `get_cron_job_info(job_name)`

## Testing

Run the test suite:

```bash
deno test --allow-read utils/cron.test.ts
```

## Requirements Satisfied

- **7.1**: Uses Supabase cron jobs for scheduling monitor checks
- **7.2**: Cron jobs call the appropriate Hono backend endpoints
- **7.4**: Comprehensive error handling and logging for cron job operations