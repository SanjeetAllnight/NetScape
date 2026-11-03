import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "@/index.css";
import { initializePwa } from "@/pwa/register";

// Initialize PWA service worker (prompt mode, app shell precache only)
initializePwa();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' not found in document");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

