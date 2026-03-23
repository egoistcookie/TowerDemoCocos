# 深度游戏调研报告：抽卡 `get_all` 与 UR 概率提升

> 生成时间：2026-03-23  
> 数据来源：MySQL（见 `database/game_analytics.sql` 内连接配置说明）  
> 代码依据：`assets/scripts/GameManager.ts`、`BuffCardPopup.ts`、`BuffCardConfigManager.ts`、`AnalyticsManager.ts`

---

## 0. 调研目标与交付物

本次调研目标：基于近 7 天的 `game_sessions` 与 `card_selection_events` 明细数据，结合现有抽卡/选卡实现代码，输出一份可落地的建议，回答：

1. 游戏当前玩家画像是什么（活跃深度、选卡偏好、人群覆盖面）。
2. 现存的影响抽卡体验与概率落地的问题有哪些（尤其是 UR 与 `get_all`）。
3. 如何提升 `get_all` 获取的期望质量，以及“抽到 UR（或更高稀有度）”的概率/可靠性。
4. 给出可验证的指标口径与 SQL/实验验证路径。

交付物包括：
1. 关键统计结论（近 7 天、可复核口径）。
2. 代码级根因定位（数据结论如何由代码行为解释）。
3. 改进方案（按优先级给出实现思路与预期指标变化）。
4. 验证建议（你可以直接用同样口径在上线后做对比）。

---

## 1. 重点思考过程（思路与推导，而非逐步“内心推理”）

### 1.1 从数据到“机制结论”

1. 先用 `selection_mode` 统计选卡行为分布，确定玩家是否真的在使用 `get_all`。
2. 再用 `cards_json` 解析每次选卡中卡片稀有度，计算：
   - UR 在不同选择模式内的“事件率”（某次事件是否出现 UR）。
   - UR 在不同选择模式内的“卡片粒度占比”（3 张卡整体里的 UR 数量占比）。
3. 用 `game_sessions` 的胜率/产出指标去验证“这些抽卡行为是否能带来结果差异”（注意样本量与选择偏差）。

### 1.2 从代码到“机制解释”

1. 先确认稀有度生成函数：`BuffCardConfigManager.generateRarity()` 只会生成 `R/SR/SSR`（不包含 UR）。
2. UR 只能在 `GameManager.generateBuffCards(true)`（reroll 模式）中被注入。
3. `BuffCardPopup.executeGetAll()` 只是把当前 `cardData` 全部应用，并不会二次生成卡池；因此 `get_all` 中出现 UR，必须来自“弹窗当时卡池里已经包含 UR”，即很可能与 reroll 流程或 eligible 条件相关。
4. 若 reroll 的“UR eligible”条件在运行时失败（例如 active 单位类型识别错误），则 reroll 即使承诺“必得UR”也会落空，造成数据上 `single` 基本不出 UR、但 `get_all` 里出现 UR 又不是 100% 的结构性现象。

---

## 2. 数据范围与口径（近 7 天）

### 2.1 时间窗口

- `game_sessions`：使用 `start_time`（毫秒），条件：
  - `start_time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000`
- `card_selection_events`：使用 `event_time`（毫秒），条件：
  - `event_time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000`

### 2.2 UR 统计口径

`card_selection_events.cards_json` 为卡片数组 JSON，因此 UR 统计通过 `JSON_TABLE` 解析每次事件内卡片的 `rarity`：

- UR 事件率：`has_ur = 某次事件内是否至少一张 UR`
- UR 卡片占比：`UR cards / total selected cards`

---

## 3. 近 7 天总体表现与玩家画像（底座数据）

### 3.1 对局规模与胜率（`game_records`）

统计结果（近 7 天）：

| 指标 | 数值 |
|---|---:|
| 记录数 | 430 |
| 去重玩家数 | 127 |
| 胜局数 | 96 |
| 胜率 | 22.33% |
| 平均关卡 | 1.88 |
| 平均防御时间（秒） | 128.63 |
| 平均击杀 | 240.07 |
| 平均操作次数 | 37.74 |

解读要点：
1. 胜率为 22.33%：失败与重试仍然频繁，抽卡强度/适配差异会被放大。
2. `game_sessions` 中 `result` 存在大量 `NULL`（导致胜率被低估），因此本报告胜率口径以 `game_records(end_time)` 为准。

---

## 4. 抽卡/选卡行为画像（`card_selection_events`）

### 4.1 选择模式占比（行为分布）

| selection_mode | 事件数 | 占比 | 平均选中卡数 |
|---|---:|---:|---:|
| `single` | 2816 | 98.29% | 1.00 |
| `get_all` | 49 | 1.71% | 3.00 |

