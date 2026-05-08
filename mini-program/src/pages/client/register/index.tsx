import Taro from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import { registerEnterprise } from '../../../services/client';
import './index.scss';

export default function ClientRegisterPage() {
  const [companyName, setCompanyName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [legalRep, setLegalRep] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!companyName.trim()) { Taro.showToast({ title: '请输入企业名称', icon: 'none' }); return; }
    if (!licenseNo.trim()) { Taro.showToast({ title: '请输入统一社会信用代码', icon: 'none' }); return; }

    setSubmitting(true);
    try {
      await registerEnterprise({
        company_name: companyName.trim(),
        business_license_no: licenseNo.trim(),
        business_license_doc: '',
        legal_representative: legalRep.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
      });
      Taro.showToast({ title: '企业升级申请已提交', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 1500);
    } catch (e: any) { Taro.showToast({ title: e.message || '提交失败', icon: 'none' }); }
    finally { setSubmitting(false); }
  };

  return (
    <ScrollView scrollY className="cr-wrap">
      {/* ── Hero ── */}
      <View className="page-hero cr-hero">
        <Text className="page-hero-title">企业客户升级</Text>
        <Text className="cr-hero-sub">个人客户档案已默认开通。这里仅用于升级企业资质。</Text>
      </View>

      {/* ── 升级后权益 ── */}
      <View className="card">
        <Text className="section-title">升级后你会得到什么</Text>
        <Text className="cr-bullet">1. 以企业主体发布需求和沉淀信用档案</Text>
        <Text className="cr-bullet">2. 对公联系人、企业名称、营业资质集中管理</Text>
        <Text className="cr-bullet">3. 后续便于拓展企业结算、审计和运营能力</Text>
      </View>

      {/* ── 企业资料 ── */}
      <View className="card">
        <Text className="section-title">企业资料</Text>

        <Text className="cr-label">企业名称 *</Text>
        <Input className="cr-input" placeholder="请输入企业全称" value={companyName} onInput={e => setCompanyName(e.detail.value)} />

        <Text className="cr-label">统一社会信用代码 *</Text>
        <Input className="cr-input" placeholder="18 位统一社会信用代码" value={licenseNo} onInput={e => setLicenseNo(e.detail.value)} />

        <Text className="cr-label">法定代表人</Text>
        <Input className="cr-input" placeholder="选填" value={legalRep} onInput={e => setLegalRep(e.detail.value)} />
      </View>

      {/* ── 企业联系人 ── */}
      <View className="card">
        <Text className="section-title">企业联系人</Text>

        <Text className="cr-label">联系人</Text>
        <Input className="cr-input" placeholder="建议填写后续业务联系人" value={contactPerson} onInput={e => setContactPerson(e.detail.value)} />

        <Text className="cr-label">联系电话</Text>
        <Input className="cr-input" type="number" placeholder="选填" value={contactPhone} onInput={e => setContactPhone(e.detail.value)} />

        <Text className="cr-label">联系邮箱</Text>
        <Input className="cr-input" placeholder="选填" value={contactEmail} onInput={e => setContactEmail(e.detail.value)} />
      </View>

      {/* ── 提交按钮 ── */}
      <View className={`cr-submit-btn ${submitting ? 'cr-submit-disabled' : ''}`} onClick={handleSubmit}>
        <Text className="cr-submit-text">{submitting ? '提交中...' : '提交企业升级'}</Text>
      </View>
    </ScrollView>
  );
}
