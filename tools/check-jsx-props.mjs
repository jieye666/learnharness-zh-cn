// 检查 JSX 属性位置上的英文（label/title/placeholder/aria-label/alt/text/hint 等）覆盖情况
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const runtime = fs.readFileSync('dist/main.js', 'utf8').replace(/export function activate/, 'function activate');
const { translate } = new Function(`${runtime}\nreturn { translate };`)();

const PROPS = 'label|title|placeholder|aria-label|aria-placeholder|alt|text|hint|description|message|tooltip|emptyText|confirmText|subtitle|caption|heading|summary|verb|cta|confirmLabel|cancelLabel|emptyLabel|statusText|body|detail|note|reason';
const re = new RegExp(`(?:${PROPS})\\s*=\\s*"([^"\\n]{2,120})"`, 'g');
const re2 = new RegExp(`(?:${PROPS})\\s*=\\s*'([^'\\n]{2,120})'`, 'g');

const files = [];
function walkDir(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) {
			if (!/node_modules|\.next|^tests?$/.test(e.name)) walkDir(p);
		} else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
	}
}
walkDir(path.join(SRC, 'components'));
walkDir(path.join(SRC, 'app'));

const miss = new Map();
let total = 0;
for (const file of files) {
	const s = fs.readFileSync(file, 'utf8');
	for (const re1 of [re, re2]) {
		re1.lastIndex = 0;
		for (const m of s.matchAll(re1)) {
			const t = m[1].trim();
			if (!/[A-Za-z]{3}/.test(t)) continue;
			if (/^[a-z-]+(\s[a-z-]+)*$/.test(t)) continue;
			total += 1;
			if (translate(t) === null) miss.set(t, file.replace(SRC + '\\', ''));
		}
	}
}
console.log(`JSX 属性位置英文 ${total} 处，未覆盖 ${miss.size} 种`);
for (const [t, f] of [...miss].slice(0, 70)) console.log(`  ${JSON.stringify(t)}  ${f}`);
