import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { ScrollView, Text, View, Picker, Input } from '@tarojs/components';

import {
  CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES,
  PROVIDER_WORKBENCH_SUBSCRIBE_TEMPLATES,
  PILOT_VERIFICATION_SUBSCRIBE_TEMPLATES,
  COMMON_PLATFORM_SUBSCRIBE_TEMPLATES,
} from '../../../constants/subscribeTemplates';
import { requestSubscribe, devTriggerWeChatSubscribe } from '../../../services/push';
import { friendlyErrorMessage } from '../../../utils/errorMessage';

// 后端订阅消息白名单（要和 backend/internal/service/wechat_subscribe_service.go 保持一致）
const SUBSCRIBE_EVENT_TYPES = [
  'direct_order_created',
  'direct_order_confirmed',
  'order_paid',
  'settlement_settled',
  'broadcast_auto_assigned',
  'dispatch_created',
  'pilot_verification_result',
];

type SubscribeGroup = {
  key: string;
  title: string;
  description: string;
  templateIds: string[];
};

const SUBSCRIBE_GROUPS: SubscribeGroup[] = [
  {
    key: 'customer',
    title: '客户下单模板组',
    description: '设置 / 快单 / 服务市场入口',
    templateIds: CUSTOMER_ORDER_SUBSCRIBE_TEMPLATES,
  },
  {
    key: 'provider',
    title: '服务商工作台模板组',
    description: '工作台上线入口',
    templateIds: PROVIDER_WORKBENCH_SUBSCRIBE_TEMPLATES,
  },
  {
    key: 'pilot',
    title: '飞手资质模板组',
    description: '飞手注册提交入口',
    templateIds: PILOT_VERIFICATION_SUBSCRIBE_TEMPLATES,
  },
  {
    key: 'common',
    title: '设置开关（全量）',
    description: '设置页"接收平台通知"开关',
    templateIds: COMMON_PLATFORM_SUBSCRIBE_TEMPLATES,
  },
];

type LogEntry = {
  ts: string;
  group: string;
  status: 'ok' | 'warn' | 'err';
  message: string;
};

