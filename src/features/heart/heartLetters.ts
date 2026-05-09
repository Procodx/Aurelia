export type HeartLetter = {
  id: string;
  title: string;
  dateLabel: string;
  body: string;
  signature: string;
};

const softGlow = "\u{1F90D}\u{2728}";
const moonGoldStars = "\u{1F319}\u{1F49B}\u{1F31F}";

export const heartLetters: HeartLetter[] = [
  {
    id: "first-chamber-letter",
    title: "For The Queen Who Became A Universe",
    dateLabel: "Unlocked now",
    body:
      "Aurelia, this place exists because some feelings are too wide to fit inside ordinary messages. So I gave them a sky, a moon, a garden, and a chamber that opens only for you. Whenever the world feels loud, I hope this little universe reminds you that you are deeply cherished, softly noticed, and beautifully unforgettable.",
    signature: "Sir Henry",
  },
  {
    id: "soft-place-letter",
    title: "For The Days You Need Softness",
    dateLabel: "A soft promise",
    body:
      `My Aurelia, on the days when your smile feels tired and the world asks too much of you, come and rest here for a moment. You do not have to perform strength before you are loved. You do not have to explain your heart before it is held. You are precious in the loud days, precious in the quiet ones, precious when you shine, and precious when you simply breathe. I hope this little room wraps around you like warm light and reminds you: you are safe with me, always noticed, always chosen, always my Queen. ${softGlow}`,
    signature: "Sir Henry",
  },
  {
    id: "every-little-thing-letter",
    title: "Every Little Thing About You",
    dateLabel: "A golden note",
    body:
      `There are so many tiny things about you that make my heart smile. The way your name feels like a song. The way your presence can turn an ordinary moment into something I want to remember. The way even thinking of you makes the universe feel less empty and more kind. Aurelia, you are not just beautiful; you are beautiful in a way that stays. You are my favorite softness, my brightest wonder, the sweetest part of this whole sky. If stars could blush, they would whenever you entered the room. ${moonGoldStars}`,
    signature: "Sir Henry",
  },
  {
    id: "future-letter",
    title: "A Star Still Becoming",
    dateLabel: "Future letter",
    body:
      "This letter is waiting for its right day. Not every beautiful thing has to arrive at once.",
    signature: "Sir Henry",
  },
];
