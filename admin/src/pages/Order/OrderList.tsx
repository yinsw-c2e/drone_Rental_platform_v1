import React, { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Select, Card, Row, Col, Input, Button, Space, Modal, Timeline, Statistic, Descriptions, Divider, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

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
  created: { text: '已创建', color: 'default' },
  pending_provider_confirmation: { text: '待机主确认', color: 'orange' },
  provider_rejected: { text: '机主已拒绝', color: 'red' },
  pending_payment: { text: '待支付', color: 'gold' },
  paid: { text: '已支付', color: 'orange' },
  pending_dispatch: { text: '待派单', color: 'cyan' },
  assigned: { text: '已分配执行', color: 'blue' },
  preparing: { text: '准备中', color: 'processing' },
  accepted: { text: '已接单', color: 'blue' },
  in_progress: { text: '进行中', color: 'processing' },
  delivered: { text: '已送达', color: 'lime' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  rejected: { text: '已拒绝', color: 'red' },
  refunded: { text: '已退款', color: 'purple' },
  refunding: { text: '退款中', color: 'purple' },
};

const TYPE_MAP: Record<string, string> = {
  rental: '租赁',
  rental_offer: '供给租赁',
  cargo: '货运',
};

const ORDER_SOURCE_MAP: Record<string, string> = {
  demand_market: '需求转单',
  supply_direct: '供给直达',
};

const EXECUTION_MODE_MAP: Record<string, string> = {
  self_execute: '自执行',
  bound_pilot: '绑定飞手',
  dispatch_pool: '正式派单',
};

const SERVICE_TYPE_MAP: Record<string, string> = {
  rental: '整机租赁',
  aerial_photo: '航拍服务',
  logistics: '物流运输',
  agriculture: '农业植保',
};

const formatMoney = (value?: number) => `¥${((value || 0) / 100).toFixed(2)}`;
const formatTime = (value?: string) => value?.slice(0, 19).replace('T', ' ') || '-';

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number | undefined>>) => {
  const escapeCell = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csvContent = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csvContent}`], {type: 'text/csv;charset=utf-8;'});
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

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

  // 本地筛选
  const filteredOrders = orders.filter(o => {
    if (typeFilter && o.order_type !== typeFilter) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      return (
        o.order_no.toLowerCase().includes(kw) ||
        o.title.toLowerCase().includes(kw) ||
        (o.owner?.nickname || '').toLowerCase().includes(kw) ||
        (o.renter?.nickname || '').toLowerCase().includes(kw)
      );
    }
    return true;
  });
  const summary = useMemo(() => filteredOrders.reduce(
    (acc, item) => {
      acc.totalAmount += Number(item.total_amount || 0);
      acc.pendingCount += ['created', 'pending_provider_confirmation', 'pending_payment'].includes(item.status) ? 1 : 0;
      acc.executingCount += ['paid', 'pending_dispatch', 'assigned', 'preparing', 'accepted', 'in_progress', 'delivered'].includes(item.status) ? 1 : 0;
      acc.closedCount += ['completed', 'cancelled', 'rejected', 'refunded'].includes(item.status) ? 1 : 0;
      return acc;
    },
    {totalAmount: 0, pendingCount: 0, executingCount: 0, closedCount: 0},
  ), [filteredOrders]);

  const handleExport = () => {
    downloadCsv(
      `orders-export-${Date.now()}.csv`,
      ['订单号', '标题', '来源', '状态', '执行模式', '客户', '承接方', '总金额', '平台佣金', '创建时间'],
      filteredOrders.map(item => [
        item.order_no,
        item.title,
        ORDER_SOURCE_MAP[item.order_source || ''] || item.order_source || '-',
        STATUS_MAP[item.status]?.text || item.status,
        EXECUTION_MODE_MAP[item.execution_mode || ''] || item.execution_mode || '-',
        item.renter?.nickname || '-',
        item.owner?.nickname || '-',
        formatMoney(item.total_amount),
        formatMoney(item.platform_commission),
        formatTime(item.created_at),
      ]),
    );
    message.success(`已导出 ${filteredOrders.length} 条订单记录`);
  };

  const columns: ColumnsType<Order> = [
    { title: '订单号', dataIndex: 'order_no', width: 180 },
    {
      title: '类型', dataIndex: 'order_type', width: 90,
      render: (v: string) => <Tag>{TYPE_MAP[v] || v}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'order_source',
      width: 110,
      render: (v?: string) => <Tag color="geekblue">{ORDER_SOURCE_MAP[v || ''] || v || '-'}</Tag>,
    },
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '承接方', width: 120, render: (_, r) => r.owner?.nickname || (r.provider_user_id ? `用户 ${r.provider_user_id}` : '-') },
    { title: '客户', width: 120, render: (_, r) => r.renter?.nickname || '-' },
    {
      title: '执行模式',
      dataIndex: 'execution_mode',
      width: 110,
      render: (v?: string) => EXECUTION_MODE_MAP[v || ''] || v || '-',
    },
    {
      title: '待派单',
      dataIndex: 'needs_dispatch',
      width: 90,
      render: (v?: boolean) => v ? <Tag color="cyan">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '总金额', dataIndex: 'total_amount', width: 100,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{`¥${(v / 100).toFixed(2)}`}</span>,
    },
    {
      title: '平台佣金', dataIndex: 'platform_commission', width: 100,
      render: (v: number) => <span style={{ color: '#52c41a' }}>{`¥${(v / 100).toFixed(0)}`}</span>,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v?.slice(0, 19),
    },
    {
      title: '操作', width: 80, fixed: 'right',
      render: (_, record) => (
        <Button size="small" onClick={() => { setDetailOrder(record); setDetailVisible(true); }}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h2>订单管理</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="当前列表" value={filteredOrders.length} suffix={`/ ${total || 0}`} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="待推进订单" value={summary.pendingCount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="执行中/待收口" value={summary.executingCount} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="当前列表总额" value={summary.totalAmount / 100} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      {/* 搜索筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input
              placeholder="搜索订单号/标题/用户"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 220 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="订单状态"
              allowClear
              style={{ width: 130 }}
              value={statusFilter || undefined}
              onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="订单类型"
              allowClear
              style={{ width: 130 }}
              value={typeFilter || undefined}
              onChange={v => setTypeFilter(v || '')}>
              {Object.entries(TYPE_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={handleSearch}>搜索</Button>
              <Button onClick={handleReset}>重置</Button>
              <Button onClick={handleExport}>导出当前列表</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredOrders}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1650 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      {/* 订单详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={860}>
        {detailOrder && (
          <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag color={STATUS_MAP[detailOrder.status]?.color || 'default'}>
                {STATUS_MAP[detailOrder.status]?.text || detailOrder.status}
              </Tag>
              <Tag color="geekblue">{ORDER_SOURCE_MAP[detailOrder.order_source || ''] || detailOrder.order_source || '-'}</Tag>
              <Tag>{EXECUTION_MODE_MAP[detailOrder.execution_mode || ''] || detailOrder.execution_mode || '-'}</Tag>
              {detailOrder.needs_dispatch ? <Tag color="cyan">待安排执行</Tag> : <Tag>无需再派单</Tag>}
            </Space>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="订单总额" value={detailOrder.total_amount / 100} precision={2} prefix="¥" />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="平台佣金" value={detailOrder.platform_commission / 100} precision={2} prefix="¥" />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="服务方到账" value={(detailOrder.owner_amount || 0) / 100} precision={2} prefix="¥" />
                </Card>
              </Col>
            </Row>

            <Divider>基本信息</Divider>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="订单号">{detailOrder.order_no}</Descriptions.Item>
              <Descriptions.Item label="标题">{detailOrder.title}</Descriptions.Item>
              <Descriptions.Item label="订单类型">{TYPE_MAP[detailOrder.order_type] || detailOrder.order_type}</Descriptions.Item>
              <Descriptions.Item label="服务类型">{SERVICE_TYPE_MAP[detailOrder.service_type] || detailOrder.service_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="服务地址" span={2}>{detailOrder.service_address || '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatTime(detailOrder.start_time)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{formatTime(detailOrder.end_time)}</Descriptions.Item>
            </Descriptions>

            <Divider>参与方与设备</Divider>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="承接方">
                {detailOrder.owner?.nickname || '-'}
                {detailOrder.owner?.phone ? ` (${detailOrder.owner.phone})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="客户">
                {detailOrder.renter?.nickname || '-'}
                {detailOrder.renter?.phone ? ` (${detailOrder.renter.phone})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="设备品牌">
                {detailOrder.drone ? `${detailOrder.drone.brand} ${detailOrder.drone.model}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="设备序列号">{detailOrder.drone?.serial_number || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider>费用与排障</Divider>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="押金">{formatMoney(detailOrder.deposit_amount)}</Descriptions.Item>
              <Descriptions.Item label="待派单">{detailOrder.needs_dispatch ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="承接方用户ID">{detailOrder.provider_user_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="执行飞手用户ID">{detailOrder.executor_pilot_user_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="需求ID">{detailOrder.demand_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="供给ID">{detailOrder.source_supply_id || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider>关键流转日志</Divider>
            <Timeline
              items={[
                {color: 'blue', children: `订单创建：${formatTime(detailOrder.created_at)}`},
                {color: detailOrder.provider_confirmed_at ? 'green' : 'gray', children: `承接方确认：${formatTime(detailOrder.provider_confirmed_at)}`},
                {color: 'orange', children: `最近更新：${formatTime(detailOrder.updated_at)}`},
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default OrderList;
