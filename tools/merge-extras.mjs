// 把 sources/*.json（extra、shard 等）合并进 dict.source.json
// 用法：node tools/merge-extras.mjs [--write]
// 冲突（同 key 不同译法）默认保留旧值并打印，便于人工裁决
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const dictPath = path.join(root, 'dict.source.json');
const srcDir = path.join(root, 'sources');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

const order = ['extra.json', 'extra2.json', 'extra3.json', 'shard-1.json', 'shard-2.json', 'shard-3.json', 'shard-4.json'];
const files = fs
	.readdirSync(srcDir)
	.filter((f) => f.endsWith('.json') && !/^dict-backup/.test(f))
	.sort((a, b) => (order.indexOf(a) + 99) % 1000 - ((order.indexOf(b) + 99) % 1000));

const added = [];
const conflicts = [];
for (const f of files) {
	const obj = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
	for (const [k, v] of Object.entries(obj)) {
		if (v == null || typeof v !== 'string') continue;
		if (!(k in dict)) {
			dict[k] = v;
			added.push([k, v, f]);
		} else if (dict[k] !== v) {
			conflicts.push([k, dict[k], v, f]);
		}
	}
}

console.log(`新增 ${added.length} 条，词表合计 ${Object.keys(dict).length} 条`);
if (added.length) for (const [k, v, f] of added) console.log(`  + ${JSON.stringify(k)} → ${v}  (${f})`);
if (conflicts.length) {
	console.log(`\n冲突 ${conflicts.length} 条（保留旧值）：`);
	for (const [k, oldV, newV, f] of conflicts) console.log(`  ! ${JSON.stringify(k)}：旧「${oldV}」/ 新「${newV}」(${f})`);
}
if (process.argv.includes('--write')) {
	fs.writeFileSync(dictPath, `${JSON.stringify(dict, null, '\t')}\n`, 'utf8');
	console.log('\n已写入 dict.source.json');
}
