export type FutureStar = {
  id: string;
  /** The day this star lights up, local time (YYYY-MM-DD). */
  date: string;
  /** Shown while the star is still dim - a hint, never the surprise. */
  hint: string;
  /** Revealed once the day arrives. */
  title: string;
  message: string;
  tone: "gold" | "blue" | "rose" | "violet";
};

// Sir Henry: add or edit stars here. Each one stays dim (showing only its
// hint and a countdown) until its date, then lights up with its message.
// NOTE: these are placeholder examples - replace them with real plans.
export const futureStars: FutureStar[] = [
  {
    id: "first-star",
    date: "2026-10-02",
    hint: "The first star was already waiting for you.",
    title: "The First Star of Tomorrow",
    message:
      "Every universe needs a place for what has not happened yet. This is yours - and from now on it will keep lighting up, one day at a time.",
    tone: "gold",
  },
  {
    id: "star-two",
    date: "2026-12-25",
    hint: "A winter light, saved for a special day.",
    title: "A Winter Light",
    message: "Replace this with the message you want her to find on this day.",
    tone: "rose",
  },
  {
    id: "star-three",
    date: "2027-02-14",
    hint: "Something warm, kept for the day of hearts.",
    title: "Kept for the Day of Hearts",
    message: "Replace this with the message you want her to find on this day.",
    tone: "violet",
  },
  {
    id: "star-four",
    date: "2027-06-01",
    hint: "A summer star, far enough to be a surprise.",
    title: "A Summer Star",
    message: "Replace this with the message you want her to find on this day.",
    tone: "blue",
  },
];

const DAY_MS = 86_400_000;

function startOfDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function daysUntil(star: FutureStar, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((startOfDay(star.date) - today) / DAY_MS);
}

export const isLit = (star: FutureStar, now = new Date()) => daysUntil(star, now) <= 0;

export function countdownText(star: FutureStar, now = new Date()) {
  const days = daysUntil(star, now);
  if (days <= 0) {
    return "Lit";
  }
  if (days === 1) {
    return "Lights up tomorrow";
  }
  if (days < 60) {
    return `Lights up in ${days} days`;
  }
  return `Lights up in ${Math.round(days / 30)} months`;
}

export function formatStarDate(star: FutureStar) {
  return new Date(startOfDay(star.date)).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

// Her wishes live on her own device.
const WISH_KEY = "aurelia.starWishes";

export function loadWishes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(WISH_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveWish(id: string, wish: string) {
  try {
    localStorage.setItem(WISH_KEY, JSON.stringify({ ...loadWishes(), [id]: wish }));
  } catch {
    // Private mode etc. - the wish still shows for this visit.
  }
}
