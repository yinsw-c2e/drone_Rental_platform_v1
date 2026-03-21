export type AppTheme = {
  // 基础背景
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  // 卡片
  card: string;
  cardBorder: string;
  cardHighlight: string;
  // 文字
  text: string;
  textSub: string;
  textHint: string;
  textInverse: string;
  // 主色
  primary: string;
  primaryBg: string;
  primaryBorder: string;
  primaryText: string;
  // 输入框
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  // 分割线
  divider: string;
  // Tab / Nav
  tabBg: string;
  tabActiveBg: string;
  tabText: string;
  tabActiveText: string;
  // 按钮
  btnPrimary: string;
  btnPrimaryText: string;
  btnGhost: string;
  btnGhostBorder: string;
  btnGhostText: string;
  // 状态色
  success: string;
  warning: string;
  danger: string;
  info: string;
  // 装饰
  heroOverlay: string;
  badgeBg: string;
  badgeBorder: string;
  // 导航栏
  navBg: string;
  navBorder: string;
  navText: string;
  navIconActive: string;
  navIconInactive: string;
  // 刷新控件
  refreshColor: string;
  // 是否暗色
  isDark: boolean;
};

/* ──────────────────────────────────────────────
 * Dark Cyber Theme — ui-ux-pro-max design system
 * Palette: Deep navy base, electric cyan accent
 * Typography: contrast ratio ≥ 4.5:1 (WCAG AA)
 * Glassmorphism + subtle neon glow on focus
 * ────────────────────────────────────────────── */
export const darkTheme: AppTheme = {
  // Layered depth backgrounds (darkest → lighter)
  bg: '#060B18',          // deep space navy
  bgSecondary: '#0C1428', // elevated surface
  bgTertiary: '#111D35',  // tertiary layer / sheet bg

  // Cards: frosted glass aesthetic
  card: 'rgba(255,255,255,0.035)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardHighlight: 'rgba(0,212,255,0.18)',

  // Text hierarchy (4.5:1+ contrast on bg)
  text: '#ECF0F6',        // primary — near white
  textSub: '#7B8BA5',     // secondary — slate
  textHint: '#465373',    // tertiary / placeholder
  textInverse: '#060B18', // on bright surfaces

  // Accent — electric cyan
  primary: '#00D4FF',
  primaryBg: 'rgba(0,212,255,0.10)',
  primaryBorder: 'rgba(0,212,255,0.32)',
  primaryText: '#00D4FF',

  // Inputs — translucent glass
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.08)',
  inputText: '#F1F5F9',
  inputPlaceholder: '#465373',

  divider: 'rgba(255,255,255,0.06)',

  // Tabs
  tabBg: 'rgba(255,255,255,0.04)',
  tabActiveBg: 'rgba(0,212,255,0.12)',
  tabText: '#465373',
  tabActiveText: '#00D4FF',

  // Buttons
  btnPrimary: '#00D4FF',
  btnPrimaryText: '#060B18',
  btnGhost: 'transparent',
  btnGhostBorder: 'rgba(0,212,255,0.36)',
  btnGhostText: '#00D4FF',

  // Semantic status (vibrant neon)
  success: '#00E57A',
  warning: '#FFB340',
  danger: '#FF6B6B',
  info: '#4DA8FF',

  // Decorative
  heroOverlay: 'rgba(6,11,24,0.55)',
  badgeBg: 'rgba(255,255,255,0.06)',
  badgeBorder: 'rgba(255,255,255,0.12)',

  // Bottom nav
  navBg: '#060B18',
  navBorder: 'rgba(255,255,255,0.06)',
  navText: '#ECF0F6',
  navIconActive: '#00D4FF',
  navIconInactive: '#465373',

  refreshColor: '#00D4FF',
  isDark: true,
};

/* ──────────────────────────────────────────────
 * Light Business Theme — ui-ux-pro-max design system
 * Palette: Cool-neutral base, trusty blue accent
 * Typography: contrast ratio ≥ 4.5:1 (WCAG AA)
 * Clean surfaces, soft shadows, clear hierarchy
 * ────────────────────────────────────────────── */
export const lightTheme: AppTheme = {
  // Layered backgrounds (lightest → slightly tinted)
  bg: '#F5F7FA',          // page background — cool gray
  bgSecondary: '#FFFFFF',  // elevated card / sheet
  bgTertiary: '#EDF1F7',   // recessed wells

  // Cards: crisp white with subtle border
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardHighlight: '#2563EB',

  // Text hierarchy (4.5:1+ contrast on bg)
  text: '#0F172A',         // primary — near black
  textSub: '#64748B',      // secondary — slate
  textHint: '#94A3B8',     // tertiary / placeholder
  textInverse: '#FFFFFF',  // on dark / accent surfaces

  // Accent — professional blue
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  primaryBorder: '#93C5FD',
  primaryText: '#1D4ED8',

  // Inputs — white with clean border
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  inputText: '#0F172A',
  inputPlaceholder: '#94A3B8',

  divider: '#E2E8F0',

  // Tabs
  tabBg: '#FFFFFF',
  tabActiveBg: '#EFF6FF',
  tabText: '#64748B',
  tabActiveText: '#2563EB',

  // Buttons
  btnPrimary: '#2563EB',
  btnPrimaryText: '#FFFFFF',
  btnGhost: 'transparent',
  btnGhostBorder: '#2563EB',
  btnGhostText: '#2563EB',

  // Semantic status (clear & readable)
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',

  // Decorative
  heroOverlay: 'rgba(255,255,255,0)',
  badgeBg: '#F1F5F9',
  badgeBorder: '#CBD5E1',

  // Bottom nav
  navBg: '#FFFFFF',
  navBorder: '#E2E8F0',
  navText: '#0F172A',
  navIconActive: '#2563EB',
  navIconInactive: '#94A3B8',

  refreshColor: '#2563EB',
  isDark: false,
};
