import type { PlaybackEngine } from "./types";

/**
 * Silent, clock-driven engine. It keeps accurate playback position so every
 * control (seek, progress, repeat, queue advance) behaves for real.
 * No audio is produced — swap in an <audio>-backed engine to stream media.
 */
export function createSimulatedEngine(): PlaybackEngine {
  let duration = 0;
  let position = 0;
  let playing = false;
  let last = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const tickCbs = new Set<(p: number) => void>();
  const endCbs = new Set<() => void>();

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const step = () => {
    const now = performance.now();
    position += (now - last) / 1000;
    last = now;
    if (position >= duration) {
      position = duration;
      playing = false;
      stopTimer();
      tickCbs.forEach((cb) => cb(position));
      endCbs.forEach((cb) => cb());
      return;
    }
    tickCbs.forEach((cb) => cb(position));
  };

  return {
    load(_trackId, durationSec, startAt = 0) {
      duration = durationSec;
      position = Math.min(startAt, durationSec);
      tickCbs.forEach((cb) => cb(position));
    },
    play() {
      if (playing) return;
      playing = true;
      last = performance.now();
      stopTimer();
      timer = setInterval(step, 250);
    },
    pause() {
      if (!playing) return;
      step();
      playing = false;
      stopTimer();
    },
    seek(seconds) {
      position = Math.max(0, Math.min(seconds, duration));
      last = performance.now();
      tickCbs.forEach((cb) => cb(position));
    },
    setVolume() {
      /* no audio output in simulation */
    },
    onTick(cb) {
      tickCbs.add(cb);
      return () => tickCbs.delete(cb);
    },
    onEnded(cb) {
      endCbs.add(cb);
      return () => endCbs.delete(cb);
    },
    destroy() {
      stopTimer();
      tickCbs.clear();
      endCbs.clear();
    },
  };
}
