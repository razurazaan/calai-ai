export type MacroKey = 'protein' | 'carbs' | 'fat';
export type Confidence = 'high' | 'medium' | 'low';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Nutrition = { calories: number; protein: number; carbs: number; fat: number };

export type Profile = {
  gender: 'male' | 'female';
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'active';
  goal: 'lose' | 'maintain' | 'gain';
};

export type User = {
  _id: string;
  name: string;
  email: string;
  onboarded: boolean;
  profile: Profile;
  goals: Nutrition;
  weights: { date: string; kg: number }[];
};

export type FoodItem = Nutrition & {
  name: string;
  portion?: string;
  portionGrams?: number;
  confidence?: Confidence;
};

// A saved log entry (has _id) or an unsaved AI/manual result being reviewed
export type FoodDraft = Partial<Nutrition> & {
  _id?: string;
  name?: string;
  mealType?: MealType;
  servings?: number;
  portionGrams?: number;
  confidence?: Confidence;
  uncertainty?: string;
  isEstimate?: boolean;
  healthScore?: number;
  notes?: string;
  items?: FoodItem[];
  image?: string;
  source?: 'ai-photo' | 'ai-text' | 'manual';
  createdAt?: string;
};

export type FoodLog = FoodDraft & Nutrition & { _id: string; name: string; servings: number; createdAt: string };

export type AiUsage = { enabled: boolean; limit: number; used: number; left: number };
