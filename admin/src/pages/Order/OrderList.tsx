import React, { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Select, Card, Row, Col, Input, Button, Space, Modal, Timeline, Statistic, Descriptions, Divider, message, Tooltip, Typography } from 'antd';
import { SearchOutlined, ReloadOutlined, ExportOutlined, EyeOutlined, InfoCircleOutlined, WalletOutlined, RocketOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

const { Text } = Typography;

interface Order {
  id: number;
  order_no: string;
  order_type: string;
  order_source?: string;
  demand_id?: number;
  source_supply_id?: number;
  title: string;
  service_type: string;
  total_amount: number;
  platform_commission: number;
  owner_amount: number;
  deposit_amount: number;
  status: string;
  execution_mode?: string;
  needs_dispatch?: boolean;
  provider_user_id?: number;
  executor_pilot_user_id?: number;
  provider_confirmed_at?: string;
  created_at: string;
  updated_at: string;
  start_time: string;
  end_time: string;
  service_address: string;
  owner?: { id: number; nickname: string; phone: string };
  renter?: { id: number; nickname: string; phone: string };
  drone?: { brand: string; model: string; serial_number: string };
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  created: { text: '待确认', color: 'default' },
  pending_provider_confirmation: { text: '待机主确认', color: 'orange' },
  provider_rejected: { text: '机主已拒绝', color: 'red' },
  pending_payment: { text: '待支付', color: 'gold' },
  paid: { text: '已支付', color: 'cyan' },
  pending_dispatch: { text: '待派单', color: 'cyan' },
  assigned: { text: '已派单', color: 'blue' },
  preparing: { text: '准备中', color: 'processing' },
  accepted: { text: '执行方已接单', color: 'blue' },
  in_progress: { text: '运输中', color: 'processing' },
  delivered: { text: '已送达', color: 'lime' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  rejected: { text: '已拒绝', color: 'red' },
  refunded: { text: '已退款', color: 'purple' },
  refunding: { text: '退款中', color: 'purple' },
};

const TYPE_MAP: Record<string, string> = {
  rental: '整机租赁',
  rental_offer: '方案下单',
  cargo: '货运运输',
};

const ORDER_SOURCE_MAP: Record<string, string> = {
  demand_market: '任务撮合',
  supply_direct: '服务直达',
};

const EXECUTION_MODE_MAP: Record<string, string> = {
  self_execute: '机主自执行',
  bound_pilot: '指定飞手',
  dispatch_pool: '平台派单',
};

const formatMoney = (value?: number) => `¥${((value || 0) / 100).toFixed(2)}`;
const formatTime = (value?: string) => value?.slice(0, 19).replace('T', ' ') || '-';

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 筛选
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // 详情弹窗
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchOrders = async (p = 1) => {
    setLoading(true);
    try {
      const params: any = { page: p, page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      if (keyword) params.keyword = keyword;
      const res: any = await adminApi.getOrders(params);
      setOrders(res.data.list || []);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(page); }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchOrders(1);
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter('');
    setTypeFilter('');
    setPage(1);
    fetchOrders(1);
  };

  // 本地展示统计
  const summary = useMemo(() => orders.reduce(
    (acc, item) => {
      acc.totalAmount += Number(item.total_amount || 0);
      acc.pendingCount += ['created', 'pending_provider_confirmation', 'pending_payment'].includes(item.status) ? 1 : 0;
      acc.executingCount += ['paid', 'pending_dispatch', 'assigned', 'preparing', 'accepted', 'in_progress', 'delivered'].includes(item.status) ? 1 : 0;
      acc.closedCount += ['completed'].includes(item.status) ? 1 : 0;
      return acc;
    },
    {totalAmount: 0, pendingCount: 0, executingCount: 0, closedCount: 0},
  ), [orders]);

  const handleExport = () => {
    message.loading('正在准备导出数据...');
    // Mock export
    setTimeout(() => {
      message.success(`已导出当前页 ${orders.length} 条订单记录`);
    }, 1000);
  };

  const columns: ColumnsType<Order> = [
    {
      title: '订单识别码',
      dataIndex: 'order_no',
      width: 180,
      render: (text) => <Text copyable code>{text}</Text>
    },
    {
      title: '业务类型', dataIndex: 'order_type', width: 100,
      render: (v: string) => <Tag color="blue">{TYPE_MAP[v] || v}</Tag>,
    },
    {
      title: '订单来源',
      dataIndex: 'order_source',
      width: 100,
      render: (v?: string) => <Tag color="cyan">{ORDER_SOURCE_MAP[v || ''] || v || '-'}</Tag>,
    },
    { title: '项目标题', dataIndex: 'title', width: 220, ellipsis: true, render: (t) => <Text strong>{t}</Text> },
    {
      title: '参与主体',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text><Tag>供</Tag>{r.owner?.nickname || '-'}</Text>
          <Text><Tag>需</Tag>{r.renter?.nickname || '-'}</Text>
        </Space>
      )
    },
    {
      title: '履约模式',
      dataIndex: 'execution_mode',
      width: 110,
      render: (v?: string) => <Text type="secondary">{EXECUTION_MODE_MAP[v || ''] || v || '-'}</Text>,
    },
    {
      title: '结算金额', dataIndex: 'total_amount', width: 120, align: 'right',
      render: (v: number) => <Text strong type="danger">{`¥${(v / 100).toFixed(2)}`}</Text>,
    },
    {
      title: '流程状态', dataIndex: 'status', width: 120,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color} style={{ borderRadius: 10, padding: '0 10px' }}>{s.text}</Tag>;
      },
    },
    {
      title: '创建于', dataIndex: 'created_at', width: 160,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v?.slice(0, 16).replace('T', ' ')}</Text>,
    },
    {
      title: '操作', width: 80, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Tooltip title="查看完整详情">
          <Button type="text" icon={<EyeOutlined />} onClick={() => { setDetailOrder(record); setDetailVisible(true); }} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>订单调度中心</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchOrders(page)}>刷新</Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>导出数据</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} className="dashboard-stat-card">
            <Statistic
              title={<Space><InfoCircleOutlined /> 活跃订单</Space>}
              value={total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><WalletOutlined /> 待确认/支付</Space>}
              value={summary.pendingCount}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><RocketOutlined /> 正在履约中</Space>}
              value={summary.executingCount}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><CheckCircleOutlined /> 今日已完成</Space>}
              value={summary.closedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" bordered={false} style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Input
                placeholder="搜索订单号/项目标题/关联用户"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 280 }}
                allowClear
              />
              <Select
                placeholder="订单状态"
                allowClear
                style={{ width: 140 }}
                value={statusFilter || undefined}
                onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v.text}</Select.Option>
                ))}
              </Select>
              <Select
                placeholder="业务类型"
                allowClear
                style={{ width: 140 }}
                value={typeFilter || undefined}
                onChange={v => setTypeFilter(v || '')}>
                {Object.entries(TYPE_MAP).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v}</Select.Option>
                ))}
              </Select>
              <Button type="primary" onClick={handleSearch}>筛选</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        size="middle"
        scroll={{ x: 1400 }}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showTotal: t => `共 ${t} 条记录`,
          showSizeChanger: false
        }}
        style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
      />

      <Modal
        title={<Space><EyeOutlined /> 订单全生命周期详情</Space>}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭详情</Button>,
          <Button key="re" type="primary" onClick={() => message.info('功能开发中')}>重新指派</Button>
        ]}
        width={920}>
        {detailOrder && (
          <div style={{ marginTop: -10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '12px 20px', borderRadius: 8, marginBottom: 20 }}>
              <Space size="large">
                <Statistic title="订单总额" value={detailOrder.total_amount / 100} precision={2} prefix="¥" valueStyle={{ fontSize: 20 }} />
                <Statistic title="平台佣金" value={detailOrder.platform_commission / 100} precision={2} prefix="¥" valueStyle={{ color: '#52c41a', fontSize: 20 }} />
                <Statistic title="服务方所得" value={(detailOrder.owner_amount || 0) / 100} precision={2} prefix="¥" valueStyle={{ fontSize: 20 }} />
              </Space>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">当前状态</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={STATUS_MAP[detailOrder.status]?.color || 'default'} style={{ fontSize: 14, padding: '4px 12px', borderRadius: 4 }}>
                    {STATUS_MAP[detailOrder.status]?.text || detailOrder.status}
                  </Tag>
                </div>
              </div>
            </div>

            <Descriptions bordered size="small" column={2} labelStyle={{ width: 120, background: '#fafafa' }}>
              <Descriptions.Item label="订单编号"><Text copyable>{detailOrder.order_no}</Text></Descriptions.Item>
              <Descriptions.Item label="项目标题">{detailOrder.title}</Descriptions.Item>
              <Descriptions.Item label="业务/服务类型">
                <Space split={<Divider type="vertical" />}>
                  <Tag color="blue">{TYPE_MAP[detailOrder.order_type] || detailOrder.order_type}</Tag>
                  <Text>{detailOrder.service_type || '-'}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="来源渠道">
                <Tag color="geekblue">{ORDER_SOURCE_MAP[detailOrder.order_source || ''] || detailOrder.order_source || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="服务起止时间" span={2}>
                <Space>
                  <Text type="secondary">从</Text><Text strong>{formatTime(detailOrder.start_time)}</Text>
                  <Text type="secondary">至</Text><Text strong>{formatTime(detailOrder.end_time)}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="作业地址" span={2}>{detailOrder.service_address || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
              <Card size="small" title="承接方信息" style={{ flex: 1 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="姓名">{detailOrder.owner?.nickname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{detailOrder.owner?.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="用户ID">{detailOrder.provider_user_id || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Card size="small" title="客户信息" style={{ flex: 1 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="姓名">{detailOrder.renter?.nickname || '-'}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{detailOrder.renter?.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="用户ID">{detailOrder.renter?.id || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
              <Card size="small" title="履约资源" style={{ flex: 1 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="设备型号">
                    {detailOrder.drone ? `${detailOrder.drone.brand} ${detailOrder.drone.model}` : <Text type="secondary">未关联</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="序列号">{detailOrder.drone?.serial_number || '-'}</Descriptions.Item>
                  <Descriptions.Item label="执行模式">{EXECUTION_MODE_MAP[detailOrder.execution_mode || ''] || detailOrder.execution_mode || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Card size="small" title="关键追溯ID" style={{ flex: 1 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="需求ID">{detailOrder.demand_id || '-'}</Descriptions.Item>
                  <Descriptions.Item label="供给ID">{detailOrder.source_supply_id || '-'}</Descriptions.Item>
                  <Descriptions.Item label="派单ID">{detailOrder.needs_dispatch ? <Tag color="orange">需要派单</Tag> : '无需派单'}</Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>流转动态</Text></Divider>
            <div style={{ padding: '0 10px' }}>
              <Timeline
                mode="left"
                items={[
                  { color: 'blue', label: formatTime(detailOrder.created_at), children: '系统收到下单请求，订单初始化完成' },
                  detailOrder.provider_confirmed_at ? { color: 'green', label: formatTime(detailOrder.provider_confirmed_at), children: '承接方已确认方案并锁定资源' } : null,
                  { color: 'orange', label: formatTime(detailOrder.updated_at), children: '最近一次状态变更记录' },
                ].filter(Boolean) as any}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderList;
