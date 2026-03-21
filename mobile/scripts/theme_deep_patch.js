/**
 * 深度主题化脚本：将 StyleSheet 中的硬编码颜色替换为 theme 动态变量
 * 策略：将 StyleSheet.create({...}) 改为 createStyles(theme) 函数
 */

const fs = require('fs');
const path = require('path');

const SCREENS_DIR = path.join(__dirname, '../src/screens');

// 跳过已完整改造的文件
const SKIP_FILES = [
  'auth/LoginScreen.tsx',
];

// 颜色映射表 - 旧颜色 → theme token
// 优先级：越具体越优先
const COLOR_MAP = [
  // ============ 主色调 ============
  { from: "'#114178'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#114178"', to: 'theme.primary', ctx: 'bg' },
  { from: "'#0958d9'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#0958d9"', to: 'theme.primary', ctx: 'bg' },
  { from: "'#1677FF'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#1677FF"', to: 'theme.primary', ctx: 'bg' },
  { from: "'#1677ff'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#1677ff"', to: 'theme.primary', ctx: 'bg' },

  // ============ 卡片/浅背景 ============
  { from: "'#eef3f8'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#eef3f8"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#f8fbff'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#f8fbff"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#f7faff'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#f7faff"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#fafafa'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#fafafa"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#f5f5f5'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#f5f5f5"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#F4F6FA'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#F4F6FA"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#f0f4ff'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#f0f4ff"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#f9fafb'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#f9fafb"', to: 'theme.bgSecondary', ctx: 'bg' },
  { from: "'#EEF2F8'", to: 'theme.bgTertiary', ctx: 'bg' },
  { from: '"#EEF2F8"', to: 'theme.bgTertiary', ctx: 'bg' },

  // ============ 白色背景 → 卡片 ============
  // 注意：只替换 backgroundColor 中的 '#fff'/'#ffffff'
  // color: '#fff' 通常是在主色按钮上，用 theme.btnPrimaryText

  // ============ 主色浅背景 ============
  { from: "'#d6e4ff'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#d6e4ff"', to: 'theme.primaryBg', ctx: 'bg' },
  { from: "'#e6f4ff'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#e6f4ff"', to: 'theme.primaryBg', ctx: 'bg' },
  { from: "'#bae0ff'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#bae0ff"', to: 'theme.primaryBg', ctx: 'bg' },

  // ============ 分割线 ============
  { from: "'#e8e8e8'", to: 'theme.divider', ctx: 'bg' },
  { from: '"#e8e8e8"', to: 'theme.divider', ctx: 'bg' },
  { from: "'#d9d9d9'", to: 'theme.divider', ctx: 'bg' },
  { from: '"#d9d9d9"', to: 'theme.divider', ctx: 'bg' },
  { from: "'#E8ECF4'", to: 'theme.divider', ctx: 'bg' },
  { from: '"#E8ECF4"', to: 'theme.divider', ctx: 'bg' },
  { from: "'#e2e8f0'", to: 'theme.divider', ctx: 'bg' },
  { from: '"#e2e8f0"', to: 'theme.divider', ctx: 'bg' },
  { from: "'#f0f0f0'", to: 'theme.divider', ctx: 'bg' },
  { from: '"#f0f0f0"', to: 'theme.divider', ctx: 'bg' },

  // ============ 主文字 ============
  { from: "'#111827'", to: 'theme.text', ctx: 'text' },
  { from: '"#111827"', to: 'theme.text', ctx: 'text' },
  { from: "'#1f1f1f'", to: 'theme.text', ctx: 'text' },
  { from: '"#1f1f1f"', to: 'theme.text', ctx: 'text' },
  { from: "'#262626'", to: 'theme.text', ctx: 'text' },
  { from: '"#262626"', to: 'theme.text', ctx: 'text' },
  { from: "'#1a1a1a'", to: 'theme.text', ctx: 'text' },
  { from: '"#1a1a1a"', to: 'theme.text', ctx: 'text' },
  { from: "'#0F172A'", to: 'theme.text', ctx: 'text' },
  { from: '"#0F172A"', to: 'theme.text', ctx: 'text' },
  { from: "'#141414'", to: 'theme.text', ctx: 'text' },
  { from: '"#141414"', to: 'theme.text', ctx: 'text' },
  { from: "'#333333'", to: 'theme.text', ctx: 'text' },
  { from: '"#333333"', to: 'theme.text', ctx: 'text' },
  { from: "'#333'", to: 'theme.text', ctx: 'text' },
  { from: '"#333"', to: 'theme.text', ctx: 'text' },

  // ============ 次要文字 ============
  { from: "'#6b7280'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#6b7280"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#8c8c8c'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#8c8c8c"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#595959'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#595959"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#64748B'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#64748B"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#64748b'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#64748b"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#374151'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#374151"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#4b5563'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#4b5563"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#7f8c9a'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#7f8c9a"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#666'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#666"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#666666'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#666666"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#888888'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#888888"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#999'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#999"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#999999'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#999999"', to: 'theme.textSub', ctx: 'text' },

  // ============ 提示文字 ============
  { from: "'#94A3B8'", to: 'theme.textHint', ctx: 'text' },
  { from: '"#94A3B8"', to: 'theme.textHint', ctx: 'text' },
  { from: "'#94a3b8'", to: 'theme.textHint', ctx: 'text' },
  { from: '"#94a3b8"', to: 'theme.textHint', ctx: 'text' },
  { from: "'#adb5bd'", to: 'theme.textHint', ctx: 'text' },
  { from: '"#adb5bd"', to: 'theme.textHint', ctx: 'text' },
  { from: "'#bdc3cb'", to: 'theme.textHint', ctx: 'text' },
  { from: '"#bdc3cb"', to: 'theme.textHint', ctx: 'text' },

  // ============ 主色相关文字 ============
  // '#114178' 作为 color: → theme.primaryText
  // '#d6e4ff' 作为 color: → theme.primaryText (浅蓝文字)

  // ============ 更多主色变体 ============
  { from: "'#1890ff'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#1890ff"', to: 'theme.primary', ctx: 'bg' },
  { from: "'#0f5cab'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#0f5cab"', to: 'theme.primary', ctx: 'bg' },
  { from: "'#175cd3'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#175cd3"', to: 'theme.primary', ctx: 'bg' },
  { from: "'#1d4ed8'", to: 'theme.primary', ctx: 'bg' },
  { from: '"#1d4ed8"', to: 'theme.primary', ctx: 'bg' },

  // ============ 主色浅背景(更多) ============
  { from: "'#e6f7ff'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#e6f7ff"', to: 'theme.primaryBg', ctx: 'bg' },
  { from: "'#dbeafe'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#dbeafe"', to: 'theme.primaryBg', ctx: 'bg' },
  { from: "'#f0f5ff'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#f0f5ff"', to: 'theme.primaryBg', ctx: 'bg' },
  { from: "'#f6fbff'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#f6fbff"', to: 'theme.primaryBg', ctx: 'bg' },
  { from: "'#edf2f7'", to: 'theme.primaryBg', ctx: 'bg' },
  { from: '"#edf2f7"', to: 'theme.primaryBg', ctx: 'bg' },

  // ============ 成功浅背景 ============
  { from: "'#f6ffed'", to: 'theme.success + \'22\'', ctx: 'bg' },
  { from: '"#f6ffed"', to: "theme.success + '22'", ctx: 'bg' },
  { from: "'#d1fae5'", to: 'theme.success + \'22\'', ctx: 'bg' },
  { from: '"#d1fae5"', to: "theme.success + '22'", ctx: 'bg' },
  { from: "'#fffbe6'", to: 'theme.warning + \'22\'', ctx: 'bg' },
  { from: '"#fffbe6"', to: "theme.warning + '22'", ctx: 'bg' },
  { from: "'#fff7e6'", to: 'theme.warning + \'22\'', ctx: 'bg' },
  { from: '"#fff7e6"', to: "theme.warning + '22'", ctx: 'bg' },

  // ============ 主文字(更多) ============
  { from: "'#102a43'", to: 'theme.text', ctx: 'text' },
  { from: '"#102a43"', to: 'theme.text', ctx: 'text' },
  { from: "'#334e68'", to: 'theme.text', ctx: 'text' },
  { from: '"#334e68"', to: 'theme.text', ctx: 'text' },
  { from: "'#0f172a'", to: 'theme.text', ctx: 'text' },
  { from: '"#0f172a"', to: 'theme.text', ctx: 'text' },
  { from: "'#000'", to: 'theme.text', ctx: 'text' },
  { from: '"#000"', to: 'theme.text', ctx: 'text' },

  // ============ 次要文字(更多) ============
  { from: "'#52606d'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#52606d"', to: 'theme.textSub', ctx: 'text' },
  { from: "'#475569'", to: 'theme.textSub', ctx: 'text' },
  { from: '"#475569"', to: 'theme.textSub', ctx: 'text' },

  // ============ 提示/边框颜色 ============
  { from: "'#d8e1eb'", to: 'theme.cardBorder', ctx: 'bg' },
  { from: '"#d8e1eb"', to: 'theme.cardBorder', ctx: 'bg' },
  { from: "'#d9e2ec'", to: 'theme.cardBorder', ctx: 'bg' },
  { from: '"#d9e2ec"', to: 'theme.cardBorder', ctx: 'bg' },
  { from: "'#91caff'", to: 'theme.primaryBorder', ctx: 'bg' },
  { from: '"#91caff"', to: 'theme.primaryBorder', ctx: 'bg' },
  { from: "'#bbb'", to: 'theme.cardBorder', ctx: 'bg' },
  { from: '"#bbb"', to: 'theme.cardBorder', ctx: 'bg' },
  { from: "'#ccc'", to: 'theme.cardBorder', ctx: 'bg' },
  { from: '"#ccc"', to: 'theme.cardBorder', ctx: 'bg' },
  { from: "'#ddd'", to: 'theme.divider', ctx: 'bg' },
  { from: '"#ddd"', to: 'theme.divider', ctx: 'bg' },

  // ============ 深色浅蓝背景(所有者/飞手专用) ============
  { from: "'#f8fafc'", to: 'theme.bgSecondary', ctx: 'bg' },
  { from: '"#f8fafc"', to: 'theme.bgSecondary', ctx: 'bg' },

  // ============ 危险色 ============
  { from: "'#cf1322'", to: 'theme.danger', ctx: 'all' },
  { from: '"#cf1322"', to: 'theme.danger', ctx: 'all' },
  { from: "'#ff4d4f'", to: 'theme.danger', ctx: 'all' },
  { from: '"#ff4d4f"', to: 'theme.danger', ctx: 'all' },
  { from: "'#ff4040'", to: 'theme.danger', ctx: 'all' },
  { from: '"#ff4040"', to: 'theme.danger', ctx: 'all' },
  { from: "'#ff6b6b'", to: 'theme.danger', ctx: 'all' },
  { from: '"#ff6b6b"', to: 'theme.danger', ctx: 'all' },
  { from: "'#FF6B6B'", to: 'theme.danger', ctx: 'all' },
  { from: '"#FF6B6B"', to: 'theme.danger', ctx: 'all' },
  { from: "'#fff1f0'", to: 'theme.danger + \'22\'', ctx: 'bg' },
  { from: '"#fff1f0"', to: "theme.danger + '22'", ctx: 'bg' },

  // ============ 成功色 ============
  { from: "'#389e0d'", to: 'theme.success', ctx: 'all' },
  { from: '"#389e0d"', to: 'theme.success', ctx: 'all' },
  { from: "'#52c41a'", to: 'theme.success', ctx: 'all' },
  { from: '"#52c41a"', to: 'theme.success', ctx: 'all' },
  { from: "'#00E57A'", to: 'theme.success', ctx: 'all' },
  { from: '"#00E57A"', to: 'theme.success', ctx: 'all' },

  // ============ 警告色 ============
  { from: "'#d46b08'", to: 'theme.warning', ctx: 'all' },
  { from: '"#d46b08"', to: 'theme.warning', ctx: 'all' },
  { from: "'#faad14'", to: 'theme.warning', ctx: 'all' },
  { from: '"#faad14"', to: 'theme.warning', ctx: 'all' },
  { from: "'#FFB340'", to: 'theme.warning', ctx: 'all' },
  { from: '"#FFB340"', to: 'theme.warning', ctx: 'all' },
  { from: "'#ffb340'", to: 'theme.warning', ctx: 'all' },
  { from: '"#ffb340"', to: 'theme.warning', ctx: 'all' },
];

function getAllScreenFiles() {
  const results = [];
  function walk(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (item.endsWith('.tsx')) {
        results.push(full);
      }
    }
  }
  walk(SCREENS_DIR);
  return results;
}

function getRelPath(fullPath) {
  return path.relative(SCREENS_DIR, fullPath).replace(/\\/g, '/');
}

/**
 * 核心转换函数：
 * 将 StyleSheet.create({...}) 内的颜色替换为 theme.xxx
 * 同时将 StyleSheet.create 改为 getStyles(theme: AppTheme) 函数返回
 */
function transformFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relPath = getRelPath(filePath);

  // 跳过已完整改造的文件
  if (SKIP_FILES.some(skip => relPath === skip)) {
    return { path: relPath, status: 'SKIP', changes: 0 };
  }

  // 检查是否有 useTheme
  if (!content.includes('useTheme')) {
    return { path: relPath, status: 'NO_THEME', changes: 0 };
  }

  let changes = 0;
  const original = content;

  // ===== Step 1: 检测是否已经用 getStyles 模式 =====
  const alreadyHasGetStyles = content.includes('getStyles(') || content.includes('createStyles(');

  if (!alreadyHasGetStyles) {
    // ===== Step 2: 将 const styles = StyleSheet.create 转为 getStyles 模式 =====
    
    // 找到 StyleSheet.create({ ... }) 的位置
    // 支持多行的情况
    const styleSheetRegex = /const\s+styles\s*=\s*StyleSheet\.create\s*\(\s*\{/;
    if (styleSheetRegex.test(content)) {
      // 替换定义
      content = content.replace(
        /const\s+styles\s*=\s*StyleSheet\.create\s*\(/,
        'const getStyles = (theme: AppTheme) => StyleSheet.create('
      );

      // 在函数体内添加 getStyles 调用
      // 找到 const {theme} = useTheme(); 后面插入 const styles = getStyles(theme);
      if (content.includes('const {theme} = useTheme()')) {
        content = content.replace(
          /const \{theme\} = useTheme\(\);(\s*)/,
          (match, ws) => `const {theme} = useTheme();${ws}const styles = getStyles(theme);${ws}`
        );
        changes++;
      } else if (content.includes('const { theme } = useTheme()')) {
        content = content.replace(
          /const \{ theme \} = useTheme\(\);(\s*)/,
          (match, ws) => `const { theme } = useTheme();${ws}const styles = getStyles(theme);${ws}`
        );
        changes++;
      }

      // 添加 AppTheme import
      if (!content.includes('AppTheme') && content.includes("from '../theme/") || content.includes("from '../../theme/")) {
        content = content.replace(
          /import \{useTheme\} from '(\.\.\/)*theme\/ThemeContext';/,
          (match) => `import {useTheme} from '${match.match(/'(.*?)'/)[1]}';\nimport type {AppTheme} from '${match.match(/'(.*?)'/)[1].replace('ThemeContext', 'index')}';`
        );
      } else if (!content.includes('AppTheme')) {
        // 尝试智能插入 AppTheme import
        const themeImportMatch = content.match(/import \{useTheme\} from '(\.\.\/)*theme\/ThemeContext';/);
        if (themeImportMatch) {
          const themePath = themeImportMatch[1] || '';
          content = content.replace(
            themeImportMatch[0],
            `${themeImportMatch[0]}\nimport type {AppTheme} from '${themePath}theme/index';`
          );
          changes++;
        }
      }
    }
  }

  // ===== Step 3: 在 StyleSheet.create({...}) 内替换颜色 =====
  // 找到 StyleSheet.create 区域并做颜色替换
  
  // 找到 StyleSheet 块的范围（从 StyleSheet.create( 到文件末尾通常是整个 styles 块）
  const styleBlockStart = content.search(/StyleSheet\.create\s*\(/);
  if (styleBlockStart === -1) {
    // 没有 StyleSheet，直接全局替换
    const result = applyColorReplacements(content, true);
    if (result.changes > 0) {
      content = result.content;
      changes += result.changes;
    }
  } else {
    // 只替换 StyleSheet 块内的颜色
    const before = content.substring(0, styleBlockStart);
    const styleBlock = content.substring(styleBlockStart);
    const result = applyColorReplacements(styleBlock, false);
    if (result.changes > 0) {
      content = before + result.content;
      changes += result.changes;
    }
  }

  // ===== Step 4: 处理 JSX 中的内联颜色（backgroundColor: '#fff' 等）=====
  // JSX 中的 style={{...}} 直接替换
  const jsxColorResult = applyJSXColorReplacements(content);
  if (jsxColorResult.changes > 0) {
    content = jsxColorResult.content;
    changes += jsxColorResult.changes;
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { path: relPath, status: 'PATCHED', changes };
  }

  return { path: relPath, status: 'NO_CHANGE', changes: 0 };
}

/**
 * 在 StyleSheet 块内应用颜色替换
 * 将 color: '#xxx' 和 backgroundColor: '#xxx' 替换为 theme token
 */
function applyColorReplacements(content, isFullFile) {
  let changes = 0;
  let result = content;

  for (const mapping of COLOR_MAP) {
    // 在 StyleSheet 内，颜色值用于 color: 和 backgroundColor: 属性
    // 格式: color: '#xxx', 或 backgroundColor: '#xxx',
    
    // 替换 backgroundColor: 'color'
    if (mapping.ctx === 'bg' || mapping.ctx === 'all') {
      const bgRegex = new RegExp(
        `(backgroundColor:\\s*)${escapeRegex(mapping.from)}`,
        'g'
      );
      const newBg = result.replace(bgRegex, `$1${mapping.to}`);
      if (newBg !== result) {
        changes += (result.match(bgRegex) || []).length;
        result = newBg;
      }

      // borderColor
      const borderRegex = new RegExp(
        `(borderColor:\\s*)${escapeRegex(mapping.from)}`,
        'g'
      );
      const newBorder = result.replace(borderRegex, `$1${mapping.to}`);
      if (newBorder !== result) {
        changes += (result.match(borderRegex) || []).length;
        result = newBorder;
      }
    }

    if (mapping.ctx === 'text' || mapping.ctx === 'all') {
      // color: 'color'
      const colorRegex = new RegExp(
        `((?:^|\\s)color:\\s*)${escapeRegex(mapping.from)}`,
        'gm'
      );
      const newColor = result.replace(colorRegex, `$1${mapping.to}`);
      if (newColor !== result) {
        changes++;
        result = newColor;
      }

      // tintColor / overlayColor
      const tintRegex = new RegExp(
        `(tintColor:\\s*)${escapeRegex(mapping.from)}`,
        'g'
      );
      const newTint = result.replace(tintRegex, `$1${mapping.to}`);
      if (newTint !== result) {
        changes++;
        result = newTint;
      }
    }

    if (mapping.ctx === 'all') {
      // backgroundColor
      const bgRegex2 = new RegExp(
        `(backgroundColor:\\s*)${escapeRegex(mapping.from)}`,
        'g'
      );
      const newBg2 = result.replace(bgRegex2, `$1${mapping.to}`);
      if (newBg2 !== result) { changes++; result = newBg2; }
    }
  }

  return { content: result, changes };
}

/**
 * 处理 JSX 内联样式中的颜色
 * 如 style={{backgroundColor: '#fff'}} 或 style={[..., {color: '#xxx'}]}
 */
function applyJSXColorReplacements(content) {
  let changes = 0;
  let result = content;

  // 特殊处理：backgroundColor: '#fff' 和 backgroundColor: '#ffffff' → theme.card
  const whiteBgPatterns = [
    { from: `backgroundColor: '#fff'`, to: `backgroundColor: theme.card` },
    { from: `backgroundColor: "#fff"`, to: `backgroundColor: theme.card` },
    { from: `backgroundColor: '#ffffff'`, to: `backgroundColor: theme.card` },
    { from: `backgroundColor: "#ffffff"`, to: `backgroundColor: theme.card` },
    { from: `backgroundColor: '#FFFFFF'`, to: `backgroundColor: theme.card` },
    { from: `backgroundColor: "#FFFFFF"`, to: `backgroundColor: theme.card` },
    // 浅色 bg
    { from: `backgroundColor: '#f5f5f5'`, to: `backgroundColor: theme.bgSecondary` },
    { from: `backgroundColor: "#f5f5f5"`, to: `backgroundColor: theme.bgSecondary` },
    { from: `backgroundColor: '#fafafa'`, to: `backgroundColor: theme.bgSecondary` },
    { from: `backgroundColor: "#fafafa"`, to: `backgroundColor: theme.bgSecondary` },
    // 主色 bg
    { from: `backgroundColor: '#114178'`, to: `backgroundColor: theme.primary` },
    { from: `backgroundColor: "#114178"`, to: `backgroundColor: theme.primary` },
  ];

  for (const p of whiteBgPatterns) {
    if (result.includes(p.from)) {
      result = result.split(p.from).join(p.to);
      changes++;
    }
  }

  // 白色文字（在深色/主色背景按钮上）→ theme.btnPrimaryText
  const whiteTextInButton = [
    { from: `color: '#fff'`, to: `color: theme.btnPrimaryText` },
    { from: `color: "#fff"`, to: `color: theme.btnPrimaryText` },
    { from: `color: '#ffffff'`, to: `color: theme.btnPrimaryText` },
    { from: `color: "#ffffff"`, to: `color: theme.btnPrimaryText` },
    { from: `color: '#FFFFFF'`, to: `color: theme.btnPrimaryText` },
    { from: `color: "#FFFFFF"`, to: `color: theme.btnPrimaryText` },
  ];

  for (const p of whiteTextInButton) {
    if (result.includes(p.from)) {
      result = result.split(p.from).join(p.to);
      changes++;
    }
  }

  // 主色文字（用于链接、标题等）
  const primaryTextPatterns = [
    { from: `color: '#114178'`, to: `color: theme.primaryText` },
    { from: `color: "#114178"`, to: `color: theme.primaryText` },
    { from: `color: '#1890ff'`, to: `color: theme.primaryText` },
    { from: `color: "#1890ff"`, to: `color: theme.primaryText` },
    { from: `color: '#0f5cab'`, to: `color: theme.primaryText` },
    { from: `color: "#0f5cab"`, to: `color: theme.primaryText` },
    { from: `color: '#175cd3'`, to: `color: theme.primaryText` },
    { from: `color: "#175cd3"`, to: `color: theme.primaryText` },
    { from: `color: '#1d4ed8'`, to: `color: theme.primaryText` },
    { from: `color: "#1d4ed8"`, to: `color: theme.primaryText` },
    { from: `color: '#1677ff'`, to: `color: theme.primaryText` },
    { from: `color: "#1677ff"`, to: `color: theme.primaryText` },
    { from: `color: '#1677FF'`, to: `color: theme.primaryText` },
    { from: `color: "#1677FF"`, to: `color: theme.primaryText` },
    { from: `color: '#d6e4ff'`, to: `color: theme.primaryBg` },
    { from: `color: "#d6e4ff"`, to: `color: theme.primaryBg` },
  ];

  for (const p of primaryTextPatterns) {
    if (result.includes(p.from)) {
      result = result.split(p.from).join(p.to);
      changes++;
    }
  }

  return { content: result, changes };
}

function escapeRegex(str) {
  // str 是 "'#xxx'" 形式，需要处理括号和点
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 主程序
const files = getAllScreenFiles();
let patched = 0, skipped = 0, noChange = 0, noTheme = 0;
const patchedList = [];
const errorList = [];

for (const file of files) {
  try {
    const result = transformFile(file);
    if (result.status === 'PATCHED') {
      patched++;
      patchedList.push(`  PATCHED (${result.changes} changes): ${result.path}`);
    } else if (result.status === 'SKIP') {
      skipped++;
    } else if (result.status === 'NO_THEME') {
      noTheme++;
      console.log(`  NO_THEME: ${result.path}`);
    } else {
      noChange++;
    }
  } catch (e) {
    errorList.push(`  ERROR: ${getRelPath(file)}: ${e.message}`);
  }
}

console.log('\n=== Theme Deep Patch Results ===');
console.log(`PATCHED: ${patched}`);
console.log(`SKIPPED (already done): ${skipped}`);
console.log(`NO_CHANGE: ${noChange}`);
console.log(`NO_THEME: ${noTheme}`);
if (errorList.length) {
  console.log('\nERRORS:');
  errorList.forEach(e => console.log(e));
}
if (patchedList.length) {
  console.log('\nPatched files:');
  patchedList.forEach(p => console.log(p));
}
