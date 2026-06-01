import Taro from '@tarojs/taro';

import { apiV2 } from './api';

type SubscribeResult = Record<string, string> & {
  errMsg?: string;
};

const normalizeTemplateIds = (tmplIds: string[]) =>
  Array.from(new Set((tmplIds || []).map(id => String(id || '').trim()).filter(Boolean)));

export const requestSubscribe = async (tmplIds: string[]) => {
  const ids = normalizeTemplateIds(tmplIds);
  if (!ids.length) {
    return [];
  }

  const requestSubscribeMessage = (Taro as any).requestSubscribeMessage;
  if (typeof requestSubscribeMessage !== 'function') {
    return [];
  }

  try {
    const result = await requestSubscribeMessage({ tmplIds: ids }) as SubscribeResult;
    const acceptedTemplateIds = ids.filter(id => result?.[id] === 'accept');
    if (acceptedTemplateIds.length > 0) {
      await apiV2.post('/push/wechat-subscribe', {
        accepted_template_ids: acceptedTemplateIds,
      }).catch(() => null);
    }
    return acceptedTemplateIds;
  } catch {
    return [];
  }
};

export const devTriggerWeChatSubscribe = (eventType: string, extras: Record<string, any> = {}) =>
  apiV2.post<{ triggered: boolean; user_id: number; event_type: string; note: string }>(
    '/push/wechat-subscribe/dev-trigger',
    { event_type: eventType, extras },
  );

export const pushService = {
  requestSubscribe,
  devTriggerWeChatSubscribe,
};
