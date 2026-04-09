# Claude 编程指南 - TowerDemoCocos 项目

## 一、常见技术坑点

### 1. Canvas 节点路径问题

**问题**：查找节点时经常找不到，导致组件为 null。

**原因**：所有路径必须从 `Canvas` 根节点开始，不能只用 `find('GameManager')`。

**正确做法**：
```typescript
// ❌ 错误
const manager = find('GameManager');

// ✅ 正确
const manager = find('Canvas/GameManager');
```

**关键节点路径**（见 `docs/节点路径.md`）：
- `Canvas/GameManager` - 游戏管理器
- `Canvas/EnemySpawner` - 敌人生成器
- `Canvas/UnitSelectionManager` - 单位选择管理器
- `Canvas/TowerBuilder` - 塔建造器
- `Canvas/Towers` - 防御塔容器
- `Canvas/Enemies` - 敌人容器

---

### 2. 触摸事件传播特性

**问题**：单位重叠时，只能选中上层单位，下层单位无法被选中。

**原因**：Cocos Creator 的触摸事件只会发送给**被点击到的最上层节点**，其他重叠的节点不会收到事件。

**解决方案**：在 `UnitSelectionManager.onGlobalTouchEnd` 中遍历所有单位，检测点击位置是否在单位的选中区域内，选择距离最近的单位。

**选中区域定义**：宽度 = 2 倍碰撞半径，高度 = 3 倍碰撞半径的矩形区域。

---

### 3. Vec3 距离计算性能优化

**问题**：频繁调用 `Vec3.distance()` 导致性能下降。

**正确做法**：使用平方距离比较，避免开方运算。

```typescript
// ❌ 错误 - 开销大
const distance = Vec3.distance(a, b);
if (distance < radius) { }

// ✅ 正确 - 高效
const dx = a.x - b.x;
const dy = a.y - b.y;
const sqDist = dx * dx + dy * dy;
if (sqDist < radius * radius) { }
```

---

### 4. 对象池复用时的状态重置

**问题**：单位从对象池取出时，带有上一次生命周期的状态（如增幅效果、手动控制标志）。

**正确做法**：在 `onEnable()` 中重置所有状态：

```typescript
onEnable() {
    this._enhancementsApplied = false;  // 防止重复应用增幅
    this.wasManuallyControlled = false; // 重置手动控制标志
    this.autoRoamScheduled = false;     // 重置自动移动标志
    // ...其他状态重置
}
```

---

### 5. 字符串替换导致的语法错误

**问题**：使用 Edit 工具替换代码时，如果字符串不唯一或包含特殊字符，会导致替换失败或语法错误。

**正确做法**：
1. 先使用 Grep 确认要替换的字符串在文件中只出现一次
2. 替换时包含更多上下文，确保唯一性
3. 替换后必须 Read 文件检查语法

**示例**：
```typescript
// ❌ 错误 - 字符串不唯一
old_string: "return;"
new_string: "console.log('debug'); return;"

// ✅ 正确 - 包含上下文
old_string: "if (isLastWaveCompleted) {\n    return;\n}"
new_string: "if (isLastWaveCompleted) {\n    console.log('debug');\n    return;\n}"
```

---

### 6. 循环导入问题

**问题**：A 模块导入 B，B 模块导入 A，导致循环依赖。

**解决方案**：
1. 将共用类型提取到独立文件（如 `UnitType.ts`）
2. 使用字符串类型代替直接导入
3. 在文件顶部注释说明移除了哪些导入

```typescript
// 移除 UIManager 导入，避免循环导入
// import { UIManager } from '../UIManager';
```

---

### 7. Camera 坐标转换

**问题**：世界坐标与屏幕坐标混淆，导致碰撞检测失败。

**正确做法**：
```typescript
// 世界坐标转屏幕坐标
const screenPos = new Vec3();
camera.worldToScreen(worldPos, screenPos);

// 屏幕坐标转世界坐标
const worldPos = new Vec3();
camera.screenToWorld(screenPos, worldPos);
```

**注意**：相机有缩放时，世界坐标的像素值不等于屏幕坐标的像素值。

---

### 8. scheduleOnce 延迟清除选择

**问题**：使用 `scheduleOnce` 延迟清除选择状态，但时序可能不稳定。

**现状**：目前使用 `scheduleOnce(() => { this.clearSelection(); }, 0.01)` 延迟清除。

