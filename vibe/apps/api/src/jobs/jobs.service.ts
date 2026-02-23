import { Injectable } from '@nestjs/common';
import { storage } from '../storage';
import { Observable, Observer } from 'rxjs';
import { LogEmitter } from './log-emitter';

@Injectable()
export class JobsService {
  private logEmitters = new Map<string, LogEmitter>();
  private pollIntervals = new Map<string, NodeJS.Timeout>();
  /**
   * Create an observable that streams logs for a specific job
   */
  getLogStream(jobId: string): Observable<any> {
    return new Observable((observer: Observer<any>) => {
      let lastEventTime = Date.now(); // Start from current time if no existing events
      let pollInterval: NodeJS.Timeout;
      
      // Send existing logs immediately
      const existingEvents = storage.getTaskEvents(jobId);
      if (existingEvents.length > 0) {
        existingEvents.forEach(event => {
          observer.next(event);
        });
        // Update lastEventTime to the most recent event
        lastEventTime = existingEvents[existingEvents.length - 1].event_time;
      }

      // Poll for new logs
      pollInterval = setInterval(() => {
        try {
          const newEvents = storage.getEventsAfter(jobId, lastEventTime);
          
          newEvents.forEach(event => {
            observer.next(event);
            lastEventTime = event.event_time;
          });

          // Check if task is in terminal state
          const task = storage.getTask(jobId);
          if (task && (task.execution_state === 'completed' || task.execution_state === 'failed')) {
            // Send completion event
            observer.next({ type: 'complete', state: task.execution_state });
            observer.complete();
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error(`Error polling logs for job ${jobId}:`, error);
          observer.error(error);
          clearInterval(pollInterval);
        }
      }, 1000);

      // Cleanup on unsubscribe
      return () => {
        clearInterval(pollInterval);
      };
    });
  }

  /**
   * Get or create an EventEmitter for a specific job
   */
  getLogEmitter(jobId: string): LogEmitter {
    // Return existing emitter if it exists
    const existingEmitter = this.logEmitters.get(jobId);
    if (existingEmitter) {
      return existingEmitter;
    }
    
    // Create new emitter and start polling
    const emitter = new LogEmitter();
    this.logEmitters.set(jobId, emitter);
    this.startLogPolling(jobId, emitter);
    
    return emitter;
  }

  /**
   * Start polling for logs and emit them to the EventEmitter
   */
  private startLogPolling(jobId: string, emitter: LogEmitter): void {
    let lastEventTime = Date.now();
    
    // Send existing logs immediately
    const existingEvents = storage.getTaskEvents(jobId);
    if (existingEvents.length > 0) {
      existingEvents.forEach(event => {
        emitter.emit(JSON.stringify(event));
      });
      lastEventTime = existingEvents[existingEvents.length - 1].event_time;
    }

    // Poll for new logs
    const pollInterval = setInterval(() => {
      try {
        const newEvents = storage.getEventsAfter(jobId, lastEventTime);
        
        newEvents.forEach(event => {
          emitter.emit(JSON.stringify(event));
          lastEventTime = event.event_time;
        });

        // Check if task is in terminal state
        const task = storage.getTask(jobId);
        if (task && (task.execution_state === 'completed' || task.execution_state === 'failed')) {
          // Send completion event
          emitter.emit(JSON.stringify({ type: 'complete', state: task.execution_state }));
          this.cleanupJob(jobId, pollInterval);
        }
      } catch (error) {
        console.error(`Error polling logs for job ${jobId}:`, error);
        this.cleanupJob(jobId, pollInterval);
      }
    }, 1000);
    
    // Store the interval ID for proper cleanup
    this.pollIntervals.set(jobId, pollInterval);
  }

  /**
   * Clean up resources for a job
   */
  private cleanupJob(jobId: string, pollInterval: NodeJS.Timeout): void {
    clearInterval(pollInterval);
    this.pollIntervals.delete(jobId);
    
    // Cleanup emitter after 60 seconds
    setTimeout(() => {
      this.logEmitters.delete(jobId);
    }, 60000);
  }
}
