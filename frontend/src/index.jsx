import "./init";
import React from "react";
import { createRoot } from "react-dom/client";
import monday from "./lib/monday";
import App from "./App";

const THEME_CLASSES = ["light-app-theme", "dark-app-theme", "black-app-theme"];

function applyTheme(themeName) {
  const cls = `${themeName}-app-theme`;
  if (!THEME_CLASSES.includes(cls)) return;
  document.body.classList.remove(...THEME_CLASSES);
  document.body.classList.add(cls);
}

monday.listen("context", (res) => {
  const theme = res?.data?.theme;
  if (theme) applyTheme(theme);
});

const root = createRoot(document.getElementById("root"));
root.render(<App />);
