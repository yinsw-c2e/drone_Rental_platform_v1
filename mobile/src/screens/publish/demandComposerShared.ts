import {AddressData} from '../../types';

export const DEMAND_SCENE_OPTIONS = [
  {key: 'power_grid', label: '电网建设'},
  {key: 'mountain_agriculture', label: '山区农副产品'},
  {key: 'plateau_supply', label: '高原给养'},
  {key: 'island_supply', label: '海岛补给'},
  {key: 'emergency', label: '应急救援'},
];

export function buildDefaultDemandStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function buildDefaultDemandEnd(startDate: Date): Date {
  const date = new Date(startDate.getTime());
  date.setHours(date.getHours() + 8);
  return date;
}

export function buildDefaultDemandExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 59, 0);
  return date.toISOString();
}

export function formatDemandDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function parseDemandDate(value: string | undefined | null, fallback: Date): Date {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
}

export function toAddressSnapshot(value: AddressData | null | undefined) {
  return value
    ? {
        text: value.address,
        province: value.province,
        city: value.city,
        district: value.district,
        latitude: value.latitude,
        longitude: value.longitude,
      }
    : undefined;
}

export function snapshotToAddressData(snapshot: any): AddressData | null {
  if (!snapshot || !snapshot.text) {
    return null;
  }
  return {
    address: snapshot.text,
    city: snapshot.city || '',
    district: snapshot.district || '',
    province: snapshot.province || '',
    latitude: snapshot.latitude || 0,
    longitude: snapshot.longitude || 0,
  };
}

export function summarizeAddress(address?: AddressData | null): string {
  if (!address) {
    return '待补充';
  }
  return address.name || address.address || '待补充';
}

export function getSceneLabel(sceneKey: string): string {
  return DEMAND_SCENE_OPTIONS.find(option => option.key === sceneKey)?.label || '重载吊运';
}

export function deriveDraftTitle(params: {
  title?: string;
  sceneKey: string;
  serviceAddress?: AddressData | null;
  departureAddress?: AddressData | null;
  destinationAddress?: AddressData | null;
}) {
  const trimmed = params.title?.trim();
  if (trimmed) {
    return trimmed;
  }

  const sceneLabel = getSceneLabel(params.sceneKey);
  if (params.departureAddress || params.destinationAddress) {
    const from = params.departureAddress?.city || params.departureAddress?.district || '起点';
    const to = params.destinationAddress?.city || params.destinationAddress?.district || '终点';
    return `${sceneLabel}任务：${from} -> ${to}`;
  }
  const addressText =
    params.serviceAddress?.city ||
    params.serviceAddress?.district ||
    params.serviceAddress?.name ||
    params.serviceAddress?.address ||
    '作业点';
  return `${sceneLabel}任务：${addressText}`;
}

export function formatSavedAt(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatDemandDateTime(date);
}
