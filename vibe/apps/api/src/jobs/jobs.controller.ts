import { Controller, Param, Sse } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Observable, fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';

@Controller('jobs')
export class JobsController {

  constructor(private readonly jobsService: JobsService) {}

  /** SSE endpoint — frontend subscribes to /jobs/:id/logs */
  @Sse(':id/logs')
  streamLogs(@Param('id') id: string): Observable<MessageEvent> {
    const emitter = this.jobsService.getLogEmitter(id);
    return fromEvent(emitter, 'log').pipe(
      map((data) => {
        try {
          // Pass the event directly — frontend expects raw log events or
          // { type: 'complete', state } without an extra wrapping layer
          return { data: JSON.stringify(JSON.parse(data as string)) } as MessageEvent;
        } catch {
          return null;
        }
      }),
      filter((event): event is MessageEvent => event !== null)
    );
  }
}
