import fs from 'node:fs';
import path from 'node:path';
const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const roots = ['components', 'app', 'lib', 'src/core'];
const DISPLAY = /(children|label|title|description|aria-label|placeholder|alt|message|hint|tooltip|summary|subtitle|caption|heading|text|emptyText|confirmText|error|note|content)\s*[:=]\s*$/;
const out = new Map();
function scan(file) {
	const s = fs.readFileSync(file, 'utf8');
	const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
	let m;
	while ((m = re.exec(s))) {
		const v = m[2];
		if (v.includes('${')) continue;
		if (!/^[A-Za-z][A-Za-z0-9 ,.'’!?&:/()·%+×↔—–-]{2,200}$/.test(v)) continue;
		if (/^(https?:|\/|\.\/|wss?:)/.test(v)) continue;
		if (dict[v] !== undefined) continue;
		const before = s.slice(Math.max(0, m.index - 90), m.index);
		const after = s.slice(m.index + m[0].length, m.index + m[0].length + 4);
		const inJsx = /<[^<>]*>\s*$/.test(before) || /^\s*</.test(after);
		const disp = DISPLAY.test(before);
		const arr = /[[,]\s*$/.test(before);
		if (!inJsx && !disp) continue;
		if (v.split(' ').length < 2 && v.length < 4) continue;
		if (!out.has(v)) out.set(v, file.replace(SRC + '/', '') + ':' + s.slice(0, m.index).split('\n').length + (inJsx ? ' [jsx]' : ' [prop]'));
	}
}
for (const r of roots) { const p = path.join(SRC, r); if (fs.existsSync(p)) { const st = fs.statSync(p); if (st.isDirectory()) { const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|\.next|tests?$/.test(e.name)) walk(q); } else if (/\.(ts|tsx)$/.test(e.name)) scan(q); } }; walk(p); } } }
const list = [...out.entries()].sort((a, b) => a[0].length - b[0].length);
console.log('JSX/属性位置未收录：' + list.length);
for (const [k, w] of list) console.log(JSON.stringify(k) + '\t' + w);
