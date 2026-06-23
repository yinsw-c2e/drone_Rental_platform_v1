import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from '@tarojs/components';
import { orderFinanceV2Service } from '../../../services/orderFinanceV2';
import { orderV2Service } from '../../../services/orderV2';
import { store } from '../../../store/store';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import './index.scss';

type StatusTone = 'pending' | 'progress' | 'success' | 'muted';

const statusMetaOf = (status?: string): { label: string; desc: string; tone: StatusTone } => {
  if (status === 'pending') {
    return { label: '待签署', desc: '请核对服务信息和费用后签署合同。', tone: 'pending' };
  }
  if (status === 'client_signed') {
    return { label: '客户已签署', desc: '等待服务方完成签署。', tone: 'progress' };
  }
  if (status === 'provider_signed') {
    return { label: '服务方已签署', desc: '等待客户签署后合同生效。', tone: 'progress' };
  }
  if (status === 'fully_signed') {
    return { label: '双方已签署', desc: '合同已生效，可继续支付或查看订单。', tone: 'success' };
  }
  if (status === 'voided') {
    return { label: '已作废', desc: '合同已作废，无法继续签署。', tone: 'muted' };
  }
  return { label: status || '合同状态未知', desc: '正在同步合同状态。', tone: 'muted' };
};

const formatMoney = (value?: number) =>
  `¥${(Number(value || 0) / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return '待签署';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').slice(0, 16);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
};

const valueOrDash = (value?: string | number | null) => {
  const text = String(value ?? '').trim();
  return text || '-';
};

const formatWeight = (value?: number | null) => {
  const weight = Number(value || 0);
  if (!Number.isFinite(weight) || weight <= 0) return '-';
  return `${weight.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} kg`;
};

const firstText = (...values: Array<string | number | null | undefined>) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const firstPositiveNumber = (...values: Array<string | number | null | undefined>) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
};

const orderRouteTextOf = (order: any) => {
  const origin = firstText(order?.service_address, order?.origin_address, order?.pickup_address);
  const destination = firstText(order?.dest_address, order?.destination_address, order?.dropoff_address);
  if (origin && destination) return `${origin} → ${destination}`;
  return origin || destination;
};

const serviceDescriptionOf = (contract: any, order: any) => {
  const title = firstText(contract?.title);
  const contractDesc = firstText(contract?.service_description);
  const orderTitle = firstText(order?.title);
  const serviceType = firstText(order?.service_type);
  if (contractDesc && contractDesc !== title) return contractDesc;
  if (orderTitle && !orderTitle.includes('合同')) return orderTitle;
  if (serviceType) return `${serviceType}吊运服务`;
  return '无人机重载吊运服务';
};

const ContractRow = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View className='contract-row'>
    <Text className='contract-label'>{label}</Text>
    <Text className={`contract-value ${strong ? 'contract-value-strong' : ''}`}>{value}</Text>
  </View>
);

export default function ContractPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const orderId = Number(params.orderId || params.id || 0);
  const [contract, setContract] = useState<any | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [errorText, setErrorText] = useState('');
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setContract(null);
      setOrderDetail(null);
      setErrorText('缺少订单信息，无法读取合同');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText('');
    try {
      const [res, orderRes] = await Promise.all([
        orderFinanceV2Service.getContract(orderId),
        orderV2Service.get(orderId).catch(() => null),
      ]);
      const data = (res as any)?.data || res;
      const orderData = (orderRes as any)?.data || orderRes;
      setOrderDetail(orderData || null);
      if (!data?.id) {
        setContract(null);
        setErrorText('合同尚未生成');
        return;
      }
      setContract(data);
    } catch (error: any) {
      setContract(null);
      setOrderDetail(null);
      setErrorText(friendlyErrorMessage(error, '合同加载失败'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useDidShow(() => {
    load();
  });

  const currentUserId = Number(store.getState().auth.user?.id || 0);
  const isClient = currentUserId > 0 && currentUserId === Number(contract?.client_user_id || 0);
  const isProvider = currentUserId > 0 && currentUserId === Number(contract?.provider_user_id || 0);
  const fullySigned = contract?.status === 'fully_signed';
  const alreadySignedByMe = Boolean(
    (isClient && contract?.client_signed_at) ||
    (isProvider && contract?.provider_signed_at),
  );
  const canSign = Boolean(contract?.can_sign) && !fullySigned && !alreadySignedByMe && (isClient || isProvider);
  const statusMeta = statusMetaOf(contract?.status);

  const serviceRows = useMemo(() => {
    const route = firstText(contract?.service_address, orderRouteTextOf(orderDetail));
    const startAt = firstText(contract?.scheduled_start_at, orderDetail?.start_time, orderDetail?.reserved_start_at);
    const endAt = firstText(contract?.scheduled_end_at, orderDetail?.end_time);
    const weight = firstPositiveNumber(contract?.cargo_weight_kg, orderDetail?.cargo_weight_kg);
    const tripCount = firstPositiveNumber(
      contract?.estimated_trip_count,
      orderDetail?.estimated_trip_count,
      orderDetail?.source_info?.snapshots?.demand?.estimated_trip_count,
    );
    return [
      { label: '服务说明', value: serviceDescriptionOf(contract, orderDetail) },
      { label: '作业路线', value: valueOrDash(route) },
      { label: '预约开始', value: startAt ? formatDateTime(startAt) : '-' },
      { label: '预约结束', value: endAt ? formatDateTime(endAt) : '-' },
      { label: '货物重量', value: formatWeight(weight) },
      { label: '预计架次', value: tripCount ? `${tripCount} 架次` : '-' },
    ];
  }, [contract, orderDetail]);

  const feeRows = useMemo(() => [
    { label: '合同总金额', value: formatMoney(contract?.contract_amount), strong: true },
    { label: '平台服务费', value: formatMoney(contract?.platform_commission) },
    { label: '服务方到账', value: formatMoney(contract?.provider_amount) },
  ], [contract]);

  const signRows = useMemo(() => [
    { label: '客户签署', value: formatDateTime(contract?.client_signed_at) },
    { label: '服务方签署', value: formatDateTime(contract?.provider_signed_at) },
  ], [contract]);

  const clauseSections = [
    {
      title: '一、合同双方',
      lines: [
        '甲方为本次吊运服务委托方，乙方为提供无人机重载吊运服务的服务方。',
        '双方通过平台完成订单确认、合同签署、支付与履约状态留痕。',
      ],
    },
    {
      title: '二、服务内容',
      lines: [
        '乙方按本合同约定的路线、时间和服务要求提供无人机吊运服务。',
        '甲方应确保起吊点、落放点、货物信息和现场协作条件真实、完整、可执行。',
      ],
    },
    {
      title: '三、费用与支付',
      lines: [
        '合同金额以本页展示的合同总金额为准。',
        '合同签署完成后，甲方应通过平台完成支付；平台按规则结算服务方费用。',
      ],
    },
    {
      title: '四、安全与履约责任',
      lines: [
        '乙方应确保设备适航、人员具备履约资质，并按平台规则完成作业。',
        '因天气、空域管制或不可抗力导致无法作业的，双方通过平台协商调整或退款。',
      ],
    },
    {
      title: '五、违约与争议',
      lines: [
        '任一方不得绕开平台私下成交或转移支付。',
        '履约争议优先通过平台客服协调，协调不成的按平台服务规则处理。',
      ],
    },
  ];

  const goOrder = () => {
    Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
  };

  const handlePrimary = async () => {
    if (!contract) return;
    if (fullySigned) {
      if (isClient && contract.order_status === 'pending_payment') {
        Taro.redirectTo({ url: `/pages/payment/index?orderId=${orderId}` });
        return;
      }
      goOrder();
      return;
    }
    if (!canSign) {
      Taro.showToast({
        title: alreadySignedByMe ? '你已签署，等待对方处理' : (contract.sign_block_reason || '当前暂不可签署'),
        icon: 'none',
      });
      return;
    }
    const confirm = await Taro.showModal({
      title: '确认签署合同',
      content: '请确认已核对合同内容。签署后会进入后续支付或履约流程。',
      confirmText: '确认签署',
      cancelText: '再看看',
    }).catch(() => null);
    if (!confirm?.confirm) return;

    setSigning(true);
    try {
      const res = await orderFinanceV2Service.signContract(orderId);
      const data = (res as any)?.data || res;
      setContract(data);
      Taro.showToast({ title: '已签署', icon: 'success' });
    } catch (error: any) {
      Taro.showToast({ title: friendlyErrorMessage(error, '签署失败'), icon: 'none' });
    } finally {
      setSigning(false);
    }
  };

  const primaryText = fullySigned
    ? (isClient && contract?.order_status === 'pending_payment' ? '去支付' : '返回订单')
    : canSign
      ? (signing ? '签署中...' : '签署合同')
      : alreadySignedByMe
        ? (isClient ? '等待服务方签署' : '等待客户签署或支付')
        : (contract?.sign_block_reason || '等待签署条件');
  const primaryDisabled = (!fullySigned && !canSign) || signing;

  return (
    <View className='contract-page'>
      <ScrollView scrollY className='contract-scroll' enhanced showScrollbar={false}>
        {!contract ? (
          <View className='contract-empty'>
            <Text className='contract-empty-title'>{loading ? '合同加载中' : '无法读取合同'}</Text>
            <Text className='contract-empty-desc'>{loading ? '请稍候，正在同步合同数据。' : errorText}</Text>
          </View>
        ) : (
          <View className='contract-body'>
            <View className='contract-hero'>
              <View className={`contract-status contract-status-${statusMeta.tone}`}>
                <Text>{statusMeta.label}</Text>
              </View>
              <Text className='contract-hero-title'>{contract.title || '无人机重载吊运服务合同'}</Text>
              <Text className='contract-hero-desc'>{statusMeta.desc}</Text>
            </View>

            <View className='contract-sign-flow'>
              {[
                { label: '服务方签署', done: Boolean(contract.provider_signed_at) },
                { label: '客户签署', done: Boolean(contract.client_signed_at) },
                { label: '合同生效', done: fullySigned },
              ].map((item, index) => (
                <View key={item.label} className='contract-flow-item'>
                  <View className={`contract-flow-dot ${item.done ? 'is-done' : ''}`}>
                    <Text>{item.done ? '✓' : index + 1}</Text>
                  </View>
                  <Text className={`contract-flow-label ${item.done ? 'is-done' : ''}`}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View className='contract-card contract-summary-card'>
              <View className='contract-title-row'>
                <View className='contract-title-main'>
                  <Text className='contract-section-kicker'>合同信息</Text>
                  <Text className='contract-section-title'>本次吊运服务协议</Text>
                </View>
                <Text className='contract-amount'>{formatMoney(contract.contract_amount)}</Text>
              </View>
              <ContractRow label='合同编号' value={valueOrDash(contract.contract_no)} />
              <ContractRow label='订单编号' value={valueOrDash(contract.order_no)} />
              {feeRows.map(row => (
                <ContractRow key={row.label} label={row.label} value={row.value} strong={row.strong} />
              ))}
            </View>

            <View className='contract-card'>
              <Text className='contract-section-kicker'>服务内容</Text>
              <Text className='contract-section-title'>吊运作业信息</Text>
              {serviceRows.map(row => (
                <ContractRow key={row.label} label={row.label} value={row.value} />
              ))}
            </View>

            <View className='contract-card'>
              <Text className='contract-section-kicker'>签署记录</Text>
              <Text className='contract-section-title'>双方签署状态</Text>
              {signRows.map(row => (
                <ContractRow key={row.label} label={row.label} value={row.value} />
              ))}
            </View>

            <View className='contract-card contract-clause-card'>
              <Text className='contract-section-kicker'>合同正文</Text>
              <Text className='contract-section-title'>关键条款</Text>
              {clauseSections.map(section => (
                <View key={section.title} className='contract-clause-section'>
                  <Text className='contract-clause-title'>{section.title}</Text>
                  {section.lines.map(line => (
                    <Text key={line} className='contract-clause-line'>{line}</Text>
                  ))}
                </View>
              ))}
              <Text className='contract-clause-note'>
                本合同通过无人机服务平台电子签署，签署记录和订单履约记录共同作为服务凭证。
              </Text>
            </View>

            <View className='contract-scroll-spacer' />
          </View>
        )}
      </ScrollView>

      {contract ? (
        <View className='contract-footer'>
          <View className='contract-secondary' onClick={goOrder}>
            <Text>查看订单</Text>
          </View>
          <View
            className={`contract-primary ${primaryDisabled ? 'contract-primary-disabled' : ''}`}
            onClick={handlePrimary}
          >
            <Text>{primaryText}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
