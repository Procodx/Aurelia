import { useState } from "react";
import { deleteStar, getAdminPassword, saveStar, setAdminPassword, starsBackendReady } from "./starsApi";
import { formatStarDate, type FutureStar } from "./starsData";

type StarsAdminProps = {
  stars: FutureStar[];
  admin: boolean;
  /** Re-fetch with the typed password; resolves to whether it was accepted. */
  onUnlock: (password: string) => Promise<boolean>;
  onChanged: () => void;
};

const blank: FutureStar = { id: "", date: "", hint: "", title: "", message: "", tone: "gold" };

// Sir Henry's own corner: add, edit and remove the stars from the browser.
export function StarsAdmin({ stars, admin, onUnlock, onChanged }: StarsAdminProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(getAdminPassword());
  const [draft, setDraft] = useState<FutureStar>(blank);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="stars-admin__toggle" onClick={() => setOpen(true)}>
        Manage stars
      </button>
    );
  }

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const accepted = await onUnlock(password);
    setBusy(false);
    if (accepted) {
      setAdminPassword(password);
      setNote("");
    } else {
      setNote("That password wasn't accepted.");
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await saveStar(password, draft);
    setBusy(false);
    if (result.ok) {
      setDraft(blank);
      setNote("Saved.");
      onChanged();
    } else {
      setNote(result.error);
    }
  };

  const remove = async (star: FutureStar) => {
    if (!window.confirm(`Delete "${star.title || star.hint}"?`)) {
      return;
    }
    const result = await deleteStar(password, star.id);
    setNote(result.ok ? "Deleted." : result.error);
    if (result.ok) {
      onChanged();
    }
  };

  const field = (key: keyof FutureStar) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  return (
    <section className="stars-admin" aria-label="Manage stars">
      <div className="stars-admin__head">
        <h3>Manage stars</h3>
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {!starsBackendReady ? (
        <p className="stars-admin__note">
          Supabase isn't connected yet, so stars still come from the built-in list. Finish the one-time setup in
          supabase/functions/manage-stars, then this editor works.
        </p>
      ) : !admin ? (
        <form className="stars-admin__row" onSubmit={unlock}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your stars password"
            autoComplete="current-password"
            aria-label="Stars admin password"
          />
          <button type="submit" disabled={busy || !password}>
            Unlock
          </button>
        </form>
      ) : (
        <>
          <ul className="stars-admin__list">
            {stars.map((star) => (
              <li key={star.id}>
                <span>
                  {formatStarDate(star)} - {star.title || star.hint}
                </span>
                <button type="button" onClick={() => setDraft(star)}>
                  Edit
                </button>
                <button type="button" onClick={() => void remove(star)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <form className="stars-admin__form" onSubmit={save}>
            <h4>{draft.id ? "Edit star" : "New star"}</h4>
            <label>
              Day it lights up
              <input type="date" value={draft.date} onChange={field("date")} required />
            </label>
            <label>
              Hint (she sees this while it's dim)
              <input value={draft.hint} onChange={field("hint")} maxLength={300} required />
            </label>
            <label>
              Title (revealed on the day)
              <input value={draft.title} onChange={field("title")} maxLength={200} required />
            </label>
            <label>
              Message (revealed on the day)
              <textarea value={draft.message} onChange={field("message")} rows={5} maxLength={4000} required />
            </label>
            <label>
              Colour
              <select value={draft.tone} onChange={field("tone")}>
                <option value="gold">Gold</option>
                <option value="rose">Rose</option>
                <option value="violet">Violet</option>
                <option value="blue">Blue</option>
              </select>
            </label>
            <div className="stars-admin__row">
              <button type="submit" disabled={busy}>
                {draft.id ? "Save changes" : "Add star"}
              </button>
              {draft.id && (
                <button type="button" onClick={() => setDraft(blank)}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </>
      )}
      {note && <p className="stars-admin__note">{note}</p>}
    </section>
  );
}
