// Colour theme by gender: women get the pink theme (styles.css, :root[data-theme="female"]),
// everyone else the default. Remembered on the device so the app opens in the right colours.
const KEY = "calsnap_theme";

export function applyTheme(gender) {
  const female = gender === "female";
  const root = document.documentElement;
  if (female) root.dataset.theme = "female";
  else delete root.dataset.theme;
  try {
    female ? localStorage.setItem(KEY, "female") : localStorage.removeItem(KEY);
  } catch { /* storage blocked: the theme just isn't remembered */ }
  // Browser / phone status bar colour follows the page background
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  if (meta && bg) meta.content = bg;
}

// Before the first render, so a returning user doesn't see the default colours flash first
export function restoreTheme() {
  try {
    if (localStorage.getItem(KEY) === "female") applyTheme("female");
  } catch { /* ignore */ }
}
