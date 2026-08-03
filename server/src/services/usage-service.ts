import { getFirebaseFirestore } from './firebase-admin.js';
import log from '../utils/logger.js';

const FREE_ANALYSIS_LIMIT = 3;

export function getMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function withFallback<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    log.error('Firestore usage tracking unavailable, failing open', { error: err });
    return fallback;
  }
}

export async function getMonthlyAnalysisCount(uid: string, monthKey?: string): Promise<number> {
  const month = monthKey || getMonthKey();
  return withFallback(0, async () => {
    const snap = await getFirebaseFirestore()
      .collection('users')
      .doc(uid)
      .collection('usage')
      .doc(month)
      .collection('analyses')
      .listDocuments();
    return snap.length;
  });
}

export async function recordAnalysisUsage(uid: string, meetingId: string, monthKey?: string): Promise<void> {
  const month = monthKey || getMonthKey();
  await withFallback(undefined, async () => {
    await getFirebaseFirestore()
      .collection('users')
      .doc(uid)
      .collection('usage')
      .doc(month)
      .collection('analyses')
      .doc(meetingId)
      .set({ at: new Date().toISOString() });
  });
}

export { FREE_ANALYSIS_LIMIT };
