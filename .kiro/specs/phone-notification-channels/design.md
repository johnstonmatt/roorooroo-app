# Design Document: Phone Number Notification Channels

## Overview

This design extends the existing notification system to support SMS notifications via phone numbers. The implementation will integrate with Twilio SMS service and maintain consistency with the current email notification architecture. The system will validate, normalize, and store phone numbers in the existing `notification_channels` JSONB field, and send SMS notifications through the same notification flow that currently handles email alerts.

## Architecture

### High-Level Architecture

The SMS notification feature will integrate seamlessly with the existing notification system:

1. **Frontend Components**: Extend monitor creation/editing forms to include phone number inputs
2. **Validation Layer**: Client and server-side phone number validation and normalization  
3. **Storage Layer**: Store phone numbers in existing `notification_channels` JSONB field
4. **Notification Service**: Extend existing notification logic to handle SMS via Twilio
5. **Logging**: Track SMS notifications in existing `notifications` table

### SMS Service Provider Selection

**Twilio** is selected as the SMS provider for the following reasons:
- Reliable global SMS delivery with 99.95% uptime SLA
- Comprehensive Node.js SDK with TypeScript support
- Competitive pricing ($0.0075 per SMS in US)
- Excellent documentation and developer experience
- Built-in phone number validation and formatting
- Delivery status webhooks for tracking
- Rate limiting and error handling capabilities

## Components and Interfaces

### 1. Phone Number Validation Utility

**Location**: `lib/phone-validation.ts`

```typescript
interface PhoneValidationResult {
  isValid: boolean
  normalizedNumber?: string
  formattedNumber?: string
  error?: string
}

export function validatePhoneNumber(phoneNumber: string): PhoneValidationResult
export function formatPhoneNumber(phoneNumber: string): string
```

**Responsibilities**:
- Validate phone number format using libphonenumber-js
- Normalize to E.164 format (+1234567890) for storage
- Format for display (e.g., "+1 (234) 567-8900")
- Handle international and domestic US formats

### 2. SMS Service Integration

**Location**: `lib/sms-service.ts`

```typescript
interface SMSMessage {
  to: string
  message: string
  monitorId: string
  userId: string
}

interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export class SMSService {
  async sendSMS(message: SMSMessage): Promise<SMSResult>
  async validateDelivery(messageId: string): Promise<boolean>
}
```

**Responsibilities**:
- Send SMS messages via Twilio API
- Handle rate limiting and retries
- Track delivery status
- Manage API credentials securely

### 3. Enhanced Notification Service

**Location**: `lib/notification-service.ts` (new abstraction)

```typescript
interface NotificationChannel {
  type: 'email' | 'sms'
  address: string
}

interface NotificationPayload {
  monitor: Monitor
  type: 'pattern_found' | 'pattern_lost' | 'error'
  contentSnippet?: string
}

export class NotificationService {
  async sendNotifications(payload: NotificationPayload, channels: NotificationChannel[]): Promise<void>
}
```

**Responsibilities**:
- Abstract notification sending logic
- Route to appropriate service (email/SMS)
- Handle failures and logging
- Maintain notification history

### 4. Frontend Components

#### Phone Number Input Component
**Location**: `components/ui/phone-input.tsx`

```typescript
interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
}

export function PhoneInput(props: PhoneInputProps): JSX.Element
```

#### Notification Channel Manager
**Location**: `components/notification-channels.tsx`

```typescript
interface NotificationChannel {
  type: 'email' | 'sms'
  address: string
}

interface NotificationChannelsProps {
  channels: NotificationChannel[]
  onChange: (channels: NotificationChannel[]) => void
}

export function NotificationChannels(props: NotificationChannelsProps): JSX.Element
```

## Data Models

### Enhanced Monitor Model

The existing `monitors` table requires no schema changes. The `notification_channels` JSONB field will store phone numbers alongside email addresses:

```json
{
  "notification_channels": [
    {
      "type": "email",
      "address": "user@example.com"
    },
    {
      "type": "sms", 
      "address": "+12345678900"
    }
  ]
}
```

### Notification History

The existing `notifications` table will track SMS notifications with `channel` field set to "sms":

```sql
INSERT INTO notifications (
  monitor_id,
  user_id, 
  type,
  channel,  -- "sms"
  message,
  status    -- "sent", "failed", "pending"
)
```

### Environment Configuration

New environment variables required:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Optional: Webhook URL for delivery status
TWILIO_WEBHOOK_URL=https://yourdomain.com/api/webhooks/sms-status
```

## Error Handling

### Phone Number Validation Errors
- **Invalid Format**: Display format requirements and examples
- **Unsupported Country**: Show list of supported countries
- **Duplicate Numbers**: Prevent adding same number multiple times

### SMS Delivery Errors
- **Rate Limiting**: Implement exponential backoff with jitter
- **Invalid Number**: Mark notification as failed, notify user
- **Service Unavailable**: Retry with circuit breaker pattern
- **Insufficient Credits**: Graceful degradation, admin notification

### Error Recovery Strategies
1. **Retry Logic**: 3 attempts with exponential backoff (1s, 4s, 16s)
2. **Circuit Breaker**: Disable SMS after 5 consecutive failures for 5 minutes
3. **Fallback**: Continue with email notifications if SMS fails
4. **Monitoring**: Log all failures for operational visibility

## Testing Strategy

### Unit Tests
- **Phone Validation**: Test various formats, edge cases, international numbers
- **SMS Service**: Mock Twilio API, test error scenarios
- **Notification Logic**: Verify correct routing and fallback behavior

### Integration Tests  
- **End-to-End Flow**: Create monitor with SMS → trigger notification → verify delivery
- **Database Integration**: Test notification logging and status updates
- **API Integration**: Test Twilio API integration with test credentials

### User Acceptance Tests
- **Monitor Creation**: Add phone numbers during monitor setup
- **Monitor Editing**: Add/remove phone numbers from existing monitors
- **Notification Receipt**: Verify SMS messages are received and formatted correctly
- **Error Handling**: Test invalid phone numbers and service failures

### Performance Tests
- **Rate Limiting**: Verify SMS rate limits are respected
- **Concurrent Notifications**: Test multiple simultaneous SMS sends
- **Database Performance**: Ensure notification logging doesn't impact response times

## Security Considerations

### API Key Management
- Store Twilio credentials in environment variables
- Use Vercel/deployment platform secret management
- Rotate keys regularly (quarterly)
- Monitor API usage for anomalies

### Phone Number Privacy
- Store phone numbers in normalized format only
- Implement data retention policies
- Allow users to delete phone numbers
- Audit phone number access

### Rate Limiting & Abuse Prevention
- Limit SMS notifications per user per hour (default: 50)
- Implement CAPTCHA for phone number verification
- Monitor for suspicious patterns (same number across accounts)
- Implement cost controls and alerts

### Input Validation
- Sanitize all phone number inputs
- Validate against known patterns
- Prevent SMS injection attacks
- Rate limit phone number changes

## Implementation Phases

### Phase 1: Core Infrastructure
- Phone number validation utility
- SMS service integration with Twilio
- Environment configuration
- Basic error handling

### Phase 2: Frontend Integration  
- Phone input component
- Monitor creation form updates
- Monitor editing interface
- Notification channel management

### Phase 3: Notification Enhancement
- Extend notification service for SMS
- Update monitor check logic
- SMS message formatting
- Delivery status tracking

### Phase 4: User Experience
- Notification history updates
- SMS-specific UI indicators
- Error message improvements
- Help documentation

### Phase 5: Production Readiness
- Comprehensive testing
- Performance optimization
- Security audit
- Monitoring and alerting