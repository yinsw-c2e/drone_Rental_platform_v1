import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

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

const formatMoney = (value?: number) => (typeof value === 'number' ? `¥${(value / 100).toFixed(2)}` : '-');
const formatTime = (value?: string) => (value ? value.slice(0, 19).replace('T', ' ') : '-');
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

  const columns: ColumnsType<DemandItem> = [
    { title: '需求编号', dataIndex: 'demand_no', width: 190 },
    { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
    {
      title: '客户',
      width: 120,
      render: (_, record) => record.client?.nickname || `用户 ${record.client?.id || '-'}`,
    },
    { title: '场景', dataIndex: 'cargo_scene', width: 120 },
    {
      title: '预算',
      width: 150,
      render: (_, record) => `${formatMoney(record.budget_min)} - ${formatMoney(record.budget_max)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '候选飞手',
      dataIndex: 'allows_pilot_candidate',
      width: 100,
      render: (value: boolean) => (value ? <Tag color="cyan">开放</Tag> : <Tag>关闭</Tag>),
    },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: formatTime },
    {
      title: '操作',
      width: 90,
      fixed: 'right',
      render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>详情</Button>,
    },
  ];

  return (
    <div>
      <h2>需求管理</h2>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索需求编号/标题/场景"
              style={{ width: 240 }}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                fetchList(1);
              }}
            />
          </Col>
          <Col>
            <Select
              allowClear
              placeholder="状态"
              style={{ width: 150 }}
              value={statusFilter || undefined}
              onChange={value => {
                setStatusFilter(value || '');
                setPage(1);
              }}>
              {Object.entries(STATUS_MAP).map(([key, value]) => (
                <Select.Option key={key} value={key}>{value.text}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={() => { setPage(1); fetchList(1); }}>搜索</Button>
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
        scroll={{ x: 1200 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      <Modal open={!!detail} title="需求详情" footer={null} width={760} onCancel={() => setDetail(null)}>
        {detail ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="需求编号">{detail.demand_no}</Descriptions.Item>
            <Descriptions.Item label="状态">{STATUS_MAP[detail.status]?.text || detail.status}</Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>{detail.title}</Descriptions.Item>
            <Descriptions.Item label="客户">{detail.client?.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="场景类型">{detail.cargo_scene || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务类型">{detail.service_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="货物类型">{detail.cargo_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="货物重量">{detail.cargo_weight_kg ? `${detail.cargo_weight_kg} kg` : '-'}</Descriptions.Item>
            <Descriptions.Item label="预计架次">{detail.estimated_trip_count || 1}</Descriptions.Item>
            <Descriptions.Item label="预算区间">{`${formatMoney(detail.budget_min)} - ${formatMoney(detail.budget_max)}`}</Descriptions.Item>
            <Descriptions.Item label="候选飞手">{detail.allows_pilot_candidate ? '开放' : '关闭'}</Descriptions.Item>
            <Descriptions.Item label="已选服务方">{detail.selected_provider_user_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(detail.created_at)}</Descriptions.Item>
            <Descriptions.Item label="过期时间">{formatTime(detail.expires_at)}</Descriptions.Item>
            <Descriptions.Item label="起运点" span={2}>{formatAddress(detail.departure_address_snapshot)}</Descriptions.Item>
            <Descriptions.Item label="卸货点" span={2}>{formatAddress(detail.destination_address_snapshot)}</Descriptions.Item>
            <Descriptions.Item label="服务地址" span={2}>{formatAddress(detail.service_address_snapshot)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
};

export default DemandList;
