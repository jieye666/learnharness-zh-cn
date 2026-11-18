// 只挑「像界面文案」的串：含空格、无代码符号、长度合理
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone/core-plugins';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const seen = new Set();
const rows = [];
const VENDOR = /\b(CodeMirror|Intl|Segmenter|cursor\(|dispatch|userEvent|granularity|tabSize|lineIndent|scrollIntoView|Node|Bundle|npm|webpack)\b/;

for (const id of fs.readdirSync(DIR)) {
	const file = path.join(DIR, id, 'main.js');
	if (!fs.existsSync(file)) continue;
	const src = fs.readFileSync(file, 'utf8');
	const re = /"((?:[^"\\\n]|\\.){6,300})"|'((?:[^'\\\n]|\\.){6,300})'|`((?:[^`\\]|\\.){6,300})`/g;
	for (const m of src.matchAll(re)) {
		const t = (m[1] ?? m[2] ?? m[3] ?? '').trim();
		const plain = t.replace(/\$\{[^}]*\}/g, '{0}');
		if (!/\s/.test(plain)) continue;
		if (!/^[A-Za-z]/.test(plain)) continue;
		if (/[;{}=<>\\]|=>|\breturn\b|\bfunction\b|\bconst\b/.test(plain)) continue;
		if (VENDOR.test(plain)) continue;
		if (/[a-z]-[a-z]{2,}/.test(plain) && !/ /.test(plain.replace(/-/g, ' '))) continue;
		if (plain.split(/\s+/).length < 2) continue;
		const key = t;
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push([id, key, dict[key]]);
	}
}
const missing = rows.filter(r => !r[2]);
console.log(`候选 ${rows.length}，缺译 ${missing.length}`);
for (const [id, k] of missing) console.log(id + '\t' + JSON.stringify(k));
