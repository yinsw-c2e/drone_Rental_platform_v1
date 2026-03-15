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

import AddressInputField from '../../components/AddressInputField';
import EmptyState from '../../components/business/EmptyState';
import ObjectCard from '../../components/business/ObjectCard';
import StatusBadge from '../../components/business/StatusBadge';
import {
  Client,
  getClientProfile,
  registerIndividual,
  requestCreditCheck,
  updateClientProfile,
} from '../../services/client';
import {RootState} from '../../store/store';
import {AddressData} from '../../types';

const VERIFY_STATUS_MAP: Record<string, {label: string; tone: 'green' | 'orange' | 'red' | 'gray'}> = {
  approved: {label: '已认证', tone: 'green'},
  verified: {label: '已认证', tone: 'green'},
  pending: {label: '审核中', tone: 'orange'},
  rejected: {label: '未通过', tone: 'red'},
  unverified: {label: '未认证', tone: 'gray'},
};

const CREDIT_STATUS_MAP: Record<string, {label: string; tone: 'green' | 'orange' | 'red' | 'gray'}> = {
  approved: {label: '已通过', tone: 'green'},
  verified: {label: '已通过', tone: 'green'},
  pending: {label: '审核中', tone: 'orange'},
  rejected: {label: '未通过', tone: 'red'},
  failed: {label: '未通过', tone: 'red'},
  unverified: {label: '未查询', tone: 'gray'},
};

const sceneOptions = ['电网建设', '山区运输', '海岛给养', '应急救援', '高原补给'];

type DraftProfile = {
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  default_pickup_address: string;
  default_delivery_address: string;
  preferred_cargo_types: string[];
};

const emptyDraft: DraftProfile = {
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  default_pickup_address: '',
  default_delivery_address: '',
  preferred_cargo_types: [],
};

const buildAddressValue = (text?: string): AddressData | null => {
  if (!text) {
    return null;
  }
  return {
    name: text,
    address: text,
    latitude: 0,
    longitude: 0,
  };
};

