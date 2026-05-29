import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import CustomerHaulHome from './CustomerHaulHome';
import ProviderWorkbench from './ProviderWorkbench';

function RoleHomePage() {
  const selectedMode = useSelector((state: RootState) => state.role.selectedMode);

  if (selectedMode === 'provider') {
    return <ProviderWorkbench />;
  }

  return <CustomerHaulHome />;
}

export default RoleHomePage;
