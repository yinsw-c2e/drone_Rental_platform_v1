import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTheme} from '../theme/ThemeContext';
import TabGlyph from '../components/navigation/TabGlyph';

import HomeScreen from '../screens/home/HomeScreen';
import MarketHubScreen from '../screens/market/MarketHubScreen';
import OrderListScreen from '../screens/order/OrderListScreen';
import OrderDetailScreen from '../screens/order/OrderDetailScreen';
import ConversationListScreen from '../screens/message/ConversationListScreen';
import ChatScreen from '../screens/message/ChatScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import OwnerProfileScreen from '../screens/owner/OwnerProfileScreen';
import OwnerPilotBindingsScreen from '../screens/owner/OwnerPilotBindingsScreen';

import MyOffersScreen from '../screens/profile/MyOffersScreen';
import MyDemandsScreen from '../screens/profile/MyDemandsScreen';
import VerificationScreen from '../screens/profile/VerificationScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import MyQuotesScreen from '../screens/profile/MyQuotesScreen';

import PublishOfferScreen from '../screens/publish/PublishOfferScreen';
import PublishDemandScreen from '../screens/publish/PublishDemandScreen';
import EditDemandScreen from '../screens/publish/EditDemandScreen';
import PublishCargoScreen from '../screens/publish/PublishCargoScreen';

import MyDronesScreen from '../screens/drone/MyDronesScreen';
import AddDroneScreen from '../screens/drone/AddDroneScreen';
import EditDroneScreen from '../screens/drone/EditDroneScreen';
import NearbyDronesScreen from '../screens/drone/NearbyDronesScreen';
import DroneDetailScreen from '../screens/drone/DroneDetailScreen';

import OfferListScreen from '../screens/demand/OfferListScreen';
import OfferDetailScreen from '../screens/demand/OfferDetailScreen';
import QuickOrderEntryScreen from '../screens/demand/QuickOrderEntryScreen';
import DemandListScreen from '../screens/demand/DemandListScreen';
import DemandDetailScreen from '../screens/demand/DemandDetailScreen';
import DemandQuoteComposeScreen from '../screens/demand/DemandQuoteComposeScreen';
import SupplyDirectOrderConfirmScreen from '../screens/supply/SupplyDirectOrderConfirmScreen';

import AddressPickerScreen from '../screens/location/AddressPickerScreen';
import AddressSearchScreen from '../screens/location/AddressSearchScreen';
import MapPickerScreen from '../screens/location/MapPickerScreen';

import PaymentScreen from '../screens/order/PaymentScreen';
import ReviewScreen from '../screens/order/ReviewScreen';
import OrderAfterSaleScreen from '../screens/order/OrderAfterSaleScreen';
import ContractScreen from '../screens/order/ContractScreen';

import PilotRegisterScreen from '../screens/pilot/PilotRegisterScreen';
import PilotProfileScreen from '../screens/pilot/PilotProfileScreen';
import PilotOwnerBindingsScreen from '../screens/pilot/PilotOwnerBindingsScreen';
import CertificationUploadScreen from '../screens/pilot/CertificationUploadScreen';
import FlightLogScreen from '../screens/pilot/FlightLogScreen';
import BoundDronesScreen from '../screens/pilot/BoundDronesScreen';
import BindDroneScreen from '../screens/pilot/BindDroneScreen';
import DroneCertificationScreen from '../screens/drone/DroneCertificationScreen';
import DroneMaintenanceLogScreen from '../screens/drone/DroneMaintenanceLogScreen';
import ClientRegisterScreen from '../screens/client/ClientRegisterScreen';
import ClientProfileScreen from '../screens/client/ClientProfileScreen';
import CargoDeclarationScreen from '../screens/client/CargoDeclarationScreen';
import CreateDispatchTaskScreen from '../screens/dispatch/CreateDispatchTaskScreen';
import DispatchTaskListScreen from '../screens/dispatch/DispatchTaskListScreen';
import DispatchTaskDetailScreen from '../screens/dispatch/DispatchTaskDetailScreen';
import PilotTaskListScreen from '../screens/dispatch/PilotTaskListScreen';
import PilotOrderExecutionScreen from '../screens/dispatch/PilotOrderExecutionScreen';
import FlightMonitoringScreen from '../screens/flight/FlightMonitoringScreen';
import TrajectoryScreen from '../screens/flight/TrajectoryScreen';
import MultiPointTaskScreen from '../screens/flight/MultiPointTaskScreen';
import AirspaceApplicationScreen from '../screens/airspace/AirspaceApplicationScreen';
import ComplianceCheckScreen from '../screens/airspace/ComplianceCheckScreen';
import NoFlyZoneScreen from '../screens/airspace/NoFlyZoneScreen';
import WalletScreen from '../screens/settlement/WalletScreen';
import WithdrawalScreen from '../screens/settlement/WithdrawalScreen';
import WithdrawalListScreen from '../screens/settlement/WithdrawalListScreen';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const MessageStack = createNativeStackNavigator();

