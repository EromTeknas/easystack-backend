import mongoose, { Schema, Document } from 'mongoose';

/**
 * Usage tracking for billing - stores dynamic counters per workspace per month
 * This allows flexible tracking without schema migrations
 */

export interface IUsage extends Document {
  workspaceId: number;
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
    workspaceId: {
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
UsageSchema.index({ workspaceId: 1, month: 1 }, { unique: true });

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
 * Increment usage counter for a workspace
 */
export async function incrementUsage(
  workspaceId: number,
  featureKey: string,
  amount: number = 1
): Promise<void> {
  const month = getCurrentMonth();
  
  await Usage.findOneAndUpdate(
    { workspaceId, month },
    {
      $inc: { [`usage.${featureKey}`]: amount },
    },
    { upsert: true }
  );
}

/**
 * Get usage for a specific workspace and month
 */
export async function getWorkspaceUsage(
  workspaceId: number,
  month?: string
): Promise<IUsage['usage']> {
  const targetMonth = month || getCurrentMonth();
  
  const usageDoc = await Usage.findOne({ workspaceId, month: targetMonth });
  
  return usageDoc?.usage || {};
}

/**
 * Reset usage for a workspace (typically at month start)
 */
export async function resetWorkspaceUsage(workspaceId: number): Promise<void> {
  const month = getCurrentMonth();
  
  await Usage.findOneAndUpdate(
    { workspaceId, month },
    { $set: { usage: {} } },
    { upsert: true }
  );
}
