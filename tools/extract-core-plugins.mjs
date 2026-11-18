// 从内置核心插件的前端 main.js 里抽「像文案」的字符串，输出 TSV 供翻译
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone/core-plugins';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const out = [];
const seen = new Set();

const REJECT_CSS = /[;{}]|\b[a-z-]+:\s|\b(tailwind|flex|grid|rounded|px-|text-|bg-|hover:|dark:)/;
for (const id of fs.readdirSync(DIR)) {
	const file = path.join(DIR, id, 'main.js');
	if (!fs.existsSync(file)) continue;
	const src = fs.readFileSync(file, 'utf8');
	const re = /"((?:[^"\\\n]|\\.){2,400})"|'((?:[^'\\\n]|\\.){2,400})'|`((?:[^`\\]|\\.){2,400})`/g;
	for (const m of src.matchAll(re)) {
		let t = (m[1] ?? m[2] ?? m[3] ?? '').trim();
		if (!t) continue;
		const plain = t.replace(/\$\{[^}]*\}/g, '{0}');
		if (!/[A-Za-z]{2}/.test(plain)) continue;
		if (REJECT_CSS.test(plain) && !/\s/.test(plain)) continue;
		if (/^[a-z0-9_-]+$/.test(plain)) continue;          // 单个小写标识符
		if (/^[\d.]+$/.test(plain)) continue;
		if (/\.(js|css|json|ts|mjs|svg|png)$/.test(plain)) continue;
		if (/^https?:|^\/|^\.\.?\//.test(plain)) continue;
		const looksProse = /\s/.test(plain) ? true : /^[A-Z]/.test(plain);
		if (!looksProse) continue;
		const key = t;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push([id, JSON.stringify(t), dict[t] ? '有' : '缺']);
	}
}
console.log('样例数 ' + out.length + '，其中词表已有 ' + out.filter(r => r[2] === '有').length + '，缺 ' + out.filter(r => r[2] === '缺').length);
for (const [id, js, st] of out) if (st === '缺') console.log(`${id}\t${js}`);
