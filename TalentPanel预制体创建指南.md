# TalentPanel 预制体创建指南

## 概述

为了在编辑器中配置 TalentSystem 的边框贴图属性（`cardBorderFrame` 和 `detailPanelBorderFrame`），需要创建一个 TalentPanel 预制体。

## 创建步骤

### 1. 创建预制体节点

1. 在 Cocos Creator 编辑器中，右键点击 **资源管理器** 中的 `assets/prefabs` 文件夹（如果没有则创建）
2. 选择 **创建 > 预制体**
3. 命名为 `TalentPanel`

### 2. 配置预制体节点

1. 双击打开 `TalentPanel` 预制体进行编辑
2. 在 **层级管理器** 中选中根节点 `TalentPanel`
3. 在 **属性检查器** 中添加以下组件：

#### 2.1 添加 UITransform 组件
- 如果不存在，点击 **添加组件 > UI > UITransform**
- 设置尺寸：宽度 `960`，高度 `640`（或根据你的屏幕尺寸调整）
- 设置锚点：`(0.5, 0.5)`

#### 2.2 添加 Graphics 组件（背景）
- 点击 **添加组件 > UI > Graphics**
- 设置填充颜色：`(0, 0, 40, 220)`（深蓝色半透明背景）

#### 2.3 添加 Label 组件（标题，可选）
- 点击 **添加组件 > UI > Label**
- 设置文本：`天赋面板 - 强化友方单位`
- 设置字体大小：`28`
- 设置颜色：`(100, 200, 255, 255)`
- 设置对齐方式：水平居中，垂直顶部
- 在节点属性中设置位置：`(0, 200, 0)`

#### 2.4 添加 TalentSystem 组件（重要）
- 点击 **添加组件 > 自定义脚本 > TalentSystem**
- 在 **属性检查器** 中配置以下属性：
  - **Talent Panel**: 拖拽当前节点（TalentPanel）到这里
  - **Card Border Frame**: 拖拽卡片边框贴图资源（SpriteFrame）到这里
  - **Detail Panel Border Frame**: 拖拽详情面板边框贴图资源（SpriteFrame）到这里

### 3. 配置边框贴图资源

#### 3.1 准备边框贴图
1. 将边框贴图图片导入到项目中（例如：`assets/textures/borders/`）
2. 确保图片已转换为 SpriteFrame 资源

#### 3.2 在预制体中配置
1. 在 TalentPanel 预制体编辑模式下
2. 选中根节点，找到 **TalentSystem** 组件
3. 将卡片边框贴图拖拽到 **Card Border Frame** 属性
4. 将详情面板边框贴图拖拽到 **Detail Panel Border Frame** 属性

### 4. 保存预制体

1. 点击编辑器顶部的 **保存** 按钮
2. 确保预制体已保存到 `assets/prefabs/TalentPanel.prefab`

### 5. 在场景中配置 UIManager

1. 在场景中找到 **UIManager** 节点
2. 在 **属性检查器** 中找到 **UIManager** 组件
3. 将 `TalentPanel.prefab` 拖拽到 **Talent Panel Prefab** 属性

## 注意事项

1. **降级兼容**：如果没有配置预制体，UIManager 会自动使用动态创建的方式（向后兼容），但无法在编辑器中配置边框贴图。

2. **边框贴图尺寸**：
   - 卡片边框贴图应该适合卡片尺寸（150x200）
   - 详情面板边框贴图应该适合详情面板尺寸（500x400）
   - 如果贴图尺寸不匹配，Sprite 组件会自动缩放

3. **TalentPanel 引用**：确保 TalentSystem 组件的 **Talent Panel** 属性指向预制体根节点（代码会自动设置，但建议手动确认）。

4. **测试**：创建完预制体后，运行游戏并点击"天赋"按钮，检查：
   - 卡片是否正确显示边框贴图
   - 详情面板是否正确显示边框贴图
   - 如果没有配置边框贴图，应该使用 Graphics 绘制的边框（降级方案）

## 文件结构

```
assets/
├── prefabs/
│   └── TalentPanel.prefab          # TalentPanel 预制体
├── textures/
│   └── borders/
│       ├── card_border.png         # 卡片边框贴图
│       └── detail_border.png      # 详情面板边框贴图
└── scripts/
    ├── TalentSystem.ts             # TalentSystem 组件
    └── UIManager.ts                # UIManager（已更新支持预制体）
```

## 完成后的效果

- ✅ 可以在编辑器中直接配置边框贴图
- ✅ 卡片显示配置的边框贴图
- ✅ 详情面板显示配置的边框贴图
- ✅ 如果没有配置边框贴图，自动使用 Graphics 绘制边框（降级方案）

