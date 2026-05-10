import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState } from 'react';
import { View, Text, ScrollView, Input, Image } from '@tarojs/components';
import DateTimeField from '../../../components/DateTimeField';
import api from '../../../services/api';
import { API_V1_BASE_URL } from '../../../constants';
import './index.scss';

const IMAGE_BASE_URL = API_V1_BASE_URL;

export default function DroneCertificationPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const droneId = Number(params.id || 0);

  const [activeTab, setActiveTab] = useState<'uom' | 'insurance' | 'airworthiness'>('uom');
  const [loading, setLoading] = useState(false);

  // Forms
  const [uomRegNo, setUomRegNo] = useState('');
  const [uomDoc, setUomDoc] = useState('');

  const [insPolicyNo, setInsPolicyNo] = useState('');
  const [insCompany, setInsCompany] = useState('');
  const [insCoverage, setInsCoverage] = useState('');
  const [insExpiry, setInsExpiry] = useState('');
  const [insDoc, setInsDoc] = useState('');

  const [airCertNo, setAirCertNo] = useState('');
  const [airExpiry, setAirExpiry] = useState('');
  const [airDoc, setAirDoc] = useState('');

  const uploadDoc = async (setter: (url: string) => void) => {
    try {
      const res = await Taro.chooseImage({ count: 1 });
      if (!res.tempFilePaths.length) return;
      Taro.showLoading({ title: '上传中' });
      const uploadRes = await Taro.uploadFile({
        url: `${IMAGE_BASE_URL}/drone/upload`,
        filePath: res.tempFilePaths[0],
        name: 'files',
        header: { 'Authorization': `Bearer ${Taro.getStorageSync('token')}` }
      });
      const data = JSON.parse(uploadRes.data);
      if (data.data?.urls?.[0]) {
        const u = data.data.urls[0];
        setter(u.startsWith('http') ? u : `${IMAGE_BASE_URL.replace('/api/v1', '')}${u}`);
      }
      Taro.hideLoading();
    } catch (e) {
      Taro.hideLoading();
      Taro.showToast({ title: '上传失败', icon: 'none' });
    }
  };

  const submitUom = async () => {
    if (!uomRegNo || !uomDoc) return Taro.showToast({ title: '请填写并上传', icon: 'none' });
    setLoading(true);
    try {
      await api.post(`/drone/${droneId}/uom`, { registration_no: uomRegNo.trim(), registration_doc: uomDoc });
      Taro.showToast({ title: '提交成功', icon: 'success' });
    } catch (e: any) { Taro.showToast({ title: '提交失败', icon: 'none' }); }
    finally { setLoading(false); }
  };

  const submitInsurance = async () => {
    if (!insPolicyNo || !insDoc) return Taro.showToast({ title: '请填写并上传', icon: 'none' });
    setLoading(true);
    try {
      await api.post(`/drone/${droneId}/insurance`, {
        policy_no: insPolicyNo.trim(),
        company_name: insCompany.trim(),
        coverage_amount: Number(insCoverage) * 100,
        expiry_date: insExpiry ? new Date(insExpiry).toISOString() : null,
        policy_doc: insDoc
      });
      Taro.showToast({ title: '提交成功', icon: 'success' });
    } catch (e: any) { Taro.showToast({ title: '提交失败', icon: 'none' }); }
    finally { setLoading(false); }
  };

  const submitAir = async () => {
    if (!airCertNo || !airDoc) return Taro.showToast({ title: '请填写并上传', icon: 'none' });
    setLoading(true);
    try {
      await api.post(`/drone/${droneId}/airworthiness`, {
        certificate_no: airCertNo.trim(),
        expiry_date: airExpiry ? new Date(airExpiry).toISOString() : null,
        certificate_doc: airDoc
      });
      Taro.showToast({ title: '提交成功', icon: 'success' });
    } catch (e: any) { Taro.showToast({ title: '提交失败', icon: 'none' }); }
    finally { setLoading(false); }
  };

  return (
    <View className="page-wrap">
      <View className="tabs-header">
        <View className={`tab-item ${activeTab === 'uom' ? 'active' : ''}`} onClick={() => setActiveTab('uom')}><Text className="tab-text">UOM实名</Text></View>
        <View className={`tab-item ${activeTab === 'insurance' ? 'active' : ''}`} onClick={() => setActiveTab('insurance')}><Text className="tab-text">保险信息</Text></View>
        <View className={`tab-item ${activeTab === 'airworthiness' ? 'active' : ''}`} onClick={() => setActiveTab('airworthiness')}><Text className="tab-text">适航证明</Text></View>
      </View>

      <ScrollView scrollY className="tab-content">
        {activeTab === 'uom' && (
          <View className="form-group">
            <View className="form-item"><Text className="form-label">登记号</Text><Input className="form-input" placeholder="UOM实名登记号码" value={uomRegNo} onInput={e => setUomRegNo(e.detail.value)} /></View>
            <View className="form-item border-none">
              <Text className="form-label">登记凭证</Text>
              {uomDoc ? <Image src={uomDoc} className="doc-image" onClick={() => uploadDoc(setUomDoc)} /> : <View className="btn-upload" onClick={() => uploadDoc(setUomDoc)}><Text>上传凭证</Text></View>}
            </View>
            <View className="btn-primary" onClick={submitUom} disabled={loading}><Text className="btn-text">提交 UOM 实名</Text></View>
          </View>
        )}

        {activeTab === 'insurance' && (
          <View className="form-group">
            <View className="form-item"><Text className="form-label">保单号</Text><Input className="form-input" placeholder="输入保单号" value={insPolicyNo} onInput={e => setInsPolicyNo(e.detail.value)} /></View>
            <View className="form-item"><Text className="form-label">保险公司</Text><Input className="form-input" placeholder="输入保险公司名称" value={insCompany} onInput={e => setInsCompany(e.detail.value)} /></View>
            <View className="form-item"><Text className="form-label">保额(元)</Text><Input className="form-input" type="digit" placeholder="输入保险额度" value={insCoverage} onInput={e => setInsCoverage(e.detail.value)} /></View>
            <View className="form-item form-date-item">
              <DateTimeField label="过期日期" value={insExpiry} onChange={setInsExpiry} mode="date" />
            </View>
            <View className="form-item border-none">
              <Text className="form-label">保单凭证</Text>
              {insDoc ? <Image src={insDoc} className="doc-image" onClick={() => uploadDoc(setInsDoc)} /> : <View className="btn-upload" onClick={() => uploadDoc(setInsDoc)}><Text>上传凭证</Text></View>}
            </View>
            <View className="btn-primary" onClick={submitInsurance} disabled={loading}><Text className="btn-text">提交保险信息</Text></View>
          </View>
        )}

        {activeTab === 'airworthiness' && (
          <View className="form-group">
            <View className="form-item"><Text className="form-label">证书编号</Text><Input className="form-input" placeholder="输入适航证编号" value={airCertNo} onInput={e => setAirCertNo(e.detail.value)} /></View>
            <View className="form-item form-date-item">
              <DateTimeField label="过期日期" value={airExpiry} onChange={setAirExpiry} mode="date" />
            </View>
            <View className="form-item border-none">
              <Text className="form-label">证明文件</Text>
              {airDoc ? <Image src={airDoc} className="doc-image" onClick={() => uploadDoc(setAirDoc)} /> : <View className="btn-upload" onClick={() => uploadDoc(setAirDoc)}><Text>上传文件</Text></View>}
            </View>
            <View className="btn-primary" onClick={submitAir} disabled={loading}><Text className="btn-text">提交适航证明</Text></View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
