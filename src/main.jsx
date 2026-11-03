import React from "react";
import { createRoot } from "react-dom/client";
import { installLocalStorage } from "./localStorageAdapter.js";
import { initTheme } from "./theme.js";
import "./theme.css";
import App from "./App.jsx";

initTheme();

installLocalStorage();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
