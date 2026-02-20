import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { UserOutlined, RocketOutlined, ShoppingCartOutlined, DollarOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

interface DashboardData {
  user_total: number;
  drone_total: number;
  order_stats: Record<string, number>;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    adminApi.dashboard().then((res: any) => setData(res.data)).catch(console.error);
  }, []);

  const totalOrders = data?.order_stats
    ? Object.values(data.order_stats).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div>
      <h2>数据概览</h2>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总用户数" value={data?.user_total || 0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="无人机数" value={data?.drone_total || 0} prefix={<RocketOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总订单数" value={totalOrders} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成订单"
              value={data?.order_stats?.completed || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待接单" value={data?.order_stats?.created || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中" value={data?.order_stats?.in_progress || 0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已支付" value={data?.order_stats?.paid || 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已取消" value={data?.order_stats?.cancelled || 0} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
