// 全面提取：源码里所有可能上屏的英文字面量（含 ${} 插值模板），与现有词表做差集。
// 输出 TSV：kind \t JSON(文本) \t 位置
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const roots = ['components', 'app', 'lib'];

const files = [];
function walkDir(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) {
			if (!/node_modules|\.next|^tests?$/.test(e.name)) walkDir(p);
		} else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) {
			files.push(p);
		}
	}
}
for (const r of roots) {
	const p = path.join(SRC, r);
	if (fs.existsSync(p)) walkDir(p);
}

/** 明显不是文案的东西 */
const REJECT = [
	/^[a-z0-9]+(-[a-z0-9]+)+$/, // kebab id / class
	/^(https?:|\/|\.\/|wss?:|mailto:|data:)/,
	/^[A-Z0-9_]{3,}$/, // CONSTANT
	/^[MmLlHhVvCcSsQqTtAaZz][\d\s,.\-MmLlHhVvCcSsQqTtAaZz]{10,}$/, // svg path
	/\$\{|=>|function\s|\breturn\b|\bimport\b|require\(|document\.|window\.|addEventListener/,
	/sqrt|rgba?\(|var\(|--[a-z]/, // css
	/^[a-z]+([A-Z][a-z]+)+$/, // camelCase 标识符
];
const CSS_PROPS = /\b(flex|grid|block|inline|absolute|relative|sticky|hidden|truncate|uppercase|italic|pointer-events|select-none|whitespace|break-words|shrink|grow|basis|justify|items-center|self-|place-|content-|divide-|ring-|stroke-|fill-|aspect-|object-|cursor-|group|peer|dark:|hover:|focus:|active:|disabled:|data-\[|aria-|text-(xs|sm|base|lg|xl)|bg-|border-|rounded|shadow|size-|w-|h-|p-|m-|gap-|space-|overflow|animate|transition|duration|ease|opacity|z-|top-|left-|right-|bottom-|max-|min-|font-|leading-|tracking-)\b/;

const out = new Map();
let templateHits = 0;

function record(raw, kind, where) {
	let text = raw;
	if (kind === 'template') {
		if (!/\$\{/.test(raw)) kind = 'quoted';
		else {
			let i = 0;
			text = raw.replace(/\$\{[^}]*\}/g, () => `{${i++}}`);
			templateHits += 1;
		}
	}
	if (dict[text] !== undefined) return;
	if (text.length < 2 || text.length > 400) return;
	if (!/[A-Za-z]{2}/.test(text)) return;
	if (!/^[\x20-\x7E\u00A0-\u024F\u2010-\u2027\u2030-\u22FF\u2190-\u21FF\u2600-\u27BF·…—’“”]+$/.test(text)) return;
	const plain = text.replace(/\{\d+\}/g, '');
	if (REJECT.some((re) => re.test(text))) return;
	if (CSS_PROPS.test(plain) && plain.includes(' ')) return;
	if (plain.trim().length < 2) return;
	if (!out.has(text)) out.set(text, { kind, where });
}

for (const file of files) {
	const s = fs.readFileSync(file, 'utf8');
	const rel = file.replace(SRC + '/', '');
	const lineAt = (idx) => rel + ':' + s.slice(0, idx).split('\n').length;

	const tplRe = /`((?:\\.|[^`\\])*)`/g;
	let m;
	while ((m = tplRe.exec(s)) !== null) record(m[1], 'template', lineAt(m.index));
	const qRe = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g;
	while ((m = qRe.exec(s)) !== null) record(m[2], 'quoted', lineAt(m.index));
}

const list = [...out.entries()].sort((a, b) => a[0].length - b[0].length);
const tpl = list.filter(([, v]) => v.kind === 'template').length;
console.error(`未收录 ${list.length} 条，其中模板插值 ${tpl} 条（模板命中 ${templateHits}）`);
for (const [text, v] of list) process.stdout.write(`${v.kind}\t${JSON.stringify(text)}\t${v.where}\n`);