覆盖面：
- 近 7 天使用过 `get_all` 的玩家：20/515（3.88%）
- 近 7 天使用过 `single` 的玩家：514/515（99.61%）

解读要点：
1. `get_all` 转化率极低，不是“玩家不想出 UR”，而是“愿意看视频/全拿的人太少”或“全拿收益不够确定”。
2. 要提升 `get_all` 概率/收益体验，核心不只是稀有度概率，还包括“回报确定性与期望价值稳定性”。

### 4.2 UR 出现与稀有度分布（按 selection_mode）

UR 事件率（某次事件是否出现 UR）：
- `get_all`：UR event rate = **36.73%**
- `single`：UR event rate = **0.28%**

UR 卡片占比（按卡片粒度，3 张合计）：
- `get_all`：UR cards share = **12.24%**
- `single`：UR cards share = **0.28%**

稀有度分布（按卡片数量）：
- `get_all`：R 57.82% / SR 26.53% / SSR 3.40% / UR 12.24%
- `single`：R 64.38% / SR 27.41% / SSR 7.92% / UR 0.28%

解读要点：
1. `single` 基本不出 UR → UR 不是普通池子的自然掉落。
2. UR 在 `get_all` 里明显存在 → 说明当某些 `get_all` 事件发生时，弹窗的卡池里“已经包含 UR”（与 reroll 条件/成功密切相关）。

---

## 5. 把数据映射到代码：现存问题的“证据链”

### 5.1 问题 1：普通抽卡（single/get_all）不包含 UR，UR 只来自 reroll

代码证据：
1. `BuffCardConfigManager.generateRarity()`：只生成 `R/SR/SSR`，注释也明确“UR 只能通过再抽一次获得”。
2. `GameManager.generateBuffCards(isRerollMode=true)`：仅在 reroll 模式下把某张卡的 `rarity` 强行设置成 `UR`（且 `urCardIndex` 在 3 张中随机落点）。
3. `BuffCardPopup.executeGetAll()`：只对 `this.cardData` 的每张卡执行 `applyBuff` 并隐藏弹窗，不会再触发 generateBuffCards。

数据证据：
- `single` UR event rate = 0.28%（几乎为 0）
- `get_all` UR event rate = 36.73%（显著存在）

结论：
- `get_all` 的“UR 概率”并不是 reroll 之后的概率，而是“当下 cardData 是否已经包含 UR”的概率。

### 5.2 问题 2：`get_all` 里看到 UR 的概率低是正常现象，应以“reroll 粒度”验证“必得UR”

先更正一个推断口径：`get_all` 的 UR 事件率只有 **36.73%** 并不必然意味着 reroll 注入失败。

按照现有代码链路：
1. `BuffCardConfigManager.generateRarity()` 普通池只会产出 `R/SR/SSR`，不包含 `UR`。
2. `UR` 只能在 `GameManager.generateBuffCards(true)`（reroll 模式）中被注入。
3. `BuffCardPopup.executeGetAll()` 只是把**当前弹窗里的 3 张卡（this.cardData）**全应用；它并不会二次调用 `generateBuffCards(true)`。

因此：
1. 当玩家在点击 `get_all` 前没有触发过 reroll，那么这次 `get_all` 基本不会出现 UR（即使它“全拿”）。
2. 只有当玩家在同一轮弹窗流程里先点过 reroll，且 reroll 生成的 3 张卡里包含 UR，随后再点击 `get_all`，才会在 `get_all` 事件里观察到 UR。

也就是说，`get_all` 的 UR 事件率反映的是“多少 `get_all` 发生在先 reroll 之后”的结果，这与 36.73% 的数值是相容的。

仍可能存在的问题是：reroll 的“必得UR”是否真的可靠，取决于 `urEligibleTypes` 是否为空以及其判定是否总能成立。当前实现里，当 `urEligibleTypes` 为空时确实不会设置 `urCardIndex`，因此 reroll 生成的 3 张卡可能不包含 UR。

但这件事要验证，应当用 **reroll 行为（点击/生成结果）**为粒度统计，而不是用 `get_all` 来反推。

### 5.3 问题 3（高置信根因假设）：UR eligible 类型判定可能误判为空（active 单位类型识别逻辑不完整）

代码证据（推断链）：
1. UR eligible 只允许两类：
   - 角色：`Arrower/Hunter/ElfSwordsman/Priest/Mage`
   - 防御塔：`WatchTower/IceTower/ThunderTower`
