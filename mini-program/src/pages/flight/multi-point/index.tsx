import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import flightService from '../../../services/flight';
import { formatUnknownEnumLabel } from '../../../utils';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: '未开始',
  in_progress: '执行中',
  completed: '已完成',
  cancelled: '已取消',
  failed: '已失败',
};

export default function MultiPointTaskPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || 0);

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadTask = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await flightService.getMultiPointTask(orderId);
      setTask(res);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => {
    loadTask();
  });

  const handleStartTask = async () => {
    try {
      Taro.showLoading({ title: '启动中' });
      await flightService.startMultiPointTask(task.id);
      Taro.hideLoading();
      Taro.showToast({ title: '任务已启动', icon: 'success' });
      loadTask();
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: friendlyErrorMessage(e, '启动失败'), icon: 'none' });
    }
  };

  const handleArrive = async (stopId: number) => {
    try {
      Taro.showLoading({ title: '处理中' });
      await flightService.arriveAtStop(task.id, stopId, { latitude: 0, longitude: 0 });
      Taro.hideLoading();
      Taro.showToast({ title: '已到达', icon: 'success' });
      loadTask();
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: friendlyErrorMessage(e, '操作失败'), icon: 'none' });
    }
  };

  const handleComplete = async (stopId: number) => {
    try {
      Taro.showLoading({ title: '处理中' });
      await flightService.completeStop(task.id, stopId);
      Taro.hideLoading();
      Taro.showToast({ title: '节点已完成', icon: 'success' });
      loadTask();
    } catch (e: any) {
      Taro.hideLoading();
      Taro.showToast({ title: friendlyErrorMessage(e, '操作失败'), icon: 'none' });
    }
  };

  if (loading && !task) {
    return <View className="page-wrap"><Text className="loading-text">加载中...</Text></View>;
  }

  if (!task) {
    return (
      <View className="page-wrap empty-state">
        <Text className="empty-state-text">未找到多点任务数据，或该订单不支持多点任务。</Text>
      </View>
    );
  }

  const isPending = task.status === 'pending';
  const inProgress = task.status === 'in_progress';
  const completed = task.status === 'completed';

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="task-header card">
        <Text className="task-title">{task.name || '多点任务'}</Text>
        <View className="task-meta">
          <Text className="meta-text">状态：{TASK_STATUS_LABELS[String(task.status || '').toLowerCase()] || formatUnknownEnumLabel(task.status, '未开始')}</Text>
          <Text className="meta-text">总距离：{(Number(task.total_distance) / 1000).toFixed(2)} km</Text>
        </View>
        {isPending && (
          <View className="btn btn-primary" onClick={handleStartTask}>
            <Text className="btn-text">开始执行任务</Text>
          </View>
        )}
      </View>

      <View className="stops-list card">
        <Text className="section-title">任务节点</Text>
        {(task.stops || []).map((stop: any, index: number) => {
          const isStopPending = stop.status === 'pending';
          const isArrived = stop.status === 'arrived';
          const isDone = stop.status === 'completed';

          return (
            <View key={stop.id} className="stop-item">
              <View className="stop-info">
                <Text className="stop-index">{index + 1}</Text>
                <View className="stop-detail">
                  <Text className="stop-name">{stop.action_type === 'pickup' ? '取货点' : stop.action_type === 'dropoff' ? '卸货点' : '途经点'}</Text>
                  <Text className="stop-status" style={{ color: isDone ? '#10B981' : isArrived ? '#F59E0B' : '#6B7280' }}>
                    {isDone ? '已完成' : isArrived ? '已到达' : '待处理'}
                  </Text>
                </View>
              </View>
              {inProgress && (
                <View className="stop-actions">
                  {isStopPending && (
                    <View className="btn-sm btn-outline" onClick={() => handleArrive(stop.id)}>
                      <Text className="btn-sm-text">确认到达</Text>
                    </View>
                  )}
                  {isArrived && (
                    <View className="btn-sm btn-primary" onClick={() => handleComplete(stop.id)}>
                      <Text className="btn-sm-text-white">完成作业</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
