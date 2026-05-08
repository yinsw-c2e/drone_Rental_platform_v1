import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import { ownerService } from '../../../services/owner';
import { formatUnknownEnumLabel } from '../../../utils';
import './index.scss';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending_confirmation', label: '待确认' },
  { key: 'active', label: '合作中' },
  { key: 'paused', label: '已暂停' },
];

const statusMeta: Record<string, { label: string; tone: string }> = {
  pending_confirmation: { label: '待确认', tone: '#FA8C16' },
  active: { label: '合作中', tone: '#52C41A' },
  paused: { label: '已暂停', tone: '#9CA3AF' },
  dissolved: { label: '已解除', tone: '#9CA3AF' },
};

export default function BindPilotPage() {
  const [bindings, setBindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [pilotUserId, setPilotUserId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await ownerService.listPilotBindings({
        page: 1, page_size: 100,
        status: activeFilter === 'all' ? undefined : activeFilter,
      });
      setBindings((res as any).items || []);
    } catch {} finally { setLoading(false); }
  }, [activeFilter]);

  useDidShow(() => { loadData(); });

  const handleInvite = async () => {
    if (!pilotUserId.trim()) { Taro.showToast({ title: '请填写飞手账号编号', icon: 'none' }); return; }
    setSubmitting(true);
    try {
      await ownerService.invitePilotBinding({ pilot_user_id: Number(pilotUserId), note: note.trim() || undefined, is_priority: true });
      setPilotUserId('');
      setNote('');
      Taro.showToast({ title: '邀请已发送', icon: 'success' });
      loadData();
    } catch (e: any) { Taro.showToast({ title: e.message || '发送失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const handleAction = async (binding: any, action: string) => {
    try {
      if (action === 'confirm') await ownerService.confirmPilotBinding(binding.id);
      else if (action === 'reject') await ownerService.rejectPilotBinding(binding.id);
      else await ownerService.updatePilotBindingStatus(binding.id, action);
      loadData();
    } catch (e: any) { Taro.showToast({ title: e.message, icon: 'none' }); }
  };

  return (
    <ScrollView scrollY className="bp-wrap">
      {/* ── Hero ── */}
      <View className="page-hero bp-hero">
        <Text className="page-hero-title">绑定飞手</Text>
        <Text className="bp-hero-sub">长期合作关系从这里管理</Text>
      </View>

      {/* ── 邀请飞手 ── */}
      <View className="card">
        <Text className="section-title">邀请飞手</Text>
        <Text className="bp-desc">输入对方账号编号发起邀请，确认后即可建立长期合作。</Text>
        <Input className="bp-input" type="number" placeholder="飞手账号编号" value={pilotUserId} onInput={e => setPilotUserId(e.detail.value)} />
        <Input className="bp-input bp-input-textarea" placeholder="合作说明（选填）" value={note} onInput={e => setNote(e.detail.value)} />
        <View className={`bp-invite-btn ${submitting ? 'bp-btn-disabled' : ''}`} onClick={handleInvite}>
          <Text className="bp-invite-text">{submitting ? '发送中...' : '发送邀请'}</Text>
        </View>
      </View>

      {/* ── 筛选标签 ── */}
      <View className="filter-tabs">
        {FILTERS.map(f => (
          <View key={f.key} className={`filter-tab ${activeFilter === f.key ? 'filter-tab-active' : ''}`}
            onClick={() => { setActiveFilter(f.key); setLoading(true); }}>
            <Text>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* ── 绑定列表 ── */}
      {loading ? <View className="empty-state"><Text className="empty-state-text">加载中...</Text></View>
       : bindings.length === 0 ? (
        <View className="empty-state">
          <Text className="empty-state-icon">🤝</Text>
          <Text className="empty-state-text">暂无绑定关系</Text>
        </View>
      ) : bindings.map(b => {
        const meta = statusMeta[b.status] || { label: formatUnknownEnumLabel(b.status, '状态未知'), tone: '#9CA3AF' };
        const pilotName = b.pilot?.nickname || `飞手 ${b.pilot_user_id}`;
        return (
          <View key={b.id} className="list-item">
            <View className="list-item-header">
              <View>
                <Text className="list-item-title">{pilotName}</Text>
                <Text className="list-item-meta-text">发起方：{b.initiated_by === 'owner' ? '机主邀请' : '飞手申请'}</Text>
              </View>
              <Text className="status-badge" style={{ backgroundColor: meta.tone }}>{meta.label}</Text>
            </View>
            <Text style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{b.note || '未填写合作说明。'}</Text>
            <View className="bp-actions">
              {b.status === 'pending_confirmation' && (
                <View>
                  <View className="bp-action-ghost" onClick={() => handleAction(b, 'reject')}><Text className="bp-action-ghost-text">拒绝</Text></View>
                  <View className="bp-action-primary" onClick={() => handleAction(b, 'confirm')}><Text className="bp-action-primary-text">确认合作</Text></View>
                </View>
              )}
              {b.status === 'active' && (
                <View>
                  <View className="bp-action-ghost" onClick={() => handleAction(b, 'paused')}><Text className="bp-action-ghost-text">暂停</Text></View>
                  <View className="bp-action-primary" onClick={() => handleAction(b, 'dissolved')}><Text className="bp-action-primary-text">解除</Text></View>
                </View>
              )}
              {b.status === 'paused' && (
                <View>
                  <View className="bp-action-ghost" onClick={() => handleAction(b, 'dissolved')}><Text className="bp-action-ghost-text">解除</Text></View>
                  <View className="bp-action-primary" onClick={() => handleAction(b, 'active')}><Text className="bp-action-primary-text">恢复合作</Text></View>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