2. `GameManager.getActiveUnitTypes()` 对建筑类单位只尝试 `child.getComponent(unitType)`，没有像角色类那样进行 `Build/Role` fallback（读取 `unitType` 属性）。
3. 如果 Prefab 的建筑脚本并非以 `WatchTower/IceTower/ThunderTower` 组件形式挂载，而是以统一脚本（例如 `Build`）管理 `unitType` 字段，那么 `activeUnitTypes` 会漏识别建筑，进而 `urEligibleTypes` 为空，造成 reroll 不能注入 UR。

影响：
- reroll 成功率下降 → UR 进入 cardData 的概率下降 → `get_all` 中能看到 UR 的概率下降。

---

## 6. 与“现存问题”相关的行为/结果差异（辅助解释）

在样本量与选择偏差较大的前提下，对比近 7 天玩家群体：

1. 是否使用过 `get_all` 与胜率（玩家层面，胜率来自 `game_records`）：
   - ever_get_all=1：胜率约 16.67%（42 records，7 wins；20 玩家）
   - ever_get_all=0：胜率约 23.28%（348 records，81 wins；500 玩家）
2. 是否出现过 UR 与胜率：
   - ever_ur=1：胜率约 18.46%（65 records，12 wins；16 玩家）
   - ever_ur=0：胜率约 23.38%（325 records，76 wins；504 玩家）

解读要点：
- `get_all`/UR 相关玩家反而胜率更低，这更符合“选择偏差/压力触发”：在更困难的局面中玩家更倾向于尝试 `get_all` 或 reroll（从而观察到更低的总体胜率），因此不能把“胜率差”直接当作“机制无效”的证据。

---

## 7. 提升 `get_all` 与 UR 概率的可落地方案（按优先级）

### 7.1 方案 A（优先级 P0）：让 `executeGetAll()` 在当前 cardData 不含 UR 时具备 UR 兜底（重抽/生成）

问题指向：
- 当前 `get_all` 只是拿走弹窗已有卡，并不保证 UR。

实现思路（建议 AB 可控）：
1. 在 `BuffCardPopup.executeGetAll()` 点击回调里，统计 `this.cardData` 是否包含 UR。
2. 若不包含 UR，则在“视频完成回调”同一流程中调用：
   - `this.gameManager.generateBuffCards(true)`（reroll模式）生成新 3 张
3. 用新卡替换 `this.cardData` 后再执行 `applyBuff`（确保最终奖励与视频后结果一致）。

预期指标变化：
1. `get_all` UR event rate 将显著上升（从 36.73% 向上）
2. `get_all` 的 UR 卡片占比上升
3. 因为“全拿收益确定性增强”，`get_all` 使用率可能提高（需配合 UI/体验优化）

注意点：
- 若你希望完全一致展示“视频后奖励卡面”，建议同时刷新 UI（`updateCards()`）并处理翻牌动画。

### 7.2 方案 B（优先级 P0/P1）：修复 reroll 的“必得UR”一致性（让 eligible 判定更准确或兜底文案）

两条路线（二选一或组合）：
1. 修复 UR eligible 类型识别：
   - 修改 `GameManager.getActiveUnitTypes()`：建筑类单位在 `child.getComponent(unitType)` 失败时，尝试从 `Build`/`Role` 取 `unitType` 字段匹配。
2. 文案/逻辑一致性：
   - 若 eligibleTypes 为空，按钮文案从“必得UR”改为“再抽一次（可能获得UR）”，避免玩家挫败。

预期：
- reroll 更可靠 → `get_all` 更容易看到 UR

### 7.3 方案 C（优先级 P1）：增强 `get_all` 的“回报稳定性”（避免 global buff 稀释）

原因推断：
- `generateBuffCards` 对非 UR 卡有 20% 概率生成 global buff（人口/金币等）。
- 当玩家点 `get_all`，如果三张里可能含较多低价值 global 卡，玩家会不信任“全拿一定更强”，从而转化率仍然低。

可做的改动：
1. 降低 global buff 概率（例如从 20% 降到 5%~10%）仅限 get_all/rewarded-video 产生的集合。
2. 强约束 `get_all` 集合：至少保证一张“塔/角色类增益”，避免三张全是全局资源。

预期：
- `get_all` 使用率上升
- 即使 UR 不变，通关收益更稳定也会提升胜率。

### 7.4 方案 D（优先级 P1）：补齐埋点，让概率实验可归因

当前数据的问题：
- `card_selection_events` 只记录 `selection_mode`，没有直接记录 reroll 是否点击、reroll 是否成功注入 UR。

