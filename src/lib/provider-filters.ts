export function isProviderWithoutDriverProfile(provider: {
  driver_profiles?: unknown;
}): boolean {
  const relation = provider.driver_profiles;
  if (Array.isArray(relation)) return relation.length === 0;
  return relation == null;
}
