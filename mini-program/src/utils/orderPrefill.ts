import Taro from '@tarojs/taro';

export const QUICK_ORDER_PREFILL_STORAGE_KEY = 'customer_home_quick_order_prefill_v1';
export const ORDER_REDISPATCH_HINT_STORAGE_KEY = 'customer_order_redispatch_hint_v1';

export type OrderPrefillCompleteness = 'full' | 'partial';

export const writeQuickOrderPrefillFromOrder = (order: any): OrderPrefillCompleteness => {
  const weight = Number(order?.cargo_weight_kg || order?.cargo_weight || 0);
  const scheduledStartAt = String(order?.start_time || order?.scheduled_start_at || '');
  const pickupLat = Number(order?.service_latitude || 0);
  const pickupLng = Number(order?.service_longitude || 0);
  const pickupText = String(order?.service_address || '').trim();
  const dropoffLat = Number(order?.dest_latitude || 0);
  const dropoffLng = Number(order?.dest_longitude || 0);
  const dropoffText = String(order?.dest_address || '').trim();
  const hasPickup = pickupLat !== 0 && pickupLng !== 0 && pickupText.length > 0;
  const hasDropoff = dropoffLat !== 0 && dropoffLng !== 0 && dropoffText.length > 0;
  const completeness: OrderPrefillCompleteness = hasPickup && hasDropoff ? 'full' : 'partial';

  Taro.setStorageSync(QUICK_ORDER_PREFILL_STORAGE_KEY, {
    pickupAddress: hasPickup
      ? { address: pickupText, name: pickupText, latitude: pickupLat, longitude: pickupLng }
      : undefined,
    deliveryAddress: hasDropoff
      ? { address: dropoffText, name: dropoffText, latitude: dropoffLat, longitude: dropoffLng }
      : undefined,
    cargoWeight: weight > 0 ? String(weight) : '',
    scheduledStartAt: scheduledStartAt || undefined,
    timeOption: scheduledStartAt ? '预约' : '尽快',
  });
  Taro.setStorageSync(ORDER_REDISPATCH_HINT_STORAGE_KEY, completeness);

  return completeness;
};
