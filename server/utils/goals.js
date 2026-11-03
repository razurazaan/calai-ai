const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const GOAL_ADJUST = { lose: -500, maintain: 0, gain: 300 };

// Mifflin-St Jeor BMR -> TDEE -> goal-adjusted calories, then a simple macro split.
export function computeGoals({ gender, age, heightCm, weightKg, activity, goal }) {
  if (!age || !heightCm || !weightKg) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "female" ? -161 : 5);
  const tdee = bmr * (ACTIVITY[activity] ?? 1.375);
  const minCalories = gender === "female" ? 1200 : 1500;
  const calories = Math.max(minCalories, Math.round(tdee + (GOAL_ADJUST[goal] ?? 0)));

  const protein = Math.round(weightKg * (goal === "maintain" ? 1.6 : 2.0));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}
