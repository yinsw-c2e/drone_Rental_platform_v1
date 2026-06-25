import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import React, { useState, useCallback, useEffect } from 'react';
import { Button, View, Text, ScrollView } from '@tarojs/components';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { demandV2Service } from '../../../services/demandV2';
import { orderV2Service } from '../../../services/orderV2';
import { DemandDetail, DemandQuoteSummary } from '../../../types';
import { CARGO_TYPES } from '../../../constants';
import { getDemandSceneLabel, getObjectStatusMeta } from '../../../utils';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../../utils/roleSummary';
import { friendlyErrorMessage } from '../../../utils/errorMessage';
import { clearQuickOrderOfferDraftForDemand } from '../../../utils/quickOrderOfferDraft';
import StatusBadge from '../../../components/business/StatusBadge';
import StepBar from '../../../components/business/StepBar';
import './index.scss';

type DemandStep = '已发布' | '收到报价' | '已选定服务商' | '已成单';
const DEMAND_STEPS: DemandStep[] = ['已发布', '收到报价', '已选定服务商', '已成单'];

const resolveDemandStepIndex = (demand: DemandDetail | null): number => {
  if (!demand) return 0;
  const status = String(demand.status || '').toLowerCase();
  if (status === 'converted_to_order') return 3;
  if (status === 'selected' || demand.selected_quote_id) return 2;
  if ((demand.quote_count || 0) > 0) return 1;
  return 0;
};

const isDemandTerminal = (demand: DemandDetail | null): boolean => {
  if (!demand) return false;
  const status = String(demand.status || '').toLowerCase();
  return status === 'cancelled' || status === 'expired' || status === 'closed';
};

const isDemandDraft = (demand: DemandDetail | null): boolean => {
  if (!demand) return false;
  return String(demand.status || '').toLowerCase() === 'draft';
};

const buildExpectationTip = (demand: DemandDetail | null): { title: string; lines: string[]; tone: 'info' | 'success' | 'muted' } => {
  if (!demand) return { title: '', lines: [], tone: 'info' };
  if (isDemandTerminal(demand)) {
    return { title: '任务已结束', lines: ['如果想再发起一次，可回首页发布新的吊运任务。'], tone: 'muted' };
  }
  const status = String(demand.status || '').toLowerCase();
  if (status === 'converted_to_order') {
    return { title: '订单已生成', lines: ['服务商正在按约定推进履约，进度可在订单中跟踪。'], tone: 'success' };
  }
  const quoteCount = demand.quote_count || 0;
  if (status === 'selected' || demand.selected_quote_id) {
    return { title: '已选定服务商', lines: ['等服务商确认后即可生成订单，记得关注消息通知。'], tone: 'success' };
  }
  if (quoteCount > 0) {
    return {
      title: `已收到 ${quoteCount} 家服务商报价`,
      lines: ['对比价格、机型和服务商资料，挑一家点"选定"即可生成订单。'],
      tone: 'success',
    };
  }
  return {
    title: '通常 30 分钟内会有 1-3 家服务商报价',
    lines: [
      '没人报价时，可以试试：',
      '• 检查作业说明是否清晰具体（建材吊几楼、要不要现场看）',
      '• 适当放宽时间或预算，覆盖更多服务商',
    ],
    tone: 'info',
  };
};

const formatScheduledRange = (startISO?: string, endISO?: string): string => {
  const fmt = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  };
  const start = fmt(startISO);
  const end = fmt(endISO);
  if (start && end) return `${start} → ${end}`;
  return start || end || '-';
};

const formatProviderResponse = (seconds?: number) => {
  const safeSeconds = Number(seconds || 0);
  if (!safeSeconds || safeSeconds <= 0) return '响应时间暂无';
  if (safeSeconds < 60) return `平均 ${Math.round(safeSeconds)} 秒响应`;
  if (safeSeconds < 3600) return `平均 ${Math.round(safeSeconds / 60)} 分钟响应`;
  return `平均 ${(safeSeconds / 3600).toFixed(1)} 小时响应`;
};

const formatProviderRating = (rating?: number | null, count?: number) => {
  const safeRating = Number(rating || 0);
  const safeCount = Number(count || 0);
  if (!safeRating || safeCount <= 0) return '暂无评分';
  return `★ ${safeRating.toFixed(1)}（${safeCount} 评）`;
};

