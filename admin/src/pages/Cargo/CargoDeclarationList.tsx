import React, { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Space, message, Modal, Select, Card, Row, Col, Descriptions, Input,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

const { TextArea } = Input;

interface CargoDeclaration {
  id: number;
  client_id: number;
  declaration_no: string;
  cargo_category: string;
  cargo_name: string;
  cargo_description: string;
  quantity: number;
  total_weight: number;
  length: number;
  width: number;
  height: number;
  declared_value: number;
  is_hazardous: boolean;
  requires_insurance: boolean;
  compliance_status: string; // pending / approved / rejected
  compliance_note: string;
  cargo_images: string[];
  created_at: string;
  client?: {
    id: number;
    user?: { nickname: string; phone: string };
  };
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  normal:     { label: '普通货物', color: 'blue' },
  valuable:   { label: '贵重物品', color: 'gold' },
  fragile:    { label: '易碎品',   color: 'orange' },
  hazardous:  { label: '危险品',   color: 'red' },
  perishable: { label: '生鲜',     color: 'green' },
  medical:    { label: '医疗用品', color: 'purple' },
};

const COMPLIANCE_MAP: Record<string, { label: string; color: string }> = {
  pending:  { label: '待审核', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
};

export default function CargoDeclarationList() {
  const [list, setList] = useState<CargoDeclaration[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const [detailVisible, setDetailVisible] = useState(false);
  const [current, setCurrent] = useState<CargoDeclaration | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [operating, setOperating] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res: any = await adminApi.getCargoDeclarations({
        page,
        page_size: 20,
      });
      const data = res.data;
      setList(data?.list || []);
      setTotal(data?.total || 0);
    } catch (e: any) {
      message.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [page]);

  const filteredList = list.filter(item =>
    !statusFilter || item.compliance_status === statusFilter,
  );

  const handleApprove = (record: CargoDeclaration) => {
    Modal.confirm({
      title: '确认审核通过？',
      content: `即将通过货物申报「${record.cargo_name}」（${record.declaration_no}）`,
      okText: '通过',
      onOk: async () => {
        setOperating(true);
        try {
          await adminApi.approveCargoDeclaration(record.id);
          message.success('审核已通过');
          setDetailVisible(false);
          fetchList();
        } catch (e: any) {
          message.error(e.message || '操作失败');
        } finally {
          setOperating(false);
        }
      },
    });
  };

  const handleReject = (record: CargoDeclaration) => {
    Modal.confirm({
      title: '确认拒绝？',
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>请填写拒绝原因（必填）：</p>
          <TextArea
            rows={3}
            placeholder="请填写拒绝原因"
            onChange={e => setRejectNote(e.target.value)}
          />
        </div>
      ),
      okText: '确认拒绝',
      okType: 'danger',
      onOk: async () => {
        if (!rejectNote.trim()) {
          message.warning('请填写拒绝原因');
          return Promise.reject();
        }
        setOperating(true);
        try {
          await adminApi.rejectCargoDeclaration(record.id, rejectNote.trim());
          message.success('已拒绝');
          setDetailVisible(false);
          setRejectNote('');
          fetchList();
        } catch (e: any) {
          message.error(e.message || '操作失败');
        } finally {
          setOperating(false);
        }
      },
    });
  };

  const columns: ColumnsType<CargoDeclaration> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '申报单号', dataIndex: 'declaration_no', width: 160,
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '申报人',
      width: 140,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.client?.user?.nickname || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.client?.user?.phone || '-'}</div>
        </div>
      ),
    },
    {
      title: '货物名称', dataIndex: 'cargo_name', width: 120,
    },
    {
      title: '类别', dataIndex: 'cargo_category', width: 90,
      render: v => {
        const c = CATEGORY_MAP[v] || { label: v, color: 'default' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '重量(kg)', dataIndex: 'total_weight', width: 90,
      render: v => `${v} kg`,
    },
    {
      title: '申报价值', dataIndex: 'declared_value', width: 100,
      render: v => `¥${(v / 100).toFixed(2)}`,
    },
    {
      title: '审核状态', dataIndex: 'compliance_status', width: 90,
      render: v => {
        const s = COMPLIANCE_MAP[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '危险品', dataIndex: 'is_hazardous', width: 70,
      render: v => v ? <Tag color="red">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '申报时间', dataIndex: 'created_at', width: 120,
      render: v => v?.substring(0, 10) || '-',
    },
    {
      title: '操作', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setCurrent(record); setRejectNote(''); setDetailVisible(true); }}
          >
            详情
          </Button>
          {record.compliance_status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={operating}
                onClick={() => handleApprove(record)}
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={operating}
                onClick={() => handleReject(record)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const pendingCount = list.filter(i => i.compliance_status === 'pending').length;

  return (
    <div>
      <h2>货物申报审核</h2>

      {pendingCount > 0 && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#faad14', background: '#fffbe6' }}>
          <span style={{ color: '#d46b08', fontWeight: 600 }}>
            ⚠️ 当前有 {pendingCount} 条货物申报待审核
          </span>
        </Card>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Select
              placeholder="审核状态"
              style={{ width: 130 }}
              value={statusFilter || undefined}
              allowClear
              onChange={v => setStatusFilter(v || '')}
            >
              {Object.entries(COMPLIANCE_MAP).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.label}</Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={filteredList}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
      />

      {/* 详情弹窗 */}
      <Modal
        title="货物申报详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={640}
        footer={
          current?.compliance_status === 'pending'
            ? [
                <Button key="reject" danger icon={<CloseCircleOutlined />} loading={operating} onClick={() => current && handleReject(current)}>拒绝</Button>,
                <Button key="approve" type="primary" icon={<CheckCircleOutlined />} loading={operating} onClick={() => current && handleApprove(current)}>审核通过</Button>,
              ]
            : [<Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>]
        }
      >
        {current && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="申报单号" span={2}>
              <span style={{ fontFamily: 'monospace' }}>{current.declaration_no}</span>
            </Descriptions.Item>
            <Descriptions.Item label="申报人">
              {current.client?.user?.nickname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">
              {current.client?.user?.phone || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="货物名称">{current.cargo_name}</Descriptions.Item>
            <Descriptions.Item label="货物类别">
              <Tag color={CATEGORY_MAP[current.cargo_category]?.color}>
                {CATEGORY_MAP[current.cargo_category]?.label || current.cargo_category}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="数量">{current.quantity} 件</Descriptions.Item>
            <Descriptions.Item label="总重量">{current.total_weight} kg</Descriptions.Item>
            {(current.length > 0 || current.width > 0 || current.height > 0) && (
              <Descriptions.Item label="尺寸(cm)" span={2}>
                {current.length || '-'} × {current.width || '-'} × {current.height || '-'}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="申报价值" span={2}>
              ¥{(current.declared_value / 100).toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="是否危险品">
              <Tag color={current.is_hazardous ? 'red' : 'default'}>{current.is_hazardous ? '是' : '否'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="是否保价">
              <Tag color={current.requires_insurance ? 'blue' : 'default'}>{current.requires_insurance ? '是' : '否'}</Tag>
            </Descriptions.Item>
            {current.cargo_description && (
              <Descriptions.Item label="货物描述" span={2}>{current.cargo_description}</Descriptions.Item>
            )}
            <Descriptions.Item label="审核状态">
              <Tag color={COMPLIANCE_MAP[current.compliance_status]?.color}>
                {COMPLIANCE_MAP[current.compliance_status]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="申报时间">{current.created_at?.substring(0, 19)}</Descriptions.Item>
            {current.compliance_note && (
              <Descriptions.Item label="审核备注" span={2}>{current.compliance_note}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
