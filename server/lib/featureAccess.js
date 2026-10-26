// Feature access defaults to enabled for existing businesses without a plan.
// Expiry is evaluated at request time; no cron job or in-memory timer is needed.
export const featureNames = ["pos", "booking"];
export const featureDurations = [7, 30, 90, 365];

export function featureStatus(source, feature, now = new Date()) {
  if (!featureNames.includes(feature)) throw new Error("Unknown feature.");
  const entry = source?.featureAccess?.[feature] || {};
  const enabled = entry.enabled !== false;
  const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
  const hasExpiry = Boolean(expiresAt && Number.isFinite(expiresAt.getTime()));
  const expired = enabled && hasExpiry && expiresAt.getTime() <= new Date(now).getTime();
  return {
    enabled,
    active: enabled && !expired,
    expired,
    expiresAt: hasExpiry ? expiresAt.toISOString() : null
  };
}

export function featureSummary(source, now = new Date()) {
  return Object.fromEntries(featureNames.map(feature => [feature, featureStatus(source, feature, now)]));
}
