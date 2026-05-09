import { useCallback, useRef, useState } from "react";

const fallbackBackdropTrackSrc =
  "/audio/JVKE%20-%20her%20(official%20lyric%20video).mp3";

type AudioLibraryTrack = {
  id?: string;
  title?: string;
  artist?: string;
  source?: string;
  fileName?: string;
};

type AudioLibrary = {
  tracks?: AudioLibraryTrack[];
};

type AmbientNodes = {
  context: AudioContext;
  master: GainNode;
  tones: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  track: HTMLAudioElement;
};

export function useAmbientSound() {
  const nodesRef = useRef<AmbientNodes | null>(null);
  const backdropSrcRef = useRef<string | null>(null);
  const pauseTimeoutRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const resolveBackdropTrack = useCallback(async () => {
    if (backdropSrcRef.current) {
      return backdropSrcRef.current;
    }

    try {
      const response = await fetch(`/audio/library.json?updated=${Date.now()}`);
      if (!response.ok) {
        throw new Error("Audio library unavailable");
      }

      const library = (await response.json()) as AudioLibrary;
      const tracks = Array.isArray(library.tracks) ? library.tracks : [];
      const herTrack = tracks.find((track) => {
        const haystack =
          `${track.id ?? ""} ${track.title ?? ""} ${track.artist ?? ""} ${track.fileName ?? ""}`.toLowerCase();
        return (
          haystack.includes("her") &&
          (haystack.includes("jvke") || haystack.includes("jyke"))
        );
      });

      backdropSrcRef.current = herTrack?.source ?? fallbackBackdropTrackSrc;
    } catch {
      backdropSrcRef.current = fallbackBackdropTrackSrc;
    }

    return backdropSrcRef.current;
  }, []);

  const createNodes = useCallback((trackSrc: string) => {
    const context = new AudioContext();
    const master = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    master.gain.value = 0.0001;
    lfo.frequency.value = 0.035;
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);

    const tones = [96, 144, 192].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();

      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      toneGain.gain.value = index === 0 ? 0.022 : 0.008;
      oscillator.connect(toneGain);
      toneGain.connect(master);
      oscillator.start();
      return oscillator;
    });

    const track = new Audio(trackSrc);
    track.loop = true;
    track.preload = "auto";
    track.volume = 0.12;

    master.connect(context.destination);
    lfo.start();

    nodesRef.current = { context, master, tones, lfo, lfoGain, track };
    return nodesRef.current;
  }, []);

  const start = useCallback(async () => {
    const trackSrc = await resolveBackdropTrack();
    const nodes = nodesRef.current ?? createNodes(trackSrc);
    if (pauseTimeoutRef.current !== null) {
      window.clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    await nodes.context.resume();

    if (!nodes.track.src.endsWith(trackSrc)) {
      nodes.track.src = trackSrc;
      nodes.track.load();
    }

    await nodes.track.play().catch(() => undefined);

    nodes.master.gain.cancelScheduledValues(nodes.context.currentTime);
    nodes.master.gain.exponentialRampToValueAtTime(
      0.055,
      nodes.context.currentTime + 2.6,
    );
    setIsPlaying(true);
  }, [createNodes, resolveBackdropTrack]);

  const pause = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) {
      return;
    }

    nodes.master.gain.cancelScheduledValues(nodes.context.currentTime);
    nodes.master.gain.exponentialRampToValueAtTime(
      0.0001,
      nodes.context.currentTime + 1.2,
    );
    if (pauseTimeoutRef.current !== null) {
      window.clearTimeout(pauseTimeoutRef.current);
    }

    pauseTimeoutRef.current = window.setTimeout(() => {
      nodes.track.pause();
      void nodes.context.suspend();
      pauseTimeoutRef.current = null;
    }, 1300);
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isPlaying) {
      pause();
      return;
    }

    await start();
  }, [isPlaying, pause, start]);

  return { isPlaying, start, pause, toggle };
}
