import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';

import {
  ComplianceCheck,
  airspaceService,
} from '../../services/airspace';
import { friendlyErrorMessage } from '../../utils/errorMessage';
import './index.scss';

const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  passed: { label: '通过', color: '#52C41A' },
  failed: { label: '未通过', color: '#F5222D' },
  warning: { label: '有提醒', color: '#FA8C16' },
  pending: { label: '检查中', color: '#1677FF' },
};

const CATEGORY_MAP: Record<string, string> = {
  pilot: '履约资质',
  drone: '无人机合规',
  cargo: '载荷检查',
  airspace: '空域检查',
};

const getResultConfig = (value?: string) =>
  RESULT_CONFIG[String(value || 'pending').toLowerCase()] || RESULT_CONFIG.pending;

export default function CompliancePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const checkId = Number(params.checkId || 0);
  const applicationId = Number(params.applicationId || 0);
  const pilotId = Number(params.pilotId || 0);
  const droneId = Number(params.droneId || 0);
  const orderId = Number(params.orderId || 0);

  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadCheck = async () => {
    setLoading(true);
    try {
      let next: ComplianceCheck | null = null;
      if (checkId) {
        next = await airspaceService.getComplianceCheck(checkId);
      } else if (pilotId && droneId) {
        next = await airspaceService.getLatestComplianceCheck(pilotId, droneId);
      }
      setCheck(next);
    } catch {
      setCheck(null);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadCheck();
  });

  const handleRunCheck = async () => {
    if (!pilotId || !droneId) {
      Taro.showToast({ title: '缺少履约资质或无人机信息', icon: 'none' });
      return;
    }
    setRunning(true);
    try {
      const next = await airspaceService.runComplianceCheck({
        pilot_id: pilotId,
        drone_id: droneId,
        order_id: orderId || undefined,
        airspace_application_id: applicationId || undefined,
        trigger_type: applicationId ? 'airspace_apply' : 'manual',
      });
      setCheck(next);
      const cfg = getResultConfig(next.overall_result);
      Taro.showToast({ title: `合规检查${cfg.label}`, icon: next.overall_result === 'failed' ? 'none' : 'success' });
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '检查失败'), icon: 'none' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScrollView scrollY className='compliance-wrap'>
      <View className='compliance-content'>
        <View className={`compliance-run-btn ${running ? 'compliance-run-disabled' : ''}`} onClick={handleRunCheck}>
          <Text className='compliance-run-text'>{running ? '检查中...' : check ? '重新检查' : '执行合规检查'}</Text>
        </View>

        {loading ? (
          <View className='empty-state'>
            <Text className='empty-state-text'>加载中...</Text>
          </View>
        ) : check ? (
          <View>
            {(() => {
              const cfg = getResultConfig(check.overall_result);
              return (
                <View className='compliance-overall' style={{ backgroundColor: `${cfg.color}22`, borderColor: cfg.color }}>
                  <View className='compliance-overall-icon' style={{ backgroundColor: cfg.color }}>
                    <Text className='compliance-overall-emoji'>{check.overall_result === 'passed' ? '✓' : check.overall_result === 'failed' ? '✕' : '!'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className='compliance-overall-title' style={{ color: cfg.color }}>合规检查{cfg.label}</Text>
                    <Text className='compliance-overall-desc'>{check.notes || '已完成本次合规检查'}</Text>
                    <View className='compliance-stats-row'>
                      <View className='compliance-stat'><Text className='compliance-stat-num' style={{ color: '#52C41A' }}>{check.passed_items || 0}</Text><Text className='compliance-stat-label'>通过</Text></View>
                      <View className='compliance-stat'><Text className='compliance-stat-num' style={{ color: '#F5222D' }}>{check.failed_items || 0}</Text><Text className='compliance-stat-label'>失败</Text></View>
                      <View className='compliance-stat'><Text className='compliance-stat-num' style={{ color: '#FA8C16' }}>{check.warning_items || 0}</Text><Text className='compliance-stat-label'>提醒</Text></View>
                      <View className='compliance-stat'><Text className='compliance-stat-num'>{check.total_items || 0}</Text><Text className='compliance-stat-label'>总计</Text></View>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View className='compliance-summary'>
              {Object.entries(CATEGORY_MAP).map(([cat, name]) => {
                const value = (check as any)[`${cat}_compliance`] as string;
                if (!value) {
                  return null;
                }
                const cfg = getResultConfig(value);
                return (
                  <View key={cat} className='compliance-summary-item' style={{ backgroundColor: `${cfg.color}22` }}>
                    <Text className='compliance-summary-label' style={{ color: cfg.color }}>{name}</Text>
                    <Text className='compliance-summary-value' style={{ color: cfg.color }}>{cfg.label}</Text>
                  </View>
                );
              })}
            </View>

            {(check.items || []).map((item, idx) => {
              const cfg = getResultConfig(item.result);
              return (
                <View key={item.id || idx} className='card compliance-item-card' style={{ borderLeftColor: cfg.color, borderLeftWidth: '3px' }}>
                  <View className='compliance-item-header'>
                    <Text className='compliance-item-name'>{item.check_name}</Text>
                    <View className='compliance-item-badge' style={{ backgroundColor: cfg.color }}>
                      <Text className='compliance-item-badge-text'>{cfg.label}</Text>
                    </View>
                  </View>
                  {item.message ? <Text className='compliance-item-msg'>{item.message}</Text> : null}
                  {item.expected_value ? <Text className='compliance-item-value'>要求: {item.expected_value}</Text> : null}
                  {item.actual_value ? <Text className='compliance-item-value'>实际: {item.actual_value}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View className='empty-state'>
            <Text className='empty-state-icon'>✅</Text>
            <Text className='empty-state-text'>暂无合规检查记录</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
