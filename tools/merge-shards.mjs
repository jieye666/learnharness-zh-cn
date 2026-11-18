// 把子代理产出的分片并入主词表（null 跳过），并报告统计
import fs from 'node:fs';

const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const before = Object.keys(dict).length;
const shards = ['shard-1.json', 'shard-2.json', 'shard-3.json', 'shard-4.json'];
let added = 0;
let skipped = 0;
const conflicts = [];
for (const name of shards) {
	const p = `sources/${name}`;
	if (!fs.existsSync(p)) continue;
	const data = JSON.parse(fs.readFileSync(p, 'utf8'));
	for (const [key, value] of Object.entries(data)) {
		if (typeof value !== 'string' || !value.trim()) {
			skipped += 1;
			continue;
		}
		if (dict[key] !== undefined) {
			if (dict[key] !== value) conflicts.push(`${key}: ${dict[key]} / ${value}`);
			continue;
		}
		dict[key] = value;
		added += 1;
	}
}
fs.writeFileSync('dict.source.json', `${JSON.stringify(dict, null, '\t')}\n`, 'utf8');
console.log(`合并前 ${before} 条 → 新增 ${added} 条，跳过 ${skipped} 条，现共 ${Object.keys(dict).length} 条`);
if (conflicts.length) console.log(`冲突 ${conflicts.length} 条（保留旧译）：\n${conflicts.slice(0, 10).join('\n')}`);
