// Mirrors the server's effective feature status for UI routing and navigation.
// The API is still the authority: backend middleware guards every service write.
export function hasBusinessFeature(user, feature, now = Date.now()) {
  if (user?.role !== "business") return false;
  const access = user?.featureAccess?.[feature];
  // Preserve existing business accounts that haven't received a plan yet.
  if (!access) return true;
  if (access.enabled === false || access.active === false) return false;
  if (access.expiresAt) {
    const expiry = new Date(access.expiresAt).getTime();
    if (Number.isFinite(expiry) && expiry <= now) return false;
  }
  return true;
}
