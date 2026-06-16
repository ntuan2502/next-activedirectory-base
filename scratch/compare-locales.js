/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/config/locales');
const files = ['en.ts', 'vi.ts', 'ja.ts', 'th.ts'];

function loadLocale(file) {
  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  // Chuyển đổi export const xxx = { ... } thành JSON hoặc CommonJS để eval
  content = content.replace(/export\s+const\s+\w+\s*=\s*/, 'module.exports = ');
  
  // Tạo file tạm để require
  const tempPath = path.join(__dirname, `temp_${file}.js`);
  fs.writeFileSync(tempPath, content);
  const data = require(tempPath);
  fs.unlinkSync(tempPath);
  return data;
}

const locales = {};
files.forEach(file => {
  locales[file] = loadLocale(file);
});

// Hàm lấy tất cả các đường dẫn key phẳng (ví dụ: common.save, usersPage.tableHeaders.username)
function getFlatKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const flatKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getFlatKeys(obj[key], flatKey));
      } else {
        keys.push(flatKey);
      }
    }
  }
  return keys;
}

const flatKeysMap = {};
files.forEach(file => {
  flatKeysMap[file] = new Set(getFlatKeys(locales[file]));
});

// Lấy hợp của tất cả các key trên mọi file
const allKeys = new Set();
files.forEach(file => {
  flatKeysMap[file].forEach(key => allKeys.add(key));
});

console.log(`Tổng số key duy nhất được tìm thấy: ${allKeys.size}`);
console.log('--- CHI TIẾT SỐ LƯỢNG KEY ---');
files.forEach(file => {
  console.log(`${file}: ${flatKeysMap[file].size} keys`);
});

console.log('\n--- CÁC KEY BỊ THIẾU GIỮA CÁC FILE ---');
allKeys.forEach(key => {
  const missingIn = [];
  files.forEach(file => {
    if (!flatKeysMap[file].has(key)) {
      missingIn.push(file);
    }
  });
  if (missingIn.length > 0) {
    console.log(`Key "${key}" bị thiếu ở: ${missingIn.join(', ')}`);
  }
});
