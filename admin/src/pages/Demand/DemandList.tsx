import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Divider, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Timeline, Typography, message, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, ExportOutlined, EyeOutlined, ProjectOutlined, MessageOutlined, CarryOutOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

const { Text, Title } = Typography;

interface DemandItem {
  id: number;
  demand_no: string;
  title: string;
  cargo_scene: string;
  service_type: string;
  budget_min: number;
  budget_max: number;
  status: string;
  allows_pilot_candidate: boolean;
  selected_provider_user_id?: number;
  created_at: string;
  expires_at?: string;
  client?: {
    id: number;
    nickname?: string;
    phone?: string;
  };
  departure_address_snapshot?: any;
  destination_address_snapshot?: any;
  service_address_snapshot?: any;
  cargo_weight_kg?: number;
  cargo_type?: string;
  estimated_trip_count?: number;
  description?: string;
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '已发布', color: 'blue' },
  quoting: { text: '报价中', color: 'processing' },
  selected: { text: '已选方案', color: 'gold' },
  converted_to_order: { text: '已转订单', color: 'purple' },
  cancelled: { text: '已取消', color: 'red' },
  expired: { text: '已过期', color: 'orange' },
};

const SCENE_MAP: Record<string, string> = {
  power_grid: '电网巡检',
  mountain_agriculture: '山区农运',
  plateau_supply: '高原补给',
  island_supply: '海岛运输',
  emergency: '应急救援',
};

const formatMoney = (value?: number) => (typeof value === 'number' ? `¥${(value / 100).toFixed(2)}` : '-');
const formatTime = (value?: string) => (value ? value.slice(0, 16).replace('T', ' ') : '-');
const formatAddress = (snapshot: any) => snapshot?.text || snapshot?.address || '-';

