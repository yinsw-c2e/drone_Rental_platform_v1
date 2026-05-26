import React from 'react';
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {haulAssets} from '../../assets/haul';
import {RootState} from '../../store/store';
import {HaulRoleMode, setHaulRoleMode} from '../../store/slices/roleSlice';

const DESIGN_WIDTH = 941;
const DESIGN_HEIGHT = 1672;

export default function ModeSelectionScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const styles = React.useMemo(
    () => createStyles(width / DESIGN_WIDTH, height, insets.bottom),
    [height, insets.bottom, width],
  );
  const dispatch = useDispatch();
  const selectedMode = useSelector(
    (state: RootState) => state.role.selectedMode,
  );

  const handleSelect = (mode: HaulRoleMode) => {
    dispatch(setHaulRoleMode(mode));
  };

  const openLogin = () => {
    navigation.navigate('Login', {roleMode: selectedMode});
  };

  const openRegister = () => {
    navigation.navigate('Register', {roleMode: selectedMode});
  };

  return (
    <View style={styles.page}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <LinearGradient
        colors={['#FAFAFC', '#F6F8FB']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        bounces={false}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.canvas}>
          <Image source={haulAssets.logo} style={styles.logo} resizeMode="contain" />
          <Text allowFontScaling={false} style={styles.brandTitle}>
            重载吊运
          </Text>
          <Text allowFontScaling={false} style={styles.brandSub}>
            无人机吊运服务平台
          </Text>

          <Text allowFontScaling={false} style={styles.heroTitle}>
            欢迎使用
          </Text>
          <Text allowFontScaling={false} style={styles.heroSub}>
            请选择你要做什么
          </Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => handleSelect('customer')}
            style={[
              styles.customerCard,
              selectedMode !== 'customer' && styles.customerCardInactive,
            ]}>
            <Image
              source={haulAssets.customerLift}
              style={styles.customerImage}
              resizeMode="contain"
            />
            <Text allowFontScaling={false} style={styles.customerTitle}>
              我要吊运
            </Text>
            <View style={styles.badge}>
              <Text allowFontScaling={false} style={styles.badgeText}>
                推荐
              </Text>
            </View>
            <Text allowFontScaling={false} style={styles.customerDesc}>
              发布吊运需求，获取服务商方案
            </Text>
            <Image
              source={haulAssets.chevronRight}
              style={styles.customerChevron}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => handleSelect('provider')}
            style={[
              styles.providerCard,
              selectedMode === 'provider' && styles.providerCardSelected,
            ]}>
            <Image
              source={haulAssets.providerOrder}
              style={styles.providerImage}
              resizeMode="contain"
            />
            <Text allowFontScaling={false} style={styles.providerTitle}>
              我要接单
            </Text>
            <Text allowFontScaling={false} style={styles.providerDesc}>
              服务商入驻，报价接单，管理履约
            </Text>
            <Image
              source={haulAssets.chevronRight}
              style={styles.providerChevron}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={openRegister}
            style={styles.primaryButton}>
            <LinearGradient
              colors={['#0038A1', '#0644AD', '#023491']}
              start={{x: 0, y: 0.5}}
              end={{x: 1, y: 0.5}}
              style={styles.primaryGradient}>
              <Text allowFontScaling={false} style={styles.primaryText}>
                手机号登录 / 注册
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text allowFontScaling={false} style={styles.loginHint}>
            已有账号？
          </Text>
          <Text
            allowFontScaling={false}
            onPress={openLogin}
            style={styles.loginLink}>
            立即登录
          </Text>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={openLogin}
            style={styles.wechatButton}>
            <Image
              source={haulAssets.wechat}
              style={styles.wechatIcon}
              resizeMode="contain"
            />
            <Text allowFontScaling={false} style={styles.wechatText}>
              微信一键登录
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Image
              source={haulAssets.shield}
              style={styles.footerIcon}
              resizeMode="contain"
            />
            <Text allowFontScaling={false} style={styles.footerText}>
              平台提供资质核验、保险保障与空域辅助检测
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(scale: number, windowHeight: number, bottomInset: number) {
  const dp = (value: number) => Number((value * scale).toFixed(3));
  const font = (value: number) => Math.round(value * scale);
  const textBase = {
    includeFontPadding: false,
    letterSpacing: 0,
  };
  const canvasHeight = Math.max(windowHeight, dp(DESIGN_HEIGHT) + bottomInset);

  const absolute = (x: number, y: number, width: number, height: number) => ({
    position: 'absolute' as const,
    left: dp(x),
    top: dp(y),
    width: dp(width),
    height: dp(height),
  });

  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#F6F8FB',
    },
    scrollContent: {
      minHeight: canvasHeight,
    },
    canvas: {
      width: '100%',
      height: canvasHeight,
      minHeight: canvasHeight,
      position: 'relative',
    },
    logo: {
      ...absolute(40, 133, 120, 122),
      borderRadius: dp(20),
    },
    brandTitle: {
      ...textBase,
      position: 'absolute',
      left: dp(186),
      top: dp(149),
      color: '#071E5E',
      fontSize: font(48),
      lineHeight: dp(56),
      fontWeight: '800',
    },
    brandSub: {
      ...textBase,
      position: 'absolute',
      left: dp(187),
      top: dp(216),
      color: '#5B6A95',
      fontSize: font(31),
      lineHeight: dp(38),
      fontWeight: '400',
    },
    heroTitle: {
      ...textBase,
      position: 'absolute',
      left: dp(53),
      top: dp(346),
      color: '#03205C',
      fontSize: font(68),
      lineHeight: dp(82),
      fontWeight: '800',
    },
    heroSub: {
      ...textBase,
      position: 'absolute',
      left: dp(53),
      top: dp(463),
      color: '#4C5C87',
      fontSize: font(40),
      lineHeight: dp(48),
      fontWeight: '400',
    },
    customerCard: {
      ...absolute(44, 564, 852, 277),
      borderRadius: dp(22),
      borderWidth: Math.max(1, dp(2)),
      borderColor: '#FD5A04',
      backgroundColor: '#FFFDFC',
      shadowColor: '#FD5A04',
      shadowOffset: {width: 0, height: dp(12)},
      shadowOpacity: 0.1,
      shadowRadius: dp(30),
      elevation: 3,
    },
    customerCardInactive: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#D9E0EA',
      backgroundColor: '#FFFFFF',
      shadowColor: '#112E69',
      shadowOpacity: 0.08,
      shadowRadius: dp(24),
    },
    providerCard: {
      ...absolute(44, 878, 852, 252),
      borderRadius: dp(22),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#D9E0EA',
      backgroundColor: '#FFFFFF',
      shadowColor: '#112E69',
      shadowOffset: {width: 0, height: dp(10)},
      shadowOpacity: 0.08,
      shadowRadius: dp(24),
      elevation: 3,
    },
    providerCardSelected: {
      borderWidth: Math.max(1, dp(2)),
      borderColor: '#0B5FE8',
      backgroundColor: '#F7FAFF',
      shadowColor: '#0B5FE8',
      shadowOpacity: 0.1,
    },
    customerImage: {
      ...absolute(52, 50, 122, 192),
    },
    providerImage: {
      ...absolute(51, 55, 135, 139),
    },
    customerTitle: {
      ...textBase,
      position: 'absolute',
      left: dp(244),
      top: dp(83),
      color: '#061E5B',
      fontSize: font(44),
      lineHeight: dp(54),
      fontWeight: '700',
    },
    providerTitle: {
      ...textBase,
      position: 'absolute',
      left: dp(244),
      top: dp(70),
      color: '#061E5B',
      fontSize: font(44),
      lineHeight: dp(54),
      fontWeight: '700',
    },
    badge: {
      position: 'absolute',
      left: dp(475),
      top: dp(80),
      width: dp(89),
      height: dp(50),
      borderRadius: dp(8),
      backgroundColor: '#FD5A04',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      ...textBase,
      color: '#FFFFFF',
      fontSize: font(28),
      lineHeight: dp(34),
      fontWeight: '600',
    },
    customerDesc: {
      ...textBase,
      position: 'absolute',
      left: dp(243),
      top: dp(164),
      color: '#445885',
      fontSize: font(30),
      lineHeight: dp(38),
      fontWeight: '400',
    },
    providerDesc: {
      ...textBase,
      position: 'absolute',
      left: dp(243),
      top: dp(151),
      color: '#445885',
      fontSize: font(30),
      lineHeight: dp(38),
      fontWeight: '400',
    },
    customerChevron: {
      ...absolute(783, 119, 20, 34),
    },
    providerChevron: {
      ...absolute(783, 106, 20, 33),
    },
    primaryButton: {
      ...absolute(44, 1184, 852, 122),
      borderRadius: dp(18),
      shadowColor: '#0038A1',
      shadowOffset: {width: 0, height: dp(8)},
      shadowOpacity: 0.12,
      shadowRadius: dp(18),
      elevation: 3,
    },
    primaryGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: dp(18),
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      ...textBase,
      color: '#FFFFFF',
      fontSize: font(40),
      lineHeight: dp(48),
      fontWeight: '700',
    },
    loginHint: {
      ...textBase,
      position: 'absolute',
      left: dp(327),
      top: dp(1347),
      color: '#5B6A95',
      fontSize: font(29),
      lineHeight: dp(36),
      fontWeight: '400',
    },
    loginLink: {
      ...textBase,
      position: 'absolute',
      left: dp(491),
      top: dp(1348),
      color: '#024CFD',
      fontSize: font(29),
      lineHeight: dp(36),
      fontWeight: '500',
    },
    wechatButton: {
      ...absolute(44, 1415, 852, 88),
      borderRadius: dp(16),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#D4DBE8',
      backgroundColor: '#FFFFFF',
    },
    wechatIcon: {
      ...absolute(274, 20, 60, 45),
    },
    wechatText: {
      ...textBase,
      position: 'absolute',
      left: dp(353),
      top: dp(29),
      color: '#071E5E',
      fontSize: font(30),
      lineHeight: dp(36),
      fontWeight: '600',
    },
    footer: {
      ...absolute(44, 1541, 852, 60),
    },
    footerIcon: {
      ...absolute(104, 0, 42, 49),
    },
    footerText: {
      ...textBase,
      position: 'absolute',
      left: dp(166),
      top: dp(13),
      color: '#5D6B95',
      fontSize: font(27),
      lineHeight: dp(34),
      fontWeight: '400',
    },
  });
}
