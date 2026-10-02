// iPhones only let a page play sound from an audio element that was first
// started by a tap. In VR she can't tap, so one element is "unlocked" during
// the tap that enters VR (by playing a moment of silence) and reused later to
// play whatever she gazes at.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function createUnlockedAudio() {
  const audio = new Audio(SILENT_WAV);
  audio.volume = 0;
  void audio
    .play()
    .then(() => audio.pause())
    .catch(() => undefined)
    .finally(() => {
      audio.volume = 1;
    });
  return audio;
}
