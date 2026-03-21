/**
 * 修复错误插入的 import 语句
 * 问题：import {useTheme} 和 import type {AppTheme} 被插入到多行 import 块中间
 * 解决：将它们移到正确位置（所有 import 语句的末尾）
 */

const fs = require('fs');
const path = require('path');

const ERROR_FILES = [
  'src/screens/airspace/ComplianceCheckScreen.tsx',
  'src/screens/airspace/NoFlyZoneScreen.tsx',
  'src/screens/client/CargoDeclarationScreen.tsx',
  'src/screens/credit/ViolationListScreen.tsx',
  'src/screens/demand/OfferDetailScreen.tsx',
  'src/screens/flight/FlightMonitoringScreen.tsx',
  'src/screens/flight/MultiPointTaskScreen.tsx',
  'src/screens/flight/TrajectoryScreen.tsx',
  'src/screens/insurance/ClaimListScreen.tsx',
  'src/screens/insurance/InsurancePolicyListScreen.tsx',
  'src/screens/order/OrderAfterSaleScreen.tsx',
  'src/screens/order/OrderDetailScreen.tsx',
  'src/screens/order/PaymentScreen.tsx',
  'src/screens/pilot/BoundDronesScreen.tsx',
  'src/screens/pilot/FlightLogScreen.tsx',
  'src/screens/profile/MyDemandsScreen.tsx',
  'src/screens/settlement/WalletScreen.tsx',
  'src/screens/supply/SupplyDirectOrderConfirmScreen.tsx',
];

const BASE = path.join(__dirname, '..');

function fixFile(relPath) {
  const filePath = path.join(BASE, relPath);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 查找并提取错误插入的 import 语句
  // 模式1：import {\nimport {useTheme} ...\nimport type {AppTheme}...\n  xxx,
  // 模式2：import {\nimport {useTheme} ...\n  xxx,
  
  // 先检查是否存在这种模式
  const hasWrongInsert = /^import \{[\r\n]+import \{useTheme\}/m.test(content);
  if (!hasWrongInsert) {
    console.log(`  SKIP (no wrong insert): ${relPath}`);
    return false;
  }
  
  // 提取被错误插入的 import 语句
  const themeImportLine = content.match(/^import \{useTheme\} from '[^']+';/m)?.[0];
  const appThemeImportLine = content.match(/^import type \{AppTheme\} from '[^']+';/m)?.[0];
  
  if (!themeImportLine) {
    console.log(`  SKIP (no theme import found): ${relPath}`);
    return false;
  }
  
  // 移除错误插入的行（从多行 import 块中间移除）
  if (appThemeImportLine) {
    content = content.replace('\n' + appThemeImportLine + '\n', '\n');
  }
  content = content.replace('\n' + themeImportLine + '\n', '\n');
  
  // 验证移除后没有破坏 import 块
  // 确保 useTheme 仍在文件中（应该有一个单独的 import 行）
  if (!content.includes('useTheme')) {
    // 需要重新添加
    console.log(`  Need to re-add theme imports: ${relPath}`);
  }
  
  // 找到所有 import 语句的末尾，在其后插入
  // 找到最后一个完整的 import 语句（单行或多行结束的 ';'）
  const lines = content.split('\n');
  let lastImportLineIdx = -1;
  let inMultilineImport = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (inMultilineImport) {
      if (line.includes(';')) {
        lastImportLineIdx = i;
        inMultilineImport = false;
      }
    } else if (line.startsWith('import ')) {
      if (!line.includes(';')) {
        // 多行 import
        inMultilineImport = true;
      } else {
        lastImportLineIdx = i;
      }
    } else if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      // 跳过空行和注释
      continue;
    } else if (lastImportLineIdx >= 0) {
      // 遇到非 import 语句且已有 import，停止
      break;
    }
  }
  
  if (lastImportLineIdx < 0) {
    console.log(`  ERROR: No import found in ${relPath}`);
    return false;
  }
  
  // 检查 useTheme 是否已经在文件中（作为独立 import 行）
  const hasThemeImport = content.includes(themeImportLine);
  const hasAppThemeImport = appThemeImportLine ? content.includes(appThemeImportLine) : false;
  
  // 在 lastImportLineIdx 后插入
  const toInsert = [];
  if (!hasThemeImport) {
    toInsert.push(themeImportLine);
  }
  if (appThemeImportLine && !hasAppThemeImport) {
    toInsert.push(appThemeImportLine);
  }
  
  if (toInsert.length > 0) {
    lines.splice(lastImportLineIdx + 1, 0, ...toInsert);
    content = lines.join('\n');
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

let fixed = 0;
for (const relPath of ERROR_FILES) {
  try {
    const result = fixFile(relPath);
    if (result) {
      fixed++;
      console.log(`FIXED: ${relPath}`);
    }
  } catch (e) {
    console.log(`ERROR: ${relPath}: ${e.message}`);
  }
}

console.log(`\nFixed ${fixed} files`);
