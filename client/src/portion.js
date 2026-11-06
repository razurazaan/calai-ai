// Portion rescaling for the food editor. Mirrored in mobile/src/lib/portion.ts: keep them in sync.
//
// `base` holds the unrounded values at a known weight. Every scaled value is computed from `base`,
// never from what is on screen, so typing a weight digit by digit can't compound rounding errors.
const NUTRIENTS = ["calories", "protein", "carbs", "fat"];
const num = (v) => Math.max(0, Number(v) || 0);
const toBase = (v) => (v === "" || v == null ? "" : num(v));

export function makeBase(initial) {
  const base = { grams: num(initial.portionGrams) };
  for (const k of NUTRIENTS) base[k] = toBase(initial[k]);
  return base;
}

// The user typed a new weight. An empty or zero weight shows the base values again.
export function applyPortion(form, value) {
  const { base } = form;
  if (!base.grams) return { ...form, portionGrams: value };
  const grams = num(value);
  const ratio = grams ? grams / base.grams : 1;
  const next = { ...form, portionGrams: value };
  for (const k of NUTRIENTS) next[k] = base[k] === "" ? "" : String(Math.round(base[k] * ratio));
  return next;
}

// The user typed a nutrient directly: keep it, converted back to the base weight, for later rescaling.
export function applyNutrient(form, key, value) {
  const { base } = form;
  const grams = num(form.portionGrams);
  const atBase = value === "" ? "" : base.grams && grams ? (num(value) * base.grams) / grams : num(value);
  return { ...form, [key]: value, base: { ...base, [key]: atBase } };
}

// Manual entries start with no weight. The first one entered becomes the base once the user leaves the field.
export function commitPortion(form) {
  const grams = num(form.portionGrams);
  if (form.base.grams || !grams) return form;
  return { ...form, base: { ...form.base, grams } };
}
