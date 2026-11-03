// Local-time YYYY-MM-DD (not UTC, so late-night meals land on the right day)
export function dateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}

export function guessMealType(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

// Shrink a photo before upload: faster AI analysis + small thumbnail for the log
export function resizeImage(file, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Couldn't read that image"));
    img.src = url;
  });
}

export function shrinkDataUrl(dataUrl, maxSize = 240) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = dataUrl;
  });
}

export const MACROS = [
  { key: "protein", label: "Protein", color: "var(--protein)" },
  { key: "carbs", label: "Carbs", color: "var(--carbs)" },
  { key: "fat", label: "Fat", color: "var(--fat)" },
];

export const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
