// 提取核心插件设置 schema 里的展示串：label / description / hint / title / name / placeholder
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone/core-plugins';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const rows = [];
for (const id of fs.readdirSync(DIR)) {
	const file = path.join(DIR, id, 'main.js');
	if (!fs.existsSync(file)) continue;
	const src = fs.readFileSync(file, 'utf8');
	for (const m of src.matchAll(/\b(label|description|hint|title|name|placeholder|helper|summary):\s*"((?:[^"\\]|\\.){2,400})"/g)) {
		const raw = m[2];
		if (!/[A-Za-z]{2}/.test(raw)) continue;
		if (/\\x|\\u/.test(raw)) continue;
		rows.push([id, m[1], raw, dict[raw]]);
	}
}
const missing = rows.filter(r => !r[3]);
const uniq = new Map();
for (const r of missing) uniq.set(r[2], r);
console.log(`命中 ${rows.length}，缺译 ${uniq.size}`);
for (const [k, r] of uniq) console.log(r[0] + '\t' + r[1] + '\t' + JSON.stringify(k));
