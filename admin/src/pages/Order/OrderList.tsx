import React, { useEffect, useState } from 'react';
import { Table, Tag, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Order {
  id: number;
  order_no: string;
  order_type: string;
  title: string;
  total_amount: number;
  platform_commission: number;
  status: string;
  created_at: string;
  owner?: { nickname: string };
  renter?: { nickname: string };
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

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

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

  const columns: ColumnsType<Order> = [
    { title: '订单号', dataIndex: 'order_no', width: 180 },
    { title: '类型', dataIndex: 'order_type', width: 80, render: (v: string) => v === 'rental' ? '租赁' : '货运' },
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '出租方', width: 100, render: (_, r) => r.owner?.nickname || '-' },
    { title: '承租方', width: 100, render: (_, r) => r.renter?.nickname || '-' },
    {
      title: '总金额', dataIndex: 'total_amount', width: 100,
      render: (v: number) => `${(v / 100).toFixed(2)}`,
    },
    {
      title: '平台佣金', dataIndex: 'platform_commission', width: 100,
      render: (v: number) => `${(v / 100).toFixed(2)}`,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: (v: string) => v?.slice(0, 19) },
  ];

  return (
    <div>
      <h2>订单管理</h2>
      <div style={{ marginBottom: 16 }}>
        <Select
          placeholder="筛选状态"
          allowClear
          style={{ width: 150 }}
          value={statusFilter || undefined}
          onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v.text}</Select.Option>
          ))}
        </Select>
      </div>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
};

export default OrderList;
