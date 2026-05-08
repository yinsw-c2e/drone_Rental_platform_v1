import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import { pilotV2Service } from '../../../services/pilotV2';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

export default function BindDronePage() {
  const [bindings, setBindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [note, setNote] = useState('');

  useDidShow(() => {
    pilotV2Service.listOwnerBindings({}).then(res => {
      setBindings((res as any).items || []);
    }).catch(() => setBindings([])).finally(() => setLoading(false));
  });

  const handleApply = async () => {
    if (!ownerUserId.trim()) { Taro.showToast({ title: '请填写机主账号编号', icon: 'none' }); return; }
    setSubmitting(true);
    try {
      await pilotV2Service.applyOwnerBinding({ owner_user_id: Number(ownerUserId), note: note.trim() || undefined });
      setOwnerUserId('');
      setNote('');
      Taro.showToast({ title: '绑定申请已提交', icon: 'success' });
    } catch (e: any) { Taro.showToast({ title: e.message || '申请失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const statusMeta: Record<string, { label: string; tone: string }> = {
    pending_confirmation: { label: '待确认', tone: '#FA8C16' },
    active: { label: '合作中', tone: '#52C41A' },
    paused: { label: '已暂停', tone: '#9CA3AF' },
  };

  return (
    <ScrollView scrollY className="bd-wrap">
      {/* ── Hero ── */}
      <View className="page-hero bd-hero">
        <Text className="page-hero-title">绑定无人机</Text>
        <Text className="bd-hero-sub">与机主建立合作关系，绑定无人机设备</Text>
      </View>

      {/* ── 申请绑定 ── */}
      <View className="card">
        <Text className="section-title">申请绑定机主</Text>
        <Text className="bd-desc">输入机主账号编号发起绑定申请</Text>
        <Input className="bd-input" type="number" placeholder="机主账号编号" value={ownerUserId} onInput={e => setOwnerUserId(e.detail.value)} />
        <Input className="bd-input bd-input-textarea" placeholder="申请说明（选填）" value={note} onInput={e => setNote(e.detail.value)} />
        <View className={`bd-submit-btn ${submitting ? 'bd-btn-disabled' : ''}`} onClick={handleApply}>
          <Text className="bd-submit-text">{submitting ? '提交中...' : '申请绑定'}</Text>
        </View>
      </View>

      {/* ── 绑定列表 ── */}
      <Text className="section-title">已绑定的无人机</Text>
      {loading ? <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
       : bindings.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-state-icon">🛩️</Text>
          <Text className="empty-state-text">暂无绑定</Text>
        </View>
      ) : bindings.map(b => {
        const meta = statusMeta[b.status] || { label: formatUnknownEnumLabel(b.status, '状态未知'), tone: '#9CA3AF' };
        return (
          <View key={b.id} className="list-item">
            <View className="list-item-header">
              <View>
                <Text className="list-item-title">{b.owner?.nickname || `机主#${b.owner_user_id}`}</Text>
                <Text className="list-item-meta-text">状态: {meta.label}</Text>
              </View>
              <Text className="status-badge" style={{ backgroundColor: meta.tone }}>{meta.label}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
