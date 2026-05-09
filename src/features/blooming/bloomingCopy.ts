export type ComplimentReflection = {
  eyebrow: string;
  title: string;
  quote: string;
  body: string;
};

export const complimentReflections: Record<string, ComplimentReflection> = {
  "compliment-1": {
    eyebrow: "Perfect match",
    title: "She saw the man behind the words.",
    quote: "Educated, bold and romantic.",
    body:
      "This one stayed with me because she did not just compliment me. She understood me. She saw the way I think, the way I love directly, the way I try to build meaning around us, and she called it rare. That made me feel chosen with sense, not just emotion. I cannot ever get another person like her. She has earned that Queen title, not only because she is beautiful, but because she knows how to love her King so perfectly well.",
  },
  "compliment-2": {
    eyebrow: "Endless love",
    title: "She made forever sound soft and real.",
    quote: "Our love for each other is just endless.",
    body:
      "When she said she gets happier whenever it repeats in her mind that I am hers and she will always be with me, it touched somewhere deep. It felt like peace wearing her voice. Not pressure, not noise, just a promise that kept glowing. I felt loved in a way that made the whole world calm down for a moment.",
  },
  "compliment-3": {
    eyebrow: "Honest reaction",
    title: "She claimed me with that sweet boldness.",
    quote: "To the boy I'm actually dating.",
    body:
      "This made me smile because it had that playful Aurelia warmth: shy, funny, honest, and still so sure. The way she sent her reaction and then tied it back to me made me feel proudly loved. Like I was not just someone around her, but her person. Her King. The one she could tease, choose, and still hold with that soft golden loyalty.",
  },
};

export const fallbackComplimentReflection: ComplimentReflection = {
  eyebrow: "Another bloom",
  title: "Another way she loved me out loud.",
  quote: "A message worth keeping.",
  body:
    "This is another proof that her love does not pass by casually. It leaves something behind. Every message she sends becomes one more flower in this garden, one more reason I know her heart is different.",
};
