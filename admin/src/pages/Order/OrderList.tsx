import React, { useEffect, useState } from 'react';
import { Table, Tag, Select, Card, Row, Col, Input, Button, Space, Modal, Timeline } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Order {
  id: number;
  order_no: string;
  order_type: string;
  title: string;
  service_type: string;
  total_amount: number;
  platform_commission: number;
  owner_amount: number;
  deposit_amount: number;
  status: string;
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
  created: { text: '待接单', color: 'default' },
  accepted: { text: '已接单', color: 'blue' },
  paid: { text: '已支付', color: 'orange' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  rejected: { text: '已拒绝', color: 'red' },
  refunded: { text: '已退款', color: 'purple' },
};

const TYPE_MAP: Record<string, string> = {
  rental: '租赁',
  rental_offer: '供给租赁',
  cargo: '货运',
};

const SERVICE_TYPE_MAP: Record<string, string> = {
  rental: '整机租赁',
  aerial_photo: '航拍服务',
  logistics: '物流运输',
  agriculture: '农业植保',
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

  const columns: ColumnsType<Order> = [
    { title: '订单号', dataIndex: 'order_no', width: 180 },
    {
      title: '类型', dataIndex: 'order_type', width: 90,
      render: (v: string) => <Tag>{TYPE_MAP[v] || v}</Tag>,
    },
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '出租方', width: 100, render: (_, r) => r.owner?.nickname || '-' },
    { title: '承租方', width: 100, render: (_, r) => r.renter?.nickname || '-' },
    {
      title: '总金额', dataIndex: 'total_amount', width: 100,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{`¥${(v / 100).toFixed(0)}`}</span>,
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
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredOrders}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      {/* 订单详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}>
        {detailOrder && (
          <div>
            <Row gutter={[0, 8]}>
              <Col span={24} style={{ marginBottom: 8 }}>
                <Tag
                  color={STATUS_MAP[detailOrder.status]?.color || 'default'}
                  style={{ fontSize: 14, padding: '4px 12px' }}>
                  {STATUS_MAP[detailOrder.status]?.text || detailOrder.status}
                </Tag>
              </Col>

              <Col span={24}><h4 style={{ margin: '8px 0' }}>基本信息</h4></Col>
              <Col span={8}><strong>订单号:</strong></Col>
              <Col span={16}>{detailOrder.order_no}</Col>
              <Col span={8}><strong>订单类型:</strong></Col>
              <Col span={16}>{TYPE_MAP[detailOrder.order_type] || detailOrder.order_type}</Col>
              <Col span={8}><strong>标题:</strong></Col>
              <Col span={16}>{detailOrder.title}</Col>
              <Col span={8}><strong>服务类型:</strong></Col>
              <Col span={16}>{SERVICE_TYPE_MAP[detailOrder.service_type] || detailOrder.service_type || '-'}</Col>
              <Col span={8}><strong>服务地址:</strong></Col>
              <Col span={16}>{detailOrder.service_address || '-'}</Col>
              <Col span={8}><strong>开始时间:</strong></Col>
              <Col span={16}>{detailOrder.start_time?.slice(0, 19) || '-'}</Col>
              <Col span={8}><strong>结束时间:</strong></Col>
              <Col span={16}>{detailOrder.end_time?.slice(0, 19) || '-'}</Col>

              <Col span={24}><h4 style={{ margin: '12px 0 8px' }}>费用信息</h4></Col>
              <Col span={8}><strong>订单总额:</strong></Col>
              <Col span={16} style={{ color: '#f5222d', fontWeight: 600 }}>
                ¥{(detailOrder.total_amount / 100).toFixed(2)}
              </Col>
              <Col span={8}><strong>押金:</strong></Col>
              <Col span={16}>¥{(detailOrder.deposit_amount / 100).toFixed(2)}</Col>
              <Col span={8}><strong>平台佣金:</strong></Col>
              <Col span={16} style={{ color: '#52c41a' }}>
                ¥{(detailOrder.platform_commission / 100).toFixed(2)}
              </Col>
              <Col span={8}><strong>机主收入:</strong></Col>
              <Col span={16}>¥{((detailOrder.owner_amount || 0) / 100).toFixed(2)}</Col>

              <Col span={24}><h4 style={{ margin: '12px 0 8px' }}>参与方信息</h4></Col>
              <Col span={8}><strong>出租方:</strong></Col>
              <Col span={16}>
                {detailOrder.owner?.nickname || '-'}
                {detailOrder.owner?.phone ? ` (${detailOrder.owner.phone})` : ''}
              </Col>
              <Col span={8}><strong>承租方:</strong></Col>
              <Col span={16}>
                {detailOrder.renter?.nickname || '-'}
                {detailOrder.renter?.phone ? ` (${detailOrder.renter.phone})` : ''}
              </Col>

              {detailOrder.drone && (
                <>
                  <Col span={24}><h4 style={{ margin: '12px 0 8px' }}>无人机信息</h4></Col>
                  <Col span={8}><strong>品牌型号:</strong></Col>
                  <Col span={16}>{detailOrder.drone.brand} {detailOrder.drone.model}</Col>
                  <Col span={8}><strong>序列号:</strong></Col>
                  <Col span={16}>{detailOrder.drone.serial_number || '-'}</Col>
                </>
              )}

              <Col span={24}><h4 style={{ margin: '12px 0 8px' }}>时间信息</h4></Col>
              <Col span={8}><strong>创建时间:</strong></Col>
              <Col span={16}>{detailOrder.created_at?.slice(0, 19)}</Col>
              <Col span={8}><strong>更新时间:</strong></Col>
              <Col span={16}>{detailOrder.updated_at?.slice(0, 19)}</Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderList;
