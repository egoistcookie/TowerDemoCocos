# ElfSwordsman性能优化报告

## 性能瓶颈分析

### 11 处性能关键标记

| # | 方法 | 问题 | 影响范围 |
|---|------|------|----------|
| 1 | `update` | 每帧调用，触发多个重负载子方法 | 每个剑士单位每帧执行 |
| 2 | `tickSwordsmanRepairDecision` | 每帧包含重负载搜索（全容器遍历） | 每帧遍历 ~10 容器 × 多个建筑 |
| 3 | `hasSwordsmanDamagedBuildingInSearchRange` | 遍历 ~10 个建筑容器，每个容器遍历所有子节点 | 被 tickSwordsmanRepairDecision 每帧调用 |
| 4 | `findSwordsmanRepairBuildingTarget` | 遍历 ~10 容器 × 所有子节点 | 满足空闲条件时调用 |
| 5 | ~~`isSwordsmanWorldPointNearBlockingBuilding`~~ | 遍历全部建筑容器（~10个） | **已删除（与 `isSwordsmanPathBlockedByBuildings` 一并移除）** |
| 6 | ~~`isSwordsmanLineBlockedByStoneWallOnly`~~ | 连线分段采样，每步遍历所有存活石墙 | **已删除，受击时走正常索敌路径** |
| 7 | `isFriendlyWalkerOnStoneWallCell` | 遍历 UnitManager 获取所有友方单位 + 逐个检测 | 造墙决策时调用 |
| 8 | ~~`findSwordsmanNodeByPath`~~ | `find()` 遍历场景图 O(N)，递归兜底更甚 | **已删除** |
| 9 | ~~`spawnHealFloatBlackOutlineOnBuilding`~~ | 每次创建 Node + Label + LabelOutline + UITransform + UIOpacity | **已改用 `BattleFloatTextPool` 对象池** |
| 10 | `showSwordsmanRepairEffect` | `instantiate` 实例化 + `find('Canvas')` | 维修时每 2 秒一次 |
| 11 | `playSwordsmanRepairAnimation` | `schedule(, 0)` 每帧执行帧切换 | 维修/造墙读条期间 |

## 已实施优化 ✅

### 1. 容器缓存（替代 `findSwordsmanNodeByPath`）
- **新增字段**：`_cachedBuildingContainers: Map<string, Node | null>`
- **新增方法**：`getBuildingContainer(path)` — 懒加载 + 有效性校验 + 缓存
- **替换范围**：所有 `findSwordsmanNodeByPath` 调用点（4处）均改为 `getBuildingContainer`
- **`onEnable`**：对象池复用时 `clear()` 清除缓存
- **删除**：`findSwordsmanNodeByPath` 方法已移除

### 2. 检测频率节流
- **`tickSwordsmanRepairDecision`**：新增 `_repairDecisionThrottleTimer`，每 0.5s 执行一次 `hasSwordsmanDamagedBuildingInSearchRange`
- **`tickAutoStoneWallDecision`**：新增 `_autoStoneWallThrottleTimer`，每 0.5s 执行一次 `tryGetAutoStoneWallTargetCell`
- **`onEnable`**：重置节流计时器

### 3. `clampPositionToScreen` 性能标注
- 标注 `view.getVisibleSize()` / `getDesignResolutionSize()` 每次调用都访问原生层，建议缓存

### 4. 飘字改用对象池
- **替换方法**：`spawnHealFloatBlackOutlineOnBuilding`
- **改造前**：每次创建 `new Node` + `addComponent(Label/LabelOutline/UITransform/UIOpacity)` + `tween` → `destroy()`
- **改造后**：调用 `BattleFloatTextPool.spawnFloatText()` — 复用节点、自动回收
- **import 清理**：移除不再需要的 `Label`、`LabelOutline`、`UIOpacity`、`UITransform`、`tween`

### 5. 移除反击连线石墙检测与被堵计时
- **删除方法**：`isSwordsmanLineBlockedByStoneWallOnly`、`isSwordsmanPathBlockedByBuildings`、`isSwordsmanWorldPointNearBlockingBuilding`
- **删除变量**：`repairBlockedThresholdSec`、`_repairBlockedTimer`
- **改造前**：`tryRegisterWallDefenseRetaliation` 中用连线采样判断是否被石墙阻挡；`tickSwordsmanRepairDecision` 中累计被堵时长用于触发维修
- **改造后**：反击直接记录追击目标由 Role 索敌处理；维修仅凭 `repairIdleThresholdSec` 空闲计时触发，只要周围有未满血建筑就进入维修

## 待改造项🔧

### 高优先级
1. **`showSwordsmanRepairEffect`**：使用对象池复用特效节点
