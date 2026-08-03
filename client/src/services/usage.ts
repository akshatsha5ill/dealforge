import { db } from './local-db/db';

export const getMonthlyAnalyzedCount = async (): Promise<number> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const analyses = await db.ai_analysis.toArray();
  const meetingIds = new Set(
    analyses.filter((a) => a.analyzedAt >= startOfMonth).map((a) => a.meetingId)
  );
  return meetingIds.size;
};
