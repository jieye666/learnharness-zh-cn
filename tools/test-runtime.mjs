// 运行时自测：把 dist/main.js 里的词表 + 规则抽出来，在 node 里跑若干用例
import fs from 'node:fs';

const src = fs.readFileSync('dist/main.js', 'utf8').replace(/export function activate/, 'function activate');
const factory = new Function(`${src}\nreturn { translate, translateBareNoun, PATTERNS, FRAGMENTS };`);
const fakeNode = (prevText) => ({
	nodeType: 3,
	nodeValue: '',
	parentElement: null,
	previousSibling: prevText === undefined ? null : { nodeValue: prevText }
});
const { translate, translateBareNoun, PATTERNS } = factory();

const cases = [
	'Save',
	'Settings',
	'Sessions',
	'just now',
	'5m ago',
	'3h ago',
	'2d ago',
	'Version 0.6.1',
	'Tool · research',
	'Plan · 3 nodes',
	'3 nodes selected',
	'2 messages unextracted',
	'read 4 pages',
	'3 models · 连接正常',
	'Save changes',
	'  Save  ',
	'not a ui string at all'
];

let bad = 0;
for (const input of cases) {
	console.log(JSON.stringify(input), '=>', JSON.stringify(translate(input)));
}
// 纯名词补量词
for (const [txt, prev] of [['nodes', '3 '], ['nodes', 'abc '], ['session', '12 ']]) {
	const node = fakeNode(prev);
	console.log(`bare ${JSON.stringify(txt)} (prev=${JSON.stringify(prev)}) =>`, JSON.stringify(translateBareNoun(node, txt)));
}
console.log('模板规则条数:', PATTERNS.length);
if (bad) console.error(`失败 ${bad} 条`);
