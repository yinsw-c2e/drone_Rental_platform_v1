import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text} from 'react-native';

import HomeScreen from '../screens/home/HomeScreen';
import OrderListScreen from '../screens/order/OrderListScreen';
import OrderDetailScreen from '../screens/order/OrderDetailScreen';
import ConversationListScreen from '../screens/message/ConversationListScreen';
import ChatScreen from '../screens/message/ChatScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Profile screens
import MyOffersScreen from '../screens/profile/MyOffersScreen';
import MyDemandsScreen from '../screens/profile/MyDemandsScreen';
import MyCargoScreen from '../screens/profile/MyCargoScreen';
import VerificationScreen from '../screens/profile/VerificationScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';

// Publish screens
import PublishOfferScreen from '../screens/publish/PublishOfferScreen';
import PublishDemandScreen from '../screens/publish/PublishDemandScreen';
import PublishCargoScreen from '../screens/publish/PublishCargoScreen';

// Drone screens
import MyDronesScreen from '../screens/drone/MyDronesScreen';
import AddDroneScreen from '../screens/drone/AddDroneScreen';
import NearbyDronesScreen from '../screens/drone/NearbyDronesScreen';
import DroneDetailScreen from '../screens/drone/DroneDetailScreen';

// Demand screens
import OfferListScreen from '../screens/demand/OfferListScreen';
import OfferDetailScreen from '../screens/demand/OfferDetailScreen';
import DemandListScreen from '../screens/demand/DemandListScreen';
import DemandDetailScreen from '../screens/demand/DemandDetailScreen';

// Cargo screens
import CargoListScreen from '../screens/cargo/CargoListScreen';
import CargoDetailScreen from '../screens/cargo/CargoDetailScreen';
import CargoAcceptScreen from '../screens/cargo/CargoAcceptScreen';

// Location screens
import AddressPickerScreen from '../screens/location/AddressPickerScreen';
import AddressSearchScreen from '../screens/location/AddressSearchScreen';
import MapPickerScreen from '../screens/location/MapPickerScreen';

// Order flow screens
import PaymentScreen from '../screens/order/PaymentScreen';
import ReviewScreen from '../screens/order/ReviewScreen';
import CreateOrderScreen from '../screens/order/CreateOrderScreen';

// Pilot screens
import PilotRegisterScreen from '../screens/pilot/PilotRegisterScreen';
import PilotProfileScreen from '../screens/pilot/PilotProfileScreen';
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
import PilotTaskListScreen from '../screens/dispatch/PilotTaskListScreen';
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
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{headerShown: false}} />
      <Stack.Screen name="PublishOffer" component={PublishOfferScreen} options={{title: '发布供给'}} />
      <Stack.Screen name="PublishDemand" component={PublishDemandScreen} options={{title: '发布需求'}} />
      <Stack.Screen name="PublishCargo" component={PublishCargoScreen} options={{title: '货运需求'}} />
      <Stack.Screen name="AddDrone" component={AddDroneScreen} options={{title: '添加无人机'}} />
      <Stack.Screen name="NearbyDrones" component={NearbyDronesScreen} options={{title: '附近无人机'}} />
      <Stack.Screen name="DroneDetail" component={DroneDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{title: '创建订单'}} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{title: '订单支付'}} />
      <Stack.Screen name="Review" component={ReviewScreen} options={{title: '评价订单'}} />
      <Stack.Screen name="OfferList" component={OfferListScreen} options={{title: '供给列表'}} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} options={{title: '供给详情'}} />
      <Stack.Screen name="DemandList" component={DemandListScreen} options={{title: '需求列表'}} />
      <Stack.Screen name="DemandDetail" component={DemandDetailScreen} options={{title: '需求详情'}} />
      <Stack.Screen name="CargoList" component={CargoListScreen} options={{title: '货运列表'}} />
      <Stack.Screen name="CargoDetail" component={CargoDetailScreen} options={{title: '货运详情'}} />
      <Stack.Screen name="CargoAccept" component={CargoAcceptScreen} options={{title: '确认接单'}} />
      <Stack.Screen name="AddressPicker" component={AddressPickerScreen} options={{title: '选择地址'}} />
      <Stack.Screen name="AddressSearch" component={AddressSearchScreen} options={{headerShown: false}} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} options={{title: '地图选点'}} />
      <Stack.Screen name="FlightMonitoring" component={FlightMonitoringScreen} options={{title: '飞行监控'}} />
      <Stack.Screen name="TrajectoryRecord" component={TrajectoryScreen} options={{title: '轨迹记录'}} />
      <Stack.Screen name="MultiPointTask" component={MultiPointTaskScreen} options={{title: '多点任务'}} />
      <Stack.Screen name="AirspaceApplication" component={AirspaceApplicationScreen} options={{title: '空域申请'}} />
      <Stack.Screen name="ComplianceCheck" component={ComplianceCheckScreen} options={{title: '合规检查'}} />
      <Stack.Screen name="NoFlyZone" component={NoFlyZoneScreen} options={{title: '禁飞区'}} />
    </Stack.Navigator>
  );
}

function OrderStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="OrderMain" component={OrderListScreen} options={{title: '我的订单'}} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{title: '订单支付'}} />
      <Stack.Screen name="Review" component={ReviewScreen} options={{title: '评价订单'}} />
      <Stack.Screen name="DroneDetail" component={DroneDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="FlightMonitoring" component={FlightMonitoringScreen} options={{title: '飞行监控'}} />
      <Stack.Screen name="TrajectoryRecord" component={TrajectoryScreen} options={{title: '轨迹记录'}} />
      <Stack.Screen name="MultiPointTask" component={MultiPointTaskScreen} options={{title: '多点任务'}} />
      <Stack.Screen name="AirspaceApplication" component={AirspaceApplicationScreen} options={{title: '空域申请'}} />
      <Stack.Screen name="ComplianceCheck" component={ComplianceCheckScreen} options={{title: '合规检查'}} />
      <Stack.Screen name="NoFlyZone" component={NoFlyZoneScreen} options={{title: '禁飞区'}} />
    </Stack.Navigator>
  );
}

function MessageStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ConversationList" component={ConversationListScreen} options={{headerShown: false}} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{title: '聊天'}} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{headerShown: false}} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{title: '编辑资料'}} />
      <Stack.Screen name="MyDrones" component={MyDronesScreen} options={{title: '我的无人机'}} />
      <Stack.Screen name="AddDrone" component={AddDroneScreen} options={{title: '添加无人机'}} />
      <Stack.Screen name="MyOrders" component={OrderListScreen} options={{title: '我的订单'}} />
      <Stack.Screen name="MyOffers" component={MyOffersScreen} options={{title: '我的供给'}} />
      <Stack.Screen name="MyDemands" component={MyDemandsScreen} options={{title: '我的需求'}} />
      <Stack.Screen name="MyCargo" component={MyCargoScreen} options={{title: '我的货运'}} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{title: '实名认证'}} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{title: '设置'}} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} options={{title: '供给详情'}} />
      <Stack.Screen name="DemandDetail" component={DemandDetailScreen} options={{title: '需求详情'}} />
      <Stack.Screen name="CargoDetail" component={CargoDetailScreen} options={{title: '货运详情'}} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{title: '创建订单'}} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{title: '订单支付'}} />
      <Stack.Screen name="Review" component={ReviewScreen} options={{title: '评价订单'}} />
      <Stack.Screen name="DroneDetail" component={DroneDetailScreen} options={{headerShown: false}} />
      <Stack.Screen name="PilotProfile" component={PilotProfileScreen} options={{title: '飞手中心'}} />
      <Stack.Screen name="PilotRegister" component={PilotRegisterScreen} options={{title: '飞手认证'}} />
      <Stack.Screen name="CertificationUpload" component={CertificationUploadScreen} options={{title: '证书管理'}} />
      <Stack.Screen name="FlightLog" component={FlightLogScreen} options={{title: '飞行记录'}} />
      <Stack.Screen name="BoundDrones" component={BoundDronesScreen} options={{title: '绑定的无人机'}} />
      <Stack.Screen name="BindDrone" component={BindDroneScreen} options={{title: '绑定无人机'}} />
      <Stack.Screen name="DroneCertification" component={DroneCertificationScreen} options={{title: '无人机认证'}} />
      <Stack.Screen name="DroneMaintenanceLog" component={DroneMaintenanceLogScreen} options={{title: '维护记录'}} />
      <Stack.Screen name="ClientProfile" component={ClientProfileScreen} options={{title: '客户中心'}} />
      <Stack.Screen name="ClientRegister" component={ClientRegisterScreen} options={{title: '客户注册'}} />
      <Stack.Screen name="CargoDeclaration" component={CargoDeclarationScreen} options={{title: '货物申报'}} />
      <Stack.Screen name="CreateDispatchTask" component={CreateDispatchTaskScreen} options={{title: '创建派单'}} />
      <Stack.Screen name="DispatchTaskList" component={DispatchTaskListScreen} options={{title: '派单任务'}} />
      <Stack.Screen name="PilotTaskList" component={PilotTaskListScreen} options={{title: '接单任务'}} />
      <Stack.Screen name="FlightMonitoring" component={FlightMonitoringScreen} options={{title: '飞行监控'}} />
      <Stack.Screen name="TrajectoryRecord" component={TrajectoryScreen} options={{title: '轨迹记录'}} />
      <Stack.Screen name="MultiPointTask" component={MultiPointTaskScreen} options={{title: '多点任务'}} />
      <Stack.Screen name="AirspaceApplication" component={AirspaceApplicationScreen} options={{title: '空域申请'}} />
      <Stack.Screen name="ComplianceCheck" component={ComplianceCheckScreen} options={{title: '合规检查'}} />
      <Stack.Screen name="NoFlyZone" component={NoFlyZoneScreen} options={{title: '禁飞区'}} />
      <Stack.Screen name="Wallet" component={WalletScreen} options={{title: '我的钱包'}} />
      <Stack.Screen name="Withdrawal" component={WithdrawalScreen} options={{title: '提现'}} />
      <Stack.Screen name="WithdrawalList" component={WithdrawalListScreen} options={{title: '提现记录'}} />
    </Stack.Navigator>
  );
}

const tabIcon = (name: string, focused: boolean) => (
  <Text style={{fontSize: 22, opacity: focused ? 1 : 0.5}}>
    {name === 'Home' ? '🏠' : name === 'Orders' ? '📋' : name === 'Messages' ? '💬' : '👤'}
  </Text>
);

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused}) => tabIcon(route.name, focused),
        tabBarActiveTintColor: '#1890ff',
        tabBarInactiveTintColor: '#999',
      })}>
      <Tab.Screen name="Home" component={HomeStack} options={{tabBarLabel: '首页'}} />
      <Tab.Screen name="Orders" component={OrderStack} options={{tabBarLabel: '订单'}} />
      <Tab.Screen name="Messages" component={MessageStack} options={{tabBarLabel: '消息'}} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{tabBarLabel: '我的'}} />
    </Tab.Navigator>
  );
}