const DemandList: React.FC = () => {
  const [items, setItems] = useState<DemandItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<DemandItem | null>(null);

  const fetchList = async (nextPage = page) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getDemands({
        page: nextPage,
        page_size: 20,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      });
      setItems(res.data?.list || []);
      setTotal(res.data?.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(page);
  }, [page, statusFilter]);

  const summary = useMemo(() => items.reduce(
    (acc, item) => {
      acc.openCount += ['published', 'quoting'].includes(item.status) ? 1 : 0;
      acc.selectedCount += item.status === 'selected' ? 1 : 0;
      acc.totalBudgetMax += Number(item.budget_max || 0);
      return acc;
    },
    {openCount: 0, selectedCount: 0, totalBudgetMax: 0},
  ), [items]);

  const handleExport = () => {
    message.success(`正在导出当前筛选下的 ${items.length} 条需求记录...`);
  };

  const columns: ColumnsType<DemandItem> = [
    {
      title: '需求识别码',
      dataIndex: 'demand_no',
      width: 190,
      render: (text) => <Text copyable code>{text}</Text>
    },
    { title: '项目标题', dataIndex: 'title', width: 220, ellipsis: true, render: (t) => <Text strong>{t}</Text> },
    {
      title: '发布客户',
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.client?.nickname || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {record.client?.id}</Text>
        </Space>
      ),
    },
    {
      title: '作业场景',
      dataIndex: 'cargo_scene',
      width: 120,
      render: (v) => <Tag color="orange">{SCENE_MAP[v] || v}</Tag>
    },
    {
      title: '预算范围',
      width: 180,
      align: 'right',
      render: (_, record) => (
        <Text type="danger" strong>{`${formatMoney(record.budget_min)} - ${formatMoney(record.budget_max)}`}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color} style={{ borderRadius: 10 }}>{status.text}</Tag>;
      },
    },
    {
      title: '飞手招募',
      dataIndex: 'allows_pilot_candidate',
      width: 100,
      render: (value: boolean) => (value ? <Tag color="cyan">开放中</Tag> : <Text type="secondary">未开放</Text>),
    },
    { title: '发布于', dataIndex: 'created_at', width: 160, render: formatTime },
    {
      title: '操作',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button type="text" icon={<EyeOutlined />} onClick={() => setDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>需求撮合看板</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchList(page)}>刷新</Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport}>导出列表</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><ProjectOutlined /> 累计发布需求</Space>}
              value={total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><MessageOutlined /> 正在报价中</Space>}
              value={summary.openCount}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><CarryOutOutlined /> 已选定方案</Space>}
              value={summary.selectedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title={<Space><DollarOutlined /> 预算总规模</Space>}
              value={summary.totalBudgetMax / 100}
              precision={0}
              prefix="¥"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" bordered={false} style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索需求编号/标题/关键词"
                style={{ width: 280 }}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={() => { setPage(1); fetchList(1); }}
              />
              <Select
                allowClear
                placeholder="流程状态"
                style={{ width: 140 }}
                value={statusFilter || undefined}
                onChange={value => { setStatusFilter(value || ''); setPage(1); }}>
                {Object.entries(STATUS_MAP).map(([key, value]) => (
                  <Select.Option key={key} value={key}>{value.text}</Select.Option>
                ))}
              </Select>
              <Button type="primary" onClick={() => { setPage(1); fetchList(1); }}>筛选</Button>
              <Button onClick={() => { setKeyword(''); setStatusFilter(''); setPage(1); fetchList(1); }}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        size="middle"
        scroll={{ x: 1300 }}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showTotal: t => `共 ${t} 条需求`,
          showSizeChanger: false
        }}
        style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
      />

      <Modal open={!!detail} title={<Space><EyeOutlined /> 原始需求档案详情</Space>} footer={null} width={920} onCancel={() => setDetail(null)}>
        {detail ? (
          <div style={{ marginTop: -10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: '12px 20px', borderRadius: 8, marginBottom: 20 }}>
              <Space size="large">
                <Statistic title="最低预算" value={(detail.budget_min || 0) / 100} precision={2} prefix="¥" valueStyle={{ fontSize: 18 }} />
                <Statistic title="最高预算" value={(detail.budget_max || 0) / 100} precision={2} prefix="¥" valueStyle={{ color: '#cf1322', fontSize: 18 }} />
                <Statistic title="预计架次" value={detail.estimated_trip_count || 1} valueStyle={{ fontSize: 18 }} />
              </Space>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">需求状态</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={STATUS_MAP[detail.status]?.color || 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
                    {STATUS_MAP[detail.status]?.text || detail.status}
                  </Tag>
                </div>
              </div>
            </div>

            <Descriptions column={2} bordered size="small" labelStyle={{ background: '#fafafa', width: 120 }}>
              <Descriptions.Item label="需求编号"><Text copyable>{detail.demand_no}</Text></Descriptions.Item>
              <Descriptions.Item label="标题">{detail.title}</Descriptions.Item>
              <Descriptions.Item label="发布客户">{detail.client?.nickname || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系方式">{detail.client?.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="场景类型"><Tag color="orange">{SCENE_MAP[detail.cargo_scene] || detail.cargo_scene}</Tag></Descriptions.Item>
              <Descriptions.Item label="服务模式">{detail.service_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="货物属性">{detail.cargo_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="预估重量">{detail.cargo_weight_kg ? `${detail.cargo_weight_kg} kg` : '-'}</Descriptions.Item>
              <Descriptions.Item label="选定服务方ID">{detail.selected_provider_user_id || <Text type="secondary">尚未选定</Text>}</Descriptions.Item>
              <Descriptions.Item label="飞手招募">{detail.allows_pilot_candidate ? '已开启' : '未开启'}</Descriptions.Item>
              <Descriptions.Item label="起运位置" span={2}>{formatAddress(detail.departure_address_snapshot)}</Descriptions.Item>
              <Descriptions.Item label="目的位置" span={2}>{formatAddress(detail.destination_address_snapshot)}</Descriptions.Item>
              <Descriptions.Item label="补充作业说明" span={2}>{detail.description || <Text type="secondary">未填写</Text>}</Descriptions.Item>
            </Descriptions>

            <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>生命周期动态</Text></Divider>
            <div style={{ padding: '0 10px' }}>
              <Timeline
                items={[
                  { color: 'blue', label: formatTime(detail.created_at), children: '客户提交需求，系统自动生成存证编号' },
                  detail.status !== 'draft' ? { color: 'green', label: '已进入撮合', children: '需求已向全平台符合条件的机主/飞手开放' } : null,
                  detail.expires_at ? { color: 'red', label: formatTime(detail.expires_at), children: '需求有效期截止（若未成交将自动过期）' } : null,
                ].filter(Boolean) as any}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DemandList;
