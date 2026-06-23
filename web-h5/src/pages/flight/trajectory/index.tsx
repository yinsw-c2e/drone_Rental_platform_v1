interface FlightTrajectory { id: number; status: string; }
interface FlightWaypoint { latitude: number; longitude: number; altitude: number; }
interface SavedRoute { id: number; name: string; is_public: boolean; description?: string; total_distance: number; estimated_duration: number; }
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import flightService from '../../../services/flight';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

export default function TrajectoryPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || 0);

  const [activeTab, setActiveTab] = useState<'recording' | 'myRoutes' | 'publicRoutes'>('recording');
  const [trajectory, setTrajectory] = useState<FlightTrajectory | null>(null);
  const [waypoints, setWaypoints] = useState<FlightWaypoint[]>([]);
  const [myRoutes, setMyRoutes] = useState<SavedRoute[]>([]);
  const [publicRoutes, setPublicRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoutes = async () => {
    try {
      const [my, pub] = await Promise.all([
        flightService.listMyRoutes().catch(() => []),
        flightService.listPublicRoutes().catch(() => []),
      ]);
      setMyRoutes(my || []);
      setPublicRoutes(pub || []);
    } catch (e) {
      Taro.showToast({ title: '加载路线失败', icon: 'none' });
    }
  };

  useDidShow(() => {
    loadRoutes();
  });

  const handleStartRecording = async () => {
    if (!orderId) {
      Taro.showToast({ title: '请从订单进入', icon: 'none' });
      return;
    }
    try {
      setLoading(true);
      const traj = await flightService.startTrajectory(orderId);
      setTrajectory(traj);
      Taro.showToast({ title: '记录已开始', icon: 'success' });
    } catch (e: any) {
      Taro.showToast({ title: friendlyErrorMessage(e, '操作失败'), icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = () => {
    if (!trajectory) return;
    Taro.showModal({
      title: '停止记录',
      content: '确定要停止轨迹记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            setLoading(true);
            const traj = await flightService.stopTrajectory(trajectory.id);
            setTrajectory(traj);
            const detail = await flightService.getTrajectory(trajectory.id);
            setWaypoints(detail.waypoints || []);
            Taro.showToast({ title: '记录已停止', icon: 'success' });
          } catch (e: any) {
            Taro.showToast({ title: friendlyErrorMessage(e, '操作失败'), icon: 'none' });
          } finally {
            setLoading(false);
          }
        }
      }
    });
  };

  const handleSaveRoute = async () => {
    if (!trajectory) return;
    Taro.showModal({
      title: '保存路线',
      editable: true,
      placeholderText: '请输入路线名称',
      success: async (res: any) => {
        if (res.confirm && res.content) {
          try {
            Taro.showLoading({ title: '保存中' });
            await flightService.createRouteFromTrajectory(trajectory.id, {
              name: res.content.trim(),
              is_public: false,
            });
            Taro.hideLoading();
            Taro.showToast({ title: '保存成功', icon: 'success' });
            loadRoutes();
          } catch (e: any) {
            Taro.hideLoading();
            Taro.showToast({ title: friendlyErrorMessage(e, '保存失败'), icon: 'none' });
          }
        }
      }
    } as any);
  };

  const renderRecording = () => {
    return (
      <View className="tab-pane">
        <View className="status-card">
          <Text className="status-title">状态：{trajectory ? (trajectory.status === 'recording' ? '记录中' : '已停止') : '未开始'}</Text>
          <Text className="status-desc">轨迹点数：{waypoints.length || (trajectory ? '-' : '0')}</Text>
        </View>

        <View className="action-row">
          {!trajectory || trajectory.status !== 'recording' ? (
            <View className="btn btn-primary" onClick={handleStartRecording}>
              <Text className="btn-text">{trajectory ? '重新开始' : '开始记录'}</Text>
            </View>
          ) : (
            <View className="btn btn-danger" onClick={handleStopRecording}>
              <Text className="btn-text">停止记录</Text>
            </View>
          )}
          {trajectory && trajectory.status === 'completed' && (
            <View className="btn btn-success" onClick={handleSaveRoute} style={{ marginLeft: '12px' }}>
              <Text className="btn-text">保存路线</Text>
            </View>
          )}
        </View>

        <View className="history-list">
          {waypoints.length > 0 ? waypoints.map((wp, i) => (
            <View key={i} className="waypoint-item">
              <Text className="wp-index">#{i + 1}</Text>
              <Text className="wp-coord">{Number(wp.latitude).toFixed(6)}, {Number(wp.longitude).toFixed(6)}</Text>
              <Text className="wp-alt">{Number(wp.altitude).toFixed(1)}m</Text>
            </View>
          )) : (
            <View className="empty-state"><Text className="empty-state-text">暂无轨迹点数据</Text></View>
          )}
        </View>
      </View>
    );
  };

  const renderRoutes = (routes: SavedRoute[]) => {
    if (routes.length === 0) return <View className="empty-state"><Text className="empty-state-text">暂无路线</Text></View>;
    return (
      <View className="routes-list">
        {routes.map(r => (
          <View key={r.id} className="route-card">
            <View className="route-header">
              <Text className="route-name">{r.name}</Text>
              {r.is_public && <Text className="route-badge">公开</Text>}
            </View>
            <Text className="route-desc">{r.description || '暂无描述'}</Text>
            <View className="route-footer">
              <Text className="route-stats">距离：{(Number(r.total_distance) / 1000).toFixed(1)} km</Text>
              <Text className="route-stats">预估：{Math.ceil(Number(r.estimated_duration) / 60)} 分钟</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View className="page-wrap">
      <View className="tabs-header">
        <View className={`tab-item ${activeTab === 'recording' ? 'active' : ''}`} onClick={() => setActiveTab('recording')}>
          <Text className={`tab-text ${activeTab === 'recording' ? 'active-text' : ''}`}>轨迹记录</Text>
        </View>
        <View className={`tab-item ${activeTab === 'myRoutes' ? 'active' : ''}`} onClick={() => setActiveTab('myRoutes')}>
          <Text className={`tab-text ${activeTab === 'myRoutes' ? 'active-text' : ''}`}>我的路线</Text>
        </View>
        <View className={`tab-item ${activeTab === 'publicRoutes' ? 'active' : ''}`} onClick={() => setActiveTab('publicRoutes')}>
          <Text className={`tab-text ${activeTab === 'publicRoutes' ? 'active-text' : ''}`}>公共路线</Text>
        </View>
      </View>
      <ScrollView scrollY className="tab-content">
        {activeTab === 'recording' && renderRecording()}
        {activeTab === 'myRoutes' && renderRoutes(myRoutes)}
        {activeTab === 'publicRoutes' && renderRoutes(publicRoutes)}
      </ScrollView>
    </View>
  );
}
