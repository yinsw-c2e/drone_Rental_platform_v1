const fs = require('fs');
const path = require('path');

const rootDir = '/Users/yinswc2e/Code/drone_Rental_platform_v1/mini-program/src/pages';

const excludedDirs = [
  'auth/login',
  'auth/mode-selection',
  'home',
  'profile/index.scss',
  'demand/list',
  'demand/detail',
  'messages'
];

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else if (f === 'index.scss') {
            callback(dirPath);
        }
    });
}

const targetFiles = [];
walkDir(rootDir, (filePath) => {
    let relativePath = path.relative(rootDir, filePath);
    let normPath = relativePath.replace(/\\/g, '/');
    
    let excluded = false;
    for (const ex of excludedDirs) {
        if (normPath === ex || normPath.startsWith(ex + '/')) {
            excluded = true;
            break;
        }
    }
    
    if (!excluded) {
        targetFiles.push(filePath);
    }
});

targetFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // 1. Replace background colors
  content = content.replace(/background:\s*(#[fF][0-9a-fA-F]{5}|#f4f7fb|#F5F7FB|#f7f9fc|#F5F7FA|#F9FAFB);\s*/g, 'background: #f5f7fa;\n');

  // 2. Remove hard borders
  content = content.replace(/border:\s*\d+r?px\s+solid\s+#[0-9a-fA-F]{3,6};?/ig, 'border: none;');
  content = content.replace(/border-top:\s*\d+r?px\s+solid\s+#[0-9a-fA-F]{3,6};?/ig, 'border-top: none;');
  content = content.replace(/border-bottom:\s*\d+r?px\s+solid\s+#[0-9a-fA-F]{3,6};?/ig, 'border-bottom: none;');
  content = content.replace(/border-left:\s*\d+r?px\s+solid\s+#[0-9a-fA-F]{3,6};?/ig, 'border-left: none;');
  content = content.replace(/border-right:\s*\d+r?px\s+solid\s+#[0-9a-fA-F]{3,6};?/ig, 'border-right: none;');

  // 3. Convert px to rpx
  content = content.replace(/(\d+)px/g, (match, p1) => {
      const val = parseInt(p1, 10);
      if (val === 0) return '0';
      if (val === 1) return '1rpx';
      return (val * 2) + 'rpx';
  });

  // 4 & 5. Header and Cards parsing
  // To avoid breaking SCSS nested rules (which regex can't perfectly parse), we'll do a simple regex that matches top-level or single-nested rules.
  content = content.replace(/([^{}]*)\{([^}]*)\}/g, (match, selector, inner) => {
      let selectors = selector.split(',').map(s => s.trim());
      
      let isCard = selectors.some(s => {
          let classes = s.match(/\.[a-zA-Z0-9_-]+/g);
          if (!classes) return false;
          let lastClass = classes[classes.length - 1];
          return /(card|panel)$/i.test(lastClass);
      });

      let isHeader = selectors.some(s => {
          let classes = s.match(/\.[a-zA-Z0-9_-]+/g);
          if (!classes) return false;
          let lastClass = classes[classes.length - 1];
          return /(navbar|header|hero)$/i.test(lastClass) || lastClass.includes('-blue-bg');
      });

      if (isHeader) {
          if (/background:\s*[^;]+;/.test(inner)) {
              inner = inner.replace(/background:\s*[^;]+;/, 'background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);');
          } else {
              inner += '\n  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);';
          }
          // remove border radius top, keep bottom
          inner = inner.replace(/border-radius:\s*[^;]+;/, 'border-radius: 0 0 24rpx 24rpx;');
          return `${selector}{${inner}}`;
      }

      if (isCard) {
          // If the card is empty-state or similar, skip or apply? We can apply.
          inner = inner.replace(/padding:\s*[^;]+;/g, 'padding: 32rpx;');
          inner = inner.replace(/margin:\s*[^;]+;/g, 'margin: 24rpx;');
          inner = inner.replace(/background:\s*[^;]+;/g, 'background: #ffffff;');
          inner = inner.replace(/border-radius:\s*[^;]+;/g, 'border-radius: 24rpx;');
          inner = inner.replace(/box-shadow:\s*[^;]+;/g, 'box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);');
          inner = inner.replace(/border:\s*[^;]+;/g, 'border: none;');
          
          if (!/padding:\s*32rpx;/.test(inner)) inner += '\n  padding: 32rpx;';
          if (!/background:\s*#ffffff;/.test(inner)) inner += '\n  background: #ffffff;';
          if (!/border-radius:\s*24rpx;/.test(inner)) inner += '\n  border-radius: 24rpx;';
          if (!/box-shadow:\s*0 4rpx 16rpx rgba\(15, 23, 42, 0\.04\);/.test(inner)) inner += '\n  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);';
          if (!/border:\s*none;/.test(inner)) inner += '\n  border: none;';
          
          return `${selector}{${inner}}`;
      }

      return match;
  });

  // 6. Scrollbar
  if (content.includes('::-webkit-scrollbar')) {
      content = content.replace(/::-webkit-scrollbar\s*\{[^}]*\}/g, '::-webkit-scrollbar { display: none; }');
  } else {
      content += '\n::-webkit-scrollbar {\n  display: none;\n}\n';
  }

  if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
  }
});
