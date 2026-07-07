import { vi } from "../src/config/locales/vi";
import { en } from "../src/config/locales/en";
import { ja } from "../src/config/locales/ja";
import { th } from "../src/config/locales/th";

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const k in obj) {
    const key = prefix ? `${prefix}.${k}` : k;
    const value = obj[k];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value as Record<string, unknown>, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

const viKeys = flattenKeys(vi as Record<string, unknown>);
const enKeys = flattenKeys(en as Record<string, unknown>);
const jaKeys = flattenKeys(ja as Record<string, unknown>);
const thKeys = flattenKeys(th as Record<string, unknown>);

console.log(`Total Keys - VI: ${viKeys.length}, EN: ${enKeys.length}, JA: ${jaKeys.length}, TH: ${thKeys.length}`);

function compare(sourceKeys: string[], targetKeys: string[], targetName: string) {
  const sourceSet = new Set(sourceKeys);
  const targetSet = new Set(targetKeys);
  
  const missing: string[] = [];
  for (const k of sourceKeys) {
    if (!targetSet.has(k)) {
      missing.push(k);
    }
  }
  
  const extra: string[] = [];
  for (const k of targetKeys) {
    if (!sourceSet.has(k)) {
      extra.push(k);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n[MISSING in ${targetName}]:`);
    missing.forEach(k => console.log(`  - ${k}`));
  }
  
  if (extra.length > 0) {
    console.log(`\n[EXTRA in ${targetName}]:`);
    extra.forEach(k => console.log(`  - ${k}`));
  }
}

compare(viKeys, enKeys, 'EN');
compare(viKeys, jaKeys, 'JA');
compare(viKeys, thKeys, 'TH');
