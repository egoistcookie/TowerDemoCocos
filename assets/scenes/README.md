# 场景设置说明

## GameScene 场景结构

在Cocos Creator编辑器中创建场景时，请按照以下结构设置：

### 根节点层级结构：

```
Canvas (Canvas组件)
├── Camera (Camera组件)
├── GameManager (Node + GameManager脚本)
├── Crystal (Node + Sprite + Crystal脚本)
│   └── Sprite (圆形，蓝色，半径约40像素)
├── EnemySpawner (Node + EnemySpawner脚本)
├── TowerBuilder (Node + TowerBuilder脚本)
├── Enemies (Node，空容器，用于存放敌人实例)
├── Towers (Node，空容器，用于存放防御塔实例)
└── UI (Node)
    ├── HealthLabel (Label组件，显示水晶血量)
    ├── TimerLabel (Label组件，显示倒计时)
    ├── BuildButton (Button组件，建造防御塔按钮)
    └── GameOverPanel (Node)
        ├── GameOverLabel (Label组件，显示胜利/失败)
        └── RestartButton (Button组件，重新开始按钮)
```

## 节点创建步骤

### 如何创建节点和添加组件

#### 1. GameManager 节点（空节点 + 脚本）

**创建节点：**
- 在 Hierarchy 面板中，右键点击 `Canvas` 节点
- 选择 `Create` → `Empty Node`（创建空节点）
- 将节点重命名为 `GameManager`

**添加脚本组件：**
- 选中 `GameManager` 节点
- 在 Inspector 面板底部点击 `Add Component`
- 在搜索框输入 `GameManager`，或选择 `Custom Script` → `GameManager`

#### 2. Crystal 节点（Sprite + 脚本）

**创建节点：**
- 在 Hierarchy 面板中，右键点击 `Canvas` 节点
- 选择 `Create` → `2D Object` → `Sprite`
- 将节点重命名为 `Crystal`

**配置 Sprite 组件：**
- 选中 `Crystal` 节点
- 在 Inspector 面板的 Sprite 组件中：
  - 设置 SpriteFrame（可以使用内置的圆形纹理，或创建纯色圆形纹理）
  - 设置颜色为蓝色
  - 调整 Size 为 (80, 80) 左右

**添加脚本组件：**
- 在 Inspector 面板底部点击 `Add Component`
- 选择 `Custom Script` → `Crystal`

**设置位置：**
- 在 Transform 组件中，设置 Position 为 (0, 0, 0)

#### 3. EnemySpawner 节点（空节点 + 脚本）

**创建节点：**
- 右键点击 `Canvas` → `Create` → `Empty Node`
- 重命名为 `EnemySpawner`

**添加脚本组件：**
- 选中节点，点击 `Add Component` → `Custom Script` → `EnemySpawner`

#### 4. TowerBuilder 节点（空节点 + 脚本）

**创建节点：**
- 右键点击 `Canvas` → `Create` → `Empty Node`
- 重命名为 `TowerBuilder`

**添加脚本组件：**
- 选中节点，点击 `Add Component` → `Custom Script` → `TowerBuilder`

#### 5. Enemies 和 Towers 容器节点

**创建 Enemies 容器：**
- 右键点击 `Canvas` → `Create` → `Empty Node`
- 重命名为 `Enemies`

**创建 Towers 容器：**
- 右键点击 `Canvas` → `Create` → `Empty Node`
- 重命名为 `Towers`

> **注意：** 这两个是空容器节点，不需要添加脚本，用于存放运行时生成的敌人和防御塔实例。

#### 6. UI 节点和组件

**创建 UI 根节点：**
- 右键点击 `Canvas` → `Create` → `Empty Node`
- 重命名为 `UI`

**创建 HealthLabel（显示血量）：**
- 右键点击 `UI` 节点 → `Create` → `UI Component` → `Label`
- 重命名为 `HealthLabel`
- 在 Label 组件中设置：
  - String: "水晶血量: 100"
  - Font Size: 24
  - Color: 白色
- 调整位置到屏幕左上角

