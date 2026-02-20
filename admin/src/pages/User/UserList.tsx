import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface User {
  id: number;
  phone: string;
  nickname: string;
  user_type: string;
  id_verified: string;
  credit_score: number;
  status: string;
  created_at: string;
}

const USER_TYPE_MAP: Record<string, string> = {
  renter: '租客',
  drone_owner: '无人机主',
  cargo_owner: '货主',
  admin: '管理员',
};

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async (p = 1) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getUsers({ page: p, page_size: 20 });
      setUsers(res.data.list || []);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(page); }, [page]);

  const handleStatusChange = (id: number, status: string) => {
    Modal.confirm({
      title: `确认${status === 'active' ? '启用' : '禁用'}该用户？`,
      onOk: async () => {
        await adminApi.updateUserStatus(id, status);
        message.success('操作成功');
        fetchUsers(page);
      },
    });
  };

  const handleVerify = (id: number, approved: boolean) => {
    Modal.confirm({
      title: `确认${approved ? '通过' : '拒绝'}该用户的实名认证？`,
      onOk: async () => {
        await adminApi.approveIDVerify(id, approved);
        message.success('操作成功');
        fetchUsers(page);
      },
    });
  };

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '昵称', dataIndex: 'nickname', width: 120 },
    {
      title: '用户类型', dataIndex: 'user_type', width: 100,
      render: (v: string) => USER_TYPE_MAP[v] || v,
    },
    {
      title: '实名认证', dataIndex: 'id_verified', width: 100,
      render: (v: string) => (
        <Tag color={v === 'approved' ? 'green' : v === 'pending' ? 'orange' : 'red'}>
          {v === 'approved' ? '已认证' : v === 'pending' ? '待审核' : '未通过'}
        </Tag>
      ),
    },
    { title: '信用分', dataIndex: 'credit_score', width: 80 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v === 'active' ? '正常' : '已禁用'}</Tag>,
    },
    { title: '注册时间', dataIndex: 'created_at', width: 160, render: (v: string) => v?.slice(0, 19) },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'active' ? (
            <Button size="small" danger onClick={() => handleStatusChange(record.id, 'suspended')}>禁用</Button>
          ) : (
            <Button size="small" type="primary" onClick={() => handleStatusChange(record.id, 'active')}>启用</Button>
          )}
          {record.id_verified === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleVerify(record.id, true)}>通过</Button>
              <Button size="small" danger onClick={() => handleVerify(record.id, false)}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>用户管理</h2>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
};

export default UserList;
