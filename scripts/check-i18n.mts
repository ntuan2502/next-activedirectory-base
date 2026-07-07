import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { fileURLToPath } from 'url';

// Because Node.js v24 can run ES modules natively via .mts extension
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const localesDir = path.join(projectRoot, 'src', 'config', 'locales');
const srcDir = path.join(projectRoot, 'src');

console.log('='.repeat(60));
console.log('  i18n CHECKER - Next.js TS Translation Audit');
console.log('='.repeat(60));

if (!fs.existsSync(localesDir)) {
  console.error(`Error: Locales directory does not exist: ${localesDir}`);
  process.exit(1);
}

const files = fs.readdirSync(localesDir).filter((f: string) => f.endsWith('.ts'));
const locales: Record<string, Record<string, unknown>> = {};

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const lang = path.basename(file, '.ts');
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip TypeScript types/export to make it plain JS
  const exportRegex = new RegExp(`export\\s+const\\s+${lang}\\s*=`);
  content = content.replace(exportRegex, `const ${lang} =`);
  content += `\n; ${lang};`; // Return the object

  try {
    const script = new vm.Script(content);
    const context = vm.createContext({});
    const evaluated = script.runInContext(context);
    if (evaluated && typeof evaluated === 'object' && !Array.isArray(evaluated)) {
      locales[lang] = evaluated as Record<string, unknown>;
    } else {
      locales[lang] = {};
    }
  } catch (err) {
    console.error(`Error loading/evaluating locale file ${file}:`, err);
  }
}

const languages = Object.keys(locales);
console.log(`\n[LOCALES] Found ${languages.length} language(s): ${languages.join(', ')}`);

// Flatten keys helper
function flattenKeys(obj: unknown, prefix = ''): Record<string, string> {
  const keys: Record<string, string> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    for (const k in record) {
      const val = record[k];
      const newKey = prefix ? `${prefix}.${k}` : k;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(keys, flattenKeys(val, newKey));
      } else {
        keys[newKey] = String(val);
      }
    }
  }
  return keys;
}

const flattenedLocales: Record<string, Record<string, string>> = {};
const allKeysUnion = new Set<string>();

for (const lang of languages) {
  const flattened = flattenKeys(locales[lang]);
  flattenedLocales[lang] = flattened;
  for (const key in flattened) {
    allKeysUnion.add(key);
  }
}

// 2. Check completeness
let completenessIssues = 0;
console.log('\n[COMPLETENESS CHECK]');
console.log('-'.repeat(40));

for (const lang of languages) {
  const missingKeys: string[] = [];
  const currentKeys = flattenedLocales[lang];

  for (const key of allKeysUnion) {
    if (!(key in currentKeys)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    completenessIssues += missingKeys.length;
    console.log(`❌ Locale '${lang}' is missing ${missingKeys.length} key(s):`);
    missingKeys.sort().forEach(k => console.log(`   → ${k}`));
  } else {
    console.log(`✅ Locale '${lang}' has all keys.`);
  }
}

// 3. Scan Codebase
function getFiles(dir: string, filesList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return filesList;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      if (!name.includes('node_modules') && !name.includes('.next') && !name.includes('config/locales')) {
        getFiles(name, filesList);
      }
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      filesList.push(name);
    }
  }
  return filesList;
}

interface TUsage {
  file: string;
  line: number;
  key: string;
  isDynamic: boolean;
  prefix?: string;
}

const codeFiles = getFiles(srcDir);
const tUsages: TUsage[] = [];

for (const file of codeFiles) {
  const relativePath = path.relative(projectRoot, file);
  const content = fs.readFileSync(file, 'utf8');
  
  const lines = content.split('\n');
  lines.forEach((line: string, index: number) => {
    let lineMatch: RegExpExecArray | null;
    const lineRegex = /\bt\(\s*(['"`])(.*?)\1/g;
    while ((lineMatch = lineRegex.exec(line)) !== null) {
      const key = lineMatch[2];
      if (key.includes('${')) {
        const prefix = key.split('${')[0];
        tUsages.push({
          file: relativePath,
          line: index + 1,
          key,
          isDynamic: true,
          prefix
        });
      } else if (key.endsWith('.')) {
        tUsages.push({
          file: relativePath,
          line: index + 1,
          key,
          isDynamic: true,
          prefix: key
        });
      } else {
        tUsages.push({
          file: relativePath,
          line: index + 1,
          key,
          isDynamic: false
        });
      }
    }
  });
}

// 4. Validate
let codeIssues = 0;
console.log('\n[CODE USAGE CHECK]');
console.log('-'.repeat(40));

const uniqueMissingKeys = new Set<string>();
const missingUsages: TUsage[] = [];

for (const usage of tUsages) {
  if (usage.isDynamic) {
    const hasMatch = Array.from(allKeysUnion).some(k => k.startsWith(usage.prefix || ''));
    if (!hasMatch) {
      const keyDetail = `${usage.prefix}*`;
      uniqueMissingKeys.add(keyDetail);
      missingUsages.push(usage);
    }
  } else {
    if (!allKeysUnion.has(usage.key)) {
      uniqueMissingKeys.add(usage.key);
      missingUsages.push(usage);
    }
  }
}

if (missingUsages.length > 0) {
  codeIssues = missingUsages.length;
  console.log(`❌ Found ${missingUsages.length} translation key usages in code that are missing in locales:`);
  
  const grouped: Record<string, TUsage[]> = {};
  for (const usage of missingUsages) {
    if (!grouped[usage.file]) {
      grouped[usage.file] = [];
    }
    grouped[usage.file].push(usage);
  }

  for (const file in grouped) {
    console.log(`  File: ${file}`);
    for (const usage of grouped[file]) {
      const dynamicLabel = usage.isDynamic ? ' (dynamic prefix)' : '';
      console.log(`    Line ${usage.line}: key '${usage.key}'${dynamicLabel} is missing`);
    }
  }
} else {
  console.log('✅ All keys used in code are defined in locales.');
}

console.log('\n' + '='.repeat(60));
const totalIssues = completenessIssues + codeIssues;
if (totalIssues === 0) {
  console.log('🎉 SUCCESS: i18n check passed!');
  process.exit(0);
} else {
  console.log(`❌ FAILURE: Found ${totalIssues} issue(s) total (${completenessIssues} in locales, ${codeIssues} in code)`);
  process.exit(1);
}
