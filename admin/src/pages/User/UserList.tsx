import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal, Input, Select, Card, Row, Col } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
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
  both: '双重身份',
  admin: '管理员',
};

const VERIFY_STATUS_MAP: Record<string, { text: string; color: string }> = {
  approved: { text: '已认证', color: 'green' },
  pending: { text: '待审核', color: 'orange' },
  rejected: { text: '未通过', color: 'red' },
  none: { text: '未提交', color: 'default' },
};

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 搜索筛选
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [verifyFilter, setVerifyFilter] = useState<string>('');

  // 详情抽屉
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchUsers = async (p = 1) => {
    setLoading(true);
    try {
      const params: any = { page: p, page_size: 20 };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;
      const res: any = await adminApi.getUsers(params);
      setUsers(res.data.list || []);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(page); }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchUsers(1);
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter('');
    setTypeFilter('');
    setVerifyFilter('');
    setPage(1);
    fetchUsers(1);
  };

  const handleStatusChange = (id: number, status: string) => {
    Modal.confirm({
      title: `确认${status === 'active' ? '启用' : '禁用'}该用户？`,
      content: status === 'suspended' ? '禁用后该用户将无法登录系统' : '启用后该用户可正常使用系统',
      onOk: async () => {
        await adminApi.updateUserStatus(id, status);
        message.success('操作成功');
        fetchUsers(page);
      },
    });
  };

  const handleVerify = (id: number, approved: boolean) => {
    if (!approved) {
      Modal.confirm({
        title: '拒绝实名认证',
        content: '确定拒绝该用户的实名认证申请？',
        okText: '拒绝',
        okType: 'danger',
        onOk: async () => {
          await adminApi.approveIDVerify(id, false, '信息不符合要求');
          message.success('已拒绝');
          fetchUsers(page);
        },
      });
    } else {
      Modal.confirm({
        title: '通过实名认证',
        content: '确定通过该用户的实名认证？',
        onOk: async () => {
          await adminApi.approveIDVerify(id, true);
          message.success('已通过');
          fetchUsers(page);
        },
      });
    }
  };

  const showDetail = (user: User) => {
    setDetailUser(user);
    setDetailVisible(true);
  };

  // 本地筛选（类型和认证状态在前端过滤）
  const filteredUsers = users.filter(u => {
    if (typeFilter && u.user_type !== typeFilter) return false;
    if (verifyFilter && u.id_verified !== verifyFilter) return false;
    return true;
  });

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '昵称', dataIndex: 'nickname', width: 120 },
    {
      title: '用户类型', dataIndex: 'user_type', width: 100,
      render: (v: string) => <Tag>{USER_TYPE_MAP[v] || v}</Tag>,
    },
    {
      title: '实名认证', dataIndex: 'id_verified', width: 100,
      render: (v: string) => {
        const s = VERIFY_STATUS_MAP[v] || VERIFY_STATUS_MAP['none'];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '信用分', dataIndex: 'credit_score', width: 80,
      render: (v: number) => (
        <span style={{ color: v >= 90 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f', fontWeight: 600 }}>
          {v}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'red'}>
          {v === 'active' ? '正常' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v?.slice(0, 19),
    },
    {
      title: '操作', width: 240, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => showDetail(record)}>详情</Button>
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
      {/* 搜索筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input
              placeholder="搜索手机号/昵称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="用户类型"
              allowClear
              style={{ width: 130 }}
              value={typeFilter || undefined}
              onChange={v => setTypeFilter(v || '')}>
              {Object.entries(USER_TYPE_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="认证状态"
              allowClear
              style={{ width: 130 }}
              value={verifyFilter || undefined}
              onChange={v => setVerifyFilter(v || '')}>
              {Object.entries(VERIFY_STATUS_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="账户状态"
              allowClear
              style={{ width: 130 }}
              value={statusFilter || undefined}
              onChange={v => setStatusFilter(v || '')}>
              <Select.Option value="active">正常</Select.Option>
              <Select.Option value="suspended">已禁用</Select.Option>
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
        dataSource={filteredUsers}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      {/* 用户详情弹窗 */}
      <Modal
        title="用户详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={500}>
        {detailUser && (
          <div>
            <Row gutter={[0, 12]}>
              <Col span={8}><strong>用户ID:</strong></Col>
              <Col span={16}>{detailUser.id}</Col>
              <Col span={8}><strong>手机号:</strong></Col>
              <Col span={16}>{detailUser.phone}</Col>
              <Col span={8}><strong>昵称:</strong></Col>
              <Col span={16}>{detailUser.nickname || '未设置'}</Col>
              <Col span={8}><strong>用户类型:</strong></Col>
              <Col span={16}><Tag>{USER_TYPE_MAP[detailUser.user_type] || detailUser.user_type}</Tag></Col>
              <Col span={8}><strong>实名认证:</strong></Col>
              <Col span={16}>
                <Tag color={VERIFY_STATUS_MAP[detailUser.id_verified]?.color || 'default'}>
                  {VERIFY_STATUS_MAP[detailUser.id_verified]?.text || '未知'}
                </Tag>
              </Col>
              <Col span={8}><strong>信用分:</strong></Col>
              <Col span={16}>{detailUser.credit_score}</Col>
              <Col span={8}><strong>账户状态:</strong></Col>
              <Col span={16}>
                <Tag color={detailUser.status === 'active' ? 'green' : 'red'}>
                  {detailUser.status === 'active' ? '正常' : '已禁用'}
                </Tag>
              </Col>
              <Col span={8}><strong>注册时间:</strong></Col>
              <Col span={16}>{detailUser.created_at?.slice(0, 19)}</Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserList;
