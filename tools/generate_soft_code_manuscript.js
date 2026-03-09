// 软著代码稿自动生成脚本
// 使用方式（在项目根目录运行）：
//   node tools/generate_soft_code_manuscript.js
// 运行后会在项目根目录下生成 soft_code_manuscript.txt
// 打开该文件，全部复制粘贴到 Word 中，再按需要微调格式即可。

const fs = require('fs');
const path = require('path');

// 配置
const OUTPUT_FILE = path.join(__dirname, '..', 'soft_code_manuscript.txt');
const SOURCE_DIR = path.join(__dirname, '..', 'assets', 'scripts');

/**
 * 递归获取目录下的所有源码文件
 * 目前收集：.ts, .js, .tsx, .jsx
 */
function collectSourceFiles(dir) {
    const result = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push(...collectSourceFiles(fullPath));
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.ts' || ext === '.js' || ext === '.tsx' || ext === '.jsx') {
                result.push(fullPath);
            }
        }
    }
    // 按路径排序，保证生成顺序稳定
    result.sort();
    return result;
}

/**
 * 读取所有源码文件并合并为行数组
 */
function buildCodeLines(files) {
    const lines = [];
    for (const file of files) {
        const relPath = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
        lines.push('');
        lines.push(`// ==============================`);
        lines.push(`// File: ${relPath}`);
        lines.push(`// ==============================`);

        const content = fs.readFileSync(file, 'utf8');
        const fileLines = content.split(/\r?\n/);
        for (const line of fileLines) {
            // 保持原始代码，不额外加行号，避免影响可读性
            lines.push(line);
        }
    }
    return lines;
}

function main() {
    if (!fs.existsSync(SOURCE_DIR)) {
        console.error('找不到源码目录：', SOURCE_DIR);
        process.exit(1);
    }

    console.log('正在收集源码文件:', SOURCE_DIR);
    const files = collectSourceFiles(SOURCE_DIR);
    if (files.length === 0) {
        console.error('assets/scripts 目录下没有找到任何 .ts/.js 文件');
        process.exit(1);
    }

    console.log(`共找到 ${files.length} 个源码文件，开始生成代码稿...`);
    const codeLines = buildCodeLines(files);
    // 不再在文本中添加“古树防线游戏软件 V1.0 第X页”的页眉信息，直接输出源码行
    const documentText = codeLines.join('\n');

    fs.writeFileSync(OUTPUT_FILE, documentText, 'utf8');
    console.log('生成完成：', OUTPUT_FILE);
    console.log('下一步：用记事本或任意文本编辑器打开该文件，全部复制粘贴进 Word。');
    console.log('在 Word 中：');
    console.log('1）设置字体为等宽字体（如 Consolas 或 Courier New），字号 9-10 磅；');
    console.log('2）通过 Word 自己的页眉/页码功能添加 “古树防线游戏软件 V1.0 第X页”；');
    console.log('3）如有需要，可只保留前30页和最后30页用于软著提交。');
}

if (require.main === module) {
    main();
}

