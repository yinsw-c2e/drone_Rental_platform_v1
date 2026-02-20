import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList, Platform } from 'react-native'

// ============= Types =============
type Screen = 'Login' | 'Register' | 'Home' | 'Orders' | 'Messages' | 'Profile'
type Tab = 'Home' | 'Orders' | 'Messages' | 'Profile'

// ============= Login Screen =============
function LoginScreen({ onLogin, onGoRegister }: { onLogin: () => void; onGoRegister: () => void }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code')
  const [password, setPassword] = useState('')
  const [countdown, setCountdown] = useState(0)

  const sendCode = () => {
    if (!phone || phone.length !== 11) {
      alert('请输入正确的手机号')
      return
    }
    alert('验证码已发送（演示模式）')
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  return (
    <View style={loginStyles.container}>
      <View style={loginStyles.content}>
        <Text style={loginStyles.title}>无人机租赁平台</Text>
        <Text style={loginStyles.subtitle}>登录 / 注册</Text>

        <TextInput
          style={loginStyles.input}
          placeholder="手机号"
          maxLength={11}
          value={phone}
          onChangeText={setPhone}
        />

        {loginMode === 'code' ? (
          <View style={loginStyles.codeRow}>
            <TextInput
              style={[loginStyles.input, { flex: 1, marginRight: 12 }]}
              placeholder="验证码"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            <TouchableOpacity
              style={[loginStyles.codeBtn, countdown > 0 && loginStyles.codeBtnDisabled]}
              onPress={sendCode}
              disabled={countdown > 0}
            >
              <Text style={loginStyles.codeBtnText}>
                {countdown > 0 ? `${countdown}s` : '发送验证码'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={loginStyles.input}
            placeholder="密码"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        <TouchableOpacity style={loginStyles.loginBtn} onPress={onLogin}>
          <Text style={loginStyles.loginBtnText}>登录</Text>
        </TouchableOpacity>

        <TouchableOpacity style={loginStyles.switchBtn}
          onPress={() => setLoginMode(loginMode === 'code' ? 'password' : 'code')}>
          <Text style={loginStyles.switchBtnText}>
            {loginMode === 'code' ? '使用密码登录' : '使用验证码登录'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={loginStyles.switchBtn} onPress={onGoRegister}>
          <Text style={loginStyles.switchBtnText}>注册新账号</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const loginStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#1890ff' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginTop: 8, marginBottom: 40 },
  input: {
    height: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 16, fontSize: 16, marginBottom: 16,
  },
  codeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  codeBtn: {
    height: 48, paddingHorizontal: 16, backgroundColor: '#1890ff',
    borderRadius: 8, justifyContent: 'center',
  },
  codeBtnDisabled: { backgroundColor: '#ccc' },
  codeBtnText: { color: '#fff', fontSize: 14 },
  loginBtn: {
    height: 48, backgroundColor: '#1890ff', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchBtn: { marginTop: 16, alignItems: 'center' },
  switchBtnText: { color: '#1890ff', fontSize: 14 },
})

// ============= Register Screen =============
function RegisterScreen({ onRegister, onGoLogin }: { onRegister: () => void; onGoLogin: () => void }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')

  return (
    <View style={regStyles.container}>
      <View style={regStyles.content}>
        <Text style={regStyles.title}>注册新账号</Text>
        <TextInput style={regStyles.input} placeholder="手机号" maxLength={11} value={phone} onChangeText={setPhone} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextInput style={[regStyles.input, { flex: 1, marginRight: 12 }]} placeholder="验证码" maxLength={6} value={code} onChangeText={setCode} />
          <TouchableOpacity style={regStyles.codeBtn} onPress={() => alert('验证码已发送')}>
            <Text style={{ color: '#fff', fontSize: 14 }}>发送验证码</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={regStyles.input} placeholder="设置密码（至少6位）" secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={regStyles.input} placeholder="昵称（选填）" value={nickname} onChangeText={setNickname} />
        <TouchableOpacity style={regStyles.btn} onPress={onRegister}>
          <Text style={regStyles.btnText}>注册</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={onGoLogin}>
          <Text style={{ color: '#1890ff' }}>已有账号？去登录</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const regStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 },
  input: { height: 48, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, fontSize: 16, marginBottom: 16 },
  codeBtn: { height: 48, paddingHorizontal: 16, backgroundColor: '#1890ff', borderRadius: 8, justifyContent: 'center' },
  btn: { height: 48, backgroundColor: '#1890ff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
})

// ============= Home Screen =============
function HomeScreen() {
  const cards = [
    { title: '发布出租', desc: '发布无人机出租服务', color: '#1890ff', icon: '🚁' },
    { title: '租赁需求', desc: '发布无人机租赁需求', color: '#52c41a', icon: '📋' },
    { title: '货运需求', desc: '发布吊运/运输需求', color: '#fa8c16', icon: '📦' },
    { title: '附近无人机', desc: '查看附近可用无人机', color: '#722ed1', icon: '📍' },
  ]

  const recentOffers = [
    { id: 1, title: 'DJI Mavic 3 航拍服务', price: '800元/天', owner: '飞行者小张', rating: '4.9' },
    { id: 2, title: '大疆T50 农业植保', price: '1200元/天', owner: '农田卫士', rating: '4.8' },
    { id: 3, title: 'DJI M350 物流运输', price: '2000元/天', owner: '天空快递', rating: '4.7' },
  ]

  const recentDemands = [
    { id: 1, title: '婚礼航拍 - 需航拍无人机', budget: '预算 500-1000元', area: '北京朝阳', urgent: true },
    { id: 2, title: '农田喷洒 - 需植保无人机', budget: '预算 800-1500元', area: '河北保定', urgent: false },
  ]

  return (
    <ScrollView style={homeStyles.container}>
      <View style={homeStyles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={homeStyles.headerTitle}>无人机租赁平台</Text>
            <Text style={homeStyles.headerSubtitle}>智能匹配，高效撮合</Text>
          </View>
          <View style={homeStyles.searchBtn}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
          </View>
        </View>
      </View>

      <View style={homeStyles.grid}>
        {cards.map((card, index) => (
          <TouchableOpacity key={index} style={[homeStyles.card, { borderLeftColor: card.color }]}>
            <Text style={homeStyles.cardIcon}>{card.icon}</Text>
            <Text style={homeStyles.cardTitle}>{card.title}</Text>
            <Text style={homeStyles.cardDesc}>{card.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats banner */}
      <View style={homeStyles.statsBanner}>
        <View style={homeStyles.statItem}>
          <Text style={homeStyles.statNum}>2,386</Text>
          <Text style={homeStyles.statLabel}>注册无人机</Text>
        </View>
        <View style={homeStyles.statDivider} />
        <View style={homeStyles.statItem}>
          <Text style={homeStyles.statNum}>15,890</Text>
          <Text style={homeStyles.statLabel}>完成订单</Text>
        </View>
        <View style={homeStyles.statDivider} />
        <View style={homeStyles.statItem}>
          <Text style={homeStyles.statNum}>98.5%</Text>
          <Text style={homeStyles.statLabel}>好评率</Text>
        </View>
      </View>

      <View style={homeStyles.section}>
        <Text style={homeStyles.sectionTitle}>最新供给</Text>
        <TouchableOpacity><Text style={homeStyles.moreText}>查看更多 &gt;</Text></TouchableOpacity>
      </View>
      {recentOffers.map(offer => (
        <TouchableOpacity key={offer.id} style={homeStyles.offerCard}>
          <View style={homeStyles.offerIcon}><Text style={{ fontSize: 24 }}>🚁</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={homeStyles.offerTitle}>{offer.title}</Text>
            <Text style={homeStyles.offerMeta}>{offer.owner} · ⭐{offer.rating}</Text>
          </View>
          <Text style={homeStyles.offerPrice}>{offer.price}</Text>
        </TouchableOpacity>
      ))}

      <View style={homeStyles.section}>
        <Text style={homeStyles.sectionTitle}>最新需求</Text>
        <TouchableOpacity><Text style={homeStyles.moreText}>查看更多 &gt;</Text></TouchableOpacity>
      </View>
      {recentDemands.map(demand => (
        <TouchableOpacity key={demand.id} style={homeStyles.demandCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={homeStyles.demandTitle}>{demand.title}</Text>
            {demand.urgent && <View style={homeStyles.urgentBadge}><Text style={{ color: '#fff', fontSize: 10 }}>紧急</Text></View>}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: '#f5222d', marginRight: 16 }}>{demand.budget}</Text>
            <Text style={{ fontSize: 13, color: '#999' }}>📍 {demand.area}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={{ height: 20 }} />
    </ScrollView>
  )
}

const homeStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#1890ff', padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
  card: {
    width: '46%', backgroundColor: '#fff', borderRadius: 10,
    padding: 16, margin: '2%', borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cardDesc: { fontSize: 12, color: '#999', marginTop: 4 },
  statsBanner: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 14, borderRadius: 10,
    paddingVertical: 16, marginTop: 4, marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#1890ff' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },
  section: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  moreText: { fontSize: 13, color: '#1890ff' },
  offerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: 10,
  },
  offerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e6f7ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  offerTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  offerMeta: { fontSize: 12, color: '#999', marginTop: 4 },
  offerPrice: { fontSize: 14, fontWeight: 'bold', color: '#f5222d' },
  demandCard: {
    backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: 10,
  },
  demandTitle: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  urgentBadge: { backgroundColor: '#ff4d4f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
})

// ============= Order List Screen =============
function OrderListScreen() {
  const [activeTab, setActiveTab] = useState('')

  const TABS = [
    { key: '', label: '全部' },
    { key: 'created', label: '待接单' },
    { key: 'paid', label: '已支付' },
    { key: 'in_progress', label: '进行中' },
    { key: 'completed', label: '已完成' },
  ]

  const STATUS_MAP: Record<string, string> = {
    created: '待接单', paid: '已支付', in_progress: '进行中', completed: '已完成',
  }

  const mockOrders = [
    { id: 1, order_no: 'ORD20250219001', title: 'DJI Mavic 3 航拍服务', status: 'in_progress', total_amount: 80000, created_at: '2025-02-19' },
    { id: 2, order_no: 'ORD20250218002', title: '大疆T50 农业植保 3日', status: 'paid', total_amount: 360000, created_at: '2025-02-18' },
    { id: 3, order_no: 'ORD20250217003', title: 'M350 物流运输任务', status: 'completed', total_amount: 200000, created_at: '2025-02-17' },
    { id: 4, order_no: 'ORD20250216004', title: '精灵4RTK 测绘服务', status: 'created', total_amount: 150000, created_at: '2025-02-16' },
    { id: 5, order_no: 'ORD20250215005', title: 'FPV穿越机 活动航拍', status: 'completed', total_amount: 50000, created_at: '2025-02-15' },
  ]

  const filteredOrders = activeTab ? mockOrders.filter(o => o.status === activeTab) : mockOrders

  return (
    <View style={orderStyles.container}>
      <View style={orderStyles.header}>
        <Text style={orderStyles.headerTitle}>我的订单</Text>
      </View>
      <View style={orderStyles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[orderStyles.tab, activeTab === tab.key && orderStyles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[orderStyles.tabText, activeTab === tab.key && orderStyles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {filteredOrders.map(item => (
          <TouchableOpacity key={item.id} style={orderStyles.card}>
            <View style={orderStyles.cardHeader}>
              <Text style={orderStyles.orderNo}>{item.order_no}</Text>
              <Text style={[orderStyles.status, { color: item.status === 'completed' ? '#52c41a' : item.status === 'in_progress' ? '#fa8c16' : '#1890ff' }]}>
                {STATUS_MAP[item.status] || item.status}
              </Text>
            </View>
            <Text style={orderStyles.title}>{item.title}</Text>
            <View style={orderStyles.cardFooter}>
              <Text style={orderStyles.amount}>{(item.total_amount / 100).toFixed(2)} 元</Text>
              <Text style={orderStyles.time}>{item.created_at}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const orderStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', paddingTop: 36, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1890ff' },
  tabText: { fontSize: 13, color: '#666' },
  tabTextActive: { color: '#1890ff', fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderNo: { fontSize: 12, color: '#999' },
  status: { fontSize: 13, fontWeight: 'bold' },
  title: { fontSize: 15, color: '#333', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  amount: { fontSize: 16, color: '#f5222d', fontWeight: 'bold' },
  time: { fontSize: 12, color: '#999', alignSelf: 'flex-end' },
})

// ============= Chat / Messages Screen =============
function MessagesScreen() {
  const [inputText, setInputText] = useState('')
  const [messages, setMessages] = useState([
    { id: 1, sender_id: 2, content: '您好，我想租用您的DJI Mavic 3进行航拍', isMine: false, time: '14:30' },
    { id: 2, sender_id: 1, content: '好的，请问什么时候需要？', isMine: true, time: '14:31' },
    { id: 3, sender_id: 2, content: '这周六可以吗？大概需要半天时间', isMine: false, time: '14:32' },
    { id: 4, sender_id: 1, content: '周六可以的，航拍范围在哪里？', isMine: true, time: '14:33' },
    { id: 5, sender_id: 2, content: '在北京奥林匹克公园附近，主要拍一些风景', isMine: false, time: '14:35' },
    { id: 6, sender_id: 1, content: '没问题，我可以提供4K航拍服务，价格800元/天，您看可以吗？', isMine: true, time: '14:36' },
    { id: 7, sender_id: 2, content: '可以的！那我们下一步怎么操作？', isMine: false, time: '14:38' },
  ])

  const handleSend = () => {
    if (!inputText.trim()) return
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      sender_id: 1,
      content: inputText.trim(),
      isMine: true,
      time: new Date().toTimeString().slice(0, 5),
    }])
    setInputText('')
  }

  return (
    <View style={chatStyles.container}>
      <View style={chatStyles.header}>
        <Text style={chatStyles.headerTitle}>飞行者小张</Text>
        <Text style={{ fontSize: 12, color: '#52c41a', textAlign: 'center' }}>在线</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {messages.map(msg => (
          <View key={msg.id} style={[chatStyles.msgRow, msg.isMine && chatStyles.msgRowRight]}>
            {!msg.isMine && <View style={chatStyles.avatar}><Text style={{ fontSize: 14 }}>👤</Text></View>}
            <View style={{ maxWidth: '70%' }}>
              <View style={[chatStyles.bubble, msg.isMine ? chatStyles.bubbleMine : chatStyles.bubbleOther]}>
                <Text style={[chatStyles.msgText, msg.isMine && { color: '#fff' }]}>{msg.content}</Text>
              </View>
              <Text style={[chatStyles.timeText, msg.isMine && { textAlign: 'right' }]}>{msg.time}</Text>
            </View>
            {msg.isMine && <View style={[chatStyles.avatar, { backgroundColor: '#bae7ff' }]}><Text style={{ fontSize: 14 }}>😊</Text></View>}
          </View>
        ))}
      </ScrollView>
      <View style={chatStyles.inputBar}>
        <TouchableOpacity style={chatStyles.addBtn}><Text style={{ fontSize: 20 }}>+</Text></TouchableOpacity>
        <TextInput
          style={chatStyles.input}
          placeholder="输入消息..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={chatStyles.sendBtn} onPress={handleSend}>
          <Text style={chatStyles.sendText}>发送</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const chatStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', paddingTop: 36, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  msgRowRight: { flexDirection: 'row', justifyContent: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  bubble: { padding: 12, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#1890ff', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, color: '#333', lineHeight: 20 },
  timeText: { fontSize: 10, color: '#ccc', marginTop: 4, marginHorizontal: 4 },
  inputBar: { flexDirection: 'row', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, height: 38, backgroundColor: '#f5f5f5', borderRadius: 19, paddingHorizontal: 16, fontSize: 14 },
  sendBtn: { width: 56, height: 36, backgroundColor: '#1890ff', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
})

// ============= Profile Screen =============
function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const menuItems = [
    { title: '我的无人机', icon: '🚁', badge: '3' },
    { title: '我的订单', icon: '📋', badge: '' },
    { title: '我的供给', icon: '📤', badge: '2' },
    { title: '我的需求', icon: '📥', badge: '1' },
    { title: '钱包', icon: '💰', badge: '' },
    { title: '实名认证', icon: '🪪', badge: '已认证' },
    { title: '设置', icon: '⚙️', badge: '' },
  ]

  return (
    <ScrollView style={profileStyles.container}>
      <View style={profileStyles.header}>
        <View style={profileStyles.avatar}>
          <Text style={profileStyles.avatarText}>演</Text>
        </View>
        <Text style={profileStyles.name}>演示用户</Text>
        <Text style={profileStyles.phone}>138****8000</Text>
        <View style={profileStyles.badges}>
          <View style={[profileStyles.badge, { backgroundColor: 'rgba(82,196,26,0.8)' }]}>
            <Text style={profileStyles.badgeText}>已认证</Text>
          </View>
          <View style={profileStyles.badge}>
            <Text style={profileStyles.badgeText}>信用分: 98</Text>
          </View>
          <View style={profileStyles.badge}>
            <Text style={profileStyles.badgeText}>无人机主</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={profileStyles.statsRow}>
        <View style={profileStyles.statItem}>
          <Text style={profileStyles.statNum}>12</Text>
          <Text style={profileStyles.statLabel}>总订单</Text>
        </View>
        <View style={profileStyles.statItem}>
          <Text style={profileStyles.statNum}>¥8,600</Text>
          <Text style={profileStyles.statLabel}>总收入</Text>
        </View>
        <View style={profileStyles.statItem}>
          <Text style={profileStyles.statNum}>4.9</Text>
          <Text style={profileStyles.statLabel}>评分</Text>
        </View>
      </View>

      <View style={profileStyles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={profileStyles.menuItem}>
            <Text style={{ fontSize: 18, marginRight: 12 }}>{item.icon}</Text>
            <Text style={profileStyles.menuText}>{item.title}</Text>
            <View style={{ flex: 1 }} />
            {item.badge ? (
              <Text style={[profileStyles.menuBadge, item.badge === '已认证' && { color: '#52c41a' }]}>{item.badge}</Text>
            ) : null}
            <Text style={profileStyles.menuArrow}>&gt;</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={profileStyles.logoutBtn} onPress={onLogout}>
        <Text style={profileStyles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const profileStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#1890ff', padding: 24, paddingTop: 44, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  phone: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  badges: { flexDirection: 'row', marginTop: 12 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 12 },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 14, marginTop: -16,
    borderRadius: 10, paddingVertical: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  menu: { backgroundColor: '#fff', marginTop: 12 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  menuText: { fontSize: 15, color: '#333' },
  menuBadge: { fontSize: 12, color: '#999', marginRight: 8 },
  menuArrow: { fontSize: 16, color: '#ccc' },
  logoutBtn: {
    margin: 20, height: 48, backgroundColor: '#fff', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ff4d4f',
  },
  logoutText: { color: '#ff4d4f', fontSize: 16 },
})

// ============= Tab Bar =============
function TabBar({ activeTab, onTabPress }: { activeTab: Tab; onTabPress: (tab: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'Home', label: '首页', icon: '🏠' },
    { key: 'Orders', label: '订单', icon: '📋' },
    { key: 'Messages', label: '消息', icon: '💬' },
    { key: 'Profile', label: '我的', icon: '👤' },
  ]

  return (
    <View style={tabStyles.container}>
      {tabs.map(tab => (
        <TouchableOpacity key={tab.key} style={tabStyles.tab} onPress={() => onTabPress(tab.key)}>
          <Text style={[tabStyles.icon, activeTab === tab.key && tabStyles.iconActive]}>{tab.icon}</Text>
          <Text style={[tabStyles.label, activeTab === tab.key && tabStyles.labelActive]}>{tab.label}</Text>
          {tab.key === 'Messages' && (
            <View style={tabStyles.dot} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  )
}

const tabStyles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingBottom: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  icon: { fontSize: 22, opacity: 0.45 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: '#999', marginTop: 2 },
  labelActive: { color: '#1890ff', fontWeight: '600' },
  dot: { position: 'absolute', top: 4, right: '25%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4d4f' },
})

// ============= Root App =============
export default function App() {
  const [screen, setScreen] = useState<Screen>('Login')
  const [activeTab, setActiveTab] = useState<Tab>('Home')

  const handleLogin = () => {
    setScreen('Home')
    setActiveTab('Home')
  }

  const handleLogout = () => {
    setScreen('Login')
  }

  const handleTabPress = (tab: Tab) => {
    setActiveTab(tab)
    setScreen(tab)
  }

  // Auth screens
  if (screen === 'Login') {
    return <LoginScreen onLogin={handleLogin} onGoRegister={() => setScreen('Register')} />
  }
  if (screen === 'Register') {
    return <RegisterScreen onRegister={handleLogin} onGoLogin={() => setScreen('Login')} />
  }

  // Main screens with tab bar
  const renderMainScreen = () => {
    switch (activeTab) {
      case 'Home': return <HomeScreen />
      case 'Orders': return <OrderListScreen />
      case 'Messages': return <MessagesScreen />
      case 'Profile': return <ProfileScreen onLogout={handleLogout} />
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={{ flex: 1 }}>{renderMainScreen()}</View>
      <TabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  )
}
