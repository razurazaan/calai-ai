// Portion rescaling for the food editor. Mirrored in client/src/portion.js: keep them in sync.
//
// `base` holds the unrounded values at a known weight. Every scaled value is computed from `base`,
// never from what is on screen, so typing a weight digit by digit can't compound rounding errors.
const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'] as const;
type Nutrient = (typeof NUTRIENTS)[number];

export type PortionBase = { grams: number } & Record<Nutrient, number | ''>;
export type PortionForm = { portionGrams: string; base: PortionBase } & Record<Nutrient, string>;

const num = (v: unknown) => Math.max(0, Number(v) || 0);
const toBase = (v: unknown): number | '' => (v === '' || v == null ? '' : num(v));

export function makeBase(initial: { portionGrams?: number } & Partial<Record<Nutrient, number>>): PortionBase {
  return {
    grams: num(initial.portionGrams),
    calories: toBase(initial.calories),
    protein: toBase(initial.protein),
    carbs: toBase(initial.carbs),
    fat: toBase(initial.fat),
  };
}

// The user typed a new weight. An empty or zero weight shows the base values again.
export function applyPortion<F extends PortionForm>(form: F, value: string): F {
  const { base } = form;
  if (!base.grams) return { ...form, portionGrams: value };
  const grams = num(value);
  const ratio = grams ? grams / base.grams : 1;
  const next = { ...form, portionGrams: value };
  for (const k of NUTRIENTS) {
    const b = base[k];
    (next as PortionForm)[k] = b === '' ? '' : String(Math.round(b * ratio));
  }
  return next;
}

// The user typed a nutrient directly: keep it, converted back to the base weight, for later rescaling.
export function applyNutrient<F extends PortionForm>(form: F, key: Nutrient, value: string): F {
  const { base } = form;
  const grams = num(form.portionGrams);
  const atBase = value === '' ? '' : base.grams && grams ? (num(value) * base.grams) / grams : num(value);
  return { ...form, [key]: value, base: { ...base, [key]: atBase } };
}

// Manual entries start with no weight. The first one entered becomes the base once the user leaves the field.
export function commitPortion<F extends PortionForm>(form: F): F {
  const grams = num(form.portionGrams);
  if (form.base.grams || !grams) return form;
  return { ...form, base: { ...form.base, grams } };
}