function MessageStackScreen() {
  return (
    <MessageStack.Navigator>
      <MessageStack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{headerShown: false}}
      />
      <MessageStack.Screen name="Chat" component={ChatScreen} options={{title: '聊天'}} />
    </MessageStack.Navigator>
  );
}

const tabIcon = (name: string, color: string) => {
  const iconMap: Record<string, 'home' | 'discover' | 'orders' | 'messages' | 'profile'> = {
    Home: 'home',
    Market: 'discover',
    Orders: 'orders',
    Messages: 'messages',
    Profile: 'profile',
  };

  return <TabGlyph name={iconMap[name] || 'home'} color={color} />;
};

function MainTabs() {
  const {theme} = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({color}) => tabIcon(route.name, color),
        tabBarActiveTintColor: theme.navIconActive,
        tabBarInactiveTintColor: theme.navIconInactive,
        tabBarStyle: {backgroundColor: theme.navBg, borderTopColor: theme.navBorder},
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{tabBarLabel: '首页'}} />
      <Tab.Screen name="Market" component={MarketHubScreen} options={{tabBarLabel: '发现'}} />
      <Tab.Screen name="Orders" component={OrderListScreen} options={{tabBarLabel: '进度'}} />
      <Tab.Screen name="Messages" component={MessageStackScreen} options={{tabBarLabel: '消息'}} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{tabBarLabel: '我的'}} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{headerShown: false}} />
      <RootStack.Screen name="PublishOffer" component={PublishOfferScreen} options={{title: '服务草稿与上架'}} />
      <RootStack.Screen name="PublishDemand" component={PublishDemandScreen} options={{title: '发布任务'}} />
      <RootStack.Screen name="EditDemand" component={EditDemandScreen} options={{title: '修改任务'}} />
      <RootStack.Screen name="PublishCargo" component={PublishCargoScreen} options={{title: '发布任务'}} />
      <RootStack.Screen name="AddDrone" component={AddDroneScreen} options={{title: '添加无人机'}} />
      <RootStack.Screen name="EditDrone" component={EditDroneScreen} options={{title: '编辑无人机'}} />
      <RootStack.Screen name="NearbyDrones" component={NearbyDronesScreen} options={{title: '附近无人机'}} />
      <RootStack.Screen name="DroneDetail" component={DroneDetailScreen} options={{headerShown: false}} />
      <RootStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{headerShown: false}} />
      <RootStack.Screen name="Payment" component={PaymentScreen} options={{title: '订单支付'}} />
      <RootStack.Screen name="Review" component={ReviewScreen} options={{title: '评价订单'}} />
      <RootStack.Screen name="OrderAfterSale" component={OrderAfterSaleScreen} options={{title: '售后处理'}} />
      <RootStack.Screen name="Contract" component={ContractScreen} options={{title: '合同签约'}} />
      <RootStack.Screen name="QuickOrderEntry" component={QuickOrderEntryScreen} options={{title: '快速下单'}} />
      <RootStack.Screen name="OfferList" component={OfferListScreen} options={{title: '服务列表'}} />
      <RootStack.Screen name="OfferDetail" component={OfferDetailScreen} options={{title: '服务详情'}} />
      <RootStack.Screen name="SupplyDirectOrderConfirm" component={SupplyDirectOrderConfirmScreen} options={{title: '确认直达下单'}} />
      <RootStack.Screen name="DemandList" component={DemandListScreen} options={{title: '任务列表'}} />
      <RootStack.Screen name="DemandDetail" component={DemandDetailScreen} options={{title: '任务详情'}} />
      <RootStack.Screen name="DemandQuoteCompose" component={DemandQuoteComposeScreen} options={{title: '提交报价'}} />
      <RootStack.Screen name="AddressPicker" component={AddressPickerScreen} options={{title: '选择地址'}} />
      <RootStack.Screen name="AddressSearch" component={AddressSearchScreen} options={{headerShown: false}} />
      <RootStack.Screen
        name="MapPicker"
        component={MapPickerScreen}
        options={{
          headerShown: false,
          animation: 'none',
          freezeOnBlur: false,
          presentation: 'card',
        }}
      />
      <RootStack.Screen name="FlightMonitoring" component={FlightMonitoringScreen} options={{title: '飞行监控'}} />
      <RootStack.Screen name="TrajectoryRecord" component={TrajectoryScreen} options={{title: '轨迹记录'}} />
      <RootStack.Screen name="MultiPointTask" component={MultiPointTaskScreen} options={{title: '多点任务'}} />
      <RootStack.Screen name="AirspaceApplication" component={AirspaceApplicationScreen} options={{title: '空域报备'}} />
      <RootStack.Screen name="ComplianceCheck" component={ComplianceCheckScreen} options={{title: '合规检查'}} />
      <RootStack.Screen name="NoFlyZone" component={NoFlyZoneScreen} options={{title: '禁飞区'}} />
      <RootStack.Screen name="CargoDeclaration" component={CargoDeclarationScreen} options={{title: '货物申报'}} />
      <RootStack.Screen name="CreateDispatchTask" component={CreateDispatchTaskScreen} options={{title: '安排执行'}} />
      <RootStack.Screen name="DispatchTaskList" component={DispatchTaskListScreen} options={{title: '执行安排'}} />
      <RootStack.Screen name="DispatchTaskDetail" component={DispatchTaskDetailScreen} options={{title: '执行安排详情'}} />
      <RootStack.Screen name="PilotTaskList" component={PilotTaskListScreen} options={{title: '待接任务'}} />
      <RootStack.Screen name="PilotOrderExecution" component={PilotOrderExecutionScreen} options={{title: '任务执行'}} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} options={{title: '编辑资料'}} />
      <RootStack.Screen name="MyDrones" component={MyDronesScreen} options={{title: '我的无人机'}} />
      <RootStack.Screen name="MyOrders" component={OrderListScreen} options={{title: '我的订单'}} />
      <RootStack.Screen name="MyOffers" component={MyOffersScreen} options={{title: '我的服务'}} />
      <RootStack.Screen name="MyQuotes" component={MyQuotesScreen} options={{title: '我的报价'}} />
      <RootStack.Screen name="MyDemands" component={MyDemandsScreen} options={{title: '我的任务'}} />
      <RootStack.Screen name="OwnerProfile" component={OwnerProfileScreen} options={{title: '机主档案'}} />
      <RootStack.Screen name="OwnerPilotBindings" component={OwnerPilotBindingsScreen} options={{title: '绑定飞手'}} />
      <RootStack.Screen name="Verification" component={VerificationScreen} options={{title: '实名认证'}} />
      <RootStack.Screen name="Settings" component={SettingsScreen} options={{title: '设置'}} />
      <RootStack.Screen name="PilotProfile" component={PilotProfileScreen} options={{title: '飞手中心'}} />
      <RootStack.Screen name="PilotOwnerBindings" component={PilotOwnerBindingsScreen} options={{title: '绑定机主'}} />
      <RootStack.Screen name="PilotRegister" component={PilotRegisterScreen} options={{title: '飞手认证'}} />
      <RootStack.Screen name="CertificationUpload" component={CertificationUploadScreen} options={{title: '证书管理'}} />
      <RootStack.Screen name="FlightLog" component={FlightLogScreen} options={{title: '飞行记录'}} />
      <RootStack.Screen name="BoundDrones" component={BoundDronesScreen} options={{title: '绑定的无人机'}} />
      <RootStack.Screen name="BindDrone" component={BindDroneScreen} options={{title: '绑定无人机'}} />
      <RootStack.Screen name="DroneCertification" component={DroneCertificationScreen} options={{title: '无人机认证'}} />
      <RootStack.Screen name="DroneMaintenanceLog" component={DroneMaintenanceLogScreen} options={{title: '维护记录'}} />
      <RootStack.Screen name="ClientProfile" component={ClientProfileScreen} options={{title: '客户中心'}} />
      <RootStack.Screen name="ClientRegister" component={ClientRegisterScreen} options={{title: '企业客户升级'}} />
      <RootStack.Screen name="Wallet" component={WalletScreen} options={{title: '我的钱包'}} />
      <RootStack.Screen name="Withdrawal" component={WithdrawalScreen} options={{title: '提现'}} />
      <RootStack.Screen name="WithdrawalList" component={WithdrawalListScreen} options={{title: '提现记录'}} />
    </RootStack.Navigator>
  );
}
