type ProgressOrderLike = {
  order_mode?: string | null;
  status?: string | null;
};

export type OrderProgressDestination = 'matching' | 'live' | 'none';

const progressModes = new Set(['instant', 'reservation']);
const matchingStatuses = new Set(['pending_dispatch', 'auto_assigning']);
const liveStatuses = new Set(['assigned', 'preparing', 'in_transit', 'delivered', 'completed']);

const normalizedMode = (order?: ProgressOrderLike | null) =>
  String(order?.order_mode || '').toLowerCase();

const normalizedStatus = (order?: ProgressOrderLike | null) =>
  String(order?.status || '').toLowerCase();

export const progressDestinationOf = (order?: ProgressOrderLike | null): OrderProgressDestination => {
  if (!progressModes.has(normalizedMode(order))) return 'none';
  const status = normalizedStatus(order);
  if (matchingStatuses.has(status)) return 'matching';
  if (liveStatuses.has(status)) return 'live';
  return 'none';
};

export const canOpenProgress = (order?: ProgressOrderLike | null) =>
  progressDestinationOf(order) !== 'none';

export const progressActionLabelOf = (order?: ProgressOrderLike | null) => {
  const destination = progressDestinationOf(order);
  if (destination === 'matching') return '查看匹配进度';
  if (destination === 'live') return '查看路线进度';
  return '查看进度';
};

export const progressUrlOf = (orderId: number | string | undefined | null, order?: ProgressOrderLike | null) => {
  const safeOrderId = Number(orderId || 0);
  if (!safeOrderId) return '';
  const destination = progressDestinationOf(order);
  if (destination === 'matching') return `/pages/dispatch/waiting/index?orderId=${safeOrderId}`;
  if (destination === 'live') return `/pages/orders/live/index?orderId=${safeOrderId}`;
  return '';
};
