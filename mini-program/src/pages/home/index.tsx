import { useRouter } from '@tarojs/taro';
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState, useAppDispatch } from '../../store/store';
import { setHaulRoleMode } from '../../store/slices/roleSlice';
import CustomerHaulHome from './CustomerHaulHome';
import ProviderWorkbench from './ProviderWorkbench';

function RoleHomePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);
  const forcedMode = router.params?.mode === 'provider' ? 'provider' : selectedMode;

  useEffect(() => {
    if (router.params?.mode === 'provider' && selectedMode !== 'provider') {
      dispatch(setHaulRoleMode('provider'));
    }
  }, [dispatch, router.params?.mode, selectedMode]);

  if (forcedMode === 'provider') {
    return <ProviderWorkbench />;
  }

  return <CustomerHaulHome />;
}

export default RoleHomePage;
