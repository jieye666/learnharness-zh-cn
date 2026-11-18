// 只看「JSX 文本子节点」里的英文（>XXX<），检查词表覆盖：最接近真实上屏
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/LENOVO/Documents/learnharness-src';
const runtime = fs.readFileSync('dist/main.js', 'utf8').replace(/export function activate/, 'function activate');
const { translate } = new Function(`${runtime}\nreturn { translate };`)();

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
	for (const m of s.matchAll(/>\s*([A-Za-z][A-Za-z0-9 ,.'’!?&:/()·×—–+-]{2,80})\s*</g)) {
		const t = m[1].trim();
		if (!/[A-Za-z]{3}/.test(t)) continue;
		if (/^(div|span|p|li|ul|svg|path|button|label|input|h[1-6]|br|span>)$/i.test(t)) continue;
		total += 1;
		if (translate(t) === null) miss.set(t, file.replace(SRC + '\\', ''));
	}
}
console.log(`JSX 文本子节点英文 ${total} 处，未覆盖 ${miss.size} 种`);
for (const [t, f] of [...miss].slice(0, 60)) console.log(`  ${JSON.stringify(t)}  ${f}`);
