import React, { useEffect, useState } from 'react';
import { Table, Tag, Select, Card, Row, Col, Button, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Payment {
  id: number;
  payment_no: string;
  order_id: number;
  user_id: number;
  payment_type: string;
  payment_method: string;
  amount: number;
  status: string;
  third_party_no: string;
  paid_at: string;
  created_at: string;
}

const TYPE_MAP: Record<string, { text: string; color: string }> = {
  order: { text: '订单支付', color: 'blue' },
  deposit: { text: '押金', color: 'orange' },
  refund: { text: '退款', color: 'purple' },
};

const METHOD_MAP: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  mock: '模拟支付',
};

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  paid: { text: '已支付', color: 'green' },
  pending: { text: '待支付', color: 'orange' },
  refunded: { text: '已退款', color: 'purple' },
  failed: { text: '失败', color: 'red' },
};

const TransactionList: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 筛选
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const fetchPayments = async (p = 1) => {
    setLoading(true);
    try {
      const params: any = { page: p, page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      const res: any = await adminApi.getPayments(params);
      setPayments(res.data.list || []);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPayments(page); }, [page, statusFilter]);

  const handleReset = () => {
    setStatusFilter('');
    setTypeFilter('');
    setMethodFilter('');
    setPage(1);
    fetchPayments(1);
  };

  // 本地筛选
  const filteredPayments = payments.filter(p => {
    if (typeFilter && p.payment_type !== typeFilter) return false;
    if (methodFilter && p.payment_method !== methodFilter) return false;
    return true;
  });

  // 统计
  const totalAmount = filteredPayments
    .filter(p => p.status === 'paid' && p.payment_type !== 'refund')
    .reduce((sum, p) => sum + p.amount, 0);
  const refundAmount = filteredPayments
    .filter(p => p.payment_type === 'refund' || p.status === 'refunded')
    .reduce((sum, p) => sum + p.amount, 0);

  const columns: ColumnsType<Payment> = [
    { title: '流水号', dataIndex: 'payment_no', width: 200 },
    { title: '订单ID', dataIndex: 'order_id', width: 80 },
    {
      title: '类型', dataIndex: 'payment_type', width: 100,
      render: (v: string) => {
        const t = TYPE_MAP[v] || { text: v, color: 'default' };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    {
      title: '支付方式', dataIndex: 'payment_method', width: 100,
      render: (v: string) => METHOD_MAP[v] || v,
    },
    {
      title: '金额', dataIndex: 'amount', width: 120,
      render: (v: number, r) => (
        <span style={{
          fontWeight: 600,
          color: r.payment_type === 'refund' ? '#ff4d4f' : '#333',
        }}>
          {r.payment_type === 'refund' ? '-' : ''}¥{(v / 100).toFixed(2)}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '第三方流水号', dataIndex: 'third_party_no', width: 200,
      render: (v: string) => v || '-',
    },
    {
      title: '支付时间', dataIndex: 'paid_at', width: 160,
      render: (v: string) => v?.slice(0, 19) || '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v?.slice(0, 19),
    },
  ];

  return (
    <div>
      <h2>财务记录</h2>

      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <div style={{ color: '#999', fontSize: 13 }}>收入总额</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
              ¥{(totalAmount / 100).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ color: '#999', fontSize: 13 }}>退款总额</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>
              ¥{(refundAmount / 100).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ color: '#999', fontSize: 13 }}>交易笔数</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>
              {filteredPayments.length}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Select
              placeholder="支付状态"
              allowClear
              style={{ width: 130 }}
              value={statusFilter || undefined}
              onChange={v => { setStatusFilter(v || ''); setPage(1); }}>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="交易类型"
              allowClear
              style={{ width: 130 }}
              value={typeFilter || undefined}
              onChange={v => setTypeFilter(v || '')}>
              {Object.entries(TYPE_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="支付方式"
              allowClear
              style={{ width: 130 }}
              value={methodFilter || undefined}
              onChange={v => setMethodFilter(v || '')}>
              {Object.entries(METHOD_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Button onClick={handleReset}>重置</Button>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredPayments}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />
    </div>
  );
};

export default TransactionList;