export default function SubscribeTestPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [eventTypeIndex, setEventTypeIndex] = useState(2); // order_paid 默认
  const [extrasJSON, setExtrasJSON] = useState('{"order_id": 1, "order_no": "DEV-TEST"}');
  const [triggering, setTriggering] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  const pushLog = (entry: Omit<LogEntry, 'ts'>) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [{ ts, ...entry }, ...prev].slice(0, 20));
  };

  const handleRequestGroup = async (group: SubscribeGroup) => {
    if (requesting) return;
    setRequesting(group.key);
    try {
      if (group.templateIds.length === 0) {
        pushLog({
          group: group.title,
          status: 'warn',
          message: '模板组为空——subscribeTemplates.ts 里对应模板 ID 还没填',
        });
        return;
      }
      const accepted = await requestSubscribe(group.templateIds);
      if (accepted.length === group.templateIds.length) {
        pushLog({
          group: group.title,
          status: 'ok',
          message: `全部接受（${accepted.length}/${group.templateIds.length}），已上报后端授权额度`,
        });
      } else if (accepted.length > 0) {
        pushLog({
          group: group.title,
          status: 'warn',
          message: `部分接受（${accepted.length}/${group.templateIds.length}）：${accepted.join(', ')}`,
        });
      } else {
        pushLog({
          group: group.title,
          status: 'warn',
          message: '一个都没接受——用户拒绝/取消，或模板 ID 与微信后台不一致',
        });
      }
    } catch (e: any) {
      pushLog({
        group: group.title,
        status: 'err',
        message: friendlyErrorMessage(e, '调用 requestSubscribe 失败'),
      });
    } finally {
      setRequesting(null);
    }
  };

  const handleDevTrigger = async () => {
    if (triggering) return;
    setTriggering(true);
    try {
      let extras: Record<string, any> = {};
      if (extrasJSON.trim()) {
        try {
          extras = JSON.parse(extrasJSON);
        } catch {
          Taro.showToast({ title: 'extras 不是合法 JSON', icon: 'none' });
          return;
        }
      }
      const eventType = SUBSCRIBE_EVENT_TYPES[eventTypeIndex];
      const res = await devTriggerWeChatSubscribe(eventType, extras);
      pushLog({
        group: `后端触发 ${eventType}`,
        status: 'ok',
        message: (res as any)?.note || '已发送，请到微信「服务通知」查收（mock 模式看后端日志）',
      });
    } catch (e: any) {
      pushLog({
        group: '后端触发',
        status: 'err',
        message: friendlyErrorMessage(e, 'dev-trigger 调用失败（生产模式已禁用）'),
      });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <ScrollView scrollY style={{ background: '#f5f7fa', minHeight: '100vh' }}>
      <View style={{ padding: '20px 16px 24px' }}>
        <Text style={{ display: 'block', fontSize: '20px', fontWeight: 700, color: '#111', marginBottom: '6px' }}>
          订阅消息诊断
        </Text>
        <Text style={{ display: 'block', fontSize: '13px', color: '#5a6677', lineHeight: 1.5 }}>
          上：拉起一次 wx.requestSubscribeMessage（覆盖 4 个入口的模板组合）。
          下：直接调后端 SendEvent，验证「真发出去」链路；仅在非 release 后端可用。
        </Text>
      </View>

      <View style={{ background: '#fff', margin: '0 12px 16px', borderRadius: '14px', padding: '12px' }}>
        <Text style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#222', marginBottom: '4px' }}>
          Layer 2 · 拉起授权弹窗
        </Text>
        <Text style={{ display: 'block', fontSize: '12px', color: '#8a98ad', marginBottom: '12px' }}>
          每组对应一处业务入口的真实模板组合
        </Text>
        {SUBSCRIBE_GROUPS.map((group) => (
          <View
            key={group.key}
            onClick={() => handleRequestGroup(group)}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: requesting === group.key ? '#e6ecf5' : '#eaf3ff',
              marginBottom: '10px',
              opacity: requesting && requesting !== group.key ? 0.5 : 1,
            }}
          >
            <Text style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1677ff' }}>
              {group.title}
            </Text>
            <Text style={{ display: 'block', fontSize: '12px', color: '#5a6677', marginTop: '4px' }}>
              {group.description}（{group.templateIds.length} 个模板）
              {requesting === group.key ? ' · 等待用户授权…' : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ background: '#fff', margin: '0 12px 16px', borderRadius: '14px', padding: '12px' }}>
        <Text style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#222', marginBottom: '4px' }}>
          Layer 3 · 后端触发 SendEvent
        </Text>
        <Text style={{ display: 'block', fontSize: '12px', color: '#8a98ad', marginBottom: '12px' }}>
          要求：当前账号已走过 Layer 2 授权 + 真模板 ID 已配置
        </Text>
        <Text style={{ display: 'block', fontSize: '12px', color: '#5a6677', marginBottom: '4px' }}>事件类型</Text>
        <Picker
          mode='selector'
          range={SUBSCRIBE_EVENT_TYPES}
          value={eventTypeIndex}
          onChange={(e) => setEventTypeIndex(Number(e.detail.value))}
        >
          <View style={{
            padding: '10px 12px', border: '1px solid #e5e5e5', borderRadius: '10px',
            fontSize: '14px', color: '#333', marginBottom: '12px',
          }}>
            <Text>{SUBSCRIBE_EVENT_TYPES[eventTypeIndex]}</Text>
          </View>
        </Picker>
        <Text style={{ display: 'block', fontSize: '12px', color: '#5a6677', marginBottom: '4px' }}>
          extras (JSON，需对得上模板 data 字段映射)
        </Text>
        <Input
          style={{
            padding: '10px 12px', border: '1px solid #e5e5e5', borderRadius: '10px',
            fontSize: '13px', color: '#333', marginBottom: '12px', height: '40px',
          }}
          value={extrasJSON}
          onInput={(e) => setExtrasJSON(e.detail.value)}
        />
        <View
          onClick={handleDevTrigger}
          style={{
            padding: '12px',
            borderRadius: '10px',
            background: triggering ? '#91caff' : '#1677ff',
            textAlign: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            {triggering ? '触发中…' : '触发后端 SendEvent'}
          </Text>
        </View>
      </View>

      <View style={{ background: '#fff', margin: '0 12px 24px', borderRadius: '14px', padding: '12px' }}>
        <Text style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#222', marginBottom: '12px' }}>
          调用日志 · 最近 20 条
        </Text>
        {logs.length === 0 ? (
          <Text style={{ display: 'block', fontSize: '12px', color: '#8a98ad', textAlign: 'center', padding: '20px 0' }}>
            暂无记录
          </Text>
        ) : (
          logs.map((log, i) => (
            <View
              key={i}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: log.status === 'ok' ? '#e8f7ec' : log.status === 'warn' ? '#fff7e6' : '#ffece8',
                marginBottom: '8px',
              }}
            >
              <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Text style={{ fontSize: '13px', fontWeight: 600, color: '#222' }}>{log.group}</Text>
                <Text style={{ fontSize: '11px', color: '#8a98ad' }}>{log.ts}</Text>
              </View>
              <Text style={{ display: 'block', fontSize: '12px', color: '#5a6677', lineHeight: 1.5 }}>{log.message}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
