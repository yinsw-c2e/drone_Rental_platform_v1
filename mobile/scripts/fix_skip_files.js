const fs = require('fs');
const path = require('path');

const files = [
  'src/screens/home/HomeScreen.tsx',
  'src/screens/order/OrderListScreen.tsx',
];

const BASE = process.cwd();

for (const relPath of files) {
  const filePath = path.join(BASE, relPath);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('useTheme')) {
    console.log('NO useTheme:', relPath);
    continue;
  }
  
  // Add AppTheme import if missing
  if (!content.includes('AppTheme')) {
    const themeImportMatch = content.match(/import \{useTheme\} from '[^']+ThemeContext';/);
    if (themeImportMatch) {
      content = content.replace(
        themeImportMatch[0],
        themeImportMatch[0] + "\nimport type {AppTheme} from '../../theme/index';"
      );
    }
  }
  
  // Convert StyleSheet.create to getStyles function
  if (!content.includes('getStyles')) {
    content = content.replace(
      /const\s+styles\s*=\s*StyleSheet\.create\s*\(/,
      'const getStyles = (theme: AppTheme) => StyleSheet.create('
    );
    
    // Insert const styles = getStyles(theme) after useTheme call
    content = content.replace(
      /const \{theme[^}]*\} = useTheme\(\);/,
      (match) => match + '\n  const styles = getStyles(theme);'
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Done:', relPath);
}
