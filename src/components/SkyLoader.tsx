import { useEffect, useState } from "react";

const messages = ["Aligning stars...", "Preparing magic...", "Summoning memories..."];

export function SkyLoader({ inline = false }: { inline?: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % messages.length), 1800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={inline ? "sky-loader sky-loader--inline" : "sky-loader"} role="status" aria-live="polite">
      <span className="sky-loader__star" aria-hidden="true" />
      <p>{messages[index]}</p>
    </div>
  );
}
