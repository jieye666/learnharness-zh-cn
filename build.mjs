// 构建 dist/：把词表注入运行时，写出 main.js 与 manifest.json
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dist = path.join(root, 'dist');
const dict = JSON.parse(fs.readFileSync(path.join(root, 'dict.source.json'), 'utf8'));
const runtime = fs.readFileSync(path.join(root, 'src', 'runtime.js'), 'utf8');

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'main.js'), runtime.replace('__DICT__', JSON.stringify(dict, null, '\t')), 'utf8');

const manifest = {
	apiVersion: 1,
	id: 'zh-cn-language-pack',
	name: '简体中文语言包',
	version: '1.2.1',
	minAppVersion: '0.6.1',
	description: '把 LearnHarness 界面文案替换为简体中文。纯前端注入，不改动应用文件，随开随用。',
	author: 'LearnHarness 中文社区',
	main: 'main.js'
};
fs.writeFileSync(path.join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
console.log(`dist/ 已生成：${Object.keys(dict).length} 条词表`);
