import React, { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Payment {
  id: number;
  payment_no: string;
  order_id: number;
  payment_type: string;
  payment_method: string;
  amount: number;
  status: string;
  created_at: string;
}

const TransactionList: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchPayments = async (p = 1) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getPayments({ page: p, page_size: 20 });
      setPayments(res.data.list || []);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPayments(page); }, [page]);

  const columns: ColumnsType<Payment> = [
    { title: '流水号', dataIndex: 'payment_no', width: 200 },
    { title: '订单ID', dataIndex: 'order_id', width: 80 },
    {
      title: '类型', dataIndex: 'payment_type', width: 80,
      render: (v: string) => ({ order: '订单', deposit: '押金', refund: '退款' }[v] || v),
    },
    {
      title: '方式', dataIndex: 'payment_method', width: 80,
      render: (v: string) => ({ wechat: '微信', alipay: '支付宝', mock: '模拟' }[v] || v),
    },
    {
      title: '金额', dataIndex: 'amount', width: 120,
      render: (v: number) => `¥ ${(v / 100).toFixed(2)}`,
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => (
        <Tag color={v === 'paid' ? 'green' : v === 'pending' ? 'orange' : v === 'refunded' ? 'purple' : 'red'}>
          {v === 'paid' ? '已支付' : v === 'pending' ? '待支付' : v === 'refunded' ? '已退款' : '失败'}
        </Tag>
      ),
    },
    { title: '时间', dataIndex: 'created_at', width: 160, render: (v: string) => v?.slice(0, 19) },
  ];

  return (
    <div>
      <h2>财务记录</h2>
      <Table
        columns={columns}
        dataSource={payments}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
};

export default TransactionList;
