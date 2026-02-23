import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LogEmitter } from './logs';

describe('LogEmitter', () => {
  describe('emit', () => {
    it('should create a LogEmitter instance', () => {
      const log = new LogEmitter();
      assert.ok(log instanceof LogEmitter);
    });

    it('should have emit method', () => {
      const log = new LogEmitter();
      assert.strictEqual(typeof log.emit, 'function');
    });

    it('should emit without errors', () => {
      const log = new LogEmitter();
      // Should not throw
      assert.doesNotThrow(() => {
        log.emit('Test message');
      });
    });

    it('should emit multiple messages', () => {
      const log = new LogEmitter();
      // Should not throw
      assert.doesNotThrow(() => {
        log.emit('Message 1');
        log.emit('Message 2');
        log.emit('Message 3');
      });
    });

    it('should handle empty strings', () => {
      const log = new LogEmitter();
      assert.doesNotThrow(() => {
        log.emit('');
      });
    });

    it('should handle long messages', () => {
      const log = new LogEmitter();
      const longMessage = 'x'.repeat(10000);
      assert.doesNotThrow(() => {
        log.emit(longMessage);
      });
    });

    it('should handle special characters', () => {
      const log = new LogEmitter();
      assert.doesNotThrow(() => {
        log.emit('Message with\nnewlines\tand\ttabs');
        log.emit('Message with émoji 🎉');
      });
    });
  });
});
