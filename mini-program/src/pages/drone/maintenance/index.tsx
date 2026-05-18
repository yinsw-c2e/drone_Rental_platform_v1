import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import DateTimeField from '../../../components/DateTimeField';
import { apiV2 } from '../../../services/api';
import './index.scss';

export default function DroneMaintenancePage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const droneId = Number(params.id || 0);

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Log form
  const [showAdd, setShowAdd] = useState(false);
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('routine');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await apiV2.get(`/drone/${droneId}/maintenance`);
      setLogs((res as any).data?.list || (res as any).data?.items || []);
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadLogs();
  });

  const submitLog = async () => {
    if (!maintenanceDate || !description) return Taro.showToast({ title: '请填写日期和描述', icon: 'none' });
    setSubmitting(true);
    try {
      await apiV2.post(`/drone/${droneId}/maintenance`, {
        maintenance_date: new Date(maintenanceDate).toISOString(),
        maintenance_type: maintenanceType,
        description,
        cost: (parseFloat(cost) || 0) * 100
      });
      Taro.showToast({ title: '记录已添加', icon: 'success' });
      setShowAdd(false);
      setMaintenanceDate('');
      setDescription('');
      setCost('');
      loadLogs();
    } catch (e: any) {
      Taro.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="page-wrap">
      {showAdd ? (
        <ScrollView scrollY className="form-content">
          <View className="form-group">
            <View className="form-item form-date-item">
              <DateTimeField label="日期" value={maintenanceDate} onChange={setMaintenanceDate} mode="date" required />
            </View>
            <View className="form-item"><Text className="form-label">类型</Text><Input className="form-input" placeholder="routine/repair/inspection" value={maintenanceType} onInput={e => setMaintenanceType(e.detail.value)} /></View>
            <View className="form-item"><Text className="form-label">费用(元)</Text><Input className="form-input" type="digit" placeholder="0.00" value={cost} onInput={e => setCost(e.detail.value)} /></View>
            <View className="form-item border-none" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Text className="form-label" style={{ marginBottom: '8px' }}>维护描述</Text>
              <Input className="form-input" style={{ width: '100%', height: '80px' }} placeholder="填写维护保养的详细内容" value={description} onInput={e => setDescription(e.detail.value)} />
            </View>
          </View>
          <View className="bottom-bar">
            <View className="btn-outline" onClick={() => setShowAdd(false)}><Text className="btn-outline-text">取消</Text></View>
            <View className="btn-primary" onClick={submitLog}><Text className="btn-primary-text">保存记录</Text></View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView scrollY className="list-content">
          {loading ? (
            <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
          ) : logs.length === 0 ? (
            <View className="empty-state"><Text className="empty-state-text">暂无维护记录</Text></View>
          ) : (
            logs.map(log => (
              <View key={log.id} className="log-item">
                <View className="log-header">
                  <Text className="log-type">{log.maintenance_type === 'routine' ? '常规保养' : log.maintenance_type === 'repair' ? '故障维修' : log.maintenance_type}</Text>
                  <Text className="log-date">{new Date(log.maintenance_date).toLocaleDateString()}</Text>
                </View>
                <Text className="log-desc">{log.description}</Text>
                <Text className="log-cost">费用: ¥{((log.cost || 0) / 100).toFixed(2)}</Text>
              </View>
            ))
          )}
          <View className="bottom-bar" style={{ display: 'flex', flexDirection: 'row' }}>
            <View className="btn-primary" onClick={() => setShowAdd(true)} style={{ width: '100%' }}><Text className="btn-primary-text">添加维护记录</Text></View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
