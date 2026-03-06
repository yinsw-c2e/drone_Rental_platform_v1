import React, { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Space, Modal, Descriptions, Select,
  message, Input, Typography, Row, Col, Card, Statistic,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

interface Client {
  id: number;
  user_id: number;
  client_type: string;           // individual / enterprise
  verification_status: string;   // pending / verified / rejected
  verification_note: string;
  verified_at: string | null;
  status: string;                // active / suspended / banned
  company_name: string;
  business_license_no: string;
  legal_representative: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  platform_credit_score: number;
  total_orders: number;
  completed_orders: number;
  total_spending: number;
  created_at: string;
  user?: {
    id: number;
    nickname: string;
    phone: string;
  };
}

const VERIFY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:  { label: '待审核', color: 'orange' },
  verified: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
};

const CLIENT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  individual: { label: '个人客户', color: 'blue' },
  enterprise: { label: '企业客户', color: 'purple' },
};

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getClients({
        page,
        page_size: pageSize,
        client_type: filterType || undefined,
        verification_status: filterStatus || undefined,
      });
      const data = (res as any).data;
      setClients(data?.list || []);
      setTotal(data?.total || 0);
    } catch (e: any) {
      message.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [page, filterType, filterStatus]);

  const handleVerify = async (approved: boolean) => {
    if (!currentClient) return;
    setVerifying(true);
    try {
      await adminApi.verifyClient(currentClient.id, approved, verifyNote);
      message.success(approved ? '已审核通过' : '已拒绝');
      setDetailVisible(false);
      setVerifyNote('');
      fetchClients();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    } finally {
      setVerifying(false);
    }
  };

  const pendingCount = clients.filter(c => c.verification_status === 'pending').length;

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '用户信息',
      key: 'user',
      render: (_: any, record: Client) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.user?.nickname || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.user?.phone || '-'}</div>
        </div>
      ),
    },
    {
      title: '客户类型',
      dataIndex: 'client_type',
      render: (v: string) => {
        const t = CLIENT_TYPE_MAP[v] || { label: v, color: 'default' };
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: '公司名称',
      dataIndex: 'company_name',
      render: (v: string) => v || '-',
    },
    {
      title: '审核状态',
      dataIndex: 'verification_status',
      render: (v: string) => {
        const s = VERIFY_STATUS_MAP[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '信用分',
      dataIndex: 'platform_credit_score',
      width: 80,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (v: string) => v?.substring(0, 10) || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: Client) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentClient(record);
              setVerifyNote('');
              setDetailVisible(true);
            }}
          >
            详情
          </Button>
          {record.verification_status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认审核通过？',
                    content: `即将通过客户「${record.user?.nickname || record.id}」的审核申请`,
                    okText: '通过',
                    onOk: async () => {
                      await adminApi.verifyClient(record.id, true, '');
                      message.success('已审核通过');
                      fetchClients();
                    },
                  });
                }}
              >
                通过
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认拒绝？',
                    content: `即将拒绝客户「${record.user?.nickname || record.id}」的审核申请`,
                    okText: '拒绝',
                    okType: 'danger',
                    onOk: async () => {
                      await adminApi.verifyClient(record.id, false, '');
                      message.success('已拒绝');
                      fetchClients();
                    },
                  });
                }}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>客户管理</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Card size="small">
            <Statistic title="待审核" value={pendingCount} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col>
          <Card size="small">
            <Statistic title="总客户数" value={total} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ width: 140 }}
          placeholder="按审核状态"
        >
          <Option value="">全部状态</Option>
          <Option value="pending">待审核</Option>
          <Option value="verified">已通过</Option>
          <Option value="rejected">已拒绝</Option>
        </Select>
        <Select
          value={filterType}
          onChange={setFilterType}
          style={{ width: 140 }}
          placeholder="按客户类型"
        >
          <Option value="">全部类型</Option>
          <Option value="individual">个人客户</Option>
          <Option value="enterprise">企业客户</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={clients}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showTotal: t => `共 ${t} 条`,
        }}
      />

      {/* 详情 + 审核弹窗 */}
      <Modal
        title="客户详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={700}
        footer={
          currentClient?.verification_status === 'pending'
            ? [
                <Button
                  key="reject"
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={verifying}
                  onClick={() => handleVerify(false)}
                >
                  拒绝
                </Button>,
                <Button
                  key="approve"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={verifying}
                  onClick={() => handleVerify(true)}
                >
                  审核通过
                </Button>,
              ]
            : [
                <Button key="close" onClick={() => setDetailVisible(false)}>
                  关闭
                </Button>,
              ]
        }
      >
        {currentClient && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="客户ID">{currentClient.id}</Descriptions.Item>
              <Descriptions.Item label="客户类型">
                <Tag color={CLIENT_TYPE_MAP[currentClient.client_type]?.color}>
                  {CLIENT_TYPE_MAP[currentClient.client_type]?.label || currentClient.client_type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="用户昵称">{currentClient.user?.nickname || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentClient.user?.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核状态">
                <Tag color={VERIFY_STATUS_MAP[currentClient.verification_status]?.color}>
                  {VERIFY_STATUS_MAP[currentClient.verification_status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="信用分">{currentClient.platform_credit_score}</Descriptions.Item>

              {currentClient.client_type === 'enterprise' && (
                <>
                  <Descriptions.Item label="公司名称" span={2}>
                    {currentClient.company_name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="营业执照号">{currentClient.business_license_no || '-'}</Descriptions.Item>
                  <Descriptions.Item label="法定代表人">{currentClient.legal_representative || '-'}</Descriptions.Item>
                  <Descriptions.Item label="联系人">{currentClient.contact_person || '-'}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{currentClient.contact_phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="联系邮箱" span={2}>{currentClient.contact_email || '-'}</Descriptions.Item>
                </>
              )}

              <Descriptions.Item label="总订单数">{currentClient.total_orders}</Descriptions.Item>
              <Descriptions.Item label="完成订单">{currentClient.completed_orders}</Descriptions.Item>
              <Descriptions.Item label="总消费">
                ¥{((currentClient.total_spending || 0) / 100).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {currentClient.created_at?.substring(0, 10) || '-'}
              </Descriptions.Item>

              {currentClient.verification_note && (
                <Descriptions.Item label="审核备注" span={2}>
                  {currentClient.verification_note}
                </Descriptions.Item>
              )}
            </Descriptions>

            {currentClient.verification_status === 'pending' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>审核备注（可选）</div>
                <TextArea
                  rows={3}
                  placeholder="填写审核意见，拒绝时建议注明原因"
                  value={verifyNote}
                  onChange={e => setVerifyNote(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
