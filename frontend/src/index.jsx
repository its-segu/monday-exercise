import "./init";
import { createRoot } from "react-dom/client";
import monday from "./lib/monday";
import App from "./App";

const ALL_THEME_CLASSES = [
  "light-app-theme",
  "dark-app-theme",
  "black-app-theme",
  "hacker_theme-app-theme",
];

function applyTheme(themeName) {
  const cls = themeName.endsWith("-app-theme") ? themeName : `${themeName}-app-theme`;
  document.body.classList.remove(...ALL_THEME_CLASSES);
  if (ALL_THEME_CLASSES.includes(cls)) {
    document.body.classList.add(cls);
  }
}

monday.listen("context", (res) => {
  const theme = res?.data?.theme;
  if (theme) applyTheme(theme);
});

const root = createRoot(document.getElementById("root"));
root.render(<App />);
