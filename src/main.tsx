import ReactDOM from "react-dom/client";
// Vendored UI fonts first, so the @font-face declarations are in the bundle and
// content-hashed by Vite (no third-party request, typography works offline).
import "./assets/fonts/fonts.css";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// FIN-01 — PWA: register the offline shell worker (production only).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline shell is progressive enhancement */
    });
  });
}