本次最小改动已落地的埋点口径：
1. 新增 `reroll` 粒度事件：在 `BuffCardPopup.executeReroll()` 生成完下一轮 3 张卡后，上报一次 `card_selection_events`，并将 `selection_mode` 写为 `reroll`，携带 reroll 结果的 `cards_json`。

验证价值：
- 你能直接按 reroll 事件统计：reroll 结果里是否包含 UR，从而验证“必得UR”是否真的成立。

---

## 8. 验证指标与复核 SQL（上线后对比用）

建议你保持现有口径不变，做“上线前 vs 上线后（同样近 7 天）”对比。

核心指标（必须看）：
1. `get_all` 事件占比：`COUNT(get_all)/COUNT(all selection_events)`
2. `get_all` UR event rate：每次 get_all 事件中是否至少一张 UR 的占比
3. `get_all` UR cards share：UR cards / total selected cards
4. reroll 点击率（若加埋点）：`reroll_click/selection_dialog_opens`
5. `get_all` 相关胜率（建议使用 `game_records` 口径，避免 `game_sessions.result` 为 NULL 带来的低估）

---

## 9. 附录：本次统计中使用的关键 SQL（可复用）

> 注意：SQL 依赖 MySQL 8 的 `JSON_TABLE`。

### 9.1 近 7 天对局胜率汇总（`game_records`）
```sql
WITH base AS (
  SELECT *
  FROM game_records
  WHERE end_time >= (UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000)
)
SELECT
  COUNT(*) AS records,
  COUNT(DISTINCT player_id) AS players,
  SUM(result='success') AS wins,
  ROUND(SUM(result='success')*100.0/NULLIF(COUNT(*),0),2) AS win_rate,
  ROUND(AVG(level),2) AS avg_level,
  ROUND(AVG(defend_time),2) AS avg_defend_time_sec,
  ROUND(AVG(current_wave),2) AS avg_current_wave,
  ROUND(AVG(kill_count),2) AS avg_kill_count,
  ROUND(AVG(operation_count),2) AS avg_operation_count,
  ROUND(AVG(final_gold),2) AS avg_final_gold,
  ROUND(AVG(final_population),2) AS avg_final_population
FROM base;
```

### 9.2 选择模式占比（事件粒度与卡片粒度）
```sql
WITH ev AS (
  SELECT *
  FROM card_selection_events
  WHERE event_time >= (UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000)
)
SELECT
  selection_mode,
  COUNT(*) AS events,
  SUM(selected_count) AS selected_cards,
  ROUND(COUNT(*)*100.0/NULLIF((SELECT COUNT(*) FROM ev),0),2) AS event_share_pct,
  ROUND(SUM(selected_count)*1.0/NULLIF(COUNT(*),0),2) AS avg_selected_count
FROM ev
GROUP BY selection_mode;
```

### 9.3 UR 事件率（每次事件是否包含UR）
```sql
WITH ev AS (
  SELECT *
  FROM card_selection_events
  WHERE event_time >= (UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000)
),
per_event AS (
  SELECT
    e.id AS event_id,
    e.selection_mode,
    MAX(CASE WHEN jt.rarity='UR' THEN 1 ELSE 0 END) AS has_ur,
    SUM(CASE WHEN jt.rarity='UR' THEN 1 ELSE 0 END) AS ur_cards
  FROM ev e
  JOIN JSON_TABLE(
    CAST(e.cards_json AS JSON),
    '$[*]' COLUMNS (rarity VARCHAR(10) PATH '$.rarity')
  ) jt
  GROUP BY e.id, e.selection_mode
)
SELECT
  selection_mode,
  COUNT(*) AS events,
  SUM(has_ur) AS ur_events,
  ROUND(SUM(has_ur)*100.0/NULLIF(COUNT(*),0),2) AS ur_event_rate_pct,
  ROUND(SUM(ur_cards)*1.0/NULLIF(COUNT(*),0),3) AS ur_cards_per_event
FROM per_event
GROUP BY selection_mode
ORDER BY selection_mode;
```

---

## 10. 本报告最重要的“执行建议”

如果你只做两件事，我建议顺序是：

1. 先做 `executeGetAll()` 的 UR 兜底（方案 A），把“全拿的UR可靠性”从“依赖 reroll 成功与否”改成“get_all 自己兜底”，直接提升你想要的 get_all/UR 概率与体验一致性。
2. 再修复 reroll eligible 识别（方案 B），让 reroll 的“必得UR”在逻辑层面成立，避免概率体系在某些局面/Prefab 组合下失效。

这样你才能真正把“概率提升”变成可持续的机制，而不是短期数据波动。

