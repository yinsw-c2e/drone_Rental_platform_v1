import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal, Input, Select, Card, Row, Col } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface ProviderRoleSummary {
  status: string;          // none / pending_review / approved / rejected / suspended
  asset_status: string;    // 机主（资产）侧
  executor_status: string; // 飞手（执行）侧
}

interface RoleSummary {
  has_client_role: boolean;
  has_owner_role: boolean;
  has_pilot_role: boolean;
  provider: ProviderRoleSummary;
}

interface User {
  id: number;
  phone: string;
  nickname: string;
  user_type: string;
  // 用户在小程序双端模式下选择的意向身份(customer / provider)。
  // 仅作运营分群参考,展示为"意向"标签,实际能力位仍以 role_summary 为准。
  preferred_mode?: string;
  id_verified: string;
  credit_score: number;
  status: string;
  created_at: string;
  role_summary?: RoleSummary | null;
}

const PREFERRED_MODE_META: Record<string, { text: string; color: string }> = {
  customer: { text: '意向·需求端', color: 'cyan' },
  provider: { text: '意向·服务商', color: 'purple' },
};

// 服务商各能力位的审核态展示。与小程序端 role_summary.provider 口径一致。
const PROVIDER_STATUS_MAP: Record<string, { text: string; color: string }> = {
  approved: { text: '已通过', color: 'green' },
  pending_review: { text: '审核中', color: 'orange' },
  rejected: { text: '已驳回', color: 'red' },
  suspended: { text: '已暂停', color: 'volcano' },
  none: { text: '未申请', color: 'default' },
};

const providerStatusMeta = (status?: string) =>
  PROVIDER_STATUS_MAP[status || 'none'] || PROVIDER_STATUS_MAP.none;

const VERIFY_STATUS_MAP: Record<string, { text: string; color: string }> = {
  approved: { text: '已认证', color: 'green' },
  pending: { text: '待审核', color: 'orange' },
  rejected: { text: '未通过', color: 'red' },
  none: { text: '未提交', color: 'default' },
};

// 双端模型下身份不再由 user_type 表达：每个非管理员用户默认即“客户（需求端）”，
// 是否“服务商（供给端）”由 role_summary.provider 决定，与小程序端口径保持一致。
const renderIdentityTags = (u: User): React.ReactNode => {
  if (u.user_type === 'admin') {
    return <Tag color="gold">管理员</Tag>;
  }
  const rs = u.role_summary;
  if (!rs) {
    return <Tag color="blue">客户</Tag>;
  }
  const tags: React.ReactNode[] = [];
  if (rs.has_client_role) {
    tags.push(<Tag key="client" color="blue">客户</Tag>);
  }
  const providerStatus = rs.provider?.status || 'none';
  if (providerStatus !== 'none') {
    const meta = providerStatusMeta(providerStatus);
    tags.push(<Tag key="provider" color={meta.color}>服务商·{meta.text}</Tag>);
  }
  if (!tags.length) {
    tags.push(<Tag key="client" color="blue">客户</Tag>);
  }
  const preferredMeta = u.preferred_mode ? PREFERRED_MODE_META[u.preferred_mode] : null;
  if (preferredMeta) {
    tags.push(<Tag key="preferred" color={preferredMeta.color}>{preferredMeta.text}</Tag>);
  }
  return <Space size={4} wrap>{tags}</Space>;
};

// 身份筛选在当前页数据上本地过滤（与下方实名/账户状态的本地筛选一致）。
const IDENTITY_FILTER_OPTIONS = [
  { value: 'provider', label: '服务商' },
  { value: 'client_only', label: '纯客户' },
  { value: 'admin', label: '管理员' },
];

const matchesIdentity = (u: User, filter: string): boolean => {
  if (!filter) return true;
  if (filter === 'admin') return u.user_type === 'admin';
  const providerStatus = u.role_summary?.provider?.status || 'none';
  if (filter === 'provider') return u.user_type !== 'admin' && providerStatus !== 'none';
  if (filter === 'client_only') return u.user_type !== 'admin' && providerStatus === 'none';
  return true;
};

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 搜索筛选
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [identityFilter, setIdentityFilter] = useState<string>('');
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
    setIdentityFilter('');
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

  // 本地筛选（身份和认证状态在前端过滤）
  const filteredUsers = users.filter(u => {
    if (identityFilter && !matchesIdentity(u, identityFilter)) return false;
    if (verifyFilter && u.id_verified !== verifyFilter) return false;
    return true;
  });

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '昵称', dataIndex: 'nickname', width: 120 },
    {
      title: '身份', dataIndex: 'role_summary', width: 220,
      render: (_: unknown, record: User) => renderIdentityTags(record),
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
              placeholder="身份"
              allowClear
              style={{ width: 130 }}
              value={identityFilter || undefined}
              onChange={v => setIdentityFilter(v || '')}>
              {IDENTITY_FILTER_OPTIONS.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
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
              <Col span={8}><strong>身份:</strong></Col>
              <Col span={16}>{renderIdentityTags(detailUser)}</Col>
              <Col span={8}><strong>小程序意向:</strong></Col>
              <Col span={16}>
                {detailUser.preferred_mode
                  ? (
                    <Tag color={PREFERRED_MODE_META[detailUser.preferred_mode]?.color}>
                      {PREFERRED_MODE_META[detailUser.preferred_mode]?.text || detailUser.preferred_mode}
                    </Tag>
                  )
                  : <span style={{ color: '#bfbfbf' }}>未选择</span>}
              </Col>
              {detailUser.user_type !== 'admin' && (
                <>
                  <Col span={8}><strong>服务商·资产(机主):</strong></Col>
                  <Col span={16}>
                    <Tag color={providerStatusMeta(detailUser.role_summary?.provider?.asset_status).color}>
                      {providerStatusMeta(detailUser.role_summary?.provider?.asset_status).text}
                    </Tag>
                  </Col>
                  <Col span={8}><strong>服务商·执行(飞手):</strong></Col>
                  <Col span={16}>
                    <Tag color={providerStatusMeta(detailUser.role_summary?.provider?.executor_status).color}>
                      {providerStatusMeta(detailUser.role_summary?.provider?.executor_status).text}
                    </Tag>
                  </Col>
                </>
              )}
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
