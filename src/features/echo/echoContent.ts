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
    id: "soft-star-portrait",
    title: "Soft Star Portrait",
    source: "/memories/aurelia-portrait.jpg",
  },
  {
    id: "first-spark-chat",
    title: "First Spark",
    source: "/memories/first-conversation-chat.png",
  },
  {
    id: "almost-chill-chat",
    title: "Almost-Chill Moment",
    source: "/memories/first-laugh-chat.png",
  },
];
