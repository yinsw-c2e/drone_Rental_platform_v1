import { AirspaceCheckResult } from '../services/airspace';

export const isAirspaceHardBlocked = (result?: AirspaceCheckResult | null) => {
  if (!result) {
    return false;
  }
  const status = String(result.status || '').toLowerCase();
  if (status === 'blocked') {
    return true;
  }
  if (result.available === false && result.allows_continue === false) {
    return true;
  }
  return (result.restrictions || []).some((item) => {
    const level = String(item.restriction_level || '').toLowerCase();
    return level === 'no_fly' || level === 'blocked';
  });
};
