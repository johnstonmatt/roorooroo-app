# Admin SMS Costs API

This endpoint provides administrative access to SMS cost monitoring and management.

## Authentication

All admin endpoints require:
1. Valid Supabase JWT token in Authorization header: `Bearer <token>`
2. User must have admin role in their profile

## Endpoints

### GET /api/admin/sms-costs

Returns system-wide SMS cost statistics and alerts.

**Response:**
```json
{
  "systemStats": {
    "totalMonthlyCostUSD": 45.67,
    "totalMonthlyMessages": 6089,
    "activeUsers": 23,
    "averageCostPerUser": 1.99,
    "topUsers": [
      {
        "userId": "uuid",
        "costUSD": 12.34,
        "messageCount": 1645
      }
    ]
  },
  "alerts": [
    {
      "userId": "uuid",
      "currentCostUSD": 95.50,
      "limitUSD": 100.00,
      "percentageUsed": 95.5,
      "alertLevel": "critical"
    }
  ],
  "projections": [
    {
      "userId": "uuid",
      "currentMonthlyCost": 45.67,
      "projectedMonthlyCost": 89.23,
      "daysIntoMonth": 15,
      "isOnTrackToExceedLimit": false
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### POST /api/admin/sms-costs

Perform administrative actions on SMS cost data.

**Request Body:**
```json
{
  "action": "reset-monthly-costs" | "check-user-alert" | "get-user-projection",
  "userId": "uuid" // Required for check-user-alert and get-user-projection
}
```

**Actions:**

#### reset-monthly-costs
Resets monthly cost counters for all users (typically run at month start).

**Response:**
```json
{
  "success": true,
  "message": "Successfully reset monthly costs for 23 users",
  "resetCount": 23,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### check-user-alert
Check if a specific user has cost alerts.

**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "alert": {
    "userId": "uuid",
    "currentCostUSD": 95.50,
    "limitUSD": 100.00,
    "percentageUsed": 95.5,
    "alertLevel": "critical"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### get-user-projection
Get cost projection for a specific user.

**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "projection": {
    "currentMonthlyCost": 45.67,
    "projectedMonthlyCost": 89.23,
    "daysIntoMonth": 15,
    "isOnTrackToExceedLimit": false
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Responses

All endpoints return appropriate HTTP status codes with error details:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

Common status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (not admin user)
- `500` - Internal Server Error