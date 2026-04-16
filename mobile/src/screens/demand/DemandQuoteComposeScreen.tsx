import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {droneService} from '../../services/drone';
import {demandV2Service} from '../../services/demandV2';
import {DemandQuoteSummary, Drone} from '../../types';
import {useTheme} from '../../theme/ThemeContext';
import type {AppTheme} from '../../theme/index';

const toDisplayAmount = (amount?: number | null) =>
  amount && amount > 0 ? String((amount / 100).toFixed(2)) : '';

export default function DemandQuoteComposeScreen({route, navigation}: any) {
  const {theme} = useTheme();
  const styles = getStyles(theme);
  const demandId = Number(route.params?.demandId || route.params?.id || 0);
  const demandTitle = String(route.params?.demandTitle || '需求');
  const existingQuote = (route.params?.existingQuote || null) as DemandQuoteSummary | null;

  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDroneId, setSelectedDroneId] = useState<number>(Number(existingQuote?.drone?.id || 0));
  const [priceText, setPriceText] = useState(toDisplayAmount(existingQuote?.price_amount));
  const [executionPlan, setExecutionPlan] = useState(existingQuote?.execution_plan || '');

  useEffect(() => {
    let mounted = true;
    const fetchDrones = async () => {
      try {
        const res = await droneService.myDrones({page: 1, page_size: 100});
        if (!mounted) {
          return;
        }
        const allDrones = res.data?.list || [];
        const list = allDrones.filter(
          (d: any) =>
            d.certification_status === 'approved' &&
            d.availability_status === 'available',
        );
        setDrones(list);
        if (list.length > 0) {
          setSelectedDroneId(current => current || list[0].id);
        }
      } catch (error: any) {
        if (mounted) {
          Alert.alert('加载失败', error.message || '获取无人机失败');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchDrones();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedDrone = useMemo(
    () => drones.find(item => item.id === selectedDroneId) || null,
    [drones, selectedDroneId],
  );

  const handleSubmit = async () => {
    if (!demandId) {
      Alert.alert('提交失败', '需求编号无效');
      return;
    }
    if (!selectedDroneId) {
      Alert.alert('提示', '请选择执行无人机');
      return;
    }

    const amountYuan = Number(priceText);
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
      Alert.alert('提示', '请输入有效报价金额');
      return;
    }

    setSubmitting(true);
    try {
      await demandV2Service.createQuote(demandId, {
        drone_id: selectedDroneId,
        price_amount: Math.round(amountYuan * 100),
        execution_plan: executionPlan.trim(),
      });
      Alert.alert('提交成功', existingQuote ? '报价已更新' : '报价已提交', [
        {
          text: '查看需求',
          onPress: () => navigation.navigate('DemandDetail', {id: demandId, refreshAt: Date.now()}),
        },
      ]);
    } catch (error: any) {
      Alert.alert('提交失败', error.message || '报价提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
        <ActivityIndicator style={styles.loader} color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{existingQuote ? '更新报价' : '提交报价'}</Text>
          <Text style={styles.title}>{demandTitle}</Text>
          <Text style={styles.desc}>
            机主报价只针对需求撮合，不会在这里混入订单信息。客户选定你的方案后，才会进入订单与履约。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择执行无人机</Text>
          {drones.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>没有符合条件的无人机（需资质审核通过且状态可用），请先完善机队。</Text>
            </View>
          ) : (
            drones.map(drone => {
              const selected = drone.id === selectedDroneId;
              return (
                <TouchableOpacity
                  key={drone.id}
                  style={[styles.droneCard, selected && styles.droneCardActive]}
                  onPress={() => setSelectedDroneId(drone.id)}
                  activeOpacity={0.88}>
                  <View style={styles.droneHeader}>
                    <Text style={styles.droneName}>{drone.brand} {drone.model}</Text>
                    <View style={[styles.selectBadge, selected && styles.selectBadgeActive]}>
                      <Text style={[styles.selectBadgeText, selected && styles.selectBadgeTextActive]}>
                        {selected ? '已选择' : '点击选择'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.droneMeta}>
                    载重 {drone.max_load || 0}kg · 航时 {drone.max_flight_time || 0} 分钟 · {drone.city || '未设置城市'}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>报价金额</Text>
          <TextInput
            style={styles.input}
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
            placeholder="请输入金额（元）"
          />
          <Text style={styles.helpText}>提交后会自动按系统金额规则保存，无需自行换算。</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>执行方案</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={executionPlan}
            onChangeText={setExecutionPlan}
            multiline
            textAlignVertical="top"
            placeholder="例如：2 架次完成，预计 3 小时，适合山区点对点吊运"
          />
          <Text style={styles.helpText}>
            这里写你准备如何执行、预计架次、保障措施，帮助客户更快做判断。
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>本次提交</Text>
          <Text style={styles.summaryText}>无人机：{selectedDrone ? `${selectedDrone.brand} ${selectedDrone.model}` : '未选择'}</Text>
          <Text style={styles.summaryText}>报价：{priceText ? `¥${priceText}` : '待填写'}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || drones.length === 0) && styles.submitBtnDisabled]}
          disabled={submitting || drones.length === 0}
          onPress={handleSubmit}
          activeOpacity={0.9}>
          <Text style={styles.submitBtnText}>{submitting ? '提交中...' : existingQuote ? '更新报价' : '提交报价'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.bg},
  content: {padding: 16, paddingBottom: 120},
  loader: {marginTop: 120},
  hero: {
    backgroundColor: theme.isDark ? 'rgba(0,212,255,0.08)' : theme.primary,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: theme.isDark ? 1 : 0,
    borderColor: theme.isDark ? theme.primaryBorder : 'transparent',
  },
  eyebrow: {fontSize: 13, color: theme.isDark ? theme.primaryText : 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 8},
  title: {fontSize: 24, lineHeight: 30, color: theme.isDark ? theme.text : '#FFFFFF', fontWeight: '700'},
  desc: {marginTop: 8, fontSize: 13, lineHeight: 20, color: theme.isDark ? theme.textSub : 'rgba(255,255,255,0.85)'},
  section: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 17, color: theme.text, fontWeight: '700', marginBottom: 12},
  droneCard: {
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  droneCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryBg,
  },
  droneHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  droneName: {fontSize: 15, color: theme.text, fontWeight: '700', flex: 1, marginRight: 12},
  droneMeta: {fontSize: 12, lineHeight: 18, color: theme.textSub},
  selectBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectBadgeActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  selectBadgeText: {fontSize: 12, color: theme.textSub, fontWeight: '600'},
  selectBadgeTextActive: {color: theme.btnPrimaryText},
  input: {
    borderWidth: 1,
    borderColor: theme.divider,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.bgSecondary,
  },
  multilineInput: {minHeight: 110},
  helpText: {marginTop: 8, fontSize: 12, lineHeight: 18, color: theme.textSub},
  summaryCard: {
    backgroundColor: theme.warning + '22',
    borderWidth: 1,
    borderColor: theme.warning + '44',
    borderRadius: 18,
    padding: 16,
  },
  summaryTitle: {fontSize: 15, color: theme.warning, fontWeight: '700', marginBottom: 8},
  summaryText: {fontSize: 13, color: theme.warning, lineHeight: 20},
  emptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.warning + '44',
    backgroundColor: theme.warning + '22',
    padding: 14,
  },
  emptyText: {fontSize: 13, lineHeight: 20, color: theme.warning},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    backgroundColor: theme.card,
  },
  submitBtn: {
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  submitBtnDisabled: {opacity: 0.5},
  submitBtnText: {fontSize: 16, color: theme.btnPrimaryText, fontWeight: '700'},
});
