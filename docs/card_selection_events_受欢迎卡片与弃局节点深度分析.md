# card_selection_events 深度分析报告：受欢迎卡片、低价值卡片与弃局节点

> 生成时间：2026-03-23  
> 数据来源：`tower_defense_analytics.card_selection_events`（近7天）  
> 辅助表：`game_sessions`（仅用于会话结果辅助观察）

---

## 1. 分析目标

本报告聚焦回答三个问题：

1. 基于 `card_selection_events`，当前玩家最常选哪些卡（受欢迎卡片排行榜）。
2. 哪些卡片“最不值得保留”（热度低、选后易弃局、后续游玩深度差）。
3. 基于 `game_time` 与抽卡序号，玩家大多在抽到第几张卡后放弃继续游玩，并给出后续优化方向。

---

## 2. 数据范围与口径

### 2.1 时间窗口

- 近7天：
  - `event_time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000`

### 2.2 核心样本规模

- 选卡事件数：`2909`
- 覆盖会话数：`784`
- 覆盖玩家数：`524`

### 2.3 指标说明

- `pick_count`：该卡在 `cards_json` 中被选中的总次数。
- `pick_share_pct`：该卡占全部被选卡次数的比例。
- `quit_after_pick_pct`：玩家拿到该卡后，该次抽卡恰好是该会话最后一次抽卡的比例（可视作“选后即停”倾向）。
- `avg_remaining_draws_after_pick`：拿到该卡后，平均还会继续抽几次卡。
- `avg_pick_game_time`：该卡被选中的平均游戏时间（秒）。

---

## 3. 受欢迎卡片排行榜（近7天）

## 3.1 Top 10（按 pick_count）

| 排名 | 卡片 | 被选次数 | 份额 |
|---|---|---:|---:|
| 1 | Arrower | 660 | 21.95% |
| 2 | WatchTower | 604 | 20.09% |
| 3 | WarAncientTree | 426 | 14.17% |
| 4 | populationIncrease | 411 | 13.67% |
| 5 | goldReward | 315 | 10.48% |
| 6 | Hunter | 114 | 3.79% |
| 7 | Priest | 113 | 3.76% |
| 8 | ThunderTower | 76 | 2.53% |
| 9 | IceTower | 66 | 2.19% |
| 10 | SwordsmanHall | 65 | 2.16% |

### 3.2 关键结论

1. **头部集中度很高**：前5张卡合计占比约 `80.36%`（21.95 + 20.09 + 14.17 + 13.67 + 10.48）。
2. **Arrower + WatchTower 统治明显**：两者合计占比 `42.04%`，说明玩家偏好“即时战力可感知”的卡。
3. **功能型全局卡（populationIncrease / goldReward）也很强**：但这类卡更偏“续航/经济”，不一定直接转化为留存。

---

## 4. 哪些卡片最不值得保留（当前版本）

这里“最不值得保留”不是指必须删除，而是指：

- 选中频次低（热度差）
- 选后即停比例高（体验收益感知弱）
- 选后继续抽卡深度低（后续驱动力弱）

### 4.1 各卡关键行为指标（重点）

| 卡片 | 被选次数 | 份额 | 选后即停 | 选后平均剩余抽卡 |
|---|---:|---:|---:|---:|
| MageTower | 14 | 0.47% | **50.00%** | **1.07** |
| ThunderTower | 76 | 2.53% | **32.89%** | **1.92** |
| WarAncientTree | 426 | 14.17% | **31.46%** | 2.08 |
| Mage | 61 | 2.03% | 27.87% | 2.23 |
| HunterHall | 42 | 1.40% | 26.19% | 2.55 |

### 4.2 判定结论（建议优先处理）

#### A档（高优先级重做/替换）

1. `MageTower`
   - 热度最低（0.47%）
   - 选后即停最高（50%）
   - 后续抽卡深度最低（1.07）
   - **结论**：典型“低吸引 + 低续玩价值”卡，优先重做。

2. `ThunderTower`
   - 热度偏低（2.53%）
   - 选后即停偏高（32.89%）
   - 后续抽卡深度偏低（1.92）
   - **结论**：需要增强“拿到就变强”的反馈感。

#### B档（中优先级：机制优化而非删除）

3. `WarAncientTree`
   - 热度高（14.17%）但“选后即停”也高（31.46%）
   - **结论**：并非不受欢迎，而是“拿到后对继续推进帮助不足/反馈不够直观”。建议改效果呈现和即时收益。

4. `Mage` / `HunterHall`
   - 热度偏低，选后继续深度一般
   - **结论**：可通过小幅数值和展示优化，避免进入“看不懂收益所以不选”的区间。

---

## 5. 玩家在第几张卡后放弃继续游玩

## 5.1 抽卡轮次分布（draws_before_quit）

| 抽到第N张后结束 | 会话数 | 占比 | 最后一次抽卡平均 game_time |
|---|---:|---:|---:|
| 1 | 188 | 23.98% | 22.3s |
| 2 | 181 | 23.09% | 36.1s |
| 3 | 100 | 12.76% | 54.9s |
| 4 | 85 | 10.84% | 79.4s |
| 5 | 88 | 11.22% | 110.9s |
| 6 | 22 | 2.81% | 200.8s |
| 7 | 7 | 0.89% | 230.3s |
| 8 | 10 | 1.28% | 238.7s |
| 9 | 12 | 1.53% | 333.2s |
| 10 | 91 | 11.61% | 362.3s |

### 5.2 核心结论

