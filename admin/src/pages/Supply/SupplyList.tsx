import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface SupplyItem {
  id: number;
  supply_no: string;
  title: string;
  status: string;
  cargo_scenes?: string[];
  service_types?: string[];
  mtow_kg: number;
  max_payload_kg: number;
  base_price_amount: number;
  pricing_unit: string;
  accepts_direct_order: boolean;
  service_area_snapshot?: any;
  pricing_rule?: any;
  available_time_slots?: any;
  updated_at?: string;
  owner?: { id: number; nickname?: string; phone?: string };
  drone?: { id: number; brand?: string; model?: string; serial_number?: string; certification_status?: string };
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  active: { text: '上架中', color: 'green' },
  paused: { text: '暂停', color: 'orange' },
  closed: { text: '关闭', color: 'red' },
};

const SupplyList: React.FC = () => {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<SupplyItem | null>(null);

  const fetchList = async (nextPage = page) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getSupplies({
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

  const columns: ColumnsType<SupplyItem> = [
    { title: '供给编号', dataIndex: 'supply_no', width: 190 },
    { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
    { title: '机主', width: 120, render: (_, record) => record.owner?.nickname || '-' },
    {
      title: '无人机',
      width: 170,
      render: (_, record) => record.drone ? `${record.drone.brand || '-'} ${record.drone.model || ''}`.trim() : '-',
    },
    { title: '起飞重量', dataIndex: 'mtow_kg', width: 110, render: value => `${value || 0}kg` },
    { title: '最大载重', dataIndex: 'max_payload_kg', width: 110, render: value => `${value || 0}kg` },
    { title: '基础价格', dataIndex: 'base_price_amount', width: 110, render: value => `¥${((value || 0) / 100).toFixed(2)}` },
    { title: '直达下单', dataIndex: 'accepts_direct_order', width: 100, render: value => value ? <Tag color="blue">支持</Tag> : <Tag>不支持</Tag> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 170, render: value => value?.slice(0, 19).replace('T', ' ') || '-' },
    { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>详情</Button> },
  ];

  return (
    <div>
      <h2>供给管理</h2>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input allowClear prefix={<SearchOutlined />} placeholder="搜索供给编号/标题/机型/机主" style={{ width: 240 }} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); fetchList(1); }} />
          </Col>
          <Col>
            <Select allowClear placeholder="状态" style={{ width: 150 }} value={statusFilter || undefined} onChange={value => { setStatusFilter(value || ''); setPage(1); }}>
              {Object.entries(STATUS_MAP).map(([key, value]) => <Select.Option key={key} value={key}>{value.text}</Select.Option>)}
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

      <Table rowKey="id" loading={loading} columns={columns} dataSource={items} scroll={{ x: 1300 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }} />

      <Modal open={!!detail} title="供给详情" footer={null} width={760} onCancel={() => setDetail(null)}>
        {detail ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="供给编号">{detail.supply_no}</Descriptions.Item>
            <Descriptions.Item label="状态">{STATUS_MAP[detail.status]?.text || detail.status}</Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>{detail.title}</Descriptions.Item>
            <Descriptions.Item label="机主">{detail.owner?.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="无人机">{detail.drone ? `${detail.drone.brand || '-'} ${detail.drone.model || ''}`.trim() : '-'}</Descriptions.Item>
            <Descriptions.Item label="场景标签" span={2}>{(detail.cargo_scenes || []).join(' / ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务类型" span={2}>{(detail.service_types || []).join(' / ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="起飞重量">{detail.mtow_kg || 0} kg</Descriptions.Item>
            <Descriptions.Item label="最大载重">{detail.max_payload_kg || 0} kg</Descriptions.Item>
            <Descriptions.Item label="基础价格">¥{((detail.base_price_amount || 0) / 100).toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="计价单位">{detail.pricing_unit || '-'}</Descriptions.Item>
            <Descriptions.Item label="支持直达下单">{detail.accepts_direct_order ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="设备资质">{detail.drone?.certification_status || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务区域" span={2}><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(detail.service_area_snapshot || {}, null, 2)}</pre></Descriptions.Item>
            <Descriptions.Item label="价格规则" span={2}><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(detail.pricing_rule || {}, null, 2)}</pre></Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
};

export default SupplyList;
