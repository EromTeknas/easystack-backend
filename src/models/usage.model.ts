import mongoose, { Schema, Document } from 'mongoose';

/**
 * Usage tracking for billing - stores dynamic counters per user per month
 * This allows flexible tracking without schema migrations
 */

export interface IUsage extends Document {
  userId: number;
  month: string; // Format: "YYYY-MM"
  usage: {
    projects?: number;
    environments?: number;
    users?: number;
    api_requests?: number;
    ai_tokens?: number;
    storage_mb?: number;
    [key: string]: number | undefined; // Allow dynamic fields
  };
  createdAt: Date;
  updatedAt: Date;
}

const UsageSchema = new Schema<IUsage>(
  {
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      index: true,
    },
    usage: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'usage',
  }
);

// Compound index for efficient queries
UsageSchema.index({ userId: 1, month: 1 }, { unique: true });

export const Usage = mongoose.model<IUsage>('Usage', UsageSchema);

/**
 * Helper to get current month string
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Increment usage counter for a user
 */
export async function incrementUsage(
  userId: number,
  featureKey: string,
  amount: number = 1
): Promise<void> {
  const month = getCurrentMonth();
  
  await Usage.findOneAndUpdate(
    { userId, month },
    {
      $inc: { [`usage.${featureKey}`]: amount },
    },
    { upsert: true }
  );
}

/**
 * Get usage for a specific user and month
 */
export async function getUserUsage(
  userId: number,
  month?: string
): Promise<IUsage['usage']> {
  const targetMonth = month || getCurrentMonth();
  
  const usageDoc = await Usage.findOne({ userId, month: targetMonth });
  
  return usageDoc?.usage || {};
}

/**
 * Reset usage for a user (typically at month start)
 */
export async function resetUserUsage(userId: number): Promise<void> {
  const month = getCurrentMonth();
  
  await Usage.findOneAndUpdate(
    { userId, month },
    { $set: { usage: {} } },
    { upsert: true }
  );
}
