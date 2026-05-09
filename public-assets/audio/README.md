Place audio files in this folder (`public-assets/audio`) and run:

npm run sync-audio

Echo Moon reads public/audio/library.json, which is generated from this folder.

Supported formats:

- .mp3
- .m4a
- .mp4
- .wav
- .ogg
- .aac
- .flac

If you want to convert non-MP3 audio to MP3 and keep the originals, run:

npm run normalize-audio

That command converts .aac, .aiff, .flac, .m4a, .mp4, .m4v, .mov, .oga, .ogg, .opus, .wav, .webm, and .wma files to .mp3.

If you explicitly want to remove originals after successful conversion, run:

npm run normalize-audio-clean

Naming tips:

- "Her by Sir Henry.ogg" becomes title "Her" and artist "Sir Henry".
- "Alex Warren - Ordinary.mp3" becomes artist "Alex Warren" and title "Ordinary".
- Any other filename is still listed automatically.
