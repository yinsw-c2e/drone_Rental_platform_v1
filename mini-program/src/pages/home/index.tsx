import { useDidShow } from '@tarojs/taro';
import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { HaulRoleMode, readStoredRoleMode, setHaulRoleMode } from '../../store/slices/roleSlice';
import { getEffectiveRoleSummary, resolveProviderCapabilities } from '../../utils/roleSummary';
import CustomerHaulHome from './CustomerHaulHome';
import ProviderWorkbench from './ProviderWorkbench';

function RoleHomePage() {
  const dispatch = useDispatch();
  const reduxMode = useSelector((state: RootState) => state.role.selectedMode);
  const roleSummary = useSelector((state: RootState) => state.auth.roleSummary);
  const providerCapabilities = useMemo(
    () => resolveProviderCapabilities(getEffectiveRoleSummary(roleSummary)),
    [roleSummary],
  );

  const storedMode = readStoredRoleMode();
  // 账号未申请过服务商资质时,任何 provider 残留都视为 customer,避免身份与页面错位
  const effectiveMode: HaulRoleMode = storedMode === 'provider' && providerCapabilities.hasProviderApplication
    ? 'provider'
    : 'customer';

  useEffect(() => {
    if (effectiveMode !== storedMode) {
      dispatch(setHaulRoleMode(effectiveMode));
      return;
    }
    if (effectiveMode !== reduxMode) {
      dispatch(setHaulRoleMode(effectiveMode));
    }
  }, [effectiveMode, storedMode, reduxMode, dispatch]);

  useDidShow(() => {
    const current = readStoredRoleMode();
    const next: HaulRoleMode = current === 'provider' && providerCapabilities.hasProviderApplication
      ? 'provider'
      : 'customer';
    if (next !== current) {
      dispatch(setHaulRoleMode(next));
      return;
    }
    if (next !== reduxMode) dispatch(setHaulRoleMode(next));
  });

  if (effectiveMode === 'provider') {
    return <ProviderWorkbench />;
  }

  return <CustomerHaulHome />;
}

export default RoleHomePage;
