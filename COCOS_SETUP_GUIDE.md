# Cocos Creator 设置指南

## 第二轮优化功能设置说明

### 1. 金币系统设置

#### 在 GameManager 节点中：
1. 选中 `GameManager` 节点
2. 在 Inspector 面板找到 `GameManager` 脚本组件
3. 找到 `Gold Label` 属性
4. 在 Hierarchy 中创建新的 Label 节点：
   - 右键点击 `UI` 节点 → `Create` → `UI Component` → `Label`
   - 重命名为 `GoldLabel`
   - 设置位置在水晶血量下方（例如：x: 0, y: -30）
   - 设置 String: "金币: 10"
   - Font Size: 24
   - Color: 黄色或金色
5. 将 `GoldLabel` 节点拖拽到 GameManager 的 `Gold Label` 属性中

### 2. 敌人血条和伤害数字设置

#### 在 Enemy 预制体中：
1. 打开 `assets/prefabs/Enemy.prefab`
2. 选中 `Enemy` 节点
3. 在 `Enemy` 脚本组件中：
   - `Gold Reward`: 2（消灭敌人获得的金币）
   - `Damage Number Prefab`: 可选，如果创建了伤害数字预制体，拖拽到这里

#### 创建伤害数字预制体（可选）：
1. 在 Hierarchy 中创建新节点：
   - 右键 → `Create` → `UI Component` → `Label`
   - 重命名为 `DamageNumber`
2. 添加 `DamageNumber` 脚本：
   - `Add Component` → `Custom Script` → `DamageNumber`
3. 设置 Label 属性：
   - Font Size: 20
   - Color: 白色
   - String: "-10"（示例）
4. 保存为预制体：
   - 拖拽到 `assets/prefabs/` 文件夹

### 3. 防御塔血条和伤害数字设置

#### 在 Tower 预制体中：
1. 打开 `assets/prefabs/Tower.prefab`
2. 选中 `Tower` 节点
3. 在 `Tower` 脚本组件中：
   - `Build Cost`: 5（建造成本）
   - `Level`: 1（初始等级）
   - `Damage Number Prefab`: 可选，如果创建了伤害数字预制体，拖拽到这里

#### 为防御塔添加点击检测：
1. 选中 Tower 节点
2. 添加 `UITransform` 组件（如果还没有）：
   - `Add Component` → `UITransform`
   - 设置 Content Size: (50, 50) 或更大，确保可以点击
3. 添加 `Button` 组件（可选，用于更好的点击检测）：
   - `Add Component` → `Button`
   - 设置 Transition: NONE（因为我们用代码处理点击）

### 4. 防御塔选择面板说明

防御塔的选择面板会在点击防御塔时自动创建，包含：
- **回收按钮**：左侧，点击后按建造成本的80%回收金币
- **升级按钮**：右侧，点击后消耗双倍建造成本进行升级

面板会自动在防御塔上方显示，点击其他地方会自动关闭。

### 5. 爆炸特效修复说明

爆炸特效已经修复，初始缩放设置为0，不会在屏幕中央显示。确保：
1. `ExplosionEffect` 脚本已添加到爆炸预制体
2. 爆炸预制体的初始 Scale 设置为 (1, 1, 1)
3. 脚本会自动处理缩放动画

### 6. 需要添加的组件和标签

#### 新增脚本组件：
- ✅ `HealthBar.ts` - 血条组件（已创建）
- ✅ `DamageNumber.ts` - 伤害数字组件（已创建）

#### 需要在 Cocos Creator 中设置的属性：

**GameManager 节点：**
- `Gold Label` (Label) - 金币显示标签

**Enemy 预制体：**
- `Gold Reward` (number) - 金币奖励，默认 2
- `Damage Number Prefab` (Prefab) - 可选，伤害数字预制体

**Tower 预制体：**
- `Build Cost` (number) - 建造成本，默认 5
- `Level` (number) - 等级，默认 1
- `Damage Number Prefab` (Prefab) - 可选，伤害数字预制体
- 需要添加 `UITransform` 组件用于点击检测

**TowerBuilder 节点：**
- `Tower Cost` (number) - 防御塔建造成本，默认 5

### 7. 操作步骤总结

#### 步骤1：设置金币显示
1. 创建 `GoldLabel` 节点（在 UI 节点下）
2. 设置位置和样式
3. 绑定到 GameManager 的 `Gold Label` 属性

#### 步骤2：设置敌人
1. 打开 Enemy 预制体
2. 设置 `Gold Reward` 为 2
3. （可选）创建并绑定伤害数字预制体

#### 步骤3：设置防御塔
1. 打开 Tower 预制体
2. 设置 `Build Cost` 为 5
3. 设置 `Level` 为 1
4. 添加 `UITransform` 组件
5. （可选）创建并绑定伤害数字预制体

#### 步骤4：设置 TowerBuilder
1. 选中场景中的 `TowerBuilder` 节点
2. 在脚本组件中设置 `Tower Cost` 为 5

### 8. 注意事项

1. **血条会自动创建**：Enemy 和 Tower 的血条会在运行时自动创建，不需要手动添加
2. **伤害数字**：如果没有创建预制体，系统会自动创建简单的 Label 显示伤害
3. **防御塔点击**：确保 Tower 节点有 UITransform 组件，否则可能无法点击
4. **选择面板**：点击防御塔后会显示选择面板，点击其他地方会自动关闭
5. **金币不足**：建造或升级时如果金币不足，会在控制台输出提示

### 9. 测试清单

- [ ] 金币显示正常，初始为10
- [ ] 建造防御塔消耗5金币
- [ ] 消灭敌人获得2金币
- [ ] 敌人和防御塔都有血条显示
- [ ] 受到伤害时显示伤害数字
- [ ] 点击防御塔显示选择面板
- [ ] 回收防御塔获得80%金币
- [ ] 升级防御塔消耗双倍成本，属性提升
- [ ] 爆炸特效不在屏幕中央显示