**创建 TimerLabel（显示倒计时）：**
- 右键点击 `UI` 节点 → `Create` → `UI Component` → `Label`
- 重命名为 `TimerLabel`
- 设置 String: "时间: 3:00"
- 调整位置到屏幕右上角

**创建 BuildButton（建造按钮）：**
- 右键点击 `UI` 节点 → `Create` → `UI Component` → `Button`
- 重命名为 `BuildButton`
- 在 Button 组件中：
  - 找到 `Click Events`，点击 `+` 添加事件
  - 拖拽 `UIManager` 节点到 Target
  - 选择 `UIManager` → `onBuildButtonClick`
- 调整位置到屏幕底部

**创建 GameOverPanel（游戏结束面板）：**
- 右键点击 `UI` 节点 → `Create` → `Empty Node`
- 重命名为 `GameOverPanel`
- 添加 Widget 组件，设置对齐方式为全屏居中

**创建 GameOverLabel：**
- 右键点击 `GameOverPanel` → `Create` → `UI Component` → `Label`
- 重命名为 `GameOverLabel`
- 设置 String: ""（初始为空）
- Font Size: 48
- Color: 红色或绿色

**创建 RestartButton：**
- 右键点击 `GameOverPanel` → `Create` → `UI Component` → `Button`
- 重命名为 `RestartButton`
- 设置按钮文字为 "重新开始"
- 绑定点击事件到 `UIManager` → `onRestartButtonClick`

**创建 UIManager 节点：**
- 右键点击 `UI` 节点 → `Create` → `Empty Node`
- 重命名为 `UIManager`
- 添加 `UIManager` 脚本组件
- 在脚本属性中绑定：
  - buildButton: 拖拽 `BuildButton` 节点
  - restartButton: 拖拽 `RestartButton` 节点
  - towerBuilder: 拖拽 `TowerBuilder` 节点

## 节点设置说明

### Canvas设置

在 Cocos Creator 3.x 中，设计分辨率需要在**项目设置**中配置，而不是在 Canvas 组件中。

#### 方法一：通过项目设置配置（推荐）

1. **打开项目设置**
   - 菜单栏：`项目` → `项目设置`（Project → Project Settings）
   - 或使用快捷键（根据你的系统）

2. **设置设计分辨率**
   - 在项目设置窗口左侧，找到 `项目设置` → `通用` 或 `项目数据`
   - 找到 `设计分辨率`（Design Resolution）或 `默认 Canvas 设置`
   - 设置宽度（Width）为 `750`
   - 设置高度（Height）为 `1334`
   - 这是微信小程序的常用分辨率

3. **设置适配模式**
   - 找到 `适配屏幕宽度`（Fit Width），勾选
   - 找到 `适配屏幕高度`（Fit Height），勾选
   - 这样可以在不同尺寸的设备上自动适配

#### 方法二：通过 Canvas 的 Widget 组件适配

如果项目设置中没有找到，可以通过 Widget 组件实现适配：

1. **选中 Canvas 节点**
   - 在 Hierarchy 面板中点击 `Canvas` 节点
   - Inspector 面板会显示 Canvas 组件的属性

2. **配置 Widget 组件**
   - 确保 Canvas 节点有 `Widget` 组件（如果没有，点击 `Add Component` 添加）
   - 在 Widget 组件中：
     - **Horizontal Alignment（水平对齐）**：选择 `Stretch`（拉伸）
     - **Left** 和 **Right**：都设置为 `0`
     - **Vertical Alignment（垂直对齐）**：选择 `Stretch`（拉伸）
     - **Top** 和 **Bottom**：都设置为 `0`
     - **Align Mode**：选择 `ON_WINDOW_RESIZE`

3. **设置 Canvas 的 UITransform**
   - 在 `cc.UITransform` 组件中，Content Size 会自动适配
   - 如果需要固定设计尺寸，可以手动设置 Content Size 为 750x1334

#### Canvas 组件属性说明

- **Camera Component**：绑定的摄像机组件（通常自动绑定）
- **Align Canvas With Screen**：勾选后，Canvas 会自动对齐屏幕
- **Widget 组件**：用于实现自适应布局，可以设置边距和对齐方式

#### 微信小程序适配建议

