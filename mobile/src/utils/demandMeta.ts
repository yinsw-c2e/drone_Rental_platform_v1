import {AddressSnapshot, DemandDetail, DemandSummary} from '../types';
import {formatAmountYuan, SUPPLY_SCENE_LABELS} from './supplyMeta';

export const getDemandSceneLabel = (scene?: string | null): string => {
  const key = String(scene || '');
  if (!key) {
    return '未标注场景';
  }
  return SUPPLY_SCENE_LABELS[key] || key;
};

export const formatDemandBudget = (min?: number | null, max?: number | null): string => {
  const lower = Number(min || 0);
  const upper = Number(max || 0);
  if (lower > 0 && upper > 0) {
    return `${formatAmountYuan(lower)} - ${formatAmountYuan(upper)}`;
  }
  if (upper > 0) {
    return `${formatAmountYuan(upper)} 以内`;
  }
  if (lower > 0) {
    return `${formatAmountYuan(lower)} 起`;
  }
  return '预算待沟通';
};

export const formatDemandSchedule = (startAt?: string, endAt?: string): string => {
  if (!startAt && !endAt) {
    return '时间待沟通';
  }
  const startText = startAt ? formatDateTime(startAt) : '待定';
  const endText = endAt ? formatDateTime(endAt) : '待定';
  return `${startText} - ${endText}`;
};

export const resolveDemandPrimaryAddress = (demand?: Partial<DemandDetail | DemandSummary> & {
  departure_address?: AddressSnapshot | null;
  destination_address?: AddressSnapshot | null;
  service_address?: AddressSnapshot | null;
}): string => {
  if (!demand) {
    return '地址待补充';
  }
  return (
    demand.service_address_text ||
    demand.service_address?.text ||
    demand.departure_address?.text ||
    demand.destination_address?.text ||
    '地址待补充'
  );
};

export const formatTripCount = (tripCount?: number | null): string =>
  tripCount && tripCount > 1 ? `${tripCount} 架次` : '单架次';

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
