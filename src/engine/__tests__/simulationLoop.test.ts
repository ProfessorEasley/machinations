import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startSimulationLoop } from '../simulationLoop';

describe('engine/simulationLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startSimulationLoop — basic interval execution', () => {
    it('should call onTick at specified intervals', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
      });

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(300);
      expect(onTick).toHaveBeenCalledTimes(5);

      handle.stop();
    });

    it('should stop when handle.stop() is called', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 50,
        onTick,
      });

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(2);

      handle.stop();

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('should respect different intervalMs values', () => {
      const onTick1 = vi.fn();
      const onTick2 = vi.fn();

      const handle1 = startSimulationLoop({
        intervalMs: 50,
        onTick: onTick1,
      });

      const handle2 = startSimulationLoop({
        intervalMs: 150,
        onTick: onTick2,
      });

      vi.advanceTimersByTime(150);
      expect(onTick1).toHaveBeenCalledTimes(3);
      expect(onTick2).toHaveBeenCalledTimes(1);

      handle1.stop();
      handle2.stop();
    });
  });

  describe('startSimulationLoop — shouldSkipTick callback', () => {
    it('should skip tick when shouldSkipTick returns true', () => {
      const onTick = vi.fn();
      let skipNext = false;

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
        shouldSkipTick: () => skipNext,
      });

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      skipNext = true;
      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      skipNext = false;
      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(2);

      handle.stop();
    });

    it('should execute onTick when shouldSkipTick returns false', () => {
      const onTick = vi.fn();

      const handle = startSimulationLoop({
        intervalMs: 50,
        onTick,
        shouldSkipTick: () => false,
      });

      vi.advanceTimersByTime(150);
      expect(onTick).toHaveBeenCalledTimes(3);

      handle.stop();
    });

    it('should call shouldSkipTick on each interval', () => {
      const onTick = vi.fn();
      const shouldSkipTick = vi.fn().mockReturnValue(false);

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
        shouldSkipTick,
      });

      vi.advanceTimersByTime(300);
      expect(shouldSkipTick).toHaveBeenCalledTimes(3);

      handle.stop();
    });
  });

  describe('startSimulationLoop — error handling', () => {
    it('should call onError when onTick throws', () => {
      const error = new Error('Tick failed');
      const onTick = vi.fn().mockImplementation(() => {
        throw error;
      });
      const onError = vi.fn();

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
        onError,
      });

      vi.advanceTimersByTime(100);
      expect(onError).toHaveBeenCalledWith(error);

      handle.stop();
    });

    it('should stop interval after error if no onError handler', () => {
      const onTick = vi.fn().mockImplementation(() => {
        throw new Error('Tick failed');
      });
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
      });

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      handle.stop();
    });

    it('should call onError and stop interval when onTick throws', () => {
      const error = new Error('Tick failed');
      const onTick = vi.fn().mockImplementation(() => {
        throw error;
      });
      const onError = vi.fn();

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
        onError,
      });

      vi.advanceTimersByTime(100);
      expect(onError).toHaveBeenCalledWith(error);
      expect(onTick).toHaveBeenCalledTimes(1);

      // Interval stops after error, even with onError handler
      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      handle.stop();
    });
  });

  describe('startSimulationLoop — handle management', () => {
    it('should return handle with stop method', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
      });

      expect(handle).toHaveProperty('stop');
      expect(typeof handle.stop).toBe('function');

      handle.stop();
    });

    it('should allow multiple independent loops', () => {
      const onTick1 = vi.fn();
      const onTick2 = vi.fn();

      const handle1 = startSimulationLoop({
        intervalMs: 100,
        onTick: onTick1,
      });

      const handle2 = startSimulationLoop({
        intervalMs: 150,
        onTick: onTick2,
      });

      vi.advanceTimersByTime(300);
      expect(onTick1).toHaveBeenCalledTimes(3);
      expect(onTick2).toHaveBeenCalledTimes(2);

      handle1.stop();

      vi.advanceTimersByTime(150);
      expect(onTick1).toHaveBeenCalledTimes(3);
      expect(onTick2).toHaveBeenCalledTimes(3);

      handle2.stop();
    });

    it('should handle stop called multiple times', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
      });

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);

      handle.stop();
      handle.stop();

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(1);
    });
  });

  describe('simulationLoop — state management', () => {
    it('should maintain state across tick calls', () => {
      let counter = 0;
      const onTick = vi.fn(() => {
        counter += 1;
      });

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
      });

      vi.advanceTimersByTime(100);
      expect(counter).toBe(1);

      vi.advanceTimersByTime(100);
      expect(counter).toBe(2);

      vi.advanceTimersByTime(100);
      expect(counter).toBe(3);

      handle.stop();
      expect(counter).toBe(3);
    });

    it('should allow callbacks to modify external state', () => {
      const state = { value: 0 };
      const onTick = vi.fn(() => {
        state.value += 10;
      });

      const handle = startSimulationLoop({
        intervalMs: 100,
        onTick,
      });

      vi.advanceTimersByTime(200);
      expect(state.value).toBe(20);

      vi.advanceTimersByTime(100);
      expect(state.value).toBe(30);

      handle.stop();
    });
  });

  describe('simulationLoop — edge cases', () => {
    it('should handle very small intervalMs', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 1,
        onTick,
      });

      vi.advanceTimersByTime(10);
      expect(onTick).toHaveBeenCalledTimes(10);

      handle.stop();
    });

    it('should handle very large intervalMs', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 10000,
        onTick,
      });

      vi.advanceTimersByTime(5000);
      expect(onTick).toHaveBeenCalledTimes(0);

      vi.advanceTimersByTime(5000);
      expect(onTick).toHaveBeenCalledTimes(1);

      handle.stop();
    });

    it('should handle shouldSkipTick always returning true', () => {
      const onTick = vi.fn();
      const handle = startSimulationLoop({
        intervalMs: 50,
        onTick,
        shouldSkipTick: () => true,
      });

      vi.advanceTimersByTime(500);
      expect(onTick).toHaveBeenCalledTimes(0);

      handle.stop();
    });
  });
});
