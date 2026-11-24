import User from "../models/User.js";
import FoodLog from "../models/FoodLog.js";
import AiEvent from "../models/AiEvent.js";
import DailyActive from "../models/DailyActive.js";
import StepLog from "../models/StepLog.js";
import { forgetUserStatus } from "../middleware/auth.js";

// Deletes an account and everything tied to it: profile, food logs (with photos), AI history,
// activity and step history. Used by the admin website and by "Delete account" in the app.
// Payment rows are kept: they are financial records (amount, date, provider reference) that the law
// requires keeping, and they hold no personal details once the account is gone.
// Returns the deleted user, or null if there was none.
export async function deleteUserAndData(userId) {
  const user = await User.findByIdAndDelete(userId);
  if (!user) return null;
  const [logs, events] = await Promise.all([
    FoodLog.deleteMany({ user: user._id }),
    AiEvent.deleteMany({ user: user._id }),
    DailyActive.deleteMany({ user: user._id }),
    StepLog.deleteMany({ user: user._id }),
  ]);
  forgetUserStatus(user._id);
  return { user, deletedLogs: logs.deletedCount, deletedAiEvents: events.deletedCount };
}
