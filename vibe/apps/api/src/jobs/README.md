# Jobs Module

This module provides NestJS-based SSE (Server-Sent Events) log streaming for VIBE jobs.

## Overview

The Jobs module consists of:
- **JobsController**: Provides the SSE endpoint for streaming logs
- **JobsService**: Manages log emitters and polling for job events
- **JobsModule**: NestJS module that ties everything together

## Usage

### 1. Import the JobsModule

Add the JobsModule to your NestJS application:

```typescript
import { Module } from '@nestjs/common';
import { JobsModule } from './jobs';

@Module({
  imports: [JobsModule],
})
export class AppModule {}
```

### 2. Subscribe to Job Logs

The SSE endpoint is available at `/jobs/:id/logs`. Frontend clients can subscribe to it:

```javascript
// JavaScript/TypeScript Frontend
const eventSource = new EventSource('http://localhost:3001/jobs/abc123/logs');

eventSource.onmessage = (event) => {
  const { log } = JSON.parse(event.data);
  console.log('New log:', log);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

```bash
# Using curl
curl -N http://localhost:3001/jobs/abc123/logs
```

### 3. Log Format

Each log event is sent as:

```json
{
  "data": "{\"log\": {\"event_id\": 123, \"task_id\": \"abc123\", \"event_message\": \"Task started\", \"severity\": \"info\", \"event_time\": 1234567890}}"
}
```

The log object contains:
- `event_id`: Unique event identifier
- `task_id`: Job/task identifier
- `event_message`: The log message
- `severity`: One of 'info', 'error', 'success', 'warning'
- `event_time`: Unix timestamp

## Architecture

### JobsService

The `JobsService` manages event emitters for each job:

```typescript
@Injectable()
export class JobsService {
  getLogEmitter(jobId: string): EventEmitter;
  emitLog(jobId: string, logData: any): void;
}
```

- **getLogEmitter(jobId)**: Returns an EventEmitter for the specified job. If one doesn't exist, it creates it and starts polling for logs.
- **emitLog(jobId, logData)**: Manually emit a log event for a job (optional, for direct log injection).

### JobsController

The `JobsController` provides the SSE endpoint:

```typescript
@Controller('jobs')
export class JobsController {
  @Sse(':id/logs')
  streamLogs(@Param('id') id: string): Observable<MessageEvent>;
}
```

- **@Sse(':id/logs')**: NestJS decorator for Server-Sent Events
- Returns an Observable that streams log events as MessageEvent objects

## Integration with Existing Express API

The Jobs module is designed to work alongside the existing Express API. You have two options:

### Option 1: Run NestJS alongside Express (Recommended)

Create a separate NestJS application that runs on a different port or path:

```typescript
// nest-app.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3002); // Different port
}
bootstrap();
```

### Option 2: Use NestJS with Express Adapter

Use the Express adapter to mount NestJS routes on the existing Express app:

```typescript
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { JobsModule } from './jobs';
import express from 'express';

const app = express();
// ... existing Express setup ...

async function bootstrapNest() {
  const nestApp = await NestFactory.create(
    JobsModule,
    new ExpressAdapter(app)
  );
  await nestApp.init();
}

bootstrapNest();
```

## Testing

Test the SSE endpoint using curl:

```bash
# Stream logs for a specific job
curl -N http://localhost:3001/jobs/your-job-id/logs

# Example output:
# data: {"log":{"event_id":1,"task_id":"abc123","event_message":"Task queued","severity":"info","event_time":1234567890}}
# 
# data: {"log":{"event_id":2,"task_id":"abc123","event_message":"Building context","severity":"info","event_time":1234567891}}
```

## Notes

- The JobsService polls the database every 1 second for new events
- Emitters are automatically cleaned up 60 seconds after a job completes
- The SSE connection remains open until the job completes or the client disconnects
- Uses RxJS for reactive stream handling