- **设计分辨率**：750x1334（iPhone 6/7/8 尺寸）
- **适配方式**：
  - 在项目设置中设置设计分辨率
  - 使用 Widget 组件实现全屏拉伸适配
  - 确保 `Align Canvas With Screen` 已勾选

#### 其他常用分辨率

- 横屏游戏：1334x750
- 正方形：750x750
- 小屏适配：640x1136

#### 注意事项

- Cocos Creator 3.x 的设计分辨率主要在项目设置中配置
- Canvas 组件主要负责渲染和摄像机绑定
- 使用 Widget 组件可以实现更灵活的适配方案

### Crystal节点
- 位置：(0, 0, 0) - 场景中心
- Sprite组件：使用圆形纹理，颜色蓝色
- Crystal脚本：maxHealth = 100

### GameManager节点属性绑定

**详细步骤：**

1. **选中 GameManager 节点**
   - 在 Hierarchy 面板中点击 `GameManager` 节点
   - 确保 Inspector 面板显示 GameManager 的组件

2. **绑定 Crystal 节点**
   - 在 Inspector 面板中找到 GameManager 脚本组件
   - 找到 `Crystal` 属性（类型为 Node）
   - 从 Hierarchy 面板中**拖拽 `Crystal` 节点**到 `Crystal` 属性的输入框中
   - 或者点击输入框右侧的**圆圈图标**，在弹出的节点选择器中选择 `Crystal` 节点

3. **绑定 HealthLabel**
   - 找到 `Health Label` 属性（类型为 Label）
   - 从 Hierarchy 面板中**拖拽 `UI/HealthLabel` 节点**到该属性
   - 注意：Label 组件会自动识别，确保拖拽的是包含 Label 组件的节点

4. **绑定 TimerLabel**
   - 找到 `Timer Label` 属性（类型为 Label）
   - 从 Hierarchy 面板中**拖拽 `UI/TimerLabel` 节点**到该属性

5. **绑定 GameOverPanel**
   - 找到 `Game Over Panel` 属性（类型为 Node）
   - 从 Hierarchy 面板中**拖拽 `UI/GameOverPanel` 节点**到该属性

6. **绑定 GameOverLabel**
   - 找到 `Game Over Label` 属性（类型为 Label）
   - 从 Hierarchy 面板中**拖拽 `UI/GameOverPanel/GameOverLabel` 节点**到该属性

**绑定完成后的检查：**
- 所有属性都不应该显示为 `None` 或空
- 每个属性都应该显示对应的节点名称
- 如果属性显示为红色或警告，说明绑定失败，需要重新绑定

**提示：**
- 可以使用拖拽方式，也可以点击属性右侧的圆圈图标选择节点
- 确保节点名称正确，特别是大小写要匹配
- Label 类型的属性必须绑定包含 Label 组件的节点

### EnemySpawner节点属性绑定

**重要：必须正确绑定以下属性，否则敌人不会移动！**

1. **选中 EnemySpawner 节点**
   - 在 Hierarchy 面板中点击 `EnemySpawner` 节点

2. **绑定 Enemy Prefab**
   - 找到 `Enemy Prefab` 属性（类型为 Prefab）
   - 从 Assets 面板中**拖拽 `Enemy.prefab`** 到该属性
   - ⚠️ **必须绑定，否则敌人不会生成**

3. **绑定 Target Crystal**
   - 找到 `Target Crystal` 属性（类型为 Node）
   - 从 Hierarchy 面板中**拖拽 `Crystal` 节点**到该属性
   - ⚠️ **必须绑定，否则敌人不会向水晶移动**

4. **绑定 Enemy Container（可选）**
   - 找到 `Enemy Container` 属性（类型为 Node）
   - 从 Hierarchy 面板中**拖拽 `Enemies` 节点**到该属性
   - 如果留空，脚本会自动创建 Enemies 容器

5. **设置其他属性**
   - `Spawn Interval`: 2.5（生成间隔，秒）
   - `Spawn Distance`: 400（生成距离，像素）

**检查清单：**
- ✅ Enemy Prefab 已绑定
- ✅ Target Crystal 已绑定 Crystal 节点
- ✅ Enemy Container 已绑定 Enemies 节点（或留空）

