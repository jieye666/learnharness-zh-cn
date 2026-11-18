// 覆盖率报告：按源码文件统计「可能上屏的英文字面量」有多少已被词表/规则覆盖
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const runtime = fs.readFileSync('dist/main.js', 'utf8').replace(/export function activate/, 'function activate');
const { translate } = new Function(`${runtime}\nreturn { translate };`)();

const roots = ['components', 'app', 'lib'];
const files = [];
function walkDir(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) {
			if (!/node_modules|\.next|^tests?$/.test(e.name)) walkDir(p);
		} else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) files.push(p);
	}
}
for (const r of roots) {
	const p = path.join(SRC, r);
	if (fs.existsSync(p)) walkDir(p);
}

const REJECT = [
	/^(https?:|\/|\.\/|wss?:|mailto:|#[0-9a-f]{3,8})/i,
	/^[a-z0-9]+(-[a-z0-9]+)+$/,
	/^[A-Z0-9_]{2,}$/,
	/^[MmLlHhVvCcSsQqTtAaZz][\d\s,.\-]{12,}$/,
	/=>|function\s|\bimport\b|\brequire\b|document\.|window\./,
	/[;{}]|rgba?\(|var\(|calc\(|--[a-z-]+:/,
	/^\d+(\.\d+)?$/
];

const byFile = new Map();
let total = 0;
let covered = 0;

for (const file of files) {
	const s = fs.readFileSync(file, 'utf8');
	const rel = file.replace(SRC + '/', '');
	const found = new Map();
	for (const m of s.matchAll(/(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
		let t = m[2];
		if (t.length < 3 || t.length > 300) continue;
		if (!/[A-Za-z]{3}/.test(t)) continue;
		if (!/^[A-Za-z0-9 ,.'’!?&:/()·+×↔—–\-]+$/.test(t)) continue;
		if (REJECT.some((re) => re.test(t))) continue;
		if (/^[a-z][a-z0-9]*$/.test(t)) continue;
		if (!found.has(t)) found.set(t, translate(t) !== null);
	}
	if (!found.size) continue;
	const miss = [...found.entries()].filter(([, ok]) => !ok).map(([t]) => t);
	total += found.size;
	covered += found.size - miss.length;
	if (miss.length) byFile.set(rel, miss);
}

const rows = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`源码里疑似上屏字面量 ${total} 条，已覆盖 ${covered} 条（${((covered / total) * 100).toFixed(1)}%），未覆盖 ${total - covered} 条\n`);
for (const [file, miss] of rows.slice(0, 25)) {
	console.log(`${file}  未覆盖 ${miss.length}`);
	console.log('   ' + miss.slice(0, 6).map((t) => JSON.stringify(t.slice(0, 60))).join('  '));
}
