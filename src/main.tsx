import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { PasswordGate } from "./features/gate/PasswordGate";
import "./styles/tokens.css";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </StrictMode>,
);