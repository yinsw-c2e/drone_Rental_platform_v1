import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import DateTimeField from '../../components/DateTimeField';
import { formatUnknownEnumLabel } from '../../utils';
import './index.scss';

const CERT_TYPES = [
  { label: '无犯罪记录证明', value: 'criminal_check' },
  { label: '健康证明', value: 'health_check' },
  { label: 'CAAC 执照', value: 'caac_license' },
  { label: 'AOPA 合格证', value: 'aopa_cert' },
  { label: 'UTC 操控师证', value: 'utc_cert' },
  { label: '培训结业证书', value: 'training_cert' },
  { label: '保险证明', value: 'insurance' },
  { label: '其他资质', value: 'other' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: '#FA8C16' },
  verified: { label: '已认证', color: '#52C41A' },
  rejected: { label: '已拒绝', color: '#F5222D' },
};

export default function CertificationPage() {
  const [certifications, setCertifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [certType, setCertType] = useState('other');
  const [certNo, setCertNo] = useState('');
  const [certName, setCertName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expireDate, setExpireDate] = useState('');

  useDidShow(() => {
    // Placeholder: certifications would be loaded from service
    setCertifications([]);
    setLoading(false);
  });

  const getCertTypeLabel = (type: string) => CERT_TYPES.find(t => t.value === type)?.label || formatUnknownEnumLabel(type, '其他资质');

  const handleSubmit = async () => {
    if (!certNo.trim()) { Taro.showToast({ title: '请输入证书编号', icon: 'none' }); return; }
    if (!certName.trim()) { Taro.showToast({ title: '请输入证书名称', icon: 'none' }); return; }
    if (certType !== 'health_check' && certType !== 'criminal_check' && (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate))) { Taro.showToast({ title: '请选择发证日期', icon: 'none' }); return; }
    if (certType !== 'criminal_check' && (!expireDate || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate))) { Taro.showToast({ title: '请选择有效期', icon: 'none' }); return; }

    setSubmitting(true);
    try {
      // submitCertification API
      Taro.showToast({ title: '证书已提交', icon: 'success' });
      setShowForm(false);
      resetForm();
    } catch (e: any) { Taro.showToast({ title: e.message || '提交失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setCertType('other');
    setCertNo('');
    setCertName('');
    setIssuer('');
    setIssueDate('');
    setExpireDate('');
  };

  if (loading) {
    return <View className="cert-wrap"><View className="empty-state"><Text className="empty-state-text">加载中...</Text></View></View>;
  }

  return (
    <View className="cert-wrap">
      {showForm ? (
        <ScrollView scrollY className="cert-scroll">
          <View className="card">
            <Text className="section-title">添加证书</Text>

            <Text className="cert-label">证书类型</Text>
            <ScrollView scrollX className="cert-type-scroll">
              <View className="cert-type-row">
                {CERT_TYPES.map(type => (
                  <View key={type.value} className={`cert-type-btn ${certType === type.value ? 'cert-type-active' : ''}`}
                    onClick={() => setCertType(type.value)}>
                    <Text className={`cert-type-text ${certType === type.value ? 'cert-type-text-active' : ''}`}>{type.label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {certType === 'criminal_check' ? (
              <View className="cert-tip">
                <Text className="cert-tip-text">请上传有效的无犯罪记录证明文件，用于增强您的信用背书。</Text>
              </View>
            ) : certType === 'health_check' ? (
              <View>
                <DateTimeField label="有效期至" value={expireDate} onChange={setExpireDate} mode="date" required />
              </View>
            ) : (
              <View>
                <Text className="cert-label">证书名称 *</Text>
                <Input className="cert-input" placeholder="请输入证书全称" value={certName} onInput={e => setCertName(e.detail.value)} />
                <Text className="cert-label">证书编号 *</Text>
                <Input className="cert-input" placeholder="如：C12345678" value={certNo} onInput={e => setCertNo(e.detail.value)} />
                <Text className="cert-label">发证机关 *</Text>
                <Input className="cert-input" placeholder="请输入签发机构" value={issuer} onInput={e => setIssuer(e.detail.value)} />
                <View className="cert-date-row">
                  <View style={{ flex: 1 }}>
                    <DateTimeField label="发证日期" value={issueDate} onChange={setIssueDate} mode="date" required />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DateTimeField label="有效期至" value={expireDate} onChange={setExpireDate} mode="date" required />
                  </View>
                </View>
              </View>
            )}

            <View className="cert-actions">
              <View className="cert-btn-ghost" onClick={() => setShowForm(false)}>
                <Text className="cert-btn-ghost-text">取消</Text>
              </View>
              <View className={`cert-btn-primary ${submitting ? 'cert-btn-disabled' : ''}`} onClick={handleSubmit}>
                <Text className="cert-btn-primary-text">{submitting ? '提交中...' : '提交证书资料'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView scrollY className="cert-scroll">
          {/* 添加按钮 */}
          <View className="cert-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
            <View className="cert-add-icon-wrap"><Text className="cert-add-icon">+</Text></View>
            <Text className="cert-add-text">添加新证书</Text>
          </View>

          {certifications.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-state-icon">📄</Text>
              <Text className="empty-state-text">暂无证书记录</Text>
            </View>
          ) : certifications.map(cert => {
            const status = STATUS_MAP[cert.verification_status] || STATUS_MAP.pending;
            return (
              <View key={cert.id} className="card">
                <View className="cert-card-header">
                  <Text className="cert-card-type">{getCertTypeLabel(cert.cert_type)}</Text>
                  <Text className="status-badge" style={{ backgroundColor: status.color }}>{status.label}</Text>
                </View>
                <View className="detail-row">
                  <Text className="detail-row-label">证书名称</Text>
                  <Text className="detail-row-value">{cert.cert_name || '-'}</Text>
                </View>
                <View className="detail-row">
                  <Text className="detail-row-label">证书编号</Text>
                  <Text className="detail-row-value">{cert.cert_no || '-'}</Text>
                </View>
                <View className="detail-row" style={{ borderBottomWidth: 0 }}>
                  <Text className="detail-row-label">有效期至</Text>
                  <Text className="detail-row-value">{cert.expire_date?.substring(0, 10) || '-'}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
