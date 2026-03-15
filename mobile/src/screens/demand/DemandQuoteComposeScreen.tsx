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

const toDisplayAmount = (amount?: number | null) =>
  amount && amount > 0 ? String((amount / 100).toFixed(2)) : '';

export default function DemandQuoteComposeScreen({route, navigation}: any) {
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
        const list = res.data?.list || [];
        setDrones(list);
        if (!selectedDroneId && list.length > 0) {
          setSelectedDroneId(list[0].id);
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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} color="#1677ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.emptyText}>你还没有可选无人机，先完善机队后再报价。</Text>
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
          <Text style={styles.helpText}>提交时会自动换算为分，和后端金额口径保持一致。</Text>
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f4f7fb'},
  content: {padding: 16, paddingBottom: 120},
  loader: {marginTop: 120},
  hero: {
    backgroundColor: '#0f5cab',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  eyebrow: {fontSize: 13, color: '#d6e4ff', fontWeight: '600', marginBottom: 8},
  title: {fontSize: 24, lineHeight: 30, color: '#fff', fontWeight: '700'},
  desc: {marginTop: 8, fontSize: 13, lineHeight: 20, color: '#d6e4ff'},
  section: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 17, color: '#1f1f1f', fontWeight: '700', marginBottom: 12},
  droneCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  droneCardActive: {
    borderColor: '#1677ff',
    backgroundColor: '#f0f7ff',
  },
  droneHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  droneName: {fontSize: 15, color: '#1f1f1f', fontWeight: '700', flex: 1, marginRight: 12},
  droneMeta: {fontSize: 12, lineHeight: 18, color: '#8c8c8c'},
  selectBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectBadgeActive: {
    borderColor: '#1677ff',
    backgroundColor: '#1677ff',
  },
  selectBadgeText: {fontSize: 12, color: '#8c8c8c', fontWeight: '600'},
  selectBadgeTextActive: {color: '#fff'},
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f1f1f',
    backgroundColor: '#fafafa',
  },
  multilineInput: {minHeight: 110},
  helpText: {marginTop: 8, fontSize: 12, lineHeight: 18, color: '#8c8c8c'},
  summaryCard: {
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#ffe58f',
    borderRadius: 18,
    padding: 16,
  },
  summaryTitle: {fontSize: 15, color: '#ad6800', fontWeight: '700', marginBottom: 8},
  summaryText: {fontSize: 13, color: '#8c5a00', lineHeight: 20},
  emptyBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffe58f',
    backgroundColor: '#fffbe6',
    padding: 14,
  },
  emptyText: {fontSize: 13, lineHeight: 20, color: '#ad6800'},
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  submitBtn: {
    borderRadius: 16,
    backgroundColor: '#1677ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  submitBtnDisabled: {opacity: 0.5},
  submitBtnText: {fontSize: 16, color: '#fff', fontWeight: '700'},
});
