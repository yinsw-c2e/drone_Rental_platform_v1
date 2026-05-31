import React, { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Button, Space, Card, Row, Col, Modal, Select, Input, Descriptions } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';

// 与小程序端 role_summary.provider 完全同口径,管理端按"服务商"视角聚合展示。
// 资产侧 = 机主(owner_profile / 持有无人机) ; 执行侧 = 飞手(pilot / pilot_profile)。

interface ProviderRoleSummary {
  status: string;
  asset_status: string;
  executor_status: string;
  can_use_workbench: boolean;
  can_quote: boolean;
  can_accept_dispatch: boolean;
  next_action: string;
}

interface RoleSummary {
  has_client_role: boolean;
  has_owner_role: boolean;
  has_pilot_role: boolean;
  provider: ProviderRoleSummary;
}

interface OwnerProfile {
  id: number;
  verification_status: string;
  status: string;
  service_city: string;
  contact_phone: string;
  created_at: string;
}

interface PilotProfile {
  id: number;
  verification_status: string;
  availability_status: string;
  caac_license_no: string;
  created_at: string;
}

interface Pilot {
  id: number;
  verification_status: string;
  availability_status: string;
}

interface ProviderRow {
  user: {
    id: number;
    phone: string;
    nickname: string;
    preferred_mode?: string;
    created_at: string;
    status: string;
  };
  role_summary: RoleSummary;
  drone_total: number;
  market_eligible_drone_total: number;
  owner_profile?: OwnerProfile | null;
  pilot_profile?: PilotProfile | null;
  pilot?: Pilot | null;
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  approved: { text: '已通过', color: 'green' },
  pending_review: { text: '审核中', color: 'orange' },
  rejected: { text: '已驳回', color: 'red' },
  suspended: { text: '已暂停', color: 'volcano' },
  none: { text: '未申请', color: 'default' },
};

const NEXT_ACTION_TEXT: Record<string, string> = {
  start_onboarding: '需补充资料',
  wait_review: '等待审核',
  fix_rejected: '需驳回处理',
  open_workbench: '可进入工作台',
};

const statusMeta = (s?: string) => STATUS_META[s || 'none'] || STATUS_META.none;

const PREFERRED_MODE_TEXT: Record<string, string> = {
  customer: '我要吊运(需求端)',
  provider: '我要接单(服务商)',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'pending_review', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'suspended', label: '已暂停' },
  { value: 'none', label: '未申请' },
];

