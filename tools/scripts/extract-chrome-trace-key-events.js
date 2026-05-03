#!/usr/bin/env node
/**
 * 从 Chrome DevTools Performance 导出的 Trace JSON 中流式抽取关键事件，
 * 避免整文件 JSON.parse（大 trace 可达百万行）。
 *
 * 用法:
 *   node tools/scripts/extract-chrome-trace-key-events.js <trace.json> [-o 输出.csv]
 *
 * 默认输出 CSV 到 stdout；指定 -o 则写入文件（UTF-8）。
 *
 * 抽取: UpdateCounters, MajorGC, MinorGC,
 *       ResourceSendRequest（仅 URL 含 assets/、prefabs_sub、query-extname 之一）,
 *       XHRLoad（同上 URL 过滤）
 *
 * 说明: ResourceFinish 单局可达上万条，默认不抽取；需要时可改脚本内常量。
 */

'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');

function parseArgs(argv) {
    let infile = null;
    let outfile = null;
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '-o' && argv[i + 1]) {
            outfile = argv[++i];
            continue;
        }
        if (argv[i].startsWith('-')) {
            console.error('未知参数:', argv[i]);
            process.exit(1);
        }
        if (!infile) infile = argv[i];
    }
    return { infile, outfile };
}

function readTsWindowFromHead(filePath, readBytes = 98304) {
    const fd = fs.openSync(filePath, 'r');
    try {
        const buf = Buffer.alloc(readBytes);
        const n = fs.readSync(fd, buf, 0, readBytes, 0);
        const head = buf.slice(0, n).toString('utf8');
        const minM = head.match(/"min"\s*:\s*(\d+)\s*,\s*"max"\s*:\s*(\d+)/);
        const startM = head.match(/"startTime"\s*:\s*"([^"]+)"/);
        if (!minM) {
            return { tsMin: null, tsMax: null, startTime: startM ? startM[1] : null };
        }
        return {
            tsMin: Number(minM[1]),
            tsMax: Number(minM[2]),
            startTime: startM ? startM[1] : null,
        };
    } finally {
        fs.closeSync(fd);
    }
}

function relSeconds(ts, tsMin) {
    if (tsMin == null || ts == null) return '';
    // Chrome trace 时间戳为微秒
    return (((ts - tsMin) / 1e6).toFixed(3));
}

function heapMb(bytes) {
    if (bytes == null || Number.isNaN(bytes)) return '';
    return (bytes / 1024 / 1024).toFixed(2);
}

function urlInteresting(url) {
    if (!url || typeof url !== 'string') return false;
    return (
        url.includes('prefabs_sub') ||
        url.includes('/assets/') ||
        url.includes('query-extname')
    );
}

function shortenUrl(u, maxLen = 120) {
    if (!u) return '';
    return u.length <= maxLen ? u : u.slice(0, maxLen) + '…';
}

function csvEscape(s) {
    if (s == null) return '';
    const t = String(s);
    if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
}

function row(cols) {
    return cols.map(csvEscape).join(',');
}

async function run() {
    const { infile, outfile } = parseArgs(process.argv);
    if (!infile) {
        console.error(
            '用法: node tools/scripts/extract-chrome-trace-key-events.js <trace.json> [-o out.csv]'
        );
        process.exit(1);
    }
    const abs = path.resolve(infile);
    if (!fs.existsSync(abs)) {
        console.error('文件不存在:', abs);
        process.exit(1);
    }

    const { tsMin, tsMax, startTime } = readTsWindowFromHead(abs);
    const lines = [];

    lines.push(
        row([
            'time_s',
            'event',
            'documents',
            'jsListeners',
            'nodes',
            'heap_used_mb',
            'gc_heap_before_mb',
            'gc_heap_after_mb',
            'dur_ms',
            'url_or_note',
        ])
    );

    const rl = readline.createInterface({
        input: fs.createReadStream(abs, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });

    let inTraceEvents = false;
    let lineNo = 0;
    let parsedOk = 0;
    let parsedErr = 0;

    /** 仅当计数/堆与上一行不同才输出 UpdateCounters，避免同帧重复上万行 */
    let lastCounterKey = '';

    for await (const rawLine of rl) {
        lineNo++;
        const line = rawLine.trim();
        if (!inTraceEvents) {
            if (line.includes('"traceEvents"')) {
                inTraceEvents = true;
            }
            continue;
        }
        if (line === ']' || line === '],') break;
        if (!line.startsWith('{')) continue;

        const jsonStr = line.endsWith(',') ? line.slice(0, -1) : line;
        let ev;
        try {
            ev = JSON.parse(jsonStr);
        } catch {
            parsedErr++;
            continue;
        }
        parsedOk++;
        const name = ev.name;
        const ts = ev.ts;
        const tRel = relSeconds(ts, tsMin);

        if (name === 'UpdateCounters') {
            const d = ev.args && ev.args.data;
            if (!d) continue;
            // 仅文档/监听/节点变化时打点，避免堆每抖 0.01MB 就刷屏；堆占用仍写入当前列供对照
            const key = `${d.documents}|${d.jsEventListeners}|${d.nodes}`;
            if (key === lastCounterKey) continue;
            lastCounterKey = key;
            lines.push(
                row([
                    tRel,
                    'UpdateCounters',
                    d.documents,
                    d.jsEventListeners,
                    d.nodes,
                    heapMb(d.jsHeapSizeUsed),
                    '',
                    '',
                    '',
                    '',
                ])
            );
            continue;
        }

        if (name === 'MajorGC' || name === 'MinorGC') {
            const a = ev.args || {};
            lines.push(
                row([
                    tRel,
                    name,
                    '',
                    '',
                    '',
                    '',
                    heapMb(a.usedHeapSizeBefore),
                    heapMb(a.usedHeapSizeAfter),
                    ev.dur != null ? String(ev.dur / 1000) : '',
                    a.type || '',
                ])
            );
            continue;
        }

        if (name === 'ResourceSendRequest') {
            const url = ev.args && ev.args.data && ev.args.data.url;
            if (!urlInteresting(url)) continue;
            lines.push(
                row([
                    tRel,
                    name,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    ev.dur != null ? String(ev.dur / 1000) : '',
                    shortenUrl(url),
                ])
            );
            continue;
        }

        if (name === 'XHRLoad') {
            const url = ev.args && ev.args.data && ev.args.data.url;
            if (!urlInteresting(url)) continue;
            lines.push(
                row([
                    tRel,
                    'XHRLoad',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    ev.dur != null ? String(ev.dur / 1000) : '',
                    shortenUrl(url),
                ])
            );
        }
    }

    const banner =
        `# trace: ${path.basename(abs)}\n` +
        `# startTime: ${startTime || 'N/A'}\n` +
        `# tsMin: ${tsMin ?? 'N/A'} tsMax: ${tsMax ?? 'N/A'} range_us: ${tsMin != null && tsMax != null ? tsMax - tsMin : 'N/A'}\n`;

    const body = lines.join('\n') + '\n';
    const out = banner + body;

    if (outfile) {
        const outAbs = path.resolve(outfile);
        fs.writeFileSync(outAbs, out, 'utf8');
        console.error('已写入:', outAbs, '行数(含表头):', lines.length);
    } else {
        process.stdout.write(out);
    }

    console.error(
        `解析完成: 尝试解析 ${parsedOk} 行事件 JSON, 失败 ${parsedErr}, 输出行(含表头) ${lines.length}`
    );
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
