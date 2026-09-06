import type { VisitorIdentity } from "../gate/VisitorIdentity";

export type HeartLetter = {
  id: string;
  title: string;
  dateLabel: string;
  body: string;
  signature: string;
  recipient: "henry" | "aurelia" | "both";
  isUnread: boolean;
};

type LetterRow = {
  id: string;
  author: "henry" | "aurelia";
  recipient: "henry" | "aurelia" | "both";
  title: string;
  date_label: string;
  body: string;
  signature: string;
  unlock_at: string | null;
  read_at: string | null;
  created_at: string;
};

const softGlow = "\u{1F90D}\u{2728}";
const moonGoldStars = "\u{1F319}\u{1F49B}\u{1F31F}";

// Kept as a fallback only — if Supabase isn't configured yet, or the
// request fails for any reason, the chamber still works and shows these
// exact same four letters. Nothing breaks while Supabase is being set up.
// These are all "both" (never unread) since they're the original,
// already-known letters, not new mail.
export const heartLettersFallback: HeartLetter[] = [
  {
    id: "first-chamber-letter",
    title: "For The Queen Who Became A Universe",
    dateLabel: "Unlocked now",
    body:
      "Aurelia, this place exists because some feelings are too wide to fit inside ordinary messages. So I gave them a sky, a moon, a garden, and a chamber that opens only for you. Whenever the world feels loud, I hope this little universe reminds you that you are deeply cherished, softly noticed, and beautifully unforgettable.",
    signature: "Sir Henry",
    recipient: "both",
    isUnread: false,
  },
  {
    id: "soft-place-letter",
    title: "For The Days You Need Softness",
    dateLabel: "A soft promise",
    body:
      `My Aurelia, on the days when your smile feels tired and the world asks too much of you, come and rest here for a moment. You do not have to perform strength before you are loved. You do not have to explain your heart before it is held. You are precious in the loud days, precious in the quiet ones, precious when you shine, and precious when you simply breathe. I hope this little room wraps around you like warm light and reminds you: you are safe with me, always noticed, always chosen, always my Queen. ${softGlow}`,
    signature: "Sir Henry",
    recipient: "both",
    isUnread: false,
  },
  {
    id: "every-little-thing-letter",
    title: "Every Little Thing About You",
    dateLabel: "A golden note",
    body:
      `There are so many tiny things about you that make my heart smile. The way your name feels like a song. The way your presence can turn an ordinary moment into something I want to remember. The way even thinking of you makes the universe feel less empty and more kind. Aurelia, you are not just beautiful; you are beautiful in a way that stays. You are my favorite softness, my brightest wonder, the sweetest part of this whole sky. If stars could blush, they would whenever you entered the room. ${moonGoldStars}`,
    signature: "Sir Henry",
    recipient: "both",
    isUnread: false,
  },
  {
    id: "future-letter",
    title: "A Star Still Becoming",
    dateLabel: "Future letter",
    body:
      "This letter is waiting for its right day. Not every beautiful thing has to arrive at once.",
    signature: "Sir Henry",
    recipient: "both",
    isUnread: false,
  },
];

function isLetterUnlocked(row: LetterRow) {
  return !row.unlock_at || new Date(row.unlock_at).getTime() <= Date.now();
}

function functionsUrl(supabaseUrl: string, name: string) {
  return `${supabaseUrl}/functions/v1/${name}`;
}

/**
 * Loads letters visible to this viewer: the shared ("both") letters plus
 * anything the other person wrote to them. Never includes letters this
 * viewer wrote themselves — that's what keeps a sent letter out of your
 * own list.
 */
export async function fetchLetters(identity: VisitorIdentity): Promise<HeartLetter[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase isn't wired up yet — this is expected while the project is
    // still being created, not an error worth alarming over.
    return heartLettersFallback;
  }

  const filter = encodeURIComponent(`(recipient.eq.${identity},recipient.eq.both)`);
  const response = await fetch(
    `${supabaseUrl}/rest/v1/letters?select=*&or=${filter}&order=created_at.asc`,
    {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Could not load letters from Supabase");
  }

  const rows = (await response.json()) as LetterRow[];

  return rows.filter(isLetterUnlocked).map((row) => ({
    id: row.id,
    title: row.title,
    dateLabel: row.date_label,
    body: row.body,
    signature: row.signature,
    recipient: row.recipient,
    isUnread: row.recipient !== "both" && !row.read_at,
  }));
}

function functionsAuthHeaders(supabaseAnonKey: string) {
  // Same requirement as verify-password: Edge Functions need a valid
  // Supabase key on every request. The anon key is fine here - it's
  // public by design, and the actual privacy check (are you allowed to
  // write/mark this letter) happens inside the function itself.
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseAnonKey}`,
    apikey: supabaseAnonKey,
  };
}

export async function sendLetter(
  identity: VisitorIdentity,
  letter: { title: string; body: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Supabase isn't set up yet." };
  }

  try {
    const response = await fetch(functionsUrl(supabaseUrl, "manage-letters"), {
      method: "POST",
      headers: functionsAuthHeaders(supabaseAnonKey),
      body: JSON.stringify({ identity, ...letter }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      return { ok: false, error: result.error ?? "Could not send the letter." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

export async function markLetterRead(identity: VisitorIdentity, letterId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return;
  }

  try {
    await fetch(functionsUrl(supabaseUrl, "manage-letters"), {
      method: "PATCH",
      headers: functionsAuthHeaders(supabaseAnonKey),
      body: JSON.stringify({ identity, letterId }),
    });
  } catch {
    // Not critical if this fails silently - worst case the unread dot
    // just stays on a bit longer.
  }
}