import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for PWA support (independent of notification permission)
// This enables the app to be installed and receive push notifications
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/"
      });
      console.log("[PWA] Service Worker registered successfully:", registration.scope);

      // Check for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[PWA] New Service Worker activated");
            }
          });
        }
      });
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
