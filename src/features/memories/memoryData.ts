export type MemoryMoment = {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  artifact: "portrait" | "chat" | "note";
  imageUrl?: string;
  pullQuote: string;
  tone: "gold" | "blue" | "rose" | "violet";
};

export const memoryMoments: MemoryMoment[] = [
  {
    id: "favorite-picture",
    title: "The Queen, Softly Lit",
    eyebrow: "Favorite picture",
    body: "Some pictures do not just show a person. They hold the quiet reason a whole universe started glowing.",
    artifact: "portrait",
    imageUrl: "/memories/aurelia-portrait.jpg",
    pullQuote: "Aurelia, seen like a soft star.",
    tone: "violet",
  },
  {
    id: "first-conversation",
    title: "The First Real Spark",
    eyebrow: "First conversation",
    body: "A simple question about exclamation marks turned into one of those tiny conversations that keeps smiling after it ends.",
    artifact: "chat",
    imageUrl: "/memories/first-conversation-chat.png",
    pullQuote: "Plus they make my text more fun and energetic.",
    tone: "gold",
  },
  {
    id: "first-laugh",
    title: "The Almost-Chill Moment",
    eyebrow: "First laugh",
    body: "A small plan, a little shyness, a playful no, and somehow the whole chat became warmer.",
    artifact: "chat",
    imageUrl: "/memories/first-laugh-chat.png",
    pullQuote: "Have fun !!!",
    tone: "rose",
  },
  {
    id: "random-moments",
    title: "Little Forever Things",
    eyebrow: "Random moments",
    body: "This space will hold the ordinary pieces: tiny messages, soft teasing, sudden smiles, and days that became warmer.",
    artifact: "note",
    pullQuote: "Tiny things. Big glow.",
    tone: "blue",
  },
];
