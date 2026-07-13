import React from "react";
import { createRoot } from "react-dom/client";
import { installLocalStorage } from "./localStorageAdapter.js";
import App from "./App.jsx";

installLocalStorage();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
