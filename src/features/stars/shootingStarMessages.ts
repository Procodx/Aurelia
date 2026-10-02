// Sir Henry: the little notes a shooting star leaves for her. Edit freely -
// add as many as you like, each is revealed one after another as she catches
// them, then they start over.
export const shootingStarMessages: string[] = [
  "You caught me. I was hoping it would be you.",
  "Somewhere in all this sky, this one was always meant for you.",
  "Make a wish. I already made mine, and you were in it.",
  "You are the brightest thing in this universe, and I mean every light in it.",
  "Pause for a second. Breathe. You are loved, exactly as you are.",
  "If you are reading this, I was thinking of you before you even looked up.",
  "Every star here is a little reason I smile when I think of you.",
  "Thank you for being the kind of person a whole sky gets built for.",
];

const KEY = "aurelia.shootingStarIndex";

/** The next note in turn, remembered on her device so she gets a new one each time. */
export function nextShootingStarMessage(): string {
  let index = 0;
  try {
    index = Number(localStorage.getItem(KEY) ?? "0") || 0;
    localStorage.setItem(KEY, String((index + 1) % shootingStarMessages.length));
  } catch {
    index = Math.floor(Math.random() * shootingStarMessages.length);
  }
  return shootingStarMessages[index % shootingStarMessages.length];
}
