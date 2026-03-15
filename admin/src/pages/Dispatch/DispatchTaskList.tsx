import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface DispatchTaskItem {
  id: number;
  dispatch_no: string;
  order_id: number;
  provider_user_id: number;
  target_pilot_user_id: number;
  dispatch_source: string;
  retry_count: number;
  status: string;
  reason?: string;
  sent_at?: string;
  responded_at?: string;
  created_at: string;
  order?: { id: number; order_no?: string; title?: string; status?: string };
  provider?: { id: number; nickname?: string; phone?: string };
  target_pilot?: { id: number; nickname?: string; phone?: string };
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending_response: { text: '待响应', color: 'orange' },
  accepted: { text: '已接受', color: 'blue' },
  executing: { text: '执行中', color: 'processing' },
  finished: { text: '已完成', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  cancelled: { text: '已取消', color: 'default' },
  timeout: { text: '已超时', color: 'red' },
};

const DispatchTaskList: React.FC = () => {
  const [items, setItems] = useState<DispatchTaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<DispatchTaskItem | null>(null);

  const fetchList = async (nextPage = page) => {
    setLoading(true);
    try {
      const res: any = await adminApi.getDispatchTasks({
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

  const columns: ColumnsType<DispatchTaskItem> = [
    { title: '派单编号', dataIndex: 'dispatch_no', width: 190 },
    { title: '订单编号', width: 190, render: (_, record) => record.order?.order_no || '-' },
    { title: '承接方', width: 120, render: (_, record) => record.provider?.nickname || '-' },
    { title: '目标飞手', width: 120, render: (_, record) => record.target_pilot?.nickname || '-' },
    { title: '派单来源', dataIndex: 'dispatch_source', width: 120 },
    { title: '重派次数', dataIndex: 'retry_count', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: value => {
        const status = STATUS_MAP[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    { title: '发起时间', dataIndex: 'sent_at', width: 170, render: value => value?.slice(0, 19).replace('T', ' ') || '-' },
    { title: '响应时间', dataIndex: 'responded_at', width: 170, render: value => value?.slice(0, 19).replace('T', ' ') || '-' },
    { title: '操作', width: 90, fixed: 'right', render: (_, record) => <Button size="small" onClick={() => setDetail(record)}>详情</Button> },
  ];

  return (
    <div>
      <h2>正式派单管理</h2>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Input allowClear prefix={<SearchOutlined />} placeholder="搜索派单编号/订单编号" style={{ width: 240 }} value={keyword} onChange={e => setKeyword(e.target.value)} onPressEnter={() => { setPage(1); fetchList(1); }} />
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

      <Table rowKey="id" loading={loading} columns={columns} dataSource={items} scroll={{ x: 1250 }} pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }} />

      <Modal open={!!detail} title="正式派单详情" footer={null} width={720} onCancel={() => setDetail(null)}>
        {detail ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="派单编号">{detail.dispatch_no}</Descriptions.Item>
            <Descriptions.Item label="状态">{STATUS_MAP[detail.status]?.text || detail.status}</Descriptions.Item>
            <Descriptions.Item label="订单编号">{detail.order?.order_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="订单标题">{detail.order?.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="承接方">{detail.provider?.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="目标飞手">{detail.target_pilot?.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="派单来源">{detail.dispatch_source || '-'}</Descriptions.Item>
            <Descriptions.Item label="重派次数">{detail.retry_count || 0}</Descriptions.Item>
            <Descriptions.Item label="发起时间">{detail.sent_at?.slice(0, 19).replace('T', ' ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="响应时间">{detail.responded_at?.slice(0, 19).replace('T', ' ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="派单原因" span={2}>{detail.reason || '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
};

export default DispatchTaskList;
