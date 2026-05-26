import React from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd';
import { AlertOutlined, AuditOutlined, BankOutlined, DownloadOutlined, ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageContainer from '../../components/admin/PageContainer';
import ResourceTablePage, { ResourceFilter, RowAction } from '../../components/admin/ResourceTablePage';
import StatusTag from '../../components/admin/StatusTag';
import { adminApi } from '../../services/api';
import { PAYMENT_METHOD_LABELS, SCENE_LABELS, downloadBlob, formatMoney, formatTime } from '../../utils/business';

const { Text } = Typography;

const statusFilter = (options: Array<[string, string]>): ResourceFilter => ({
  key: 'status',
  label: '状态',
  type: 'select',
  options: options.map(([value, label]) => ({ value, label })),
});

const dateFilter = (key: string, label: string): ResourceFilter => ({
  key,
  label,
  type: 'date',
});

const settlementTimeFieldFilter: ResourceFilter = {
  key: 'time_field',
  label: '导出时间',
  type: 'select',
  options: [
    { value: 'created_at', label: '创建时间' },
    { value: 'confirmed_at', label: '确认时间' },
    { value: 'settled_at', label: '入账时间' },
    { value: 'updated_at', label: '更新时间' },
  ],
};

const withdrawalTimeFieldFilter: ResourceFilter = {
  key: 'time_field',
  label: '导出时间',
  type: 'select',
  options: [
    { value: 'created_at', label: '创建时间' },
    { value: 'reviewed_at', label: '审核时间' },
    { value: 'completed_at', label: '完成时间' },
    { value: 'updated_at', label: '更新时间' },
  ],
};

const textCol = (title: string, dataIndex: string, width = 140): ColumnsType<any>[number] => ({
  title,
  dataIndex,
  width,
  ellipsis: true,
  render: value => value || '-',
});

const statusCol = (title = '状态', dataIndex = 'status'): ColumnsType<any>[number] => ({
  title,
  dataIndex,
  width: 110,
  render: value => <StatusTag status={value} />,
});

const severityCol = (title = '级别', dataIndex = 'severity'): ColumnsType<any>[number] => ({
  title,
  dataIndex,
  width: 100,
  render: value => {
    const color = value === 'critical' ? 'red' : value === 'warning' ? 'orange' : 'blue';
    const label = value === 'critical' ? '严重' : value === 'warning' ? '警告' : value || '-';
    return <Tag color={color}>{label}</Tag>;
  },
});

const moneyCol = (title: string, dataIndex: string): ColumnsType<any>[number] => ({
  title,
  dataIndex,
  width: 130,
  align: 'right',
  render: value => <strong>{formatMoney(value)}</strong>,
});

const timeCol = (title: string, dataIndex: string): ColumnsType<any>[number] => ({
  title,
  dataIndex,
  width: 165,
  render: value => formatTime(value),
});

const confirmAction = async (title: string, run: () => Promise<any>, reload: () => void) => {
  Modal.confirm({
    title,
    content: '操作会写入管理员审计日志。',
    okText: '确认',
    cancelText: '取消',
    async onOk() {
      await run();
      message.success('操作成功');
      reload();
    },
  });
};

type AdminConfirmState = {
  title: string;
  run: () => Promise<any>;
  reload: () => void;
};

const useAdminConfirmDialog = () => {
  const [confirmState, setConfirmState] = React.useState<AdminConfirmState | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = React.useState(false);

  const openConfirm = React.useCallback((title: string, run: () => Promise<any>, reload: () => void) => {
    setConfirmState({ title, run, reload });
  }, []);

  const closeConfirm = React.useCallback(() => {
    setConfirmState(null);
  }, []);

  const submitConfirm = React.useCallback(async () => {
    if (!confirmState) return;
    setConfirmSubmitting(true);
    try {
      await confirmState.run();
      message.success('操作成功');
      confirmState.reload();
      closeConfirm();
    } finally {
      setConfirmSubmitting(false);
    }
  }, [closeConfirm, confirmState]);

  const confirmModal = (
    <Modal
      title={confirmState?.title}
      open={!!confirmState}
      onOk={submitConfirm}
      confirmLoading={confirmSubmitting}
      onCancel={closeConfirm}
      okText="确认"
      cancelText="取消"
    >
      操作会写入管理员审计日志。
    </Modal>
  );

  return { openConfirm, confirmModal };
};

const centsToYuan = (value?: number | string | null) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Number((numberValue / 100).toFixed(2)) : undefined;
};

const yuanToCents = (value?: number | string | null) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue * 100) : undefined;
};

