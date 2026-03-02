import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Progress, Tabs, Table, Tag, Button, DatePicker, message, Spin } from 'antd';
import {
  ReloadOutlined, ShoppingCartOutlined, DollarOutlined, TeamOutlined,
  RocketOutlined, AlertOutlined, RiseOutlined, FallOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../services/api';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// 类型定义
interface TodayOrdersMetric {
  new: number;
  completed: number;
  cancelled: number;
  in_progress: number;
  completion_rate: number;
}

interface TodayRevenueMetric {
  total: number;
  platform_fee: number;
  pilot_income: number;
  owner_income: number;
}

interface OnlineCapacityMetric {
  pilots: number;
  drones: number;
  active_flights: number;
}

interface ActiveUsersMetric {
  total: number;
  pilots: number;
  owners: number;
  clients: number;
}

interface AlertsSummaryMetric {
  active: number;
  resolved_today: number;
  critical: number;
}

interface TopRegionItem {
  region: string;
  order_count: number;
  revenue: number;
}

interface SystemHealthMetric {
  status: string;
  api_latency: number;
  db_connections: number;
}

interface DashboardData {
  today_orders: TodayOrdersMetric;
  today_revenue: TodayRevenueMetric;
  online_capacity: OnlineCapacityMetric;
  active_users: ActiveUsersMetric;
  alerts_summary: AlertsSummaryMetric;
  top_regions: TopRegionItem[];
  system_health: SystemHealthMetric;
}

interface TrendItem {
  date: string;
  total?: number;
  completed?: number;
  cancelled?: number;
  revenue?: number;
  platform_fee?: number;
  new_users?: number;
}

interface TrendData {
  order_trend: TrendItem[];
  revenue_trend: TrendItem[];
  user_growth_trend: TrendItem[];
}

// 格式化金额
const formatAmount = (amount: number): string => {
  const yuan = amount / 100;
  if (yuan >= 10000) {
    return (yuan / 10000).toFixed(2) + '万';
  }
  return yuan.toFixed(2);
};

const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [trendDays, setTrendDays] = useState(7);

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, trendRes] = await Promise.all([
        adminApi.getRealtimeDashboard(),
        adminApi.getTrendData(trendDays),
      ]);
      setDashboard((dashboardRes as any).data);
      setTrend((trendRes as any).data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      message.error('获取看板数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await adminApi.refreshDashboard();
      await fetchData();
      message.success('刷新成功');
    } catch (error) {
      message.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    );
  }

  if (!dashboard) {
    return <div>数据加载失败</div>;
  }

  // 系统状态颜色
  const getHealthColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: '#52c41a',
      degraded: '#faad14',
      unhealthy: '#ff4d4f',
    };
    return colors[status] || '#999';
  };

  // 区域表格列
  const regionColumns = [
    { title: '排名', dataIndex: 'rank', key: 'rank', width: 60 },
    { title: '区域', dataIndex: 'region', key: 'region' },
    { title: '订单数', dataIndex: 'order_count', key: 'order_count', align: 'right' as const },
    { 
      title: '收入', 
      dataIndex: 'revenue', 
      key: 'revenue', 
      align: 'right' as const,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
  ];

  const regionData = dashboard.top_regions.map((item, index) => ({
    key: index,
    rank: index + 1,
    ...item,
  }));

  return (
    <div>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>运营数据看板</h2>
          <div style={{ marginTop: 8 }}>
            <Tag color={getHealthColor(dashboard.system_health.status)}>
              系统状态: {dashboard.system_health.status === 'healthy' ? '正常' : '异常'}
            </Tag>
            <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
              API延迟: {dashboard.system_health.api_latency}ms
            </span>
          </div>
        </div>
        <Button 
          type="primary" 
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={handleRefresh}
          loading={refreshing}
        >
          刷新数据
        </Button>
      </div>

      {/* 核心指标 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日新订单"
              value={dashboard.today_orders.new}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span><CheckCircleOutlined style={{ color: '#52c41a' }} /> 完成 {dashboard.today_orders.completed}</span>
              <span><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 取消 {dashboard.today_orders.cancelled}</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日收入"
              value={formatAmount(dashboard.today_revenue.total)}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              平台费 ¥{formatAmount(dashboard.today_revenue.platform_fee)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线飞手"
              value={dashboard.online_capacity.pilots}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
              <span><RocketOutlined /> 可用无人机 {dashboard.online_capacity.drones}</span>
              <span><SyncOutlined spin /> 飞行中 {dashboard.online_capacity.active_flights}</span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃告警"
              value={dashboard.alerts_summary.active}
              prefix={<AlertOutlined />}
              valueStyle={{ color: dashboard.alerts_summary.critical > 0 ? '#ff4d4f' : '#faad14' }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#ff4d4f' }}>严重 {dashboard.alerts_summary.critical}</span>
              <span style={{ color: '#52c41a' }}>今日解决 {dashboard.alerts_summary.resolved_today}</span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 完成率与用户分布 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={8}>
          <Card title="订单完成率">
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={Number(dashboard.today_orders.completion_rate.toFixed(1))}
                width={120}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#52c41a',
                }}
              />
              <div style={{ marginTop: 16, color: '#666' }}>
                进行中: {dashboard.today_orders.in_progress} 单
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="用户分布">
            <Row gutter={16}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                  {dashboard.active_users.pilots}
                </div>
                <div style={{ color: '#999' }}>飞手</div>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
                  {dashboard.active_users.owners}
                </div>
                <div style={{ color: '#999' }}>机主</div>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#13c2c2' }}>
                  {dashboard.active_users.clients}
                </div>
                <div style={{ color: '#999' }}>业主</div>
              </Col>
            </Row>
            <div style={{ textAlign: 'center', marginTop: 16, padding: '8px 0', backgroundColor: '#fafafa', borderRadius: 4 }}>
              总用户: <strong>{dashboard.active_users.total}</strong>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="热门区域TOP5" bodyStyle={{ padding: '12px 0' }}>
            <Table
              columns={regionColumns}
              dataSource={regionData.slice(0, 5)}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图表 */}
      <Card 
        title="数据趋势" 
        style={{ marginTop: 16 }}
        extra={
          <Tabs 
            size="small" 
            activeKey={String(trendDays)} 
            onChange={(key) => setTrendDays(Number(key))}
          >
            <TabPane tab="7天" key="7" />
            <TabPane tab="30天" key="30" />
            <TabPane tab="90天" key="90" />
          </Tabs>
        }
      >
        <Tabs defaultActiveKey="orders">
          <TabPane tab="订单趋势" key="orders">
            {trend && trend.order_trend.length > 0 ? (
              <div>
                <div style={{ display: 'flex', height: 200, alignItems: 'flex-end', gap: 4, padding: '20px 0' }}>
                  {trend.order_trend.map((item, index) => {
                    const maxValue = Math.max(...trend.order_trend.map(i => i.total || 0), 1);
                    const height = ((item.total || 0) / maxValue) * 160;
                    return (
                      <div key={index} style={{ flex: 1, textAlign: 'center' }}>
                        <div 
                          style={{ 
                            height: Math.max(height, 4),
                            backgroundColor: '#1890ff',
                            borderRadius: 4,
                            transition: 'height 0.3s',
                          }}
                          title={`${item.date}: ${item.total || 0}单`}
                        />
                        <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                          {item.date.slice(5)}
                        </div>
                        <div style={{ fontSize: 10, color: '#333' }}>
                          {item.total || 0}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 16 }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#52c41a', marginRight: 4 }} />完成</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#ff4d4f', marginRight: 4 }} />取消</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
            )}
          </TabPane>
          <TabPane tab="收入趋势" key="revenue">
            {trend && trend.revenue_trend.length > 0 ? (
              <div style={{ display: 'flex', height: 200, alignItems: 'flex-end', gap: 4, padding: '20px 0' }}>
                {trend.revenue_trend.map((item, index) => {
                  const maxValue = Math.max(...trend.revenue_trend.map(i => i.revenue || 0), 1);
                  const height = ((item.revenue || 0) / maxValue) * 160;
                  return (
                    <div key={index} style={{ flex: 1, textAlign: 'center' }}>
                      <div 
                        style={{ 
                          height: Math.max(height, 4),
                          backgroundColor: '#52c41a',
                          borderRadius: 4,
                          transition: 'height 0.3s',
                        }}
                        title={`${item.date}: ¥${formatAmount(item.revenue || 0)}`}
                      />
                      <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                        {item.date.slice(5)}
                      </div>
                      <div style={{ fontSize: 10, color: '#333' }}>
                        {formatAmount(item.revenue || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
            )}
          </TabPane>
          <TabPane tab="用户增长" key="users">
            {trend && trend.user_growth_trend.length > 0 ? (
              <div style={{ display: 'flex', height: 200, alignItems: 'flex-end', gap: 4, padding: '20px 0' }}>
                {trend.user_growth_trend.map((item, index) => {
                  const maxValue = Math.max(...trend.user_growth_trend.map(i => i.new_users || 0), 1);
                  const height = ((item.new_users || 0) / maxValue) * 160;
                  return (
                    <div key={index} style={{ flex: 1, textAlign: 'center' }}>
                      <div 
                        style={{ 
                          height: Math.max(height, 4),
                          backgroundColor: '#722ed1',
                          borderRadius: 4,
                          transition: 'height 0.3s',
                        }}
                        title={`${item.date}: ${item.new_users || 0}人`}
                      />
                      <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                        {item.date.slice(5)}
                      </div>
                      <div style={{ fontSize: 10, color: '#333' }}>
                        {item.new_users || 0}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
            )}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
