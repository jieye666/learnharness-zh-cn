// 覆盖率体检：把 SSR HTML 切成文本片段，用运行时同一套规则跑一遍，列出「仍是英文」的残留
import fs from 'node:fs';

const runtime = fs.readFileSync('dist/main.js', 'utf8').replace(/export function activate/, 'function activate');
const { translate } = new Function(`${runtime}\nreturn { translate };`)();

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');

const texts = [];
// 文本节点
for (const m of html.matchAll(/>([^<>]+)</g)) texts.push(m[1]);
// 展示类属性
for (const m of html.matchAll(/(?:placeholder|aria-label|title|alt)="([^"]*)"/g)) texts.push(m[1]);
// RSC/JSON 里的可见句子（含空格的英文串）
for (const m of html.matchAll(/"((?:[A-Z][^"\\]{6,})+)"/g)) texts.push(m[1]);

const seen = new Set();
const leftovers = [];
for (const raw of texts) {
	const t = raw.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
	if (!t || seen.has(t)) continue;
	seen.add(t);
	if (!/[A-Za-z]{2}/.test(t)) continue;
	if (!/[A-Za-z]{2,}/.test(t.replace(/[<>{}\[\]()]/g, ''))) continue;
	if (/^(https?:|\/|\.\/|[a-z-]+:)/.test(t)) continue;
	if (/#[\w-]|react\.|__next/.test(t)) continue;
	if (translate(raw) !== null) continue;
	if (translate(t) !== null) continue;
	leftovers.push(t);
}
console.log(`共检查 ${seen.size} 条片段，未译 ${leftovers.length} 条`);
for (const t of leftovers.sort((a, b) => a.length - b.length)) console.log(' -', JSON.stringify(t.slice(0, 120)));
