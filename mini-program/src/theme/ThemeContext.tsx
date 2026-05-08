// Taro 小程序主题替代 React Native 的 ThemeContext
// 当前只做浅色模式，后续可扩展深色
import React, { createContext, useContext } from 'react';

export interface AppTheme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  card: string;
  cardBorder: string;
  text: string;
  textSub: string;
  textHint: string;
  primary: string;
  primaryBg: string;
  primaryText: string;
  primaryBorder: string;
  success: string;
  warning: string;
  danger: string;
  divider: string;
  tabBg: string;
  tabText: string;
  tabActiveBg: string;
  tabActiveText: string;
  navBg: string;
  navIconActive: string;
  navIconInactive: string;
  navBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  btnPrimary: string;
  btnPrimaryText: string;
  refreshColor: string;
  isDark: boolean;
}

export const lightTheme: AppTheme = {
  bg: '#F5F7FA',
  bgSecondary: '#F0F2F5',
  bgTertiary: '#EBEDF0',
  card: '#FFFFFF',
  cardBorder: '#E8ECF1',
  text: '#1A1D26',
  textSub: '#6B7280',
  textHint: '#9CA3AF',
  primary: '#1677FF',
  primaryBg: '#E6F4FF',
  primaryText: '#1677FF',
  primaryBorder: '#91CAFF',
  success: '#52C41A',
  warning: '#FA8C16',
  danger: '#F5222D',
  divider: '#EEEFF2',
  tabBg: '#F0F2F5',
  tabText: '#6B7280',
  tabActiveBg: '#FFFFFF',
  tabActiveText: '#1A1D26',
  navBg: '#FFFFFF',
  navIconActive: '#1677FF',
  navIconInactive: '#9CA3AF',
  navBorder: '#E8ECF1',
  inputBg: '#F9FAFB',
  inputBorder: '#E5E7EB',
  inputText: '#1A1D26',
  inputPlaceholder: '#9CA3AF',
  btnPrimary: '#1677FF',
  btnPrimaryText: '#FFFFFF',
  refreshColor: '#1677FF',
  isDark: false,
};

const ThemeContext = createContext<AppTheme>(lightTheme);

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeContext.Provider, { value: lightTheme }, children);
}