export default function ClientProfileScreen({navigation}: any) {
  const user = useSelector((state: RootState) => state.auth.user);
  const [client, setClient] = useState<Client | null>(null);
  const [draft, setDraft] = useState<DraftProfile>(emptyDraft);
  const [pickupAddress, setPickupAddress] = useState<AddressData | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const syncDraft = useCallback((profile: Client) => {
    setDraft({
      contact_person: profile.contact_person || '',
      contact_phone: profile.contact_phone || user?.phone || '',
      contact_email: profile.contact_email || '',
      default_pickup_address: profile.default_pickup_address || '',
      default_delivery_address: profile.default_delivery_address || '',
      preferred_cargo_types: profile.preferred_cargo_types || [],
    });
    setPickupAddress(buildAddressValue(profile.default_pickup_address));
    setDeliveryAddress(buildAddressValue(profile.default_delivery_address));
  }, [user?.phone]);

  const loadData = useCallback(async () => {
    try {
      let profile: Client;
      try {
        profile = await getClientProfile();
      } catch {
        await registerIndividual();
        profile = await getClientProfile();
      }
      setClient(profile);
      syncDraft(profile);
    } catch {
      setClient(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncDraft]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const verificationStatus = VERIFY_STATUS_MAP[client?.verification_status || 'unverified'] || VERIFY_STATUS_MAP.unverified;
  const creditStatus = CREDIT_STATUS_MAP[client?.credit_check_status || 'unverified'] || CREDIT_STATUS_MAP.unverified;

  const summaryItems = useMemo(
    () => [
      {label: '需求', value: client?.total_orders || 0},
      {label: '已完成', value: client?.completed_orders || 0},
      {label: '总消费', value: client?.total_spending ? `¥${(client.total_spending / 100).toFixed(0)}` : '0'},
      {label: '评分', value: client?.average_rating?.toFixed(1) || '5.0'},
    ],
    [client],
  );

  const handleSave = useCallback(async () => {
    if (!client) {
      return;
    }
    if (!draft.contact_person.trim()) {
      Alert.alert('请补充信息', '请先填写联系人。');
      return;
    }
    if (!draft.contact_phone.trim()) {
      Alert.alert('请补充信息', '请先填写联系电话。');
      return;
    }

    setSaving(true);
    try {
      const nextProfile = await updateClientProfile({
        contact_person: draft.contact_person.trim(),
        contact_phone: draft.contact_phone.trim(),
        contact_email: draft.contact_email.trim() || undefined,
        default_pickup_address: draft.default_pickup_address.trim() || undefined,
        default_delivery_address: draft.default_delivery_address.trim() || undefined,
        preferred_cargo_types: draft.preferred_cargo_types,
      });
      setClient(nextProfile);
      syncDraft(nextProfile);
      Alert.alert('保存成功', '客户档案与默认地址已更新。');
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [client, draft, syncDraft]);

  const handleCreditCheck = useCallback(() => {
    Alert.alert('发起征信查询', '征信结果会影响部分订单的支付与下单资格，确定继续吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '继续',
        onPress: async () => {
          try {
            await requestCreditCheck();
            Alert.alert('已提交', '征信查询请求已提交，稍后可下拉刷新查看状态。');
            loadData();
          } catch (e: any) {
            Alert.alert('提交失败', e?.message || '请稍后重试');
          }
        },
      },
    ]);
  }, [loadData]);

  const toggleScene = useCallback((scene: string) => {
    setDraft(prev => ({
      ...prev,
      preferred_cargo_types: prev.preferred_cargo_types.includes(scene)
        ? prev.preferred_cargo_types.filter(item => item !== scene)
        : [...prev.preferred_cargo_types, scene],
    }));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>客户档案加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          title="客户档案暂时不可用"
          description="系统会默认创建个人客户档案。如果当前没拉到，我们可以直接重试初始化。"
          actionText="重试初始化"
          onAction={loadData}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ObjectCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroTitle}>客户档案</Text>
              <Text style={styles.heroSubtitle}>默认个人客户档案已开通，可直接发布需求与直达下单。</Text>
            </View>
            <View style={styles.heroBadges}>
              <StatusBadge label={verificationStatus.label} tone={verificationStatus.tone} />
              <StatusBadge label={client.client_type === 'enterprise' ? '企业客户' : '个人客户'} tone="blue" />
            </View>
          </View>

          <View style={styles.accountMeta}>
            <Text style={styles.accountName}>{user?.nickname || '当前账号'}</Text>
            <Text style={styles.accountPhone}>{draft.contact_phone || user?.phone || '未设置联系电话'}</Text>
          </View>

          <View style={styles.summaryRow}>
            {summaryItems.map(item => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>账号与资格</Text>
              <Text style={styles.sectionDesc}>这里确认的是“客户能力”是否就绪，而不是再次注册。</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>默认客户档案</Text>
            <StatusBadge label="已开通" tone="green" />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>征信状态</Text>
            <StatusBadge label={creditStatus.label} tone={creditStatus.tone} />
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>平台信用分</Text>
            <Text style={styles.infoValue}>{client.platform_credit_score || 600}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>外部征信分</Text>
            <Text style={styles.infoValue}>{client.credit_score || '-'}</Text>
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleCreditCheck}>
            <Text style={styles.secondaryButtonText}>发起征信查询</Text>
          </TouchableOpacity>
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>联系人信息</Text>
          <Text style={styles.inputLabel}>联系人</Text>
          <TextInput
            style={styles.input}
            placeholder="填写联系人姓名"
            value={draft.contact_person}
            onChangeText={text => setDraft(prev => ({...prev, contact_person: text}))}
          />

          <Text style={styles.inputLabel}>联系电话</Text>
          <TextInput
            style={styles.input}
            placeholder="填写联系电话"
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={text => setDraft(prev => ({...prev, contact_phone: text}))}
          />

          <Text style={styles.inputLabel}>联系邮箱</Text>
          <TextInput
            style={styles.input}
            placeholder="选填，用于接收企业审核等通知"
            keyboardType="email-address"
            autoCapitalize="none"
            value={draft.contact_email}
            onChangeText={text => setDraft(prev => ({...prev, contact_email: text}))}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>默认地址</Text>
          <Text style={styles.sectionDesc}>可作为发布需求、直达下单时的默认起运/送达地址。</Text>

          <Text style={styles.inputLabel}>默认起运地址</Text>
          <AddressInputField
            value={pickupAddress}
            placeholder="点击选择默认起运地址"
            onSelect={address => {
              setPickupAddress(address);
              setDraft(prev => ({...prev, default_pickup_address: address.address || address.name || ''}));
            }}
          />

          <Text style={styles.inputLabel}>默认送达地址</Text>
          <AddressInputField
            value={deliveryAddress}
            placeholder="点击选择默认送达地址"
            onSelect={address => {
              setDeliveryAddress(address);
              setDraft(prev => ({...prev, default_delivery_address: address.address || address.name || ''}));
            }}
          />
        </ObjectCard>

        <ObjectCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>常用任务场景</Text>
          <Text style={styles.sectionDesc}>帮助我们在市场、推荐和筛选里更早给你匹配合适的服务方。</Text>
          <View style={styles.chipRow}>
            {sceneOptions.map(scene => {
              const active = draft.preferred_cargo_types.includes(scene);
              return (
                <TouchableOpacity
                  key={scene}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleScene(scene)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{scene}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ObjectCard>

        {client.client_type === 'enterprise' ? (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>企业资质</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>企业名称</Text>
              <Text style={styles.infoValue}>{client.company_name || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>统一社会信用代码</Text>
              <Text style={styles.infoValue}>{client.business_license_no || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>法定代表人</Text>
              <Text style={styles.infoValue}>{client.legal_representative || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>企业审核状态</Text>
              <StatusBadge
                label={(VERIFY_STATUS_MAP[client.enterprise_verified] || {label: '未提交', tone: 'gray'}).label}
                tone={(VERIFY_STATUS_MAP[client.enterprise_verified] || {label: '未提交', tone: 'gray'}).tone as any}
              />
            </View>
          </ObjectCard>
        ) : (
          <ObjectCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>企业客户升级</Text>
            <Text style={styles.sectionDesc}>如果你后续要以公司名义发布需求、管理对公资料和信用主体，可在这里升级企业客户资质。</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('ClientRegister', {mode: 'enterprise'})}>
              <Text style={styles.secondaryButtonText}>去做企业升级</Text>
            </TouchableOpacity>
          </ObjectCard>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryOutline} onPress={() => navigation.navigate('CargoDeclaration')}>
            <Text style={styles.secondaryOutlineText}>货物申报</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? '保存中...' : '保存客户档案'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f8',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
  },
  heroCard: {
    backgroundColor: '#0f3f88',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  heroBadges: {
    gap: 8,
    alignItems: 'flex-end',
  },
  accountMeta: {
    marginTop: 18,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  accountPhone: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  summaryItem: {
    width: '23%',
    minWidth: 68,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  sectionCard: {
    gap: 12,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#102a43',
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748b',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#52606d',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#102a43',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334e68',
  },
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#edf2f7',
  },
  chipActive: {
    backgroundColor: '#dbeafe',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#486581',
  },
  chipTextActive: {
    color: '#1d4ed8',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#175cd3',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  secondaryButton: {
    borderRadius: 12,
    backgroundColor: '#e8f1ff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#175cd3',
  },
  secondaryOutline: {
    minWidth: 124,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  secondaryOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334e68',
  },
});
