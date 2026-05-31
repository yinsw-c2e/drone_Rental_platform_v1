import Taro from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import {
  HaulRoleMode,
  setHaulRoleMode,
} from '../../../store/slices/roleSlice';
import logoHaul from '../../../assets/haul/logo_haul_square.png';
import customerLift from '../../../assets/haul/ill_mode_customer_lift.png';
import providerOrder from '../../../assets/haul/ill_mode_provider_order.png';
import chevronRightIcon from '../../../assets/haul/icon_chevron_right.png';
import shieldIcon from '../../../assets/haul/icon_shield.png';
import wechatIcon from '../../../assets/haul/icon_wechat.png';
import { performWeChatLogin } from '../../../utils/wechatLogin';
import { syncPreferredModeWithBackend } from '../../../utils/preferredMode';
import './index.scss';

type RoleOption = {
  key: HaulRoleMode;
  title: string;
  badge?: string;
  desc: string;
  image: string;
};

const roleOptions: RoleOption[] = [
  {
    key: 'customer',
    title: '我要吊运',
    badge: '推荐',
    desc: '发布吊运需求，获取服务商方案',
    image: customerLift,
  },
  {
    key: 'provider',
    title: '我要接单',
    desc: '服务商入驻，报价接单，管理履约',
    image: providerOrder,
  },
];

export default function ModeSelectionPage() {
  const [brandTop, setBrandTop] = useState(109);
  const [wechatSubmitting, setWechatSubmitting] = useState(false);
  const hasRedirectedRef = useRef(false);
  const dispatch = useDispatch();
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync();
      const menuInfo = Taro.getMenuButtonBoundingClientRect();
      const windowWidth = systemInfo.windowWidth || 375;
      const rpxPerPx = 750 / windowWidth;

      if (menuInfo?.bottom) {
        setBrandTop(Math.round(menuInfo.bottom * rpxPerPx + 24));
      }
    } catch {
      setBrandTop(109);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    Taro.switchTab({ url: '/pages/home/index' }).catch(() => {
      Taro.reLaunch({ url: '/pages/home/index' });
    });
  }, [isAuthenticated]);

  const selectMode = (mode: HaulRoleMode) => {
    dispatch(setHaulRoleMode(mode));
    // 若已登录,把意向身份同步到后端;未登录则会在登录/注册完成后自动重新同步。
    syncPreferredModeWithBackend(mode);
  };

  const openLogin = () => {
    Taro.navigateTo({ url: `/pages/auth/login/index?roleMode=${selectedMode}` });
  };

  const openRegister = () => {
    Taro.navigateTo({ url: `/pages/auth/register/index?roleMode=${selectedMode}` });
  };

  const handleWeChatLogin = () => {
    if (wechatSubmitting) return;
    performWeChatLogin({
      dispatch,
      mode: selectedMode,
      beginSubmit: () => setWechatSubmitting(true),
      endSubmit: () => setWechatSubmitting(false),
    });
  };

  return (
    <View className='mode-page'>
      <ScrollView scrollY className='mode-scroll'>
        <View className='mode-content' style={{ paddingTop: `${brandTop}rpx` }}>
          <View className='mode-brand-row'>
            <Image className='mode-logo' src={logoHaul} mode='aspectFit' />
            <View>
              <Text className='mode-brand-title'>重载吊运</Text>
              <Text className='mode-brand-sub'>无人机吊运服务平台</Text>
            </View>
          </View>

          <View className='mode-hero-copy'>
            <Text className='mode-hero-title'>欢迎使用</Text>
            <Text className='mode-hero-sub'>请选择你要做什么</Text>
          </View>

          <View className='mode-role-list'>
            {roleOptions.map(option => {
              const selected = option.key === selectedMode;
              return (
                <View
                  key={option.key}
                  className={`mode-role-card mode-role-card-${option.key} ${selected ? 'is-selected' : 'is-inactive'}`}
                  onClick={() => selectMode(option.key)}
                >
                  <Image className='mode-role-image' src={option.image} mode='aspectFit' />
                  <Text className='mode-role-title'>{option.title}</Text>
                  {option.badge ? (
                    <View className='mode-role-badge'>
                      <Text className='mode-role-badge-text'>{option.badge}</Text>
                    </View>
                  ) : null}
                  <Text className='mode-role-desc'>{option.desc}</Text>
                  <Image className='mode-chevron' src={chevronRightIcon} mode='aspectFit' />
                </View>
              );
            })}
          </View>

          <View
            onClick={openRegister}
            className='mode-primary-button'
          >
            <Text className='mode-primary-text'>新账号注册</Text>
          </View>

          <View className='mode-login-row'>
            <Text className='mode-login-hint'>已有账号？</Text>
            <Text className='mode-login-link' onClick={openLogin}>立即登录</Text>
          </View>

          <View className='mode-wechat-button' onClick={handleWeChatLogin}>
            <Image className='mode-wechat-icon' src={wechatIcon} mode='aspectFit' />
            <Text className='mode-wechat-text'>{wechatSubmitting ? '正在登录…' : '微信一键登录'}</Text>
          </View>

          <View className='mode-footer'>
            <Image className='mode-footer-icon' src={shieldIcon} mode='aspectFit' />
            <Text className='mode-footer-text'>
              平台提供资质核验、保险保障与空域辅助检测
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