### TowerBuilder节点
- TowerBuilder脚本：
  - buildRange: 300
  - minBuildDistance: 80
  - targetCrystal: 拖拽Crystal节点
  - towerContainer: 拖拽Towers节点

## 预制体创建

### Enemy预制体

**创建步骤：**
1. 在 Hierarchy 中右键点击任意节点 → `Create` → `2D Object` → `Sprite`
2. 重命名为 `Enemy`
3. 配置 Sprite 组件：
   - 设置 SpriteFrame（方形纹理，或创建纯色方形）
   - 设置颜色为红色
   - 调整 Size 为 (40, 40) 左右
4. 添加 Enemy 脚本：
   - 点击 `Add Component` → `Custom Script` → `Enemy`
5. 设置 Enemy 脚本属性：
   - maxHealth: 30
   - moveSpeed: 50
   - attackDamage: 5
   - attackInterval: 2.0
   - attackRange: 50
6. 保存为预制体：
   - 将 `Enemy` 节点从 Hierarchy 拖拽到 Assets 面板的 `assets/prefabs/` 文件夹
   - 会自动创建 `Enemy.prefab` 文件

### Tower预制体

**创建步骤：**
1. 在 Hierarchy 中右键 → `Create` → `2D Object` → `Sprite`
2. 重命名为 `Tower`
3. 配置 Sprite 组件：
   - 设置 SpriteFrame（三角形纹理，或创建纯色三角形）
   - 设置颜色为绿色
   - 调整 Size 为 (50, 50) 左右
4. 添加 Tower 脚本：
   - 点击 `Add Component` → `Custom Script` → `Tower`
5. 设置 Tower 脚本属性：
   - maxHealth: 50
   - attackRange: 200
   - attackDamage: 10
   - attackInterval: 1.0
6. 保存为预制体：
   - 拖拽到 `assets/prefabs/` 文件夹，创建 `Tower.prefab`

### 爆炸效果预制体（可选）

**创建步骤：**
1. 在 Hierarchy 中右键 → `Create` → `2D Object` → `Sprite`
2. 重命名为 `Explosion`
3. 配置 Sprite 组件：
   - 设置 SpriteFrame（圆形纹理）
   - 设置颜色为黄色或橙色
   - 调整 Size 为 (100, 100) 左右
4. 添加 ExplosionEffect 脚本：
   - 点击 `Add Component` → `Custom Script` → `ExplosionEffect`
5. 保存为预制体：
   - 拖拽到 `assets/prefabs/` 文件夹，创建 `Explosion.prefab`

## 纹理资源创建

由于使用简单几何图形，可以使用以下方法创建纹理：

### 方法一：使用纯色 SpriteFrame（推荐）

1. **创建圆形纹理（用于Crystal）：**
   - 在 Assets 面板右键 → `Create` → `SpriteFrame`
   - 或者使用 Cocos Creator 内置的默认圆形纹理
   - 在 Sprite 组件的 SpriteFrame 属性中选择

2. **创建方形纹理（用于Enemy）：**
   - 使用内置的默认方形纹理
   - 或在 Sprite 组件中直接设置颜色

3. **创建三角形纹理（用于Tower）：**
   - 可以使用 Graphics 组件绘制
   - 或使用简单的方形纹理配合旋转

### 方法二：使用 Graphics 组件绘制

1. 创建空节点
2. 添加 Graphics 组件
3. 使用代码绘制形状：
   ```typescript
   // 在脚本中使用 Graphics 绘制
   const graphics = node.getComponent(Graphics);
   graphics.circle(0, 0, 40); // 绘制圆形
   graphics.fill(); // 填充
   ```

### 方法三：使用内置默认纹理

Cocos Creator 提供了默认的圆形和方形纹理，可以直接在 Sprite 组件中选择使用。

### 快速设置建议

对于 MVP 版本，最简单的方法是：
- Crystal: 使用默认圆形纹理，设置蓝色
- Enemy: 使用默认方形纹理，设置红色
- Tower: 使用默认方形纹理，设置绿色，旋转45度形成菱形效果