1. **前2张卡是最大流失窗口**：`1~2张`合计 `47.07%`。  
2. **前3张卡决定大多数局的去留**：`1~3张`合计 `59.83%`。  
3. 存在一批“深度用户”会走到第10张（11.61%），说明后期系统并非完全无效，但**早期体验断层明显**。

---

## 6. 从 game_time 看弃局时间节点

| 最后一次抽卡 game_time 区间 | 会话数 | 占比 |
|---|---:|---:|
| 0-30s | 330 | 42.09% |
| 31-60s | 101 | 12.88% |
| 61-90s | 94 | 11.99% |
| 91-120s | 92 | 11.73% |
| 121-180s | 14 | 1.79% |
| 181s+ | 153 | 19.52% |

### 6.1 核心结论

1. **60秒内结束占比 54.97%**（0-30 + 31-60）。
2. **120秒内结束占比 78.69%**。
3. 当前版本主要问题不是中后期，而是**前2分钟价值感建立不足**。

---

## 7. 后续优化方向（按优先级）

## 7.1 P0：强化前2张卡的“必得战力感”

目标：降低 `1~2抽后退出`（47.07%）

建议：
1. 前2抽至少保证1张“即时战力卡”（角色/塔攻速或攻击向）。
2. 降低前2抽出现纯经济卡的概率（`goldReward`、`populationIncrease`不应连续占位）。
3. 新手阶段给出“本轮提升了什么战斗指标”的即时可视化反馈。

## 7.2 P0：重做 `MageTower`，补强 `ThunderTower`

1. `MageTower`：优先重做为“可感知爆发/范围收益”类型，避免隐性增益。
2. `ThunderTower`：提升基础收益或联动触发频率，减少“拿了也没感觉”。

## 7.3 P1：对 `WarAncientTree` 做“高热度但低续玩”专项优化

虽然它常被选，但选后即停偏高。建议：
1. 优化卡面描述（强调立即收益而非长期收益）。
2. 提高首次拿到后的短期收益显性化（例如即时回血/波次抗压提升提示）。

## 7.4 P1：卡池结构优化（防止“看起来都不赚”）

1. 限制同一抽中弱价值卡重复出现。
2. 用“保底权重”确保每次抽卡至少有1张高体感收益卡。
3. 针对低热度卡增加短期轮换权重实验（A/B）后再决定去留。

## 7.5 P1：埋点补强（便于持续决策）

建议追加字段/事件：
1. 卡片候选集（不仅记录最终选择，还要记录“可选但没选”的卡）。
2. 选卡后30秒战斗表现（击杀、掉血、经济变化）作为卡价值闭环。
3. 明确“退出原因”事件（手动退出/战败/后台离开）。

---

## 8. 建议的版本目标（可量化）

建议下个迭代周期设定以下目标：

1. `1~2抽后退出占比`：从 `47.07%` 降到 `<= 40%`
2. `0~60s退出占比`：从 `54.97%` 降到 `<= 48%`
3. `MageTower` 选取占比：从 `0.47%` 提升到 `>= 1.5%`
4. `ThunderTower` 选后即停：从 `32.89%` 降到 `<= 27%`

---

## 9. 复核 SQL（关键片段）

```sql
-- 近7天样本规模
SELECT COUNT(*) AS events_7d,
       COUNT(DISTINCT session_id) AS sessions_7d,
       COUNT(DISTINCT player_id) AS players_7d
FROM card_selection_events
WHERE event_time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000;
```

```sql
-- 卡片热度 + 选后弃局倾向
WITH ordered AS (
  SELECT id, session_id, player_id, event_time, game_time,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY event_time, id) AS draw_idx,
         COUNT(*) OVER (PARTITION BY session_id) AS draw_cnt,
         cards_json
  FROM card_selection_events
  WHERE event_time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000
),
flat AS (
  SELECT o.session_id, o.player_id, o.game_time, o.draw_idx, o.draw_cnt,
         jt.unit_id, jt.rarity
  FROM ordered o
  JOIN JSON_TABLE(o.cards_json, '$[*]' COLUMNS(
    unit_id VARCHAR(100) PATH '$.unitId',
    rarity  VARCHAR(10)  PATH '$.rarity'
  )) jt
)
SELECT unit_id,
       COUNT(*) AS pick_count,
       ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(),2) AS pick_share_pct,
       ROUND(SUM(CASE WHEN draw_idx = draw_cnt THEN 1 ELSE 0 END)*100.0/COUNT(*),2) AS quit_after_pick_pct,
       ROUND(AVG(draw_cnt-draw_idx),2) AS avg_remaining_draws_after_pick,
       ROUND(AVG(game_time),1) AS avg_pick_game_time
FROM flat
GROUP BY unit_id
ORDER BY pick_count DESC;
```

```sql
-- 玩家在第几张卡后结束
WITH ordered AS (
  SELECT session_id, game_time,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY event_time, id) AS draw_idx,
         COUNT(*) OVER (PARTITION BY session_id) AS draw_cnt
  FROM card_selection_events
  WHERE event_time >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY))*1000
)
SELECT draw_cnt AS draws_before_quit,
       COUNT(*) AS session_count,
       ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(),2) AS session_pct,
       ROUND(AVG(game_time),1) AS avg_last_draw_time_s
FROM ordered
WHERE draw_idx = draw_cnt
GROUP BY draw_cnt
ORDER BY draw_cnt;
```

---

## 10. 一句话总结

当前版本的核心矛盾是：**前2张卡价值感不足导致早退（47.07%）**，同时存在少量**明显低价值卡（尤其 MageTower）**拉低体验；优先把“前2抽必有体感收益”与“低价值卡重做”落地，能最快提升继续游玩率。