**注意**：暂不优化为同步清除，因为延迟清除是为了让单位的 `globalTouchHandler` 先处理移动命令。

---

### 9. 建筑物点击事件冲突

**问题**：TowerBuilder 与建筑物的点击处理存在竞争条件，导致面板闪烁或无法显示。

**解决方案**：使用标志位协调：

```typescript
// TowerBuilder.onTouchStart 设置
(building)._towerBuilderHandlingClick = true;

// Build.onBuildingClick 检查
if ((this as any)._towerBuilderHandlingClick) {
    return; // 跳过处理
}

// UnitSelectionManager.onGlobalTouchEnd 检查
if (eventNode.getComponent(Build)) {
    return; // 跳过清除选择
}
```

---

### 10. 配置文件路径

**波次配置文件**：`resources/config/waveConfig.json`

**单位配置文件**：`resources/config/unitConfig.json`

**加载方式**：
```typescript
resources.load('config/waveConfig', JsonAsset, (err, asset) => {
    if (err) {
        console.error('[EnemySpawner] 加载波次配置失败:', err);
        return;
    }
    this.levelConfigs = asset.json as LevelConfig[];
});
```

---

### 11. 波次节奏控制逻辑

**2026/04/10 更新**：简化波次节奏逻辑，去掉 60 秒倒计时。

**正确逻辑**：
- 第 1、3、5、7、9 波：完成后**立即**显示增益卡片
- 第 2、4、6、8 波：完成后**立即显示 10 秒倒计时弹窗**（可手动关闭），倒计时结束后显示增益卡片
- 第 10 波：完成后等待**5 秒**显示增益卡片（无倒计时）

**修改文件**：
1. `CountdownPopup.ts` - 添加 `skipInitialDelay` 参数，支持跳过 5 秒延迟直接开始倒计时
2. `UIManager.ts` - 传递 `skipInitialDelay` 参数给 CountdownPopup
3. `EnemySpawner.ts` - 重构 `endCurrentWave()` 方法，简化波次节奏逻辑

**注意事项**：
- 删除重复代码后，要检查是否有语法错误（如多余的 `}` 括号）
- 使用 sed 删除大段代码时，先备份文件
- 修改波次逻辑时，在 `endCurrentWave` 方法开始时添加日志，便于调试
- **重要**：替换方法时，如果文件中有多个同名方法，必须先删除所有重复方法，再添加新方法。否则会导致方法重复定义。
- **波次跳跃问题**：如果发现波次不连续（如从第 2 波直接跳到第 4 波），在 `continueToNextWaves()` 和 `startNextWave()` 方法中添加详细日志，追踪 `currentWaveIndex` 的变化。检查是否有回调被重复调用。

---

### 13. 波次节奏控制调试

**问题**：2026/04/09 修改波次节奏后，用户报告"从第 2 波直接跳到第 4 波"。

**波次节奏规则**：
- 第 1、3、5、7、9 波：完成后立即显示增益卡片
- 第 2、4、6、8 波：完成后显示 10 秒倒计时（可手动关闭），倒计时结束后显示增益卡片
- 第 10 波：完成后等待 5 秒显示增益卡片

**调试方法**：
1. 在 `endCurrentWave()` 方法开始添加日志：`console.log(`波次=${waveNumber}, is10SecondPause=${is10SecondPause}`)`
2. 在 `continueToNextWaves()` 方法开始添加日志：`console.log(`currentWaveIndex=${this.currentWaveIndex}`)`
3. 在 `startNextWave()` 方法添加日志：记录波次索引增加前后的值
4. 在倒计时回调、增益卡片回调中添加日志，确认回调只被调用一次

**可能的原因**：
- 回调被重复调用
- 游戏状态检查失败导致 `currentWaveIndex` 被增加但未显示波次
- `showBuffCards` 期间游戏被暂停，`continueToNextWaves` 检查状态失败

---

### 12. 重复方法定义问题

**问题**：2026/04/10 修改波次节奏时，使用字符串替换方法导致 `startNextWave` 和 `endCurrentWave` 方法重复定义。

**原因**：文件中有多个相似的方法定义，替换时没有精确定位。

**解决方案**：
1. 使用 `grep -n "private 方法名"` 检查是否有重复定义
2. 如果有重复，使用 `sed -i '起始行，结束行 d'` 删除重复方法
3. 在正确位置重新添加方法

**检查命令**：
```bash
# 检查方法是否重复
grep -n "private startNextWave\|private endCurrentWave" assets/scripts/EnemySpawner.ts
```

