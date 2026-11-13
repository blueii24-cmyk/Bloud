import type { PlaybackEngine } from "./types";

/**
 * Browser media engine for catalogue tracks with an `audioUrl`. When a track
 * has no source (the bundled preview catalogue), it falls back to a silent
 * clock so the demo controls and progress UI remain usable.
 */
export function createSimulatedEngine(): PlaybackEngine {
  let duration = 0;
  let position = 0;
  let playing = false;
  let usingAudio = false;
  let unavailableSource = false;
  let pendingSeek: number | null = null;
  let last = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const tickCbs = new Set<(positionSec: number) => void>();
  const endCbs = new Set<() => void>();
  const errorCbs = new Set<(message: string) => void>();
  const audio = typeof Audio === "undefined" ? null : new Audio();
  if (audio) {
    audio.preload = "metadata";
    audio.volume = 0.8;
  }

  const notifyPosition = () => tickCbs.forEach((callback) => callback(position));
  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const boundedPosition = (seconds: number) => {
    const maximum = Number.isFinite(duration) && duration > 0 ? duration : Math.max(0, seconds);
    return Math.min(Math.max(0, seconds), maximum);
  };
  const applyPendingSeek = () => {
    if (!audio || !usingAudio || pendingSeek === null || audio.readyState < HTMLMediaElement.HAVE_METADATA) return;
    const sourceDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    const target = Math.min(pendingSeek, sourceDuration > 0 ? sourceDuration : pendingSeek);
    try {
      audio.currentTime = target;
      position = target;
      pendingSeek = null;
      notifyPosition();
    } catch {
      // Metadata can report an unseekable stream; wait for the next metadata/time event.
    }
  };
  const step = () => {
    if (usingAudio && audio) {
      position = Number.isFinite(audio.currentTime) ? audio.currentTime : position;
      notifyPosition();
      return;
    }
    if (!playing) return;
    const now = performance.now();
    position += (now - last) / 1000;
    last = now;
    if (position >= duration) {
      position = duration;
      playing = false;
      stopTimer();
      notifyPosition();
      endCbs.forEach((callback) => callback());
      return;
    }
    notifyPosition();
  };

  if (audio) {
    audio.addEventListener("loadedmetadata", applyPendingSeek);
    audio.addEventListener("timeupdate", step);
    audio.addEventListener("ended", () => {
      if (!usingAudio) return;
      playing = false;
      stopTimer();
      position = Number.isFinite(audio.duration) ? audio.duration : duration;
      notifyPosition();
      endCbs.forEach((callback) => callback());
    });
    audio.addEventListener("error", () => {
      if (!usingAudio) return;
      playing = false;
      stopTimer();
      errorCbs.forEach((callback) => callback("This track couldn't be played. Check the audio URL and your connection."));
    });
  }

  return {
    load(_trackId, durationSec, startAt = 0, source) {
      stopTimer();
      playing = false;
      duration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
      position = boundedPosition(startAt);
      pendingSeek = position;
      usingAudio = Boolean(source && audio);
      unavailableSource = false;

      if (audio) {
        audio.pause();
        if (usingAudio && source) {
          let validSource = false;
          try {
            const resolved = new URL(source, window.location.href);
            validSource = ["http:", "https:", "blob:"].includes(resolved.protocol);
          } catch {
            validSource = false;
          }
          if (!validSource) {
            usingAudio = false;
            unavailableSource = true;
            pendingSeek = null;
            position = 0;
            audio.removeAttribute("src");
            audio.load();
            errorCbs.forEach((callback) => callback("This track has an invalid audio URL."));
          } else {
            audio.src = source;
            audio.load();
            applyPendingSeek();
          }
        } else {
          usingAudio = false;
          pendingSeek = null;
          audio.removeAttribute("src");
          audio.load();
        }
      }
      notifyPosition();
    },
    play() {
      if (playing || unavailableSource) return;
      playing = true;
      if (usingAudio && audio) {
        try {
          const result = audio.play();
          void result.catch(() => {
            playing = false;
            stopTimer();
            errorCbs.forEach((callback) => callback("Audio playback was blocked or unavailable. Press play again or check the audio source."));
          });
        } catch {
          playing = false;
          errorCbs.forEach((callback) => callback("Audio playback was blocked or unavailable. Press play again or check the audio source."));
        }
        return;
      }
      last = performance.now();
      stopTimer();
      timer = setInterval(step, 250);
    },
    pause() {
      if (!playing && (!usingAudio || !audio || audio.paused)) return;
      if (usingAudio && audio) {
        audio.pause();
        position = Number.isFinite(audio.currentTime) ? audio.currentTime : position;
        playing = false;
        stopTimer();
        notifyPosition();
        return;
      }
      step();
      playing = false;
      stopTimer();
    },
    seek(seconds) {
      position = boundedPosition(seconds);
      last = performance.now();
      if (usingAudio && audio) {
        pendingSeek = position;
        applyPendingSeek();
        notifyPosition();
      } else {
        notifyPosition();
      }
    },
    setVolume(volume) {
      if (audio) audio.volume = Math.min(1, Math.max(0, volume));
    },
    onTick(callback) {
      tickCbs.add(callback);
      return () => tickCbs.delete(callback);
    },
    onEnded(callback) {
      endCbs.add(callback);
      return () => endCbs.delete(callback);
    },
    onError(callback) {
      errorCbs.add(callback);
      return () => errorCbs.delete(callback);
    },
    destroy() {
      stopTimer();
      playing = false;
      audio?.pause();
      if (audio) {
        audio.removeAttribute("src");
        audio.load();
      }
      tickCbs.clear();
      endCbs.clear();
      errorCbs.clear();
    },
  };
}
