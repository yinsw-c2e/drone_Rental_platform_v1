import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {droneService} from '../../services/drone';
import {ownerService} from '../../services/owner';
import {RootState} from '../../store/store';
import {getEffectiveRoleSummary} from '../../utils/roleSummary';

export default function OwnerProfileScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const effectiveRoleSummary = getEffectiveRoleSummary(roleSummary, user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState({service_city: '', contact_phone: '', intro: ''});
  const [stats, setStats] = useState({drones: 0, activeSupplies: 0, quotes: 0, bindings: 0});

  const loadData = useCallback(async () => {
    try {
      const [profileRes, dronesRes, suppliesRes, quotesRes, bindingsRes] = await Promise.all([
        ownerService.getProfile().catch(() => null),
        droneService.myDrones({page: 1, page_size: 100}).catch(() => null),
        ownerService.listMySupplies({page: 1, page_size: 100}).catch(() => null),
        ownerService.listMyQuotes({page: 1, page_size: 100}).catch(() => null),
        ownerService.listPilotBindings({status: 'active', page: 1, page_size: 100}).catch(() => null),
      ]);

      const nextProfile = profileRes?.data || null;
      setProfile(nextProfile);
      setDraft({
        service_city: nextProfile?.service_city || '',
        contact_phone: nextProfile?.contact_phone || user?.phone || '',
        intro: nextProfile?.intro || '',
      });

      const supplyItems = suppliesRes?.data?.items || [];
      setStats({
        drones: Number(dronesRes?.data?.list?.length || 0),
        activeSupplies: supplyItems.filter((item: any) => item.status === 'active').length,
        quotes: Number(quotesRes?.meta?.total || 0),
        bindings: Number(bindingsRes?.meta?.total || 0),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await ownerService.updateProfile({
        service_city: draft.service_city.trim(),
        contact_phone: draft.contact_phone.trim(),
        intro: draft.intro.trim(),
      });
      setProfile(res.data);
      Alert.alert('保存成功', '机主档案已更新。');
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const capabilityItems = useMemo(
    () => [
      {
        label: '可发布供给',
        enabled: effectiveRoleSummary.can_publish_supply,
        desc: effectiveRoleSummary.can_publish_supply ? '无人机与关键资质已满足主市场准入。' : '先完善无人机与关键资质，才能把供给上架到主市场。',
      },
      {
        label: '可自执行',
        enabled: effectiveRoleSummary.can_self_execute,
        desc: effectiveRoleSummary.can_self_execute ? '你已同时具备机主与飞手能力，可直接选择自执行。' : '如果要机主自执行，还需要同步具备飞手能力。',
      },
    ],
    [effectiveRoleSummary.can_publish_supply, effectiveRoleSummary.can_self_execute],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>机主档案加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ObjectCard style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>机主档案</Text>
          <Text style={styles.heroTitle}>设备、供给、资质从这里统一管理</Text>
          <Text style={styles.heroDesc}>
            机主不是一个模糊标签，而是围绕无人机资产、供给能力和执行协作展开的一组真实能力。
          </Text>

          <View style={styles.heroMetaRow}>
            <StatusBadge label={effectiveRoleSummary.has_owner_role ? '机主身份已持有' : '机主档案待建立'} tone={effectiveRoleSummary.has_owner_role ? 'green' : 'orange'} />
            <StatusBadge label={effectiveRoleSummary.can_publish_supply ? '可上架供给' : '供给待就绪'} tone={effectiveRoleSummary.can_publish_supply ? 'blue' : 'gray'} />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.drones}</Text>
              <Text style={styles.summaryLabel}>无人机</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.activeSupplies}</Text>
              <Text style={styles.summaryLabel}>生效供给</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.quotes}</Text>
              <Text style={styles.summaryLabel}>我的报价</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.bindings}</Text>
              <Text style={styles.summaryLabel}>绑定飞手</Text>
            </View>
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>档案信息</Text>
          <Text style={styles.inputLabel}>主要服务城市</Text>
          <TextInput
            style={styles.input}
            placeholder="例如：佛山 / 广州 / 珠海"
            value={draft.service_city}
            onChangeText={text => setDraft(prev => ({...prev, service_city: text}))}
          />

          <Text style={styles.inputLabel}>联系电话</Text>
          <TextInput
            style={styles.input}
            placeholder="用于客户与平台联系"
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={text => setDraft(prev => ({...prev, contact_phone: text}))}
          />

          <Text style={styles.inputLabel}>机主简介</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="说明你的设备能力、擅长场景、保障能力和服务边界"
            multiline
            textAlignVertical="top"
            value={draft.intro}
            onChangeText={text => setDraft(prev => ({...prev, intro: text}))}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>能力状态</Text>
          {capabilityItems.map(item => (
            <View key={item.label} style={styles.capabilityRow}>
              <View style={styles.capabilityTextWrap}>
                <Text style={styles.capabilityTitle}>{item.label}</Text>
                <Text style={styles.capabilityDesc}>{item.desc}</Text>
              </View>
              <StatusBadge label={item.enabled ? '已就绪' : '未就绪'} tone={item.enabled ? 'green' : 'gray'} />
            </View>
          ))}
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>机主快捷入口</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MyDrones')}>
              <Text style={styles.quickIcon}>🛩️</Text>
              <Text style={styles.quickTitle}>我的无人机</Text>
              <Text style={styles.quickDesc}>管理设备、状态和资质</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MyOffers')}>
              <Text style={styles.quickIcon}>📦</Text>
              <Text style={styles.quickTitle}>我的供给</Text>
              <Text style={styles.quickDesc}>查看草稿、上架与暂停中的供给</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('PublishOffer')}>
              <Text style={styles.quickIcon}>🧾</Text>
              <Text style={styles.quickTitle}>发布供给</Text>
              <Text style={styles.quickDesc}>创建新的重载吊运供给方案</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('MyQuotes')}>
              <Text style={styles.quickIcon}>💬</Text>
              <Text style={styles.quickTitle}>我的报价</Text>
              <Text style={styles.quickDesc}>跟进需求报价与承接节奏</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('OwnerPilotBindings')}>
              <Text style={styles.quickIcon}>🤝</Text>
              <Text style={styles.quickTitle}>绑定飞手</Text>
              <Text style={styles.quickDesc}>邀请、确认和管理长期合作飞手</Text>
            </TouchableOpacity>
          </View>
        </ObjectCard>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? '保存中...' : '保存机主档案'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#eef3f8'},
  content: {padding: 16, paddingBottom: 32, gap: 14},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {fontSize: 15, color: '#64748b'},
  heroCard: {backgroundColor: '#0f5cab'},
  heroEyebrow: {fontSize: 12, fontWeight: '700', color: '#dbeafe'},
  heroTitle: {marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#fff'},
  heroDesc: {marginTop: 10, fontSize: 13, lineHeight: 20, color: '#dbeafe'},
  heroMetaRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18},
  summaryItem: {
    width: '23%',
    minWidth: 68,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryValue: {fontSize: 18, fontWeight: '800', color: '#fff'},
  summaryLabel: {marginTop: 4, fontSize: 12, textAlign: 'center', color: '#dbeafe'},
  sectionCard: {gap: 12},
  sectionTitle: {fontSize: 20, fontWeight: '800', color: '#102a43'},
  inputLabel: {fontSize: 13, fontWeight: '700', color: '#334e68'},
  input: {
    borderWidth: 1,
    borderColor: '#d8e1eb',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#102a43',
  },
  multilineInput: {minHeight: 108},
  capabilityRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center'},
  capabilityTextWrap: {flex: 1},
  capabilityTitle: {fontSize: 15, fontWeight: '700', color: '#102a43'},
  capabilityDesc: {marginTop: 4, fontSize: 13, lineHeight: 19, color: '#64748b'},
  quickGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  quickCard: {
    width: '47%',
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#d7e5f5',
  },
  quickIcon: {fontSize: 24},
  quickTitle: {marginTop: 10, fontSize: 15, fontWeight: '700', color: '#102a43'},
  quickDesc: {marginTop: 6, fontSize: 12, lineHeight: 18, color: '#64748b'},
  saveButton: {
    borderRadius: 14,
    backgroundColor: '#175cd3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  saveButtonDisabled: {opacity: 0.6},
  saveButtonText: {fontSize: 15, fontWeight: '800', color: '#fff'},
});