const formatProviderScenes = (scenes?: string[]) => {
  const labels = (scenes || [])
    .map(item => getDemandSceneLabel(item))
    .filter(Boolean);
  return labels.length ? `擅长：${labels.slice(0, 3).join('、')}` : '擅长：暂无';
};

const formatQuoteDrone = (quote: DemandQuoteSummary) => {
  if (!quote.drone) return '机型信息待补充';
  return [quote.drone.brand, quote.drone.model].filter(Boolean).join(' ') || '机型信息待补充';
};

const centsToYuanText = (amount?: number | null): string => {
  const cents = Number(amount || 0);
  if (!Number.isFinite(cents) || cents <= 0) return '';
  const yuan = cents / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
};

const formatBudgetRange = (min?: number | null, max?: number | null) => {
  const minText = centsToYuanText(min);
  const maxText = centsToYuanText(max);
  if (minText && maxText) return `预算: ¥${minText} - ¥${maxText}`;
  if (maxText) return `预算: ¥${maxText} 以内`;
  if (minText) return `预算: ¥${minText} 起`;
  return '预算待确认';
};

const orderItemsOf = (response: unknown): any[] => {
  const data = response as any;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

const orderIdOfSelectResult = (result: unknown) => {
  const data = result as any;
  return Number(
    data?.order_id ||
    data?.data?.order_id ||
    data?.order?.id ||
    data?.data?.order?.id ||
    0,
  );
};

const buildDemandSharePath = (demandId: number) =>
  demandId > 0 ? `/pages/demand/detail/index?id=${demandId}` : '/pages/home/index';

const buildH5DemandShareUrl = (demandId: number) => {
  const path = buildDemandSharePath(demandId);
  if (typeof window === 'undefined') return path;
  const origin = window.location.origin;
  const pathname = window.location.pathname || '/';
  return `${origin}${pathname}#${path}`;
};

export default function DemandDetailPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary));
  const canRequestSuggestedPrice = providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply;
  const params = Taro.getCurrentInstance().router?.params || {};
  const demandId = Number(params.id || params.demandId || 0);

  const [demand, setDemand] = useState<DemandDetail | null>(null);
  const [quotes, setQuotes] = useState<DemandQuoteSummary[]>([]);
  const [quoteError, setQuoteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectingQuoteId, setSelectingQuoteId] = useState<number | null>(null);
  const [suggestedPriceText, setSuggestedPriceText] = useState('');

  const shareTitle = `${String(user?.nickname || '客户').trim() || '客户'}发布了一个吊运任务`;
  const shareText = demand?.title ? `吊运任务：${demand.title}` : '有一个吊运任务需要服务商报价';
  const sharePath = buildDemandSharePath(demandId);
  const shareUrl = buildH5DemandShareUrl(demandId);

  useShareAppMessage(() => {
    if (demand && (isDemandTerminal(demand) || isDemandDraft(demand))) {
      return { title: '重载吊运任务', path: '/pages/home/index' };
    }
    if (!demandId) {
      return { title: '重载吊运任务', path: '/pages/home/index' };
    }
    return {
      title: shareTitle,
      path: sharePath,
    };
  });

  const copyShareUrl = useCallback(async () => {
    try {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
      if (clipboard?.writeText) {
        await clipboard.writeText(shareUrl);
      } else {
        await Taro.setClipboardData({ data: shareUrl });
      }
      Taro.showToast({ title: '链接已复制，发给服务商即可', icon: 'none' });
    } catch {
      Taro.showModal({
        title: '分享链接',
        content: '复制失败，请手动复制浏览器地址栏链接发给服务商。',
        showCancel: false,
      });
    }
  }, [shareUrl]);

  const handleShareDemand = useCallback(async () => {
    if (!demandId) return;
    if (process.env.TARO_ENV !== 'h5') return;

    const webNavigator = typeof navigator !== 'undefined'
      ? navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
      : null;

    if (webNavigator?.share) {
      try {
        await webNavigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (error: any) {
        if (String(error?.name || '').toLowerCase() === 'aborterror') return;
      }
    }

    copyShareUrl();
  }, [copyShareUrl, demandId, shareText, shareTitle, shareUrl]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!demandId) { setLoading(false); return; }
    if (!options?.silent) setLoading(true);
    try {
      const res = await demandV2Service.getById(demandId);
      const detail = res as any;
      setDemand(detail);
      const isViewerOwner = Number(detail?.client_user_id || 0) === Number(user?.id || 0);
      if (!isViewerOwner && canRequestSuggestedPrice) {
        try {
          const suggestedRes: any = await demandV2Service.getSuggestedPrice(demandId);
          const yuan = Number(suggestedRes?.data?.yuan ?? suggestedRes?.yuan ?? 0);
          setSuggestedPriceText(Number.isFinite(yuan) && yuan > 0
            ? (Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2))
            : '');
        } catch {
          setSuggestedPriceText('');
        }
      } else {
        setSuggestedPriceText('');
      }
      if (isViewerOwner) {
        try {
          const quoteRes: any = await demandV2Service.listQuotes(demandId);
          setQuotes(quoteRes?.data?.items || quoteRes?.items || []);
          setQuoteError('');
        } catch (error: any) {
          setQuotes([]);
          setQuoteError(friendlyErrorMessage(error, '报价加载失败'));
        }
      } else {
        setQuotes([]);
        setQuoteError('');
      }
    } catch (error: any) {
      setDemand(null);
      setQuotes([]);
      setQuoteError('');
      setSuggestedPriceText('');
      Taro.showToast({ title: friendlyErrorMessage(error, '任务加载失败'), icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [canRequestSuggestedPrice, demandId, user?.id]);

  useDidShow(() => { loadData(); });
  const shouldAutoRefreshDemand = Boolean(demandId && demand && !isDemandTerminal(demand) && !isDemandDraft(demand));

  useEffect(() => {
    if (!shouldAutoRefreshDemand) return undefined;
    const timer = setInterval(() => {
      loadData({ silent: true });
    }, 8000);
    return () => clearInterval(timer);
  }, [loadData, shouldAutoRefreshDemand]);

  const isOwnDemand = demand?.client_user_id === user?.id;
  const canEdit = isOwnDemand && ['draft', 'published', 'quoting'].includes(demand?.status || '');
  const canQuote = !isOwnDemand && providerCapabilities.canUseWorkbench && providerCapabilities.canPublishSupply;
  const myQuote = ((demand as any)?.my_quote || null) as DemandQuoteSummary | null;
  const hasOwnQuote = Boolean(myQuote?.id);
  const quoteCount = demand?.quote_count || 0;
  const demandStatus = String(demand?.status || '').toLowerCase();
  const customerHeroText = demandStatus === 'converted_to_order'
    ? '订单已生成'
    : demandStatus === 'selected' || demand?.selected_quote_id
      ? '已选定服务商'
      : quoteCount > 0
        ? `已收到 ${quoteCount} 家报价`
        : isDemandDraft(demand)
          ? '任务草稿'
          : '等待服务商报价';
  const heroMetaText = canQuote && suggestedPriceText
    ? `建议报价: ¥${suggestedPriceText}`
    : isOwnDemand
      ? customerHeroText
      : formatBudgetRange(demand?.budget_min, demand?.budget_max);
  const quotePriceParam = canQuote && suggestedPriceText ? `&priceYuan=${suggestedPriceText}` : '';
  const quoteEditorUrl = demand
    ? `/pages/demand/quote/index?demandId=${demandId}&demandTitle=${encodeURIComponent(demand.title || '需求')}${quotePriceParam}`
    : '';
  const openQuoteEditor = () => {
    if (!quoteEditorUrl) return;
    Taro.navigateTo({ url: quoteEditorUrl });
  };

  const resolveGeneratedOrderId = useCallback(async () => {
    try {
      const orders = await orderV2Service.list({ role: 'client', page: 1, page_size: 50 });
      const matched = orderItemsOf(orders).find(order =>
        Number(order?.demand_id || 0) === demandId &&
        String(order?.order_source || '').toLowerCase() === 'demand_market',
      );
      return Number(matched?.id || 0);
    } catch {
      return 0;
    }
  }, [demandId]);

  const handleCancel = async () => {
    const res = await Taro.showModal({ title: '确认撤销', content: '撤销后不可恢复' });
    if (!res.confirm) return;
    setSubmitting(true);
    try { await demandV2Service.cancel(demandId); Taro.showToast({ title: '已撤销' }); loadData(); }
    catch (e: any) { Taro.showToast({ title: friendlyErrorMessage(e, '撤销失败'), icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const handleSelectQuote = async (quote: DemandQuoteSummary) => {
    if (submitting || selectingQuoteId) return;
    const res = await Taro.showModal({
      title: '选择报价',
      content: `确认选择该服务商报价 ¥${((quote.price_amount || 0) / 100).toFixed(2)} 并生成订单？`,
      confirmText: '生成订单',
    });
    if (!res.confirm) return;
    setSubmitting(true);
    setSelectingQuoteId(quote.id);
    try {
      const result = await demandV2Service.selectProvider(demandId, quote.id);
      const orderId = orderIdOfSelectResult(result) || await resolveGeneratedOrderId();
      clearQuickOrderOfferDraftForDemand(demandId);
      Taro.showToast({ title: '订单已生成', icon: 'success' });
      setTimeout(() => {
        if (orderId) Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
        else {
          loadData({ silent: true });
          setSelectingQuoteId(null);
        }
      }, 800);
    } catch (e: any) {
      const orderId = await resolveGeneratedOrderId();
      if (orderId) {
        clearQuickOrderOfferDraftForDemand(demandId);
        Taro.showToast({ title: '订单已生成', icon: 'success' });
        setTimeout(() => {
          Taro.redirectTo({ url: `/pages/orders/detail/index?orderId=${orderId}` });
        }, 800);
        return;
      }
      Taro.showToast({ title: friendlyErrorMessage(e, '选择失败'), icon: 'none' });
      setSelectingQuoteId(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View className="page-wrap"><Text className="empty-text">加载中...</Text></View>;
  if (!demand) return <View className="page-wrap"><Text className="empty-text">任务不存在</Text></View>;
  const demandStepIndex = resolveDemandStepIndex(demand);

  return (
    <ScrollView scrollY className="page-wrap">
      <View className="hero">
        <View className="hero-top">
          <Text className="demand-no">{demand.demand_no}</Text>
          <StatusBadge
            label={getObjectStatusMeta('demand', demand.status).label}
            tone={getObjectStatusMeta('demand', demand.status).tone}
          />
        </View>
        <Text className="hero-title">{demand.title}</Text>
        <Text className="hero-budget">{heroMetaText}</Text>
      </View>

      {isOwnDemand && !isDemandTerminal(demand) && !isDemandDraft(demand) ? (
        <View className="info-card">
          <Text className="section-title">任务进度</Text>
          <StepBar steps={DEMAND_STEPS.map(label => ({ key: label, label }))} currentIndex={demandStepIndex} theme="light" />
          {(() => {
            const tip = buildExpectationTip(demand);
            if (!tip.title) return null;
            return (
              <View className={`step-tip step-tip-${tip.tone}`}>
                <Text className="step-tip-title">{tip.title}</Text>
                {tip.lines.map((line, i) => (
                  <Text key={i} className="step-tip-line">{line}</Text>
                ))}
                {(demand.quote_count || 0) === 0 ? (
                  process.env.TARO_ENV === 'h5' ? (
                    <Button className="step-share-button" onClick={handleShareDemand}>
                      <Text className="step-share-text">分享给认识的服务商</Text>
                    </Button>
                  ) : (
                    <Button className="step-share-button" openType="share">
                      <Text className="step-share-text">分享给认识的服务商</Text>
                    </Button>
                  )
                ) : null}
              </View>
            );
          })()}
        </View>
      ) : null}

      <View className="info-card">
        <Text className="section-title">操作</Text>
        <View className="action-row">
          {canEdit && demand.status === 'draft' && (
            <View className="btn btn-primary" onClick={() => demandV2Service.publish(demandId).then(() => { loadData(); })}><Text className="btn-text">发布任务</Text></View>
          )}
          {canEdit && (
            <View className="btn btn-outline" onClick={handleCancel}><Text className="btn-text-outline">撤销</Text></View>
          )}
          {canQuote && (
            <View className="btn btn-primary" onClick={openQuoteEditor}><Text className="btn-text">{hasOwnQuote ? '修改报价' : '填写报价'}</Text></View>
          )}
        </View>
      </View>

      {canQuote && myQuote ? (
        <View className="info-card">
          <Text className="section-title">我的报价</Text>
          <View className="quote-card quote-card-own">
            <View className="quote-main">
              <View className="quote-provider-head">
                <Text className="quote-title">已提交给客户</Text>
                <Text className="quote-rating">{getObjectStatusMeta('quote', myQuote.status).label || myQuote.status}</Text>
              </View>
              <Text className="quote-provider-stats">{formatQuoteDrone(myQuote)}</Text>
              <Text className={`quote-desc ${(myQuote.execution_plan || '').trim() ? '' : 'is-empty'}`}>
                {(myQuote.execution_plan || '').trim() || '未填写执行说明'}
              </Text>
            </View>
            <View className="quote-side">
              <Text className="quote-price">¥{((myQuote.price_amount || 0) / 100).toFixed(2)}</Text>
              <View className="quote-select" onClick={openQuoteEditor}>
                <Text className="quote-select-text">修改</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View className="info-card">
        <Text className="section-title">任务概况</Text>
        <View className="info-row"><Text className="info-label">场景</Text><Text className="info-value">{getDemandSceneLabel(demand.cargo_scene)}</Text></View>
        <View className="info-row"><Text className="info-label">预估重量</Text><Text className="info-value">{demand.cargo_weight_kg || 0} kg</Text></View>
        <View className="info-row"><Text className="info-label">货物类型</Text><Text className="info-value">{CARGO_TYPES[String(demand.cargo_type || '')] || demand.cargo_type || '-'}</Text></View>
        <View className="info-row"><Text className="info-label">作业时间</Text><Text className="info-value">{formatScheduledRange(demand.scheduled_start_at, demand.scheduled_end_at)}</Text></View>
        <View className="info-row"><Text className="info-label">起吊点</Text><Text className="info-value">{(demand as any).departure_address?.text || (demand as any).service_address_text || '-'}</Text></View>
        <View className="info-row border-none"><Text className="info-label">落放点</Text><Text className="info-value">{(demand as any).destination_address?.text || '-'}</Text></View>
      </View>

      <View className="info-card">
        <Text className="section-title">作业说明</Text>
        <Text className={`info-desc ${(demand.description || '').trim() ? '' : 'is-empty'}`}>
          {(demand.description || '').trim() || '客户未补充说明'}
        </Text>
        {((demand as any).cargo_special_requirements || '').trim() ? (
          <View className="info-extra">
            <Text className="info-label">特殊要求</Text>
            <Text className="info-desc">{(demand as any).cargo_special_requirements}</Text>
          </View>
        ) : null}
      </View>

      <View className="info-card">
        <View className="stats-row">
          <View className="stat-box">
            <Text className="stat-num">{demand.quote_count || 0}</Text>
            <Text className="stat-label">服务商报价</Text>
          </View>
        </View>
      </View>

      {isOwnDemand ? (
        <View className="info-card">
          <Text className="section-title">服务商报价</Text>
          {quoteError ? (
            <View className="quote-empty quote-empty-warning">
              <Text className="quote-empty-text">{quoteError}</Text>
            </View>
          ) : quotes.length === 0 ? (
            <View className="quote-empty">
              <Text className="quote-empty-text">还没有服务商报价，你可以分享给认识的服务商</Text>
            </View>
          ) : (
            quotes.map((quote) => {
              const isSelectingThisQuote = selectingQuoteId === quote.id;
              const selectDisabled = submitting || selectingQuoteId !== null;
              return (
                <View key={quote.id} className="quote-card">
                  <View className="quote-main">
                    <View className="quote-provider-head">
                      <Text className="quote-title">{quote.owner?.nickname || `服务商 #${quote.owner_user_id}`}</Text>
                      <Text className="quote-rating">{formatProviderRating(quote.owner?.rating, quote.owner?.rating_count)}</Text>
                    </View>
                    <Text className="quote-provider-stats">
                      近 30 天 {Number(quote.owner?.recent_30d_completed_orders || 0)} 单 · {formatProviderResponse(quote.owner?.avg_response_seconds)}
                    </Text>
                    <Text className="quote-scenes">{formatProviderScenes(quote.owner?.preferred_scenes)}</Text>
                    <Text className="quote-desc">
                      {formatQuoteDrone(quote)}
                      {quote.execution_plan ? ` · ${quote.execution_plan}` : ''}
                    </Text>
                  </View>
                  <View className="quote-side">
                    <Text className="quote-price">¥{((quote.price_amount || 0) / 100).toFixed(2)}</Text>
                    {quote.status === 'submitted' ? (
                      <View className={`quote-select ${selectDisabled ? 'disabled' : ''}`} onClick={selectDisabled ? undefined : () => handleSelectQuote(quote)}>
                        <Text className="quote-select-text">{isSelectingThisQuote ? '处理中' : '选定'}</Text>
                      </View>
                    ) : (
                      <Text className="quote-status">{getObjectStatusMeta('quote', quote.status).label || quote.status}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