const csvFilename = (prefix: string) => `${prefix}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;

const downloadServerCsv = async (filename: string, run: () => Promise<any>) => {
  try {
    const blob = await run();
    downloadBlob(blob, filename);
    message.success('CSV 已生成');
  } catch (error: any) {
    message.error(error?.message || 'CSV 下载失败');
  }
};

export const FinanceOverviewPage: React.FC = () => {
  const [overview, setOverview] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getFinanceOverview();
      setOverview(res?.data || res);
    } catch (error: any) {
      message.error(error?.message || '财务概览加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const settlement = overview?.settlement || {};
  const withdrawal = overview?.withdrawal || {};
  const anomaly = overview?.anomaly || {};
  const manualAction = overview?.manual_action || {};
  const riskTotal =
    Number(settlement.confirmed || 0) +
    Number(settlement.disputed || 0) +
    Number(withdrawal.pending || 0) +
    Number(anomaly.open || 0) +
    Number(manualAction.applied || 0);

  const queueRows = [
    {
      title: '待入账结算',
      desc: '已确认但尚未写入钱包',
      value: settlement.confirmed || 0,
      color: 'gold',
      href: '/finance/settlements',
    },
    {
      title: '待审核提现',
      desc: `待付金额 ${formatMoney(withdrawal.pending_amount)}`,
      value: withdrawal.pending || 0,
      color: 'blue',
      href: '/finance/withdrawals',
    },
    {
      title: '未处理异常',
      desc: `严重 ${anomaly.critical_open || 0} / 警告 ${anomaly.warning_open || 0}`,
      value: anomaly.open || 0,
      color: Number(anomaly.critical_open || 0) > 0 ? 'red' : 'orange',
      href: '/finance/anomalies',
    },
    {
      title: '生效人工处理',
      desc: '可继续复核或按规则回滚',
      value: manualAction.applied || 0,
      color: 'purple',
      href: '/finance/manual-actions',
    },
  ];

  return (
    <PageContainer
      title="财务概览"
      description="汇总结算、提现、异常和人工处理队列，优先暴露需要运营介入的风险项。"
      extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type={riskTotal > 0 ? 'warning' : 'success'}
          showIcon
          message={riskTotal > 0 ? `当前有 ${riskTotal} 个财务待处理项` : '当前没有财务待处理项'}
          description={`最后更新：${formatTime(overview?.updated_at)}`}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} loading={loading}>
              <Statistic title="待入账结算" value={settlement.confirmed || 0} prefix={<BankOutlined />} valueStyle={{ color: '#d48806' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} loading={loading}>
              <Statistic title="今日已结算" value={settlement.settled_today || 0} prefix={<BankOutlined />} suffix={formatMoney(settlement.total_settled_amount_today)} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} loading={loading}>
              <Statistic title="待审核提现" value={withdrawal.pending || 0} prefix={<WalletOutlined />} suffix={formatMoney(withdrawal.pending_amount)} />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered={false} loading={loading}>
              <Statistic title="未处理异常" value={anomaly.open || 0} prefix={<AlertOutlined />} valueStyle={{ color: Number(anomaly.critical_open || 0) > 0 ? '#cf1322' : '#d46b08' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card title="风险队列" bordered={false} loading={loading}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {queueRows.map(row => (
                  <div
                    key={row.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      borderBottom: '1px solid #f0f0f0',
                      paddingBottom: 12,
                    }}
                  >
                    <Space direction="vertical" size={0}>
                      <Space>
                        <Text strong>{row.title}</Text>
                        <Tag color={row.color}>{row.value}</Tag>
                      </Space>
                      <Text type="secondary">{row.desc}</Text>
                    </Space>
                    <Button size="small" href={row.href}>查看</Button>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card title="今日处理" bordered={false} loading={loading}>
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Statistic title="提现完成" value={withdrawal.completed_today || 0} prefix={<WalletOutlined />} />
                <Statistic title="提现驳回" value={withdrawal.rejected_today || 0} prefix={<WalletOutlined />} valueStyle={{ color: '#cf1322' }} />
                <Statistic title="异常已处理" value={anomaly.resolved_today || 0} prefix={<AuditOutlined />} />
                <Statistic title="人工处理已回滚" value={manualAction.rolled_back_today || 0} prefix={<AuditOutlined />} />
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  );
};

export const RefundListPage: React.FC = () => (
  <ResourceTablePage
    title="退款审核"
    description="承接订单退款记录，生产回调未接入前保持运营审核和状态追踪。"
    fetcher={adminApi.getRefunds}
    filters={[statusFilter([['pending', '待处理'], ['completed', '已完成'], ['failed', '失败']])]}
    columns={[
      textCol('退款号', 'refund_no', 190),
      textCol('订单ID', 'order_id', 90),
      textCol('支付ID', 'payment_id', 90),
      moneyCol('退款金额', 'amount'),
      textCol('原因', 'reason', 220),
      statusCol(),
      timeCol('创建时间', 'created_at'),
    ]}
  />
);

export const SettlementListPage: React.FC = () => {
  const { openConfirm, confirmModal } = useAdminConfirmDialog();
  const [disputeForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const [disputeTarget, setDisputeTarget] = React.useState<any | null>(null);
  const [resolveTarget, setResolveTarget] = React.useState<any | null>(null);
  const [settlementReload, setSettlementReload] = React.useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const closeSettlementModal = () => {
    setDisputeTarget(null);
    setResolveTarget(null);
    setSettlementReload(null);
    disputeForm.resetFields();
    resolveForm.resetFields();
  };

  const openDisputeModal = (row: any, reload: () => void) => {
    setSettlementReload(() => reload);
    disputeForm.setFieldsValue({ reason: '' });
    setDisputeTarget(row);
  };

  const openResolveModal = (row: any, reload: () => void) => {
    setSettlementReload(() => reload);
    resolveForm.setFieldsValue({
      resolution: '后台复核通过，恢复结算执行',
      next_status: 'confirmed',
      platform_fee: centsToYuan(row.platform_fee),
      pilot_fee: centsToYuan(row.pilot_fee),
      owner_fee: centsToYuan(row.owner_fee),
      insurance_deduction: centsToYuan(row.insurance_deduction),
    });
    setResolveTarget(row);
  };

  const submitDispute = async () => {
    const values = await disputeForm.validateFields();
    if (!disputeTarget) return;
    setSubmitting(true);
    try {
      await adminApi.markSettlementDisputed(disputeTarget.id, values.reason);
      message.success('已标记争议');
      closeSettlementModal();
      settlementReload?.();
    } finally {
      setSubmitting(false);
    }
  };

  const submitResolve = async () => {
    const values = await resolveForm.validateFields();
    if (!resolveTarget) return;
    setSubmitting(true);
    try {
      await adminApi.resolveSettlementDispute(resolveTarget.id, {
        resolution: values.resolution,
        next_status: values.next_status,
        platform_fee: yuanToCents(values.platform_fee),
        pilot_fee: yuanToCents(values.pilot_fee),
        owner_fee: yuanToCents(values.owner_fee),
        insurance_deduction: yuanToCents(values.insurance_deduction),
      });
      message.success('争议已处理');
      closeSettlementModal();
      settlementReload?.();
    } finally {
      setSubmitting(false);
    }
  };

  const actions: RowAction<any>[] = [
    {
      label: '确认',
      disabled: row => !['pending', 'calculated'].includes(row.status),
      onClick: (row, reload) => openConfirm('确认该结算单进入待执行状态？', () => adminApi.confirmSettlement(row.id), reload),
    },
    {
      label: '入账',
      disabled: row => ['settled', 'disputed'].includes(row.status),
      onClick: (row, reload) => openConfirm('确认执行结算入账？', () => adminApi.executeSettlement(row.id, '后台结算执行'), reload),
    },
    {
      label: '争议',
      danger: true,
      disabled: row => ['settled', 'disputed'].includes(row.status),
      onClick: openDisputeModal,
    },
    {
      label: '解除',
      disabled: row => row.status !== 'disputed',
      onClick: openResolveModal,
    },
  ];
  return (
    <>
      <ResourceTablePage
        title="结算执行"
        description="订单分账、平台服务费、飞手劳务费、机主设备费的后台执行闭环。"
        fetcher={adminApi.getSettlements}
        filters={[
          statusFilter([['pending', '待处理'], ['calculated', '已计算'], ['confirmed', '待执行'], ['settled', '已结算'], ['disputed', '争议中']]),
          settlementTimeFieldFilter,
          dateFilter('start_date', '开始日期'),
          dateFilter('end_date', '结束日期'),
        ]}
        extraActions={({ query, loading }) => (
          <Button
            icon={<DownloadOutlined />}
            loading={loading}
            onClick={() => downloadServerCsv(
              csvFilename('settlements'),
              () => adminApi.exportSettlementCsv({ ...query, limit: 5000 })
            )}
          >
            下载对账CSV
          </Button>
        )}
        actions={actions}
        columns={[
          textCol('结算号', 'settlement_no', 190),
          textCol('订单号', 'order_no', 160),
          moneyCol('实付金额', 'final_amount'),
          moneyCol('平台服务费', 'platform_fee'),
          moneyCol('飞手劳务费', 'pilot_fee'),
          moneyCol('机主设备费', 'owner_fee'),
          moneyCol('保险代扣', 'insurance_deduction'),
          statusCol(),
          timeCol('确认时间', 'confirmed_at'),
          timeCol('入账时间', 'settled_at'),
          timeCol('创建时间', 'created_at'),
        ]}
      />

      {confirmModal}

      <Modal
        title="标记结算争议"
        open={!!disputeTarget}
        onOk={submitDispute}
        confirmLoading={submitting}
        onCancel={closeSettlementModal}
        okText="标记争议"
        cancelText="取消"
      >
        <Form form={disputeForm} layout="vertical">
          <Form.Item
            name="reason"
            label="争议原因"
            rules={[{ required: true, message: '请填写争议原因' }]}
          >
            <Input.TextArea rows={4} placeholder="例如：客户投诉金额有误、保险扣款待复核" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="解除结算争议"
        open={!!resolveTarget}
        onOk={submitResolve}
        confirmLoading={submitting}
        onCancel={closeSettlementModal}
        okText="提交处理"
        cancelText="取消"
        width={680}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Tag color="blue">实付金额 {formatMoney(resolveTarget?.final_amount)}</Tag>
          <Form form={resolveForm} layout="vertical">
            <Form.Item
              name="resolution"
              label="处理结论"
              rules={[{ required: true, message: '请填写处理结论' }]}
            >
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item
              name="next_status"
              label="处理后状态"
              rules={[{ required: true, message: '请选择处理后状态' }]}
            >
              <Select
                options={[
                  { value: 'confirmed', label: '待执行' },
                  { value: 'calculated', label: '已计算' },
                ]}
              />
            </Form.Item>
            <Space size={12} wrap>
              <Form.Item name="platform_fee" label="平台服务费(元)">
                <InputNumber min={0} precision={2} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="pilot_fee" label="飞手劳务费(元)">
                <InputNumber min={0} precision={2} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="owner_fee" label="机主设备费(元)">
                <InputNumber min={0} precision={2} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="insurance_deduction" label="保险代扣(元)">
                <InputNumber min={0} precision={2} style={{ width: 150 }} />
              </Form.Item>
            </Space>
          </Form>
        </Space>
      </Modal>
    </>
  );
};

export const WithdrawalListPage: React.FC = () => {
  const { openConfirm, confirmModal } = useAdminConfirmDialog();
  const actions: RowAction<any>[] = [
    {
      label: '通过',
      disabled: row => row.status !== 'pending',
      onClick: (row, reload) => openConfirm('确认通过提现吗？', () => adminApi.approveWithdrawal(row.id, '后台提现审核通过'), reload),
    },
    {
      label: '拒绝',
      danger: true,
      disabled: row => row.status !== 'pending',
      onClick: (row, reload) => openConfirm('确认拒绝提现吗？', () => adminApi.rejectWithdrawal(row.id, '后台审核拒绝'), reload),
    },
  ];
  return (
    <>
      <ResourceTablePage
        title="提现审核"
        description="审核钱包提现申请，测试通道转账会在记录中保留第三方流水占位。"
        fetcher={adminApi.getWithdrawals}
        filters={[
          statusFilter([['pending', '待审核'], ['processing', '处理中'], ['completed', '已完成'], ['rejected', '已拒绝']]),
          withdrawalTimeFieldFilter,
          dateFilter('start_date', '开始日期'),
          dateFilter('end_date', '结束日期'),
        ]}
        extraActions={({ query, loading }) => (
          <Button
            icon={<DownloadOutlined />}
            loading={loading}
            onClick={() => downloadServerCsv(
              csvFilename('withdrawals'),
              () => adminApi.exportWithdrawalCsv({ ...query, limit: 5000 })
            )}
          >
            下载对账CSV
          </Button>
        )}
        actions={actions}
        columns={[
          textCol('提现号', 'withdrawal_no', 190),
          textCol('用户ID', 'user_id', 90),
          moneyCol('申请金额', 'amount'),
          moneyCol('手续费', 'service_fee'),
          moneyCol('实际到账', 'actual_amount'),
          textCol('方式', 'withdraw_method', 110),
          statusCol(),
          timeCol('审核时间', 'reviewed_at'),
          timeCol('完成时间', 'completed_at'),
          timeCol('创建时间', 'created_at'),
        ]}
      />
      {confirmModal}
    </>
  );
};

export const FinanceAnomalyPage: React.FC = () => {
  const [form] = Form.useForm();
  const [target, setTarget] = React.useState<any | null>(null);
  const [reload, setReload] = React.useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const closeModal = () => {
    setTarget(null);
    setReload(null);
    form.resetFields();
  };

  const submitResolve = async () => {
    const values = await form.validateFields();
    if (!target) return;
    setSubmitting(true);
    try {
      await adminApi.resolveFinanceAnomaly(target.id, values.note);
      message.success('已标记处理');
      closeModal();
      reload?.();
    } finally {
      setSubmitting(false);
    }
  };

  const actions: RowAction<any>[] = [
    {
      label: '处理',
      disabled: row => row.status === 'resolved',
      onClick: (row, tableReload) => {
        setReload(() => tableReload);
        form.setFieldsValue({ note: '' });
        setTarget(row);
      },
    },
  ];

  return (
    <>
      <ResourceTablePage
        title="财务异常"
        description="记录结算入账、提现审核和分账复核中的异常，便于后台追踪和处理。"
        fetcher={adminApi.getFinanceAnomalies}
        filters={[
          statusFilter([['open', '待处理'], ['resolved', '已处理']]),
          { key: 'severity', label: '级别', type: 'select', options: [
            { value: 'critical', label: '严重' },
            { value: 'warning', label: '警告' },
            { value: 'info', label: '提示' },
          ] },
          { key: 'anomaly_type', label: '异常类型' },
          { key: 'source', label: '来源', type: 'select', options: [
            { value: 'settlement', label: '结算' },
            { value: 'withdrawal', label: '提现' },
            { value: 'reconciliation', label: '对账' },
          ] },
          { key: 'settlement_id', label: '结算ID' },
          { key: 'withdrawal_id', label: '提现ID' },
          { key: 'user_id', label: '用户ID' },
          { key: 'keyword', label: '关键词' },
        ]}
        actions={actions}
        columns={[
          textCol('异常号', 'anomaly_no', 190),
          severityCol(),
          statusCol(),
          textCol('异常类型', 'anomaly_type', 190),
          textCol('来源', 'source', 110),
          textCol('目标', 'target_type', 100),
          textCol('目标ID', 'target_id', 90),
          textCol('结算ID', 'settlement_id', 90),
          textCol('提现ID', 'withdrawal_id', 90),
          textCol('用户ID', 'user_id', 90),
          textCol('说明', 'message', 280),
          timeCol('发生时间', 'created_at'),
          timeCol('处理时间', 'resolved_at'),
        ]}
      />

      <Modal
        title="处理财务异常"
        open={!!target}
        onOk={submitResolve}
        confirmLoading={submitting}
        onCancel={closeModal}
        okText="标记已处理"
        cancelText="取消"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Tag color={target?.severity === 'critical' ? 'red' : 'orange'}>
            {target?.anomaly_no} {target?.anomaly_type}
          </Tag>
          <Form form={form} layout="vertical">
            <Form.Item
              name="note"
              label="处理说明"
              rules={[{ required: true, message: '请填写处理说明' }]}
            >
              <Input.TextArea rows={4} placeholder="例如：已核对钱包流水，手工补偿完成" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  );
};

export const FinanceManualActionPage: React.FC = () => {
  const [form] = Form.useForm();
  const [target, setTarget] = React.useState<any | null>(null);
  const [reload, setReload] = React.useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const closeModal = () => {
    setTarget(null);
    setReload(null);
    form.resetFields();
  };

  const submitRollback = async () => {
    const values = await form.validateFields();
    if (!target) return;
    setSubmitting(true);
    try {
      await adminApi.rollbackFinanceManualAction(target.id, values.note);
      message.success('已回滚');
      closeModal();
      reload?.();
    } finally {
      setSubmitting(false);
    }
  };

  const actions: RowAction<any>[] = [
    {
      label: '回滚',
      danger: true,
      disabled: row => row.status !== 'applied',
      onClick: (row, tableReload) => {
        setReload(() => tableReload);
        form.setFieldsValue({ note: '' });
        setTarget(row);
      },
    },
  ];

  return (
    <>
      <ResourceTablePage
        title="人工处理记录"
        description="记录财务人工处理前后快照；未入账且未被后续变更覆盖的处理可回滚。"
        fetcher={adminApi.getFinanceManualActions}
        filters={[
          statusFilter([['applied', '已应用'], ['rolled_back', '已回滚'], ['rollback_failed', '回滚失败']]),
          { key: 'action_type', label: '动作类型' },
          { key: 'target_type', label: '目标类型', type: 'select', options: [
            { value: 'settlement', label: '结算' },
            { value: 'finance_anomaly', label: '财务异常' },
          ] },
          { key: 'settlement_id', label: '结算ID' },
          { key: 'anomaly_id', label: '异常ID' },
          { key: 'admin_id', label: '管理员ID' },
          { key: 'keyword', label: '关键词' },
        ]}
        actions={actions}
        columns={[
          textCol('处理号', 'action_no', 190),
          statusCol(),
          textCol('动作类型', 'action_type', 200),
          textCol('目标类型', 'target_type', 110),
          textCol('目标ID', 'target_id', 90),
          textCol('结算ID', 'settlement_id', 90),
          textCol('异常ID', 'anomaly_id', 90),
          textCol('管理员ID', 'admin_id', 100),
          textCol('原因', 'reason', 260),
          textCol('回滚人', 'rollback_by', 90),
          timeCol('回滚时间', 'rollback_at'),
          timeCol('创建时间', 'created_at'),
        ]}
      />

      <Modal
        title="回滚人工处理"
        open={!!target}
        onOk={submitRollback}
        confirmLoading={submitting}
        onCancel={closeModal}
        okText="确认回滚"
        cancelText="取消"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Tag color="red">{target?.action_no} {target?.action_type}</Tag>
          <Form form={form} layout="vertical">
            <Form.Item
              name="note"
              label="回滚原因"
              rules={[{ required: true, message: '请填写回滚原因' }]}
            >
              <Input.TextArea rows={4} placeholder="例如：人工处理金额录入错误，恢复处理前状态" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </>
  );
};

export const PricingConfigPage: React.FC = () => (
  <ResourceTablePage
    title="定价配置"
    description="展示平台定价、分账、保险和溢价参数；修改入口已接真实接口。"
    fetcher={adminApi.getPricingConfigs}
    columns={[
      textCol('配置键', 'config_key', 220),
      textCol('分类', 'category', 120),
      textCol('配置值', 'config_value', 120),
      textCol('单位', 'unit', 100),
      textCol('说明', 'description', 320),
      { title: '启用', dataIndex: 'is_active', width: 90, render: value => (value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>) },
      timeCol('更新时间', 'updated_at'),
    ]}
  />
);

export const AirspaceApplicationPage: React.FC = () => {
  const actions: RowAction<any>[] = [
    {
      label: '通过',
      disabled: row => row.status !== 'pending_review',
      onClick: (row, reload) => confirmAction('确认通过空域申请？', () => adminApi.reviewAirspaceApplication(row.id, true, '后台审核通过'), reload),
    },
    {
      label: '驳回',
      danger: true,
      disabled: row => row.status !== 'pending_review',
      onClick: (row, reload) => confirmAction('确认驳回空域申请？', () => adminApi.reviewAirspaceApplication(row.id, false, '后台审核驳回'), reload),
    },
    {
      label: '提交UOM',
      disabled: row => !['approved', 'pending_review'].includes(row.status),
      onClick: (row, reload) => confirmAction('确认提交到UOM模拟通道？', () => adminApi.submitAirspaceToUOM(row.id), reload),
    },
  ];
  return (
    <ResourceTablePage
      title="空域申请审核"
      description="承接 App/小程序订单空域报备、平台审核和 UOM 状态追踪。"
      fetcher={adminApi.getAirspaceApplications}
      filters={[statusFilter([['draft', '草稿'], ['pending_review', '待审核'], ['approved', '已通过'], ['submitted_to_uom', '已提交UOM'], ['rejected', '已驳回']])]}
      actions={actions}
      columns={[
        textCol('计划名称', 'flight_plan_name', 180),
        textCol('用途', 'flight_purpose', 120),
        textCol('订单ID', 'order_id', 90),
        textCol('飞手ID', 'pilot_id', 90),
        textCol('无人机ID', 'drone_id', 90),
        textCol('起点', 'departure_address', 180),
        textCol('终点', 'arrival_address', 180),
        statusCol(),
        timeCol('计划开始', 'planned_start_time'),
      ]}
    />
  );
};

export const NoFlyZonePage: React.FC = () => {
  const actions: RowAction<any>[] = [
    {
      label: '删除',
      danger: true,
      onClick: (row, reload) => confirmAction('确认删除禁飞区？', () => adminApi.deleteNoFlyZone(row.id), reload),
    },
  ];
  return (
    <ResourceTablePage
      title="禁飞区管理"
      description="平台禁飞、限飞和注意区域的运营维护。"
      fetcher={adminApi.getNoFlyZones}
      filters={[
        statusFilter([['active', '启用'], ['inactive', '停用'], ['expired', '已过期']]),
        { key: 'zone_type', label: '区域类型', type: 'select', options: [
          { value: 'airport', label: '机场' },
          { value: 'military', label: '军事' },
          { value: 'restricted', label: '管制' },
          { value: 'temporary', label: '临时' },
        ] },
      ]}
      actions={actions}
      columns={[
        textCol('名称', 'name', 180),
        textCol('类型', 'zone_type', 110),
        textCol('几何', 'geometry_type', 90),
        textCol('半径(m)', 'radius', 100),
        textCol('限制等级', 'restriction_level', 120),
        statusCol(),
        timeCol('更新时间', 'updated_at'),
      ]}
    />
  );
};

export const ComplianceCheckPage: React.FC = () => (
  <ResourceTablePage
    title="合规检查"
    description="飞手、无人机、货物和空域检查结果只读追踪。"
    fetcher={adminApi.getComplianceChecks}
    filters={[
      { key: 'pilot_id', label: '飞手ID' },
      { key: 'drone_id', label: '无人机ID' },
    ]}
    columns={[
      textCol('飞手ID', 'pilot_id', 90),
      textCol('无人机ID', 'drone_id', 90),
      textCol('触发类型', 'trigger_type', 130),
      statusCol('总结果', 'overall_result'),
      textCol('通过/失败/警告', 'notes', 260),
      timeCol('检查时间', 'created_at'),
      timeCol('过期时间', 'expires_at'),
    ]}
  />
);

export const CreditScorePage: React.FC = () => (
  <ResourceTablePage
    title="信用分"
    description="跨端用户信用分、履约评分、黑名单状态统一管理视图。"
    fetcher={adminApi.getCreditScores}
    filters={[
      { key: 'user_type', label: '用户类型', type: 'select', options: [
        { value: 'pilot', label: '飞手' },
        { value: 'owner', label: '机主' },
        { value: 'client', label: '客户' },
      ] },
      { key: 'score_level', label: '等级', type: 'select', options: [
        { value: 'excellent', label: '优秀' },
        { value: 'good', label: '良好' },
        { value: 'normal', label: '正常' },
        { value: 'poor', label: '较差' },
        { value: 'bad', label: '风险' },
      ] },
    ]}
    columns={[
      textCol('用户ID', 'user_id', 90),
      textCol('用户类型', 'user_type', 100),
      textCol('总分', 'total_score', 100),
      statusCol('等级', 'score_level'),
      textCol('完成订单', 'completed_orders', 100),
      textCol('违规次数', 'violation_count', 100),
      { title: '黑名单', dataIndex: 'is_blacklisted', width: 90, render: value => (value ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag>) },
      timeCol('更新时间', 'updated_at'),
    ]}
  />
);

export const ViolationPage: React.FC = () => {
  const actions: RowAction<any>[] = [
    {
      label: '确认',
      disabled: row => row.status !== 'pending',
      onClick: (row, reload) => confirmAction('确认违规并执行处罚？', () => adminApi.confirmViolation(row.id), reload),
    },
    {
      label: '申诉通过',
      disabled: row => row.appeal_status !== 'pending',
      onClick: (row, reload) => confirmAction('确认通过违规申诉？', () => adminApi.reviewViolationAppeal(row.id, true, '申诉成立'), reload),
    },
    {
      label: '申诉驳回',
      danger: true,
      disabled: row => row.appeal_status !== 'pending',
      onClick: (row, reload) => confirmAction('确认驳回违规申诉？', () => adminApi.reviewViolationAppeal(row.id, false, '申诉不成立'), reload),
    },
  ];
  return (
    <ResourceTablePage
      title="违规记录"
      description="违规确认、申诉审核和信用处罚闭环。"
      fetcher={adminApi.getViolations}
      filters={[statusFilter([['pending', '待确认'], ['confirmed', '已确认'], ['appealed', '申诉中'], ['cancelled', '已撤销']])]}
      actions={actions}
      columns={[
        textCol('违规号', 'violation_no', 170),
        textCol('用户ID', 'user_id', 90),
        textCol('类型', 'violation_type', 120),
        textCol('等级', 'violation_level', 100),
        textCol('扣分', 'score_deduction', 80),
        statusCol(),
        statusCol('申诉', 'appeal_status'),
        timeCol('创建时间', 'created_at'),
      ]}
    />
  );
};

export const RiskControlPage: React.FC = () => {
  const actions: RowAction<any>[] = [
    {
      label: '放行',
      disabled: row => row.status !== 'pending',
      onClick: (row, reload) => confirmAction('确认风控放行？', () => adminApi.reviewRiskControl(row.id, 'approve', '后台风控放行'), reload),
    },
    {
      label: '拦截',
      danger: true,
      disabled: row => row.status !== 'pending',
      onClick: (row, reload) => confirmAction('确认风控拦截？', () => adminApi.reviewRiskControl(row.id, 'block', '后台风控拦截'), reload),
    },
  ];
  return (
    <ResourceTablePage
      title="风控记录"
      description="订单前、中、后的系统风控记录与人工处置。"
      fetcher={adminApi.getRiskControls}
      filters={[statusFilter([['pending', '待处理'], ['approved', '已放行'], ['blocked', '已拦截'], ['ignored', '已忽略']])]}
      actions={actions}
      columns={[
        textCol('风控号', 'risk_no', 170),
        textCol('用户ID', 'user_id', 90),
        textCol('订单ID', 'order_id', 90),
        textCol('阶段', 'risk_phase', 90),
        textCol('类型', 'risk_type', 120),
        textCol('分值', 'risk_score', 80),
        statusCol(),
        timeCol('创建时间', 'created_at'),
      ]}
    />
  );
};

export const BlacklistPage: React.FC = () => (
  <ResourceTablePage
    title="黑名单"
    description="平台拉黑、临时限制和解除记录。"
    fetcher={adminApi.getBlacklists}
    filters={[
      { key: 'blacklist_type', label: '类型' },
      { key: 'is_active', label: '是否生效', type: 'select', options: [{ value: 'true', label: '生效' }, { value: 'false', label: '已解除' }] },
    ]}
    columns={[
      textCol('用户ID', 'user_id', 90),
      textCol('类型', 'blacklist_type', 110),
      textCol('原因', 'reason', 260),
      { title: '生效', dataIndex: 'is_active', width: 90, render: value => (value ? <Tag color="red">生效</Tag> : <Tag>解除</Tag>) },
      timeCol('开始时间', 'start_at'),
      timeCol('结束时间', 'end_at'),
    ]}
  />
);

export const DepositPage: React.FC = () => (
  <ResourceTablePage
    title="保证金管理"
    description="飞手、机主、客户保证金要求、缴纳和退还状态。"
    fetcher={adminApi.getDeposits}
    filters={[statusFilter([['pending', '待缴纳'], ['paid', '已缴纳'], ['refunded', '已退还']])]}
    columns={[
      textCol('保证金号', 'deposit_no', 170),
      textCol('用户ID', 'user_id', 90),
      textCol('用户类型', 'user_type', 100),
      moneyCol('金额', 'amount'),
      statusCol(),
      textCol('原因', 'reason', 260),
      timeCol('创建时间', 'created_at'),
    ]}
  />
);

export const InsuranceProductPage: React.FC = () => (
  <ResourceTablePage
    title="保险产品"
    description="保险产品和强制险配置只读管理，外部保险集成本轮不接入。"
    fetcher={adminApi.getInsuranceProducts}
    filters={[
      { key: 'policy_type', label: '险种' },
      { key: 'is_mandatory', label: '强制险', type: 'select', options: [{ value: 'true', label: '是' }, { value: 'false', label: '否' }] },
    ]}
    columns={[
      textCol('产品编码', 'product_code', 150),
      textCol('产品名称', 'product_name', 180),
      textCol('险种', 'policy_type', 100),
      moneyCol('最低保费', 'min_premium'),
      moneyCol('最低保额', 'min_coverage'),
      moneyCol('最高保额', 'max_coverage'),
      { title: '强制', dataIndex: 'is_mandatory', width: 80, render: value => (value ? <Tag color="red">是</Tag> : <Tag>否</Tag>) },
    ]}
  />
);

export const InsurancePolicyPage: React.FC = () => (
  <ResourceTablePage
    title="保单列表"
    description="保单状态、投保人、被保险对象和支付状态追踪。"
    fetcher={adminApi.getInsurancePolicies}
    filters={[statusFilter([['pending', '待支付'], ['active', '保障中'], ['claimed', '理赔中'], ['cancelled', '已取消'], ['expired', '已过期']])]}
    columns={[
      textCol('保单号', 'policy_no', 170),
      textCol('险种', 'policy_type', 100),
      textCol('投保人', 'holder_name', 120),
      textCol('被保险对象', 'insured_name', 150),
      moneyCol('保额', 'coverage_amount'),
      moneyCol('保费', 'premium'),
      statusCol(),
      statusCol('支付', 'payment_status'),
      timeCol('生效时间', 'effective_from'),
    ]}
  />
);

export const InsuranceClaimPage: React.FC = () => {
  const actions: RowAction<any>[] = [
    {
      label: '调查',
      disabled: row => row.status !== 'reported',
      onClick: (row, reload) => confirmAction('确认进入理赔调查？', () => adminApi.startInsuranceInvestigation(row.id), reload),
    },
    {
      label: '核赔',
      disabled: row => row.status !== 'liability_determined',
      onClick: (row, reload) => confirmAction('确认按核定金额通过理赔？', () => adminApi.approveInsuranceClaim(row.id, row.approved_amount || row.claim_amount || 0, '后台核赔通过'), reload),
    },
    {
      label: '赔付',
      disabled: row => row.status !== 'approved',
      onClick: (row, reload) => confirmAction('确认执行赔付？', () => adminApi.payInsuranceClaim(row.id, row.approved_amount || row.claim_amount || 0), reload),
    },
    {
      label: '结案',
      disabled: row => !['paid', 'rejected'].includes(row.status),
      onClick: (row, reload) => confirmAction('确认理赔结案？', () => adminApi.closeInsuranceClaim(row.id), reload),
    },
  ];
  return (
    <ResourceTablePage
      title="理赔处理"
      description="报案、调查、责任认定、核赔、赔付和结案的运营处理台。"
      fetcher={adminApi.getInsuranceClaims}
      filters={[statusFilter([['reported', '已报案'], ['investigating', '调查中'], ['liability_determined', '责任已认定'], ['approved', '已核赔'], ['paid', '已赔付'], ['closed', '已结案'], ['rejected', '已拒赔']])]}
      actions={actions}
      columns={[
        textCol('理赔号', 'claim_no', 170),
        textCol('保单号', 'policy_no', 170),
        textCol('订单ID', 'order_id', 90),
        textCol('申请人', 'claimant_name', 120),
        textCol('事故类型', 'incident_type', 120),
        moneyCol('索赔金额', 'claim_amount'),
        moneyCol('核定金额', 'approved_amount'),
        statusCol(),
        timeCol('报案时间', 'reported_at'),
      ]}
    />
  );
};

export const ContractPage: React.FC = () => (
  <ResourceTablePage
    title="合同列表"
    description="订单电子合同、签署状态和 PDF 下载源数据追踪。"
    fetcher={adminApi.getContracts}
    filters={[statusFilter([['pending', '待签署'], ['active', '已生效'], ['cancelled', '已取消']])]}
    columns={[
      textCol('合同号', 'contract_no', 180),
      textCol('订单号', 'order_no', 160),
      textCol('标题', 'title', 200),
      moneyCol('合同金额', 'contract_amount'),
      moneyCol('平台服务费', 'platform_commission'),
      moneyCol('服务方收入', 'provider_amount'),
      statusCol(),
      timeCol('创建时间', 'created_at'),
    ]}
  />
);

export const ReviewPage: React.FC = () => (
  <ResourceTablePage
    title="评价列表"
    description="订单评价、目标对象和评分集中查看。"
    fetcher={adminApi.getReviews}
    filters={[{ key: 'target_type', label: '评价对象' }]}
    columns={[
      textCol('订单ID', 'order_id', 90),
      textCol('评价人ID', 'reviewer_id', 110),
      textCol('对象类型', 'target_type', 100),
      textCol('对象ID', 'target_id', 100),
      textCol('评分', 'rating', 90),
      textCol('内容', 'content', 260),
      timeCol('创建时间', 'created_at'),
    ]}
  />
);

export const DisputePage: React.FC = () => (
  <ResourceTablePage
    title="争议处理"
    description="订单争议、售后协同和处理状态集中跟踪。"
    fetcher={adminApi.getDisputes}
    filters={[statusFilter([['open', '处理中'], ['resolved', '已解决'], ['closed', '已关闭']])]}
    columns={[
      textCol('订单ID', 'order_id', 90),
      textCol('发起人ID', 'initiator_user_id', 110),
      textCol('争议类型', 'dispute_type', 120),
      textCol('摘要', 'summary', 320),
      statusCol(),
      timeCol('创建时间', 'created_at'),
    ]}
  />
);

export const AdminLogPage: React.FC = () => (
  <ResourceTablePage
    title="管理员操作日志"
    description="所有新增后台写操作都会记录模块、动作、目标和来源 IP。"
    fetcher={adminApi.getAdminLogs}
    filters={[
      { key: 'module', label: '模块' },
      { key: 'action', label: '动作' },
      { key: 'target_type', label: '目标类型' },
      { key: 'target_id', label: '目标ID' },
      { key: 'admin_id', label: '管理员ID' },
    ]}
    columns={[
      textCol('管理员ID', 'admin_id', 100),
      textCol('模块', 'module', 120),
      textCol('动作', 'action', 190),
      textCol('目标类型', 'target_type', 120),
      textCol('目标ID', 'target_id', 100),
      textCol('IP', 'ip_address', 140),
      timeCol('时间', 'created_at'),
    ]}
  />
);

export const PaymentLedgerPage: React.FC = () => (
  <ResourceTablePage
    title="支付流水"
    description="订单支付、押金、退款和提现相关支付记录；mock 显示为测试通道。"
    fetcher={adminApi.getPayments}
    filters={[statusFilter([['pending', '待支付'], ['paid', '已支付'], ['refunded', '已退款'], ['failed', '失败']])]}
    columns={[
      textCol('流水号', 'payment_no', 190),
      textCol('订单ID', 'order_id', 90),
      textCol('用户ID', 'user_id', 90),
      textCol('类型', 'payment_type', 110),
      { title: '支付方式', dataIndex: 'payment_method', width: 120, render: value => PAYMENT_METHOD_LABELS[value] || value || '-' },
      moneyCol('金额', 'amount'),
      statusCol(),
      timeCol('支付时间', 'paid_at'),
      timeCol('创建时间', 'created_at'),
    ]}
  />
);

export const CargoSceneTag: React.FC<{ value?: string }> = ({ value }) => (
  <Tag color="blue">{value ? SCENE_LABELS[value] || value : '-'}</Tag>
);
