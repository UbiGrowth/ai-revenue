import { EventEmitter } from 'events';

export class LogEmitter extends EventEmitter {
  emit(message: string): boolean {
    return super.emit('log', message);
  }
}
