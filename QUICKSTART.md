# 塔防游戏快速开始指南

## 已完成的工作

所有核心脚本已经创建完成，包括：

### 核心脚本（assets/scripts/）
- ✅ `GameManager.ts` - 游戏主控制器，管理游戏状态、倒计时和结束判定
- ✅ `Crystal.ts` - 水晶系统，包含血量管理和受伤害逻辑
- ✅ `Enemy.ts` - 敌人系统，包含移动、攻击和死亡动画
- ✅ `EnemySpawner.ts` - 敌人生成器，从四周生成敌人
- ✅ `Tower.ts` - 防御塔系统，包含攻击逻辑和血量管理
- ✅ `TowerBuilder.ts` - 建造系统，支持点击建造防御塔
- ✅ `UIManager.ts` - UI管理器，处理按钮事件
- ✅ `ExplosionEffect.ts` - 爆炸效果脚本

### 文档
- ✅ `assets/README.md` - 项目说明文档
- ✅ `assets/scenes/README.md` - 场景设置详细说明

## 下一步操作

### 1. 在Cocos Creator编辑器中创建场景

1. 打开Cocos Creator编辑器
2. 创建新场景 `GameScene.scene`，保存到 `assets/scenes/`
3. 按照 `assets/scenes/README.md` 中的说明设置场景结构

### 2. 创建预制体

需要创建以下预制体（保存到 `assets/prefabs/`）：

#### Enemy预制体
- 创建Node，命名为 "Enemy"
- 添加Sprite组件（使用红色方形纹理）
- 添加 `Enemy` 脚本组件
- 设置脚本属性（参考 `assets/README.md`）

#### Tower预制体
- 创建Node，命名为 "Tower"
- 添加Sprite组件（使用绿色三角形纹理）
- 添加 `Tower` 脚本组件
- 设置脚本属性

#### Explosion预制体（可选）
- 创建Node，命名为 "Explosion"
- 添加Sprite组件（使用黄色/橙色圆形纹理）
- 添加 `ExplosionEffect` 脚本组件

### 3. 配置场景节点

在GameScene场景中：

1. **GameManager节点**
   - 添加 `GameManager` 脚本
   - 绑定所有属性引用（crystal, healthLabel, timerLabel等）

2. **Crystal节点**
   - 添加Sprite组件（蓝色圆形）
   - 添加 `Crystal` 脚本
   - 位置设置为 (0, 0, 0)

3. **EnemySpawner节点**
   - 添加 `EnemySpawner` 脚本
   - 绑定enemyPrefab和enemyContainer

4. **TowerBuilder节点**
   - 添加 `TowerBuilder` 脚本
   - 绑定towerPrefab和towerContainer

5. **UI节点**
   - 创建Canvas下的UI结构
   - 添加Label显示血量和倒计时
   - 添加Button用于建造和重新开始
   - 添加GameOverPanel

### 4. 运行测试

1. 在编辑器中点击运行按钮
2. 测试游戏逻辑：
   - 敌人是否正常生成和移动
   - 防御塔是否正常攻击
   - 建造系统是否正常工作
   - 游戏结束判定是否正确

### 5. 构建到微信小程序

1. 项目 -> 构建发布
2. 选择"微信小游戏"平台
3. 配置小程序AppID
4. 点击构建

## 注意事项

1. **节点命名**：确保节点名称与脚本中查找的名称一致：
   - Crystal节点命名为 "Crystal"
   - Enemies容器命名为 "Enemies"
   - Towers容器命名为 "Towers"
   - GameManager节点命名为 "GameManager"

2. **坐标系统**：所有位置使用世界坐标，确保Camera设置正确

3. **触摸事件**：TowerBuilder使用全局触摸事件，确保Canvas的触摸事件已启用

4. **事件系统**：Crystal使用EventTarget进行事件通信，GameManager需要正确监听

## 故障排查

如果遇到问题：

1. **敌人不生成**：检查EnemySpawner的enemyPrefab是否绑定
2. **防御塔不攻击**：检查Tower的attackRange和Enemies容器是否存在
3. **建造不工作**：检查TowerBuilder的towerPrefab是否绑定，触摸事件是否启用
4. **游戏不结束**：检查GameManager的事件监听是否正确设置

## 参考文档

- 详细场景设置：`assets/scenes/README.md`
- 项目说明：`assets/README.md`
- Cocos Creator官方文档：https://docs.cocos.com/

