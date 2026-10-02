// Sir Henry: the little notes a shooting star leaves for her. Edit freely -
// add as many as you like, each is revealed one after another as she catches
// them, then they start over.
export const shootingStarMessages: string[] = [
  "You caught me. I was hoping it would be you.",
  "Make a wish. I already made mine, and you were in it.",
  "Out of every star in this sky, this one was always meant for you.",
  "You are my favorite part of every day, even the quiet ones.",
  "I hope you can feel how gently you are loved, right now, exactly as you are.",
  "Somewhere between hello and forever, you became my favorite place to be.",
  "If I could hold one star for every reason I adore you, the sky would be empty.",
  "Your smile does something to my whole universe. Please keep it close.",
  "You are not just beautiful. You are the kind of beautiful that stays.",
  "Rest your heart here for a moment. You are safe, and you are cherished.",
  "I thought of you before you even looked up.",
  "No wish needed tonight. You are already my favorite thing to have found.",
  "Thank you for being soft in a world that is so loud. It is my favorite thing about you.",
  "My Queen, even the stars slow down a little when you pass by.",
  "I am proud of you, on the days you say it out loud and on the days you don't.",
  "Whenever you doubt it: you are wanted, you are chosen, you are home to me.",
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