## 二、性能优化清单

### 已完成优化

| 优化项 | 文件 | 说明 |
|--------|------|------|
| Camera 引用缓存 | `Role.ts` | `cachedCamera` 避免每次查找 |
| Vec3 临时变量复用 | `Role.ts` | `tempVec3_1/2/3` 减少 GC |
| 碰撞检测频率控制 | `Role.ts` | `COLLISION_CHECK_INTERVAL = 0.05` |
| 事件监听器动态注册 | `Role.ts` | 仅在选中时注册移动监听器 |
| 平方距离比较 | 多个文件 | 避免 `Vec3.distance()` 开方运算 |

### 待优化项

- [ ] `isTouchOnUnit` 方法复用（已在 `Role.ts` 实现 `isPointInCollisionRadius`）
- [ ] 建筑物组件缓存（`Build.ts` 多次 `getComponent`）
- [ ] 单位屏幕坐标缓存（减少 `worldToScreen` 调用）

---

## 三、调试技巧

### 单位不移动

1. 检查 `cachedCamera` 是否初始化
2. 检查 `wasManuallyControlled` 标志
3. 检查 `autoRoamScheduled` 标志
4. 检查 `manualMoveTarget` 是否被正确设置

### 建筑物面板不显示

1. 检查 `TowerBuilder.onTouchEnd` 是否调用 `showBuildingInfoPanel`
2. 检查 `_showingInfoPanel` 标志时序
3. 检查 `_towerBuilderHandlingClick` 标志
4. 检查 `UnitSelectionManager` 是否跳过清除选择

### 选择失效

1. 检查 `UnitSelectionManager.onGlobalTouchEnd` 是否执行
2. 检查 `findUnitAtTouchLocation` 是否找到单位
3. 检查选中区域检测逻辑

---

## 四、代码规范

### 命名约定

- 私有属性：`private _prefix: type`（带下划线）
- 保护属性：`protected prefix: type`（无下划线）
- 常量：`private readonly CONSTANT_NAME: type`
- 临时变量：`const tempVar = value`

### 日志规范

```typescript
// 格式：[类名] 方法名 - 描述
console.log(`[Role.setManualMoveTarget] ${this.unitName}, wasManuallyControlled=true`);
console.warn(`[EnemySpawner] 加载波次配置失败，当前关卡：${this.currentLevel}`);
console.error('[GameManager] 严重错误：描述');
```

### 注释规范

```typescript
/**
 * 简短说明
 * @param param 参数说明
 * @returns 返回值说明
 */
private methodName(param: type): returnType {
    // 单行注释说明复杂逻辑
}
```

---

## 五、修改代码前的检查清单

1. [ ] 确认节点路径（参考 `docs/节点路径.md`）
2. [ ] 确认字符串替换的唯一性（使用 Grep）
3. [ ] 确认是否有循环导入风险
4. [ ] 确认对象池状态是否需要重置
5. [ ] 修改后检查语法是否正确
6. [ ] 添加必要的调试日志

---

## 六、重要文件索引

| 文件 | 作用 | 关键方法 |
|------|------|----------|
| `Role.ts` | 我方单位基类 | `onTowerClick`, `setManualMoveTarget` |
| `Enemy.ts` | 敌方单位基类 | `update`, `attack` |
| `Build.ts` | 建筑物基类 | `onBuildingClick`, `showSelectionPanel` |
| `UnitSelectionManager.ts` | 单位选择管理 | `selectUnit`, `clearSelection`, `findUnitAtTouchLocation` |
| `EnemySpawner.ts` | 敌人生成管理 | `updateWaveSystem`, `endCurrentWave` |
| `TowerBuilder.ts` | 塔建造管理 | `startLongPressDetection`, `startDraggingBuilding` |
| `GameManager.ts` | 游戏总管理 | `showBuffCards`, `checkGameState` |
| `BuffCardPopup.ts` | 增益卡片弹窗 | `onGetAllClick`, `showCards` |

---

## 七、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 37 | 2026/04/09 | 单位重叠选择修复、游戏节奏调整 |
| 36 | 2026/04/07 | 贴图模式调整、单位选择优化 |
| 35 | 2026/03/23 | SP 卡片、传送门机制 |
| 34 | 2026/03/16 | 弓箭手小游戏、金矿机制 |

---

**最后更新**：2026/04/09
**维护者**：Claude (Anthropic AI)
