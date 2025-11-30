# 故障排查指南

## 敌人不向水晶移动的问题

### 检查清单

#### 1. EnemySpawner 节点配置

**检查 EnemySpawner 脚本的属性绑定：**
- ✅ `enemyPrefab`: 必须绑定 Enemy 预制体
- ✅ `targetCrystal`: 必须绑定 Crystal 节点
- ✅ `enemyContainer`: 必须绑定 Enemies 容器节点（或留空，脚本会自动创建）

**如何检查：**
1. 选中 `EnemySpawner` 节点
2. 在 Inspector 面板查看 EnemySpawner 脚本
3. 确保所有属性都不是 `None` 或空

#### 2. Enemy 预制体配置

**检查 Enemy 预制体：**
- ✅ Enemy 节点必须有 `Enemy` 脚本组件
- ✅ `targetCrystal` 属性可以留空（会在运行时自动查找）

**如何检查：**
1. 打开 `assets/prefabs/Enemy.prefab`
2. 选中 Enemy 节点
3. 确保有 `Enemy` 脚本组件
4. `targetCrystal` 属性可以留空

#### 3. Crystal 节点

**检查 Crystal 节点：**
- ✅ 节点名称必须是 `Crystal`（区分大小写）
- ✅ 节点必须在场景中且处于激活状态
- ✅ 节点必须有 `Crystal` 脚本组件

**如何检查：**
1. 在 Hierarchy 面板中查找 `Crystal` 节点
2. 确保节点名称完全匹配（大小写一致）
3. 确保节点左侧没有禁用图标（灰色）

#### 4. Enemies 容器节点

**检查 Enemies 容器：**
- ✅ 节点名称必须是 `Enemies`（区分大小写）
- ✅ 节点必须在场景中

**如何检查：**
1. 在 Hierarchy 面板中查找 `Enemies` 节点
2. 如果不存在，EnemySpawner 会自动创建，但最好手动创建

### 调试步骤

#### 步骤1：检查控制台输出

运行游戏后，查看控制台（Console）是否有以下错误：
- `EnemySpawner: targetCrystal not set` - EnemySpawner 没有设置 targetCrystal
- `EnemySpawner: Enemy script not found` - Enemy 预制体缺少脚本

#### 步骤2：验证节点查找

在 Enemy 脚本的 `start()` 方法中添加调试日志（临时）：

```typescript
start() {
    // ... 现有代码 ...
    if (this.targetCrystal) {
        console.debug('Enemy: targetCrystal found:', this.targetCrystal.name);
    } else {
        console.error('Enemy: targetCrystal not found!');
    }
}
```

#### 步骤3：检查敌人是否生成

1. 运行游戏
2. 等待 2.5 秒（spawnInterval）
3. 在 Hierarchy 面板中查看 `Enemies` 节点下是否有新生成的敌人
4. 如果敌人没有生成，检查 EnemySpawner 的 `enemyPrefab` 是否绑定

#### 步骤4：检查敌人位置

1. 选中生成的敌人节点
2. 在 Inspector 面板查看 Transform 组件
3. 确认 Position 有值（不是 0,0,0）
4. 在 Scene 视图中查看敌人是否在场景中可见

### 常见问题及解决方案

#### 问题1：敌人生成了但不移动

**可能原因：**
- Crystal 节点找不到
- targetCrystal 属性没有正确设置

**解决方案：**
1. 确保 Crystal 节点名称是 `Crystal`（完全匹配）
2. 在 EnemySpawner 中手动绑定 `targetCrystal` 属性
3. 检查 Crystal 节点是否在 Canvas 下（应该在）

#### 问题2：敌人没有生成

**可能原因：**
- EnemySpawner 的 `enemyPrefab` 没有绑定
- 游戏状态不是 Playing

**解决方案：**
1. 检查 EnemySpawner 的 `enemyPrefab` 属性
2. 确保 GameManager 的游戏状态是 Playing（0）

#### 问题3：敌人生成在错误的位置

**可能原因：**
- Crystal 节点的位置不正确
- spawnDistance 设置过大或过小

**解决方案：**
1. 确保 Crystal 节点位置在 (0, 0, 0)
2. 调整 EnemySpawner 的 `spawnDistance` 属性（默认 400）

### 快速修复检查表

- [ ] EnemySpawner.targetCrystal 已绑定 Crystal 节点
- [ ] EnemySpawner.enemyPrefab 已绑定 Enemy 预制体
- [ ] EnemySpawner.enemyContainer 已绑定 Enemies 节点（或留空）
- [ ] Crystal 节点名称是 `Crystal`（完全匹配）
- [ ] Crystal 节点在场景中且激活
- [ ] Enemies 容器节点存在
- [ ] Enemy 预制体有 Enemy 脚本组件
- [ ] 游戏正在运行（GameManager 状态是 Playing）

### 如果问题仍然存在

1. **检查控制台错误信息**，根据错误信息定位问题
2. **临时添加调试日志**，查看 Enemy 的 targetCrystal 是否正确设置
3. **验证节点层级结构**，确保所有节点都在正确的位置
4. **重新创建 Enemy 预制体**，确保脚本组件正确添加

