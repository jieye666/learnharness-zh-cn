import fs from 'node:fs';
import path from 'node:path';
const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const roots = ['components', 'app', 'lib', 'src/core'];
const out = new Map();
function walkDir(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) { if (!/node_modules|\.next|tests?$/.test(e.name)) walkDir(p); }
		else if (/\.(ts|tsx)$/.test(e.name)) scan(p);
	}
}
function scan(file) {
	const s = fs.readFileSync(file, 'utf8');
	// 只取 "…" 与 '…' 与 `…`（无 ${}）字面量
	const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
	let m;
	while ((m = re.exec(s))) {
		const v = m[2];
		if (v.includes('${')) continue;
		if (!/^[A-Za-z][A-Za-z0-9 ,.'’!?&:/()·%+×↔—–-]{3,160}$/.test(v)) continue;
		if (v.split(' ').length < 2) continue;      // 至少两个词，跳过标识符
		if (/^(https?:|\/|\.\/|wss?:)/.test(v)) continue;
		if (/^[a-z0-9-]+$/.test(v)) continue;        // kebab
		if (dict[v] !== undefined) continue;
		const key = v;
		if (!out.has(key)) out.set(key, file.replace(SRC + '/', '') + ':' + (s.slice(0, m.index).split('\n').length));
	}
}
for (const r of roots) { const p = path.join(SRC, r); if (fs.existsSync(p)) walkDir(p); }
const list = [...out.entries()].sort((a, b) => a[0].length - b[0].length);
console.log('未收录可读串：' + list.length);
for (const [k, where] of list) console.log(JSON.stringify(k) + '\t' + where);
