export type EchoTrack = {
  id: string;
  title: string;
  artist: string;
  source: string;
  fileName?: string;
};

export type PuzzleImage = {
  id: string;
  title: string;
  source: string;
};

export const puzzleImages: PuzzleImage[] = [
  {
    id: "two-hearts-standing",
    title: "Two Hearts Standing",
    source: "/puzzles/puzzle-2.png",
  },
  {
    id: "softest-smile",
    title: "Softest Smile",
    source: "/puzzles/puzzle-3.jpg",
  },
  {
    id: "heart-filter-queen",
    title: "Heart Filter Queen",
    source: "/puzzles/puzzle-4.jpg",
  },
  {
    id: "eyes-never-lie",
    title: "Eyes Never Lie",
    source: "/puzzles/puzzle-5.jpg",
  },
];
