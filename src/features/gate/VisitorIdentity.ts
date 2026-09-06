export type VisitorIdentity = "henry" | "aurelia";

// sessionStorage (not localStorage) is deliberate: it clears when the tab
// or browser closes, so opening the site again later asks for the
// password again — which is what makes the visit count actually mean
// something. A refresh within the same tab/session won't re-prompt or
// double-count, but a fresh visit later will.
const STORAGE_KEY = "aurelia.visitorIdentity";

export function getStoredIdentity(): VisitorIdentity | null {
  const value = window.sessionStorage.getItem(STORAGE_KEY);
  return value === "henry" || value === "aurelia" ? value : null;
}

export function setStoredIdentity(identity: VisitorIdentity) {
  window.sessionStorage.setItem(STORAGE_KEY, identity);
}