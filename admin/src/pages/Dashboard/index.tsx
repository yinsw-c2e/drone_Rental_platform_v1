import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Tag } from 'antd';
import {
  UserOutlined, RocketOutlined, ShoppingCartOutlined, DollarOutlined,
  ArrowUpOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../services/api';

interface DashboardData {
  user_total: number;
  drone_total: number;
  order_stats: Record<string, number>;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.dashboard()
      .then((res: any) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalOrders = data?.order_stats
    ? Object.values(data.order_stats).reduce((a, b) => a + b, 0)
    : 0;

  const completedOrders = data?.order_stats?.completed || 0;
  const activeOrders = (data?.order_stats?.in_progress || 0) + (data?.order_stats?.paid || 0);
  const pendingOrders = data?.order_stats?.created || 0;
  const cancelledOrders = data?.order_stats?.cancelled || 0;

  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const cancelRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;

  // 订单状态分布数据
  const statusList = [
    { key: 'created', label: '待接单', count: data?.order_stats?.created || 0, color: '#d9d9d9' },
    { key: 'accepted', label: '已接单', count: data?.order_stats?.accepted || 0, color: '#1890ff' },
    { key: 'paid', label: '已支付', count: data?.order_stats?.paid || 0, color: '#faad14' },
    { key: 'in_progress', label: '进行中', count: data?.order_stats?.in_progress || 0, color: '#13c2c2' },
    { key: 'completed', label: '已完成', count: data?.order_stats?.completed || 0, color: '#52c41a' },
    { key: 'cancelled', label: '已取消', count: data?.order_stats?.cancelled || 0, color: '#ff4d4f' },
    { key: 'rejected', label: '已拒绝', count: data?.order_stats?.rejected || 0, color: '#ff7a45' },
    { key: 'refunded', label: '已退款', count: data?.order_stats?.refunded || 0, color: '#722ed1' },
  ];

  return (
    <div>
      <h2>数据概览</h2>

      {/* 核心指标 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="总用户数"
              value={data?.user_total || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="注册无人机"
              value={data?.drone_total || 0}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="总订单数"
              value={totalOrders}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="已完成订单"
              value={completedOrders}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 运营指标 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="活跃订单"
              value={activeOrders}
              prefix={<SyncOutlined spin={activeOrders > 0} />}
              valueStyle={{ color: '#13c2c2' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              含进行中和已支付
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="待处理订单"
              value={pendingOrders}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              等待机主接单
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>订单完成率</div>
            <Progress
              type="circle"
              percent={completionRate}
              width={80}
              strokeColor="#52c41a"
              format={p => `${p}%`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>订单取消率</div>
            <Progress
              type="circle"
              percent={cancelRate}
              width={80}
              strokeColor={cancelRate > 20 ? '#ff4d4f' : '#faad14'}
              format={p => `${p}%`}
            />
          </Card>
        </Col>
      </Row>

      {/* 订单状态分布 */}
      <Card title="订单状态分布" style={{ marginTop: 16 }} loading={loading}>
        <Row gutter={[16, 16]}>
          {statusList.map(item => (
            <Col span={6} key={item.key}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: 8,
                borderLeft: `4px solid ${item.color}`,
              }}>
                <span style={{ fontSize: 14, color: '#666' }}>{item.label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                  {item.count}
                </span>
              </div>
            </Col>
          ))}
        </Row>

        {/* 占比条 */}
        {totalOrders > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>各状态占比</div>
            <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
              {statusList
                .filter(s => s.count > 0)
                .map(s => (
                  <div
                    key={s.key}
                    style={{
                      width: `${(s.count / totalOrders) * 100}%`,
                      backgroundColor: s.color,
                      minWidth: s.count > 0 ? 2 : 0,
                      transition: 'width 0.3s',
                    }}
                    title={`${s.label}: ${s.count} (${Math.round((s.count / totalOrders) * 100)}%)`}
                  />
                ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {statusList
                .filter(s => s.count > 0)
                .map(s => (
                  <span key={s.key} style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#666' }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 2,
                      backgroundColor: s.color, display: 'inline-block', marginRight: 4,
                    }} />
                    {s.label} {Math.round((s.count / totalOrders) * 100)}%
                  </span>
                ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
