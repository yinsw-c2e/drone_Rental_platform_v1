import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface Drone {
  id: number;
  owner_id: number;
  brand: string;
  model: string;
  serial_number: string;
  certification_status: string;
  availability_status: string;
  daily_price: number;
  city: string;
  rating: number;
  owner?: { nickname: string; phone: string };
}

const DroneList: React.FC = () => {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchDrones = async (p = 1) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getDrones({ page: p, page_size: 20 });
      setDrones(res.data.list || []);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDrones(page); }, [page]);

  const handleCertify = (id: number, approved: boolean) => {
    Modal.confirm({
      title: `确认${approved ? '通过' : '拒绝'}该无人机认证？`,
      onOk: async () => {
        await adminApi.approveCertification(id, approved);
        message.success('操作成功');
        fetchDrones(page);
      },
    });
  };

  const columns: ColumnsType<Drone> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '品牌', dataIndex: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', width: 120 },
    { title: '序列号', dataIndex: 'serial_number', width: 140 },
    { title: '所有者', width: 120, render: (_, r) => r.owner?.nickname || '-' },
    { title: '城市', dataIndex: 'city', width: 80 },
    {
      title: '日租金', dataIndex: 'daily_price', width: 100,
      render: (v: number) => `${(v / 100).toFixed(2)} 元`,
    },
    { title: '评分', dataIndex: 'rating', width: 60 },
    {
      title: '认证状态', dataIndex: 'certification_status', width: 100,
      render: (v: string) => (
        <Tag color={v === 'approved' ? 'green' : v === 'pending' ? 'orange' : 'red'}>
          {v === 'approved' ? '已认证' : v === 'pending' ? '待审核' : '未通过'}
        </Tag>
      ),
    },
    {
      title: '可用状态', dataIndex: 'availability_status', width: 80,
      render: (v: string) => <Tag color={v === 'available' ? 'green' : 'default'}>{v}</Tag>,
    },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, record) =>
        record.certification_status === 'pending' ? (
          <Space>
            <Button size="small" type="primary" onClick={() => handleCertify(record.id, true)}>通过</Button>
            <Button size="small" danger onClick={() => handleCertify(record.id, false)}>拒绝</Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <div>
      <h2>无人机管理</h2>
      <Table
        columns={columns}
        dataSource={drones}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
};

export default DroneList;
