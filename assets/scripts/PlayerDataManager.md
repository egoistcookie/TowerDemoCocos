# PlayerDataManager 数据持久化说明

## 数据保存机制

### 为什么使用 localStorage 而不是直接写入 JSON 文件？

在 Cocos Creator 运行时环境中，`resources` 目录是**只读**的，无法直接修改其中的文件。这是引擎的安全机制，防止运行时代码修改资源文件。

### 数据保存方式

`PlayerDataManager` 使用 **localStorage** 来保存玩家数据，这是 Cocos Creator 推荐的标准做法：

1. **数据持久化**：localStorage 中的数据会永久保存，即使关闭游戏或浏览器，数据也不会丢失
2. **跨平台兼容**：localStorage 在所有 Cocos Creator 支持的平台上都可用（Web、微信小程序、原生平台等）
3. **性能优秀**：localStorage 的读写速度很快，不会影响游戏性能
4. **自动同步**：数据会在以下时机自动保存：
   - 经验值增加时
   - 天赋点变化时
   - 游戏结束时
   - 主动退出游戏时

### 数据存储位置

- **Web 平台**：浏览器的 localStorage
- **微信小程序**：小程序的本地存储
- **原生平台**：平台的本地存储系统

### 如何查看保存的数据

如果需要查看或调试保存的数据，可以使用以下方法：

```typescript
// 获取 PlayerDataManager 实例
const playerDataManager = PlayerDataManager.getInstance();

// 导出为 JSON 字符串（用于调试）
const jsonString = playerDataManager.exportDataAsJSON();
console.log(jsonString);

// 获取数据副本
const data = playerDataManager.getPlayerData();
console.log('经验值:', data.experience);
console.log('天赋点:', data.talentPoints);
```

### 数据加载顺序

1. 首先尝试从 localStorage 加载（如果存在）
2. 如果 localStorage 中没有数据，则从 `config/playerData.json` 加载默认值
3. 加载后自动保存到 localStorage，确保数据持久化

### 注意事项

- 数据会自动保存，无需手动调用 `saveData()`
- 每次修改经验值或天赋点后，数据会立即保存
- 游戏重启后，数据会自动从 localStorage 恢复

