#!/usr/bin/env node
/**
 * 统计 MemoryProbe 导出的 [MEM_NODE] 控制台日志：节点数、路径前缀、标签、末级节点名。
 *
 * 用法:
 *   node tools/scripts/stat-mem-node-log.js <log.txt>
 *   node tools/scripts/stat-mem-node-log.js <log.txt> --last
 *   node tools/scripts/stat-mem-node-log.js <log.txt> --depth 3 --top 25
 *
 * 选项:
 *   --last        只统计最后一次 dump（默认统计每一次 dump，并附汇总表）
 *   --depth N     路径前缀深度（1=/Canvas, 2=/Canvas/Towers，默认 2）
 *   --top N       每个表里只显示前 N 行（默认 30）
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const file = argv.find((a) => !a.startsWith('--'));
  const last = argv.includes('--last');
  let depth = 2;
  let top = 30;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--depth' && argv[i + 1]) depth = Math.max(1, parseInt(argv[++i], 10) || 2);
    if (argv[i] === '--top' && argv[i + 1]) top = Math.max(1, parseInt(argv[++i], 10) || 30);
  }
  return { file, last, depth, top };
}

/** @returns {{ type: 'begin', gameTimeSec: string, totalNodes: number } | { type: 'end', totalNodes: number } | { type: 'row', seq: number, tags: string, path: string, active: number, aih: number } | null} */
function parseLine(line) {
  const idx = line.indexOf('[MEM_NODE]');
  if (idx === -1) return null;
  let rest = line.slice(idx + '[MEM_NODE]'.length).trimStart();
  if (rest.startsWith('dump begin')) {
    const gt = rest.match(/gameTimeSec=(\S+)/);
    const tn = rest.match(/totalNodes=(\d+)/);
    return {
      type: 'begin',
      gameTimeSec: gt ? gt[1] : 'n/a',
      totalNodes: tn ? parseInt(tn[1], 10) : 0,
    };
  }
  if (rest.startsWith('dump end')) {
    const tn = rest.match(/totalNodes=(\d+)/);
    return { type: 'end', totalNodes: tn ? parseInt(tn[1], 10) : 0 };
  }
  const parts = rest.split('\t');
  if (parts.length < 6) return null;
  const seq = parseInt(parts[0], 10);
  if (Number.isNaN(seq)) return null;
  const tags = parts[1] ?? '-';
  const active = parts[2]?.startsWith('active=') ? parseInt(parts[2].slice(7), 10) : -1;
  const aih = parts[3]?.startsWith('aih=') ? parseInt(parts[3].slice(4), 10) : -1;
  const nodePath = parts.length > 6 ? parts.slice(6).join('\t') : parts[5]?.startsWith('/') ? parts[5] : '';
  return { type: 'row', seq, tags, path: nodePath || '(no-path)', active, aih };
}

function pathPrefix(p, depth) {
  if (!p || p === '(no-path)') return '(no-path)';
  const segs = p.split('/').filter(Boolean);
  if (segs.length === 0) return '/';
  const take = Math.min(depth, segs.length);
  return '/' + segs.slice(0, take).join('/');
}

function leafName(p) {
  if (!p || p === '(no-path)') return '(no-path)';
  const segs = p.split('/').filter(Boolean);
  return segs.length ? segs[segs.length - 1] : '(no-path)';
}

function bump(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function tagBreakdown(tags) {
  const set = {};
  if (tags && tags !== '-') {
    for (const t of tags.split(',')) {
      const s = t.trim();
      if (s) set[s] = (set[s] || 0) + 1;
    }
  }
  return set;
}

function sortEntries(map, top) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

function printTable(title, entries) {
  console.log(`\n--- ${title} ---`);
  if (!entries.length) {
    console.log('(empty)');
    return;
  }
  const w = Math.max(...entries.map(([k]) => String(k).length), 8);
  for (const [k, n] of entries) {
    console.log(String(k).padEnd(w) + '\t' + n);
  }
}

function aggregateRows(rows, depth, top) {
  const byPrefix = new Map();
  const byLeaf = new Map();
  const tagCounts = new Map();
  let active1 = 0;
  let aih1 = 0;
  let poolBench = 0;
  for (const r of rows) {
    if (r.type !== 'row') continue;
    bump(byPrefix, pathPrefix(r.path, depth));
    bump(byLeaf, leafName(r.path));
    if (r.active === 1) active1++;
    if (r.aih === 1) aih1++;
    if (r.tags.includes('pool_bench')) poolBench++;
    const tb = tagBreakdown(r.tags);
    for (const k of Object.keys(tb)) {
      bump(tagCounts, k, tb[k]);
    }
  }
  return {
    byPrefix: sortEntries(byPrefix, top),
    byLeaf: sortEntries(byLeaf, top),
    tagCounts: sortEntries(tagCounts, top),
    rowCount: rows.filter((r) => r.type === 'row').length,
    active1,
    aih1,
    poolBench,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const { file, last, depth, top } = parseArgs(argv);
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node stat-mem-node-log.js <log.txt> [--last] [--depth N] [--top N]');
    process.exit(1);
  }
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  /** @type {Array<{ gameTimeSec: string, headerTotal: number, rows: ReturnType<typeof parseLine>[]}>} */
  const dumps = [];
  let cur = null;

  for (const line of lines) {
    const ev = parseLine(line);
    if (!ev) continue;
    if (ev.type === 'begin') {
      cur = { gameTimeSec: ev.gameTimeSec, headerTotal: ev.totalNodes, rows: [] };
      dumps.push(cur);
    } else if (ev.type === 'row' && cur) {
      cur.rows.push(ev);
    } else if (ev.type === 'end' && cur) {
      cur = null;
    }
  }

  const toRun = last ? dumps.slice(-1) : dumps;

  console.log(`File: ${path.resolve(file)}`);
  console.log(`Dumps in file: ${dumps.length}${last ? ' (using last only)' : ''}`);
  console.log(`Prefix depth: ${depth} (--depth)`);

  const summaries = [];
  for (const d of toRun) {
    const agg = aggregateRows(d.rows, depth, top);
    summaries.push({
      gameTimeSec: d.gameTimeSec,
      headerTotal: d.headerTotal,
      parsedRows: agg.rowCount,
      ...agg,
    });
  }

  for (const s of summaries) {
    console.log('\n========');
    console.log(
      `gameTimeSec=${s.gameTimeSec}\theader totalNodes=${s.headerTotal}\tparsed rows=${s.parsedRows}\tactive=1: ${s.active1}\taih=1: ${s.aih1}\ttags pool_bench: ${s.poolBench}`
    );
    printTable(`path prefix (depth ${depth})`, s.byPrefix);
    printTable('leaf node name', s.byLeaf);
    printTable('tag counts (per node)', s.tagCounts);
  }

  if (!last && dumps.length > 1) {
    console.log('\n======== SUMMARY: totalNodes / dump (from header) ========');
    for (const d of dumps) {
      console.log(`t=${d.gameTimeSec}s\t${d.headerTotal}`);
    }
    const maxDump = dumps.reduce((a, d) => (d.headerTotal > a.headerTotal ? d : a), dumps[0]);
    if (maxDump) {
      console.log(`\nPeak totalNodes (header): ${maxDump.headerTotal} at gameTimeSec=${maxDump.gameTimeSec}s`);
    }
  }
}

main();
