import { type FormEvent, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { getStoredIdentity, setStoredIdentity } from "./VisitorIdentity";

type PasswordGateProps = {
  children: ReactNode;
};

export function PasswordGate({ children }: PasswordGateProps) {
  const [identity, setIdentity] = useState(() => getStoredIdentity());
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");

  if (identity) {
    return <>{children}</>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      // Supabase isn't configured yet - don't lock Henry out of his own
      // site while he's still setting things up.
      setIdentity("henry");
      setStoredIdentity("henry");
      return;
    }

    setStatus("checking");

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = (await response.json()) as { ok: boolean; identity?: "henry" | "aurelia" };

      if (!response.ok || !result.ok || !result.identity) {
        setStatus("error");
        return;
      }

      setStoredIdentity(result.identity);
      setIdentity(result.identity);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="password-gate">
      <div className="password-gate__stars" aria-hidden="true" />
      <motion.form
        className="password-gate__card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="password-gate__eyebrow">A quiet universe</p>
        <h1>This place is kept for two people.</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (status === "error") {
              setStatus("idle");
            }
          }}
          placeholder="Enter the password"
          aria-label="Password"
        />
        <button type="submit" disabled={status === "checking" || password.length === 0}>
          {status === "checking" ? "Opening..." : "Enter"}
        </button>
        {status === "error" && <span className="password-gate__error">That's not quite it. Try again.</span>}
      </motion.form>
    </div>
  );
}