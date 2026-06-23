import Taro from '@tarojs/taro';
import type { QuickOrderDraft } from '../types';

export const QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY = 'quick_order_offer_draft_v1';

const parseStoredDraft = (value: unknown): QuickOrderDraft | null => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as QuickOrderDraft;
  } catch {
    return null;
  }
};

export const readQuickOrderOfferDraft = () =>
  parseStoredDraft(Taro.getStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY));

export const saveQuickOrderOfferDraft = (draft: QuickOrderDraft) => {
  Taro.setStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY, draft);
};

export const clearQuickOrderOfferDraft = () => {
  Taro.removeStorageSync(QUICK_ORDER_OFFER_DRAFT_STORAGE_KEY);
};

export const clearQuickOrderOfferDraftForDemand = (demandId?: number | string | null) => {
  const targetDemandId = Number(demandId || 0);
  if (!targetDemandId) return false;
  const draft = readQuickOrderOfferDraft();
  if (Number(draft?.demand_id || 0) !== targetDemandId) return false;
  clearQuickOrderOfferDraft();
  return true;
};

const shortAddress = (address: QuickOrderDraft['departure_address'], fallback: string) =>
  address?.name || address?.address || fallback;

const formatWorkTime = (value?: string) => {
  if (!value) return '时间待定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间待定';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

export const quickOrderOfferDraftSummary = (draft: QuickOrderDraft) => {
  const weight = Number(draft.cargo_weight_kg || 0);
  return {
    route: `${shortAddress(draft.departure_address, '起吊点')} → ${shortAddress(draft.destination_address, '落放点')}`,
    meta: `${weight > 0 ? `${weight}kg` : '重量待定'} · ${formatWorkTime(draft.scheduled_start_at)}`,
  };
};
