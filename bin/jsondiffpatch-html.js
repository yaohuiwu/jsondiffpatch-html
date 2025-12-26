#!/usr/bin/env node
import fs from 'fs';
import { create } from 'jsondiffpatch';
import * as htmlFormatter from 'jsondiffpatch/formatters/html';

/**
 * 统计 jsondiffpatch delta 中「第一级属性」的差异
 *
 * @param {object} delta jsondiffpatch.diff(left, right) 的结果
 * @returns {{
 *   added: string[],
 *   removed: string[],
 *   updated: string[]
 * }}
 */
function statTopLevelDiff(delta) {
  const result = {
    added: [],
    removed: [],
    updated: [],
  };

  if (!delta || typeof delta !== 'object') {
    return result;
  }

  for (const key of Object.keys(delta)) {
    if (key === '_t') continue; // 忽略数组标记

    const value = delta[key];

    // 情况 1：数组形式（新增 / 删除 / 替换）
    if (Array.isArray(value)) {
      // 新增：[newValue]
      if (value.length === 1) {
        result.added.push(key);
        continue;
      }

      // 删除：[oldValue, 0, 0]
      if (value.length === 3 && value[1] === 0 && value[2] === 0) {
        result.removed.push(key);
        continue;
      }

      // 替换：[oldValue, newValue]
      if (value.length === 2) {
        result.updated.push(key);
        continue;
      }
    }

    // 情况 2：对象形式 → 子属性发生变化
    if (typeof value === 'object') {
      result.updated.push(key);
    }
  }

  return result;
}

// 创建实例
const jdp = create();

// CLI 参数解析
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(`Usage: jsondiffpatch-html old.json new.json [-o output.html]`);
  process.exit(1);
}

const oldFile = args[0];
const newFile = args[1];

let outFile = 'diff.html';
const oIdx = args.indexOf('-o');
if (oIdx >= 0 && args[oIdx + 1]) {
  outFile = args[oIdx + 1];
}

// 读取 JSON
const left = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
const right = JSON.parse(fs.readFileSync(newFile, 'utf8'));

// 生成 delta
const delta = jdp.diff(left, right);

const diffContent = delta ? htmlFormatter.format(delta, left) : "No diff";
const statistics = statTopLevelDiff(delta);

// 生成 HTML
// 通过实例访问 jdp.formatters.html
const releasedPkgUrl = "https://esm.sh/jsondiffpatch@0.6.0";
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JSON Diff Report</title>
<link
      rel="stylesheet"
      href="${releasedPkgUrl}/lib/formatters/styles/html.css"
      type="text/css"
    />
    <link
      rel="stylesheet"
      href="${releasedPkgUrl}/lib/formatters/styles/annotated.css"
      type="text/css"
    />
    <script type="text/javascript">

const showUnchanged = (show, node, delay) => {
    const el = node || document.body;
    const prefix = 'jsondiffpatch-unchanged-';
    const classes = {
        showing: prefix + 'showing',
        hiding: prefix + 'hiding',
        visible: prefix + 'visible',
        hidden: prefix + 'hidden',
    };
    const list = el.classList;
    if (!list) {
        return;
    }
    if (!delay) {
        list.remove(classes.showing);
        list.remove(classes.hiding);
        list.remove(classes.visible);
        list.remove(classes.hidden);
        if (show === false) {
            list.add(classes.hidden);
        }
        return;
    }
    if (show === false) {
        list.remove(classes.showing);
        list.add(classes.visible);
        setTimeout(() => {
            list.add(classes.hiding);
        }, 10);
    }
    else {
        list.remove(classes.hiding);
        list.add(classes.showing);
        list.remove(classes.hidden);
    }
    const intervalId = setInterval(() => {
        adjustArrows(el);
    }, 100);
    setTimeout(() => {
        list.remove(classes.showing);
        list.remove(classes.hiding);
        if (show === false) {
            list.add(classes.hidden);
            list.remove(classes.visible);
        }
        else {
            list.add(classes.visible);
            list.remove(classes.hidden);
        }
        setTimeout(() => {
            list.remove(classes.visible);
            clearInterval(intervalId);
        }, delay + 400);
    }, delay);
};
const hideUnchanged = (node, delay) => showUnchanged(false, node, delay);

    </script>
</head>
<body>
<input type="checkbox" id="hide-unchanged"><label>Hide unchanged<label>
<div>
<span>Added: ${statistics.added.length} ${statistics.added}</span><br/>
<span>Removed: ${statistics.removed.length} ${statistics.removed}</span><br/>
<span>Updated: ${statistics.updated.length} ${statistics.updated}</span>
</div>
<div id='the-diff'>
${diffContent}
</div>
<script type="text/javascript">
document.getElementById('hide-unchanged').addEventListener("change", (e) => {
  const checked = e.target.checked;
  if (checked) {
    hideUnchanged();
  } else {
    showUnchanged(true);
  }
});
</script>
</body>
</html>
`;

fs.writeFileSync(outFile, htmlContent, 'utf8');
console.log(`HTML diff report generated: ${outFile}`);