const ProviderList: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [detail, setDetail] = useState<ProviderRow | null>(null);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getProviders({ page: p, page_size: 20 });
      setRows(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(page); }, [page]);

  // 本地过滤：服务端只做候选集分页,关键字/状态在当前页过滤。
  const filteredRows = useMemo(() => rows.filter(row => {
    if (statusFilter && (row.role_summary?.provider?.status || 'none') !== statusFilter) {
      return false;
    }
    if (keyword) {
      const kw = keyword.trim().toLowerCase();
      if (
        !row.user.phone?.toLowerCase().includes(kw) &&
        !row.user.nickname?.toLowerCase().includes(kw) &&
        String(row.user.id) !== kw
      ) {
        return false;
      }
    }
    return true;
  }), [rows, statusFilter, keyword]);

  const columns: ColumnsType<ProviderRow> = [
    { title: '用户ID', dataIndex: ['user', 'id'], width: 80 },
    { title: '手机号', dataIndex: ['user', 'phone'], width: 130 },
    {
      title: '昵称', width: 140,
      render: (_: unknown, r) => r.user.nickname || '-',
    },
    {
      title: '意向',
      width: 140,
      render: (_: unknown, r) => r.user.preferred_mode
        ? <Tag>{PREFERRED_MODE_TEXT[r.user.preferred_mode] || r.user.preferred_mode}</Tag>
        : <span style={{ color: '#bfbfbf' }}>未选择</span>,
    },
    {
      title: '综合状态',
      width: 110,
      render: (_: unknown, r) => {
        const meta = statusMeta(r.role_summary?.provider?.status);
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '资产(机主)',
      width: 130,
      render: (_: unknown, r) => {
        const meta = statusMeta(r.role_summary?.provider?.asset_status);
        return (
          <Space size={4} direction="vertical" style={{ lineHeight: 1.3 }}>
            <Tag color={meta.color}>{meta.text}</Tag>
            <span style={{ fontSize: 12, color: '#888' }}>
              共 {r.drone_total} 架 / 在售 {r.market_eligible_drone_total}
            </span>
          </Space>
        );
      },
    },
    {
      title: '执行(飞手)',
      width: 130,
      render: (_: unknown, r) => {
        const meta = statusMeta(r.role_summary?.provider?.executor_status);
        const online = r.pilot?.availability_status === 'online';
        return (
          <Space size={4} direction="vertical" style={{ lineHeight: 1.3 }}>
            <Tag color={meta.color}>{meta.text}</Tag>
            <span style={{ fontSize: 12, color: online ? '#52c41a' : '#888' }}>
              {r.pilot ? (online ? '在线接单' : '离线') : '未注册'}
            </span>
          </Space>
        );
      },
    },
    {
      title: '下一步',
      width: 120,
      render: (_: unknown, r) => NEXT_ACTION_TEXT[r.role_summary?.provider?.next_action] || '-',
    },
    {
      title: '注册时间', width: 160,
      render: (_: unknown, r) => r.user.created_at?.slice(0, 19),
    },
    {
      title: '操作', width: 240, fixed: 'right',
      render: (_: unknown, r) => (
        <Space>
          <Button size="small" onClick={() => setDetail(r)}>详情</Button>
          {(r.drone_total > 0) && (
            <Button size="small" onClick={() => navigate('/drones')}>无人机审核</Button>
          )}
          {r.pilot && (
            <Button size="small" onClick={() => navigate('/pilots')}>飞手审核</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>服务商入驻审核</h2>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input
              placeholder="搜索手机号/昵称/ID"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="综合状态"
              allowClear
              style={{ width: 140 }}
              value={statusFilter || undefined}
              onChange={v => setStatusFilter(v || '')}>
              {STATUS_FILTER_OPTIONS.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Space>
              <Button onClick={() => { setKeyword(''); setStatusFilter(''); }}>
                重置
              </Button>
              <Button type="primary" onClick={() => fetchData(page)}>刷新</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredRows}
        rowKey={(r) => r.user.id}
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 个服务商候选` }}
      />

      <Modal
        title="服务商入驻详情"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={680}
      >
        {detail && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="用户ID">{detail.user.id}</Descriptions.Item>
            <Descriptions.Item label="手机号">{detail.user.phone}</Descriptions.Item>
            <Descriptions.Item label="昵称">{detail.user.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="账户状态">
              <Tag color={detail.user.status === 'active' ? 'green' : 'red'}>
                {detail.user.status === 'active' ? '正常' : '已禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="意向身份" span={2}>
              {detail.user.preferred_mode
                ? PREFERRED_MODE_TEXT[detail.user.preferred_mode] || detail.user.preferred_mode
                : '未选择'}
            </Descriptions.Item>
            <Descriptions.Item label="综合状态">
              <Tag color={statusMeta(detail.role_summary?.provider?.status).color}>
                {statusMeta(detail.role_summary?.provider?.status).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="下一步动作">
              {NEXT_ACTION_TEXT[detail.role_summary?.provider?.next_action] || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="资产(机主)状态">
              <Tag color={statusMeta(detail.role_summary?.provider?.asset_status).color}>
                {statusMeta(detail.role_summary?.provider?.asset_status).text}
              </Tag>
              <span style={{ marginLeft: 8, color: '#888' }}>
                共 {detail.drone_total} 架 / 在售 {detail.market_eligible_drone_total}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="执行(飞手)状态">
              <Tag color={statusMeta(detail.role_summary?.provider?.executor_status).color}>
                {statusMeta(detail.role_summary?.provider?.executor_status).text}
              </Tag>
              {detail.pilot && (
                <span style={{ marginLeft: 8, color: detail.pilot.availability_status === 'online' ? '#52c41a' : '#888' }}>
                  {detail.pilot.availability_status === 'online' ? '在线接单' : '离线'}
                </span>
              )}
            </Descriptions.Item>
            {detail.owner_profile && (
              <Descriptions.Item label="机主资料" span={2}>
                服务城市: {detail.owner_profile.service_city || '-'} ·
                联系电话: {detail.owner_profile.contact_phone || '-'} ·
                提交于 {detail.owner_profile.created_at?.slice(0, 10)}
              </Descriptions.Item>
            )}
            {detail.pilot_profile && (
              <Descriptions.Item label="飞手资料" span={2}>
                CAAC: {detail.pilot_profile.caac_license_no || '-'} ·
                提交于 {detail.pilot_profile.created_at?.slice(0, 10)}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ProviderList;
