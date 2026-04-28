import {AirspaceCheckResult} from '../services/airspace';

export function isAirspaceHardBlocked(result?: AirspaceCheckResult | null): boolean {
  if (!result) {
    return false;
  }
  return result.allows_continue === false || result.status === 'blocked' || result.available === false;
}

export function hasAirspaceRisk(result?: AirspaceCheckResult | null): boolean {
  if (!result) {
    return false;
  }
  return isAirspaceHardBlocked(result) || result.status === 'warning';
}

export function getAirspaceTitle(label: string, result?: AirspaceCheckResult | null, checking = false): string {
  if (checking) {
    return `${label}正在检测空域`;
  }
  if (isAirspaceHardBlocked(result)) {
    return `${label}命中禁飞区域`;
  }
  if (result?.status === 'warning') {
    return `${label}存在限飞提醒`;
  }
  return `${label}空域已检测`;
}

export function getAirspaceDescription(label: string, result?: AirspaceCheckResult | null, checking = false): string {
  if (checking) {
    return '系统正在核对当前位置附近的禁飞区和限飞要求，请稍候。';
  }
  if (!result) {
    return '';
  }
  if (result.recommended_action) {
    return result.recommended_action;
  }
  if (isAirspaceHardBlocked(result)) {
    return `${label}当前位于禁飞区内，请更换地址后再继续。`;
  }
  if (result.status === 'warning') {
    return `${label}附近存在限飞或注意区域，建议提前确认空域报备和限制条件。`;
  }
  return `${label}未发现禁飞限制，可以继续填写。`;
}

export function getAirspaceRestrictionSummary(result?: AirspaceCheckResult | null): string {
  if (!result?.restrictions?.length) {
    return '';
  }
  return result.restrictions
    .map(item => `${item.name}(${item.restriction_level === 'no_fly' ? '禁飞' : item.restriction_level === 'restricted' ? '限飞' : '注意'})`)
    .join('、');
}
