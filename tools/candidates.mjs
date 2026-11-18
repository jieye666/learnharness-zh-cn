// 宽松候选：把可能上屏的英文字面量都捞出来，交给人工/子代理判断，保留 context
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const roots = ['components', 'app', 'lib', 'src/core'];

const files = [];
function walkDir(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) {
			if (!/node_modules|\.next|^tests?$/.test(e.name)) walkDir(p);
		} else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) files.push(p);
	}
}
for (const r of roots) {
	const p = path.join(SRC, r);
	if (fs.existsSync(p)) walkDir(p);
}

/** 只为砍掉明显非文案的噪声（css / svg / 路径 / 常量） */
const REJECT = [
	/^(https?:|\/|\.\/|wss?:|mailto:|data:|#)/,
	/^[A-Z0-9_]{2,}$/,
	/^[MmLlHhVvCcSsQqTtAaZz][\d\s,.\-MmLlHhVvCcSsQqTtAaZz]{12,}$/,
	/=>|function\s|\breturn\b|\bimport\b|\brequire\b|document\.|window\.|classList|addEventListener/,
	/rgba?\(|var\(|calc\(|--[a-z-]+:|px\b|rem\b|em\b|%|;|{|}/,
	/sqrt|^\d+(\.\d+)?$/,
	/^\s*$/,
];

const out = new Map();
function record(raw, kind, where, ctx) {
	let text = raw;
	if (kind === 'template') {
		if (!/\$\{/.test(raw)) kind = 'quoted';
		else {
			let i = 0;
			text = raw.replace(/\$\{[^}]*\}/g, () => `{${i++}}`);
		}
	}
	if (dict[text] !== undefined) return;
	if (text.length < 2 || text.length > 300) return;
	if (!/[A-Za-z]{2}/.test(text)) return;
	if (!/^[A-Za-z0-9 ,.'’!?&:/()·%+×↔—–\-_\[\]{}<>|$@#~*]+$/.test(text)) return;
	// REJECT 判在「去掉占位符」的版本上，否则 {0} 会被 CSS 花括号规则误杀
	const plain = text.replace(/\{\d+\}/g, '');
	if (REJECT.some((re) => re.test(plain))) return;
	// 纯小写单词（class/id/enum）交给人工，但先把明显的 kebab / 单小写词丢掉
	if (/^[a-z][a-z0-9]*$/.test(text)) return;
	if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text)) return;
	if (/^[a-z]+([A-Z][a-z]+)+$/.test(text)) return; // camelCase
	if (/\b(px|rem|rgba|hover|focus)\b/.test(text)) return;
	if (!out.has(text)) out.set(text, { kind, where, ctx });
}

for (const file of files) {
	const s = fs.readFileSync(file, 'utf8');
	const lines = s.split('\n');
	const rel = file.replace(SRC + '/', '');
	const lineAt = (idx) => s.slice(0, idx).split('\n').length;

	const tplRe = /`((?:\\.|[^`\\])*)`/g;
	let m;
	while ((m = tplRe.exec(s)) !== null) {
		const ln = lineAt(m.index);
		record(m[1], 'template', rel + ':' + ln, (lines[ln - 1] ?? '').trim().slice(0, 160));
	}
	const qRe = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g;
	while ((m = qRe.exec(s)) !== null) {
		const ln = lineAt(m.index);
		record(m[2], 'quoted', rel + ':' + ln, (lines[ln - 1] ?? '').trim().slice(0, 160));
	}
}

const list = [...out.entries()].sort((a, b) => a[0].length - b[0].length);
const tpl = list.filter(([, v]) => v.kind === 'template').length;
console.error(`候选 ${list.length} 条，其中模板 ${tpl} 条`);
for (const [text, v] of list) process.stdout.write(`${v.kind}\t${JSON.stringify(text)}\t${v.where}\t${v.ctx}\n`);
