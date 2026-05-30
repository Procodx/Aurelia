import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { puzzleImages, type EchoTrack } from "./echoContent";

type EchoMoonProps = {
  onClose: () => void;
};

type EchoMode = "choose" | "audio" | "puzzle";
type TileLocation = "tray" | "board";
type TileSelection = { tile: number; from: TileLocation } | null;
type PuzzleSave = {
  board: Array<number | null>;
  tray: number[];
  completed: boolean;
  moves: number;
};
type AudioLibrary = {
  tracks?: EchoTrack[];
};

function pauseBackdropMusic() {
  window.dispatchEvent(new Event("aurelia:backdrop-pause"));
}

function resumeBackdropMusic() {
  window.dispatchEvent(new Event("aurelia:backdrop-resume"));
}

const gridSize = 3;
const tileCount = gridSize * gridSize;

function shuffleTiles() {
  const tiles = Array.from({ length: tileCount }, (_, index) => index);
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [tiles[index], tiles[swapIndex]] = [tiles[swapIndex], tiles[index]];
  }
  return tiles;
}

function getSaveKey(imageId: string) {
  return `aurelia.echoPuzzle.${imageId}`;
}

function loadPuzzle(imageId: string): PuzzleSave | null {
  try {
    const raw = window.localStorage.getItem(getSaveKey(imageId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PuzzleSave;
    if (!Array.isArray(parsed.board) || !Array.isArray(parsed.tray) || parsed.board.length !== tileCount) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function createFreshPuzzle(): PuzzleSave {
  return {
    board: Array.from({ length: tileCount }, () => null),
    tray: shuffleTiles(),
    completed: false,
    moves: 0,
  };
}

function getCorrectCount(board: Array<number | null>) {
  return board.reduce<number>((count, tile, index) => (tile === index ? count + 1 : count), 0);
}

function TilePiece({
  image,
  tile,
  selected,
  onClick,
}: {
  image: string;
  tile: number;
  selected: boolean;
  onClick: () => void;
}) {
  const col = tile % gridSize;
  const row = Math.floor(tile / gridSize);
  const positionX = (col / (gridSize - 1)) * 100;
  const positionY = (row / (gridSize - 1)) * 100;

  return (
    <button
      className={selected ? "puzzle-piece is-selected" : "puzzle-piece"}
      type="button"
      onClick={onClick}
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
        backgroundPosition: `${positionX}% ${positionY}%`,
      }}
      aria-label={`Puzzle piece ${tile + 1}`}
    />
  );
}

export function EchoMoon({ onClose }: EchoMoonProps) {
  const [mode, setMode] = useState<EchoMode>("choose");
  const [tracks, setTracks] = useState<EchoTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState("");
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [trackError, setTrackError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0] ?? null;

  const [imageId, setImageId] = useState(puzzleImages[0]!.id);
  const activeImage = puzzleImages.find((image) => image.id === imageId) ?? puzzleImages[0]!;
  const [puzzle, setPuzzle] = useState<PuzzleSave>(() => loadPuzzle(puzzleImages[0]!.id) ?? createFreshPuzzle());
  const [selection, setSelection] = useState<TileSelection>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showResume, setShowResume] = useState(() => {
    const saved = loadPuzzle(puzzleImages[0]!.id);
    return saved !== null && getCorrectCount(saved.board) > 0 && !saved.completed;
  });

  const progress = useMemo(() => getCorrectCount(puzzle.board), [puzzle.board]);
  const progressPercent = Math.round((progress / tileCount) * 100);

  useEffect(() => {
    let isMounted = true;

    const loadTracks = async () => {
      try {
        const response = await fetch(`/audio/library.json?updated=${Date.now()}`);
        if (!response.ok) {
          throw new Error("Audio library not found");
        }

        const library = (await response.json()) as AudioLibrary;
        const nextTracks = Array.isArray(library.tracks) ? library.tracks : [];
        if (!isMounted) {
          return;
        }

        setTracks(nextTracks);
        setActiveTrackId((current) => (nextTracks.some((track) => track.id === current) ? current : nextTracks[0]?.id ?? ""));
      } catch {
        if (!isMounted) {
          return;
        }

        setTracks([]);
        setActiveTrackId("");
      }
    };

    void loadTracks();

    return () => {
      isMounted = false;
    };
  }, [mode]);

  useEffect(() => {
    const saved = loadPuzzle(imageId);
    setPuzzle(saved ?? createFreshPuzzle());
    setSelection(null);
    setIsPreviewing(false);
    setShowResume(saved !== null && getCorrectCount(saved.board) > 0 && !saved.completed);
  }, [imageId]);

  useEffect(() => {
    window.localStorage.setItem(getSaveKey(imageId), JSON.stringify(puzzle));
  }, [imageId, puzzle]);

  useEffect(() => {
    setTrackError("");
    setIsTrackPlaying(false);
  }, [activeTrackId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      resumeBackdropMusic();
    };
  }, []);

  const playTrack = async (track: EchoTrack) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setActiveTrackId(track.id);
    setTrackError("");
    audio.src = track.source;
    audio.load();
    pauseBackdropMusic();
    window.setTimeout(() => {
      void audio.play().then(
        () => setIsTrackPlaying(true),
        () => {
          setIsTrackPlaying(false);
          setTrackError(`I found "${track.fileName ?? track.title}", but the browser could not play it.`);
          resumeBackdropMusic();
        },
      );
    }, 0);
  };

  const toggleTrack = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isTrackPlaying) {
      audio.pause();
      setIsTrackPlaying(false);
      resumeBackdropMusic();
      return;
    }

    if (activeTrack) {
      await playTrack(activeTrack);
    }
  };

  const leaveAudioRoom = () => {
    audioRef.current?.pause();
    setIsTrackPlaying(false);
    resumeBackdropMusic();
    setMode("choose");
  };

  const resetPuzzle = () => {
    setPuzzle(createFreshPuzzle());
    setSelection(null);
    setIsPreviewing(false);
  };

  const clearSavedPuzzle = () => {
    window.localStorage.removeItem(getSaveKey(imageId));
    resetPuzzle();
  };

  const autoPlaceHint = () => {
    const nextTile = puzzle.tray.find((tile) => puzzle.board[tile] === null);
    if (nextTile === undefined) {
      return;
    }

    setPuzzle((current) => {
      const board = [...current.board];
      const tray = current.tray.filter((tile) => tile !== nextTile);
      board[nextTile] = nextTile;
      const completed = board.every((tile, index) => tile === index);
      return { board, tray, completed, moves: current.moves + 1 };
    });
    setSelection(null);
  };

  const selectTile = (tile: number, from: TileLocation) => {
    setSelection((current) => (current?.tile === tile && current.from === from ? null : { tile, from }));
  };

  const placeInSlot = (slotIndex: number) => {
    if (!selection || puzzle.completed) {
      return;
    }

    setPuzzle((current) => {
      const board = [...current.board];
      let tray = [...current.tray];
      const existingTile = board[slotIndex];

      if (selection.from === "tray") {
        tray = tray.filter((tile) => tile !== selection.tile);
        if (existingTile !== null) {
          tray = [existingTile, ...tray];
        }
        board[slotIndex] = selection.tile;
      } else {
        const currentSlot = board.findIndex((tile) => tile === selection.tile);
        if (currentSlot === -1) {
          return current;
        }
        board[currentSlot] = existingTile;
        board[slotIndex] = selection.tile;
      }

      const completed = board.every((tile, index) => tile === index);
      return { board, tray, completed, moves: current.moves + 1 };
    });
    setSelection(null);
  };

  return (
    <motion.aside
      className="echo-moon-panel"
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.99 }}
      transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Echo Moon"
    >
      <button className="echo-moon__close" type="button" onClick={onClose} aria-label="Return to universe">
        Return
      </button>

      <div className="echo-moon-panel__scroller">
        <div className="echo-moon__header">
          <p>Echo Moon</p>
          <h2>Choose what should glow tonight.</h2>
        </div>

        {mode === "choose" && (
          <div className="echo-choice-grid">
            <button type="button" className="echo-choice echo-choice--music" onClick={() => setMode("audio")}>
              <span>Listening room</span>
              <strong>Music and Sir Henry's voice</strong>
              <small>Pick a song, or play the voice note when it is ready.</small>
            </button>
            <button type="button" className="echo-choice echo-choice--puzzle" onClick={() => setMode("puzzle")}>
              <span>Favorite game</span>
              <strong>Picture puzzle</strong>
              <small>Choose an image, arrange the pieces, and let the moon remember your progress.</small>
            </button>
          </div>
        )}

        {mode === "audio" && (
          <section className="echo-audio-room">
            <button className="echo-moon__back" type="button" onClick={leaveAudioRoom}>
              Back
            </button>
            <div className="echo-player">
              <p>{activeTrack?.artist ?? "Echo Moon Library"}</p>
              <h3>{activeTrack?.title ?? "No audio yet"}</h3>
              <audio
                ref={audioRef}
                src={activeTrack?.source}
                onEnded={() => {
                  setIsTrackPlaying(false);
                  resumeBackdropMusic();
                }}
              />
              <button type="button" onClick={toggleTrack} disabled={!activeTrack}>
                {isTrackPlaying ? "Pause" : "Play"}
              </button>
              <span>
                {trackError ||
                  (activeTrack
                    ? `Playing from ${activeTrack.fileName ?? activeTrack.source}`
                    : "Drop MP3, M4A, WAV, OGG, AAC, or FLAC files into public/audio, then run npm run sync-audio.")}
              </span>
            </div>
            <div className="echo-track-list" aria-label="Choose audio">
              {tracks.length === 0 && (
                <div className="echo-empty-audio">
                  <span>No audio files found</span>
                  Add audio to public/audio and run npm run sync-audio.
                </div>
              )}
              {tracks.map((track) => (
                <button
                  key={track.id}
                  className={track.id === activeTrackId ? "is-active" : ""}
                  type="button"
                  onClick={() => void playTrack(track)}
                >
                  <span>{track.artist}</span>
                  {track.title}
                </button>
              ))}
            </div>
          </section>
        )}

        {mode === "puzzle" && (
          <section className="echo-puzzle-room">
            <div className="puzzle-toolbar" aria-label="Puzzle controls">
              <button type="button" onClick={() => setMode("choose")} aria-label="Back to Echo Moon choices">
                Back
              </button>
              <button type="button" onClick={resetPuzzle}>
                Shuffle
              </button>
              <button type="button" onClick={autoPlaceHint}>
                Hint
              </button>
              <button type="button" onMouseDown={() => setIsPreviewing(true)} onMouseUp={() => setIsPreviewing(false)} onMouseLeave={() => setIsPreviewing(false)} onTouchStart={() => setIsPreviewing(true)} onTouchEnd={() => setIsPreviewing(false)}>
                Preview
              </button>
              <button type="button" onClick={clearSavedPuzzle}>
                Clear
              </button>
            </div>

            <div className="puzzle-image-picker" aria-label="Choose puzzle image">
              {puzzleImages.map((image) => (
                <button
                  key={image.id}
                  className={image.id === imageId ? "is-active" : ""}
                  type="button"
                  onClick={() => setImageId(image.id)}
                >
                  <img src={image.source} alt="" />
                  <span>{image.title}</span>
                </button>
              ))}
            </div>

            <div className="puzzle-progress">
              <span>{activeImage.title}</span>
              <strong>{progress}/{tileCount}</strong>
              <div>
                <i style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="puzzle-play-area">
              <div className="puzzle-board" aria-label="Puzzle board">
                {puzzle.board.map((tile, index) => (
                  <button
                    className={tile === null ? "puzzle-slot" : "puzzle-slot has-piece"}
                    key={`slot-${index}`}
                    type="button"
                    onClick={() => placeInSlot(index)}
                    aria-label={`Puzzle slot ${index + 1}`}
                  >
                    {tile !== null && (
                      <TilePiece
                        image={activeImage.source}
                        tile={tile}
                        selected={selection?.tile === tile && selection.from === "board"}
                        onClick={() => selectTile(tile, "board")}
                      />
                    )}
                  </button>
                ))}
                {isPreviewing && <img className="puzzle-preview" src={activeImage.source} alt="" />}
              </div>

              <div className="puzzle-tray" aria-label="Available puzzle pieces">
                {puzzle.tray.map((tile) => (
                  <TilePiece
                    key={`tray-${tile}`}
                    image={activeImage.source}
                    tile={tile}
                    selected={selection?.tile === tile && selection.from === "tray"}
                    onClick={() => selectTile(tile, "tray")}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence>
              {showResume && (
                <motion.div className="puzzle-resume" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div>
                    <h3>Welcome Back!</h3>
                    <img src={activeImage.source} alt="" />
                    <p>Progress <strong>{progress}/{tileCount}</strong></p>
                    <div><i style={{ width: `${progressPercent}%` }} /></div>
                    <button type="button" onClick={() => setShowResume(false)}>Continue</button>
                    <button type="button" onClick={() => { clearSavedPuzzle(); setShowResume(false); }}>Main</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {puzzle.completed && (
              <motion.div className="puzzle-complete" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
                Youve won my heart again!!!
              </motion.div>
            )}
          </section>
        )}
      </div>
    </motion.aside>
  );
}
