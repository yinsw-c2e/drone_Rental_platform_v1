export const SUPPLY_SCENE_LABELS: Record<string, string> = {
  power_grid: '电网建设',
  mountain_agriculture: '山区农副产品',
  plateau_supply: '高原给养',
  island_supply: '海岛补给',
  emergency: '应急救援',
};

export const SUPPLY_PRICING_UNIT_LABELS: Record<string, string> = {
  per_order: '元/单',
  per_trip: '元/架次',
  per_km: '元/公里',
  per_hour: '元/小时',
  per_day: '元/天',
  per_kg: '元/公斤',
  fixed: '一口价',
};

export const getSupplySceneLabel = (scene?: string | null): string => {
  const key = String(scene || '');
  if (!key) {
    return '未标注场景';
  }
  return SUPPLY_SCENE_LABELS[key] || key;
};

export const formatAmountYuan = (amount?: number | null): string =>
  `¥${((amount || 0) / 100).toFixed(2)}`;

export const formatSupplyPricing = (amount?: number | null, unit?: string | null): string => {
  const unitLabel = SUPPLY_PRICING_UNIT_LABELS[String(unit || '')] || unit || '元';
  return `${formatAmountYuan(amount)} ${unitLabel}`;
};

export const summarizeServiceArea = (snapshot: any): string => {
  if (!snapshot) {
    return '未设置服务区域';
  }
  if (typeof snapshot === 'string') {
    return snapshot;
  }
  if (Array.isArray(snapshot)) {
    const list = snapshot
      .map(item => summarizeServiceArea(item))
      .filter(Boolean);
    return list.length ? list.join(' / ') : '未设置服务区域';
  }
  if (typeof snapshot === 'object') {
    const text = snapshot.text || snapshot.address || snapshot.city || snapshot.region;
    if (text) {
      return String(text);
    }
  }
  return '未设置服务区域';
};

export const summarizeFlexibleValue = (value: any, emptyText = '未设置'): string => {
  if (value === null || value === undefined || value === '') {
    return emptyText;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map(item => summarizeFlexibleValue(item, ''))
      .filter(Boolean);
    return parts.length ? parts.join(' / ') : emptyText;
  }
  if (typeof value === 'object') {
    const preferred = value.summary || value.label || value.text || value.name;
    if (preferred) {
      return String(preferred);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return emptyText;
    }
  }
  return emptyText;
};
