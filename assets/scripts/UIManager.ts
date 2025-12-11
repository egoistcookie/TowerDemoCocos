import { _decorator, Component, Node, Button, Label, find, director, UITransform, Color, Graphics, tween, Vec3, UIOpacity, Sprite, SpriteFrame, Prefab, instantiate } from 'cc';
import { GameManager as GameManagerClass } from './GameManager';
import { CountdownPopup } from './CountdownPopup';
// 导入TalentSystem，用于管理天赋系统和单位卡片
import { TalentSystem } from './TalentSystem';

const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property(Button)
    buildButton: Button = null!;

    @property(Button)
    restartButton: Button = null!;

    @property(Node)
    towerBuilder: Node = null!;

    @property(CountdownPopup)
    countdownPopup: CountdownPopup = null!;

    @property(Prefab)
    talentPanelPrefab: Prefab = null!; // TalentPanel 预制体（可在编辑器中配置，包含 TalentSystem 组件和边框贴图）

    private gameManager: GameManagerClass = null!;
    private warningNode: Node = null!;
    private announcementNode: Node = null!;
    private onCountdownComplete: (() => void) | null = null; // 倒计时完成回调
    private onCountdownManualClose: (() => void) | null = null; // 手动关闭回调

    private confirmDialogNode: Node | null = null;

    start() {
        // 查找游戏管理器
        this.findGameManager();

        // 检查并自动创建countdownPopup
        this.autoCreateCountdownPopup();

        // 绑定按钮事件
        if (this.buildButton) {
            this.buildButton.node.on(Button.EventType.CLICK, this.onBuildButtonClick, this);
            console.debug('UIManager: BuildButton event bound');
        } else {
            console.error('UIManager: BuildButton is null!');
        }

        if (this.restartButton) {
            this.restartButton.node.on(Button.EventType.CLICK, this.onRestartButtonClick, this);
            console.debug('UIManager: RestartButton event bound');
        } else {
            console.error('UIManager: RestartButton is null!');
        }

        // 检查TowerBuilder
        if (this.towerBuilder) {
            console.debug('UIManager: TowerBuilder node set:', this.towerBuilder.name);
        } else {
            console.warn('UIManager: TowerBuilder node not set!');
        }
        
        // 初始化特效节点
        this.createEffects();
        
        // 创建底部选区UI
        this.createBottomSelectionUI();
    }
    
    /**
     * 创建底部选区UI
     */
    createBottomSelectionUI() {
        // 直接创建底部选区，不使用UIBuilder，确保它能立即显示
        console.debug('UIManager: Creating BottomSelection directly');
        
        // 获取Canvas节点
        let canvasNode = find('Canvas');
        if (!canvasNode) {
            canvasNode = this.node;
        }
        
        // 获取Canvas的尺寸信息
        const canvasTransform = canvasNode.getComponent(UITransform);
        const canvasWidth = canvasTransform ? canvasTransform.width : 750;
        const canvasHeight = canvasTransform ? canvasTransform.height : 640;
        
        // 三页签区高度设置为原来的一倍（从100变为200）
        const tabAreaHeight = 200;
        
        // 创建底部选区容器 - 覆盖整个屏幕
        const bottomSelectionNode = new Node('BottomSelection');
        bottomSelectionNode.setParent(canvasNode);
        
        // 设置为可见
        bottomSelectionNode.active = true;
        
        // 添加UITransform组件
        const uiTransform = bottomSelectionNode.addComponent(UITransform);
        uiTransform.setContentSize(canvasWidth, canvasHeight);
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 设置位置在屏幕中心
        bottomSelectionNode.setPosition(0, 0, 0);
        
        // 设置z轴顺序为最高
        bottomSelectionNode.setSiblingIndex(canvasNode.children.length - 1);
        
        // 在底部选区容器上直接绘制背景，确保整个区域背景统一
        // 这将确保面板和底部按钮容器之间没有空白区域
        const bottomSelectionBackground = bottomSelectionNode.addComponent(Graphics);
        // 先绘制默认的深色背景
        bottomSelectionBackground.fillColor = new Color(0, 0, 0, 150); // 半透明黑色背景
        bottomSelectionBackground.rect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
        bottomSelectionBackground.fill();
        
        // 获取底部选区容器的尺寸信息，在整个函数中只声明一次
        const bottomSelectionTransform = bottomSelectionNode.getComponent(UITransform);
        // 默认尺寸，防止获取不到transform的情况
        const defaultWidth = 750;
        const defaultHeight = 640;
        
        // 计算面板尺寸，在整个函数中只计算一次
        const panelWidth = bottomSelectionTransform ? bottomSelectionTransform.width : defaultWidth;
        const panelHeight = bottomSelectionTransform ? bottomSelectionTransform.height : defaultHeight;
        
        // 我们将为天赋面板添加一个特殊处理，确保它的蓝色背景覆盖整个区域
        // 当点击天赋标签时，我们会更新这个背景颜色
        
        // 1. 创建游戏主体面板 - 覆盖整个屏幕，包括底部按钮区域
        const gameMainPanel = new Node('GameMainPanel');
        gameMainPanel.setParent(bottomSelectionNode);
        
        // 设置游戏主体面板尺寸：覆盖整个屏幕
        const gamePanelTransform = gameMainPanel.addComponent(UITransform);
        // 使用底部选区容器的尺寸，避免使用未定义的canvasWidth和canvasHeight
        gamePanelTransform.setContentSize(panelWidth, panelHeight);
        gamePanelTransform.setAnchorPoint(0.5, 0.5);
        
        // 位置：屏幕中心
        gameMainPanel.setPosition(0, 0, 0);
        
        // 确保面板可见
        gameMainPanel.active = true;
        
        // 游戏主体面板暂时设置为最高层级，确保开始游戏按钮可点击
        gameMainPanel.setSiblingIndex(bottomSelectionNode.children.length - 1);
        
        // 移除单独的面板背景，使用底部选区容器的统一背景
        // 这样可以确保面板和底部按钮容器之间没有空白区域
        
        // 创建开始游戏按钮 - 居中显示在游戏主体面板
        const startButton = new Node('StartGameButton');
        startButton.setParent(gameMainPanel);
        startButton.setPosition(0, 0, 0);
        
        // 确保按钮可见
        startButton.active = true;
        
        // 添加按钮变换组件
        const startButtonTransform = startButton.addComponent(UITransform);
        startButtonTransform.setContentSize(300, 80); // 增大按钮尺寸，确保可见
        startButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 首先创建文本节点，确保文本在最上层
        const startButtonLabel = startButton.addComponent(Label);
        startButtonLabel.string = '开始游戏';
        startButtonLabel.fontSize = 30; // 增大字体，确保可见
        startButtonLabel.color = Color.WHITE;
        startButtonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        startButtonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        startButtonLabel.lineHeight = 80; // 设置行高与按钮高度一致
        
        // 使用醒目的颜色，确保可见
        const startButtonBackground = startButton.addComponent(Graphics);
        startButtonBackground.fillColor = new Color(0, 200, 0, 255); // 鲜艳的绿色背景
        startButtonBackground.roundRect(-150, -40, 300, 80, 10); // 圆角矩形
        startButtonBackground.fill();
        
        // 添加边框，增强视觉效果
        startButtonBackground.lineWidth = 3;
        startButtonBackground.strokeColor = new Color(255, 255, 255, 255); // 白色边框
        startButtonBackground.roundRect(-150, -40, 300, 80, 10);
        startButtonBackground.stroke();
        
        // 确保文本在背景之上
        startButtonLabel.node.setSiblingIndex(startButton.children.length - 1);
        
        // 添加Button组件
        const startButtonComp = startButton.addComponent(Button);
        
        // 确保开始游戏按钮位于gameMainPanel的最上层
        startButton.setSiblingIndex(gameMainPanel.children.length - 1);
        
        // 2. 创建天赋面板 - 优先使用预制体，如果没有则动态创建
        let talentPanel: Node;
        
        if (this.talentPanelPrefab) {
            // 使用预制体实例化
            console.debug('UIManager: Creating TalentPanel from prefab');
            talentPanel = instantiate(this.talentPanelPrefab);
            talentPanel.name = 'TalentPanel';
            talentPanel.setParent(bottomSelectionNode);
            
            // 设置面板尺寸和位置
            const talentPanelTransform = talentPanel.getComponent(UITransform) || talentPanel.addComponent(UITransform);
            talentPanelTransform.setContentSize(panelWidth, panelHeight);
            talentPanelTransform.setAnchorPoint(0.5, 0.5);
            talentPanel.setPosition(0, 0, 0);
            
            // 设置面板层级
            talentPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
            
            // 确保 TalentSystem 组件的 talentPanel 属性已设置
            // 先查找所有子节点中的 TalentSystem 组件（因为组件可能在子节点上）
            let talentSystem = talentPanel.getComponent(TalentSystem);
            if (!talentSystem) {
                // 递归查找子节点
                const findTalentSystem = (node: Node): TalentSystem | null => {
                    const comp = node.getComponent(TalentSystem);
                    if (comp) return comp;
                    for (const child of node.children) {
                        const found = findTalentSystem(child);
                        if (found) return found;
                    }
                    return null;
                };
                talentSystem = findTalentSystem(talentPanel);
            }
            
            if (talentSystem) {
                talentSystem.talentPanel = talentPanel;
                console.debug('UIManager: TalentSystem component found in prefab, talentPanel property set to:', talentPanel.name);
            } else {
                console.warn('UIManager: TalentSystem component not found in prefab, adding it dynamically');
                const newTalentSystem = talentPanel.addComponent(TalentSystem);
                newTalentSystem.talentPanel = talentPanel;
                console.debug('UIManager: TalentSystem component added dynamically, talentPanel property set');
            }
        } else {
            // 降级方案：动态创建（保持向后兼容）
            console.debug('UIManager: Creating TalentPanel dynamically (prefab not set)');
            talentPanel = new Node('TalentPanel');
            talentPanel.setParent(bottomSelectionNode);
            
            // 设置面板尺寸和位置 - 覆盖整个屏幕，从顶部到底部
            const talentPanelTransform = talentPanel.addComponent(UITransform);
            // 面板高度：覆盖整个屏幕，包括底部按钮区域
            talentPanelTransform.setContentSize(panelWidth, panelHeight);
            talentPanelTransform.setAnchorPoint(0.5, 0.5);
            
            // 位置：屏幕中心
            talentPanel.setPosition(0, 0, 0);
            
            // 设置面板层级，确保在底部选区背景之上，但在底部按钮容器之下
            talentPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
            
            // 添加半透明背景，确保内容可见且与底部按钮容器连接
            const talentPanelBackground = talentPanel.addComponent(Graphics);
            // 使用更不透明的背景色，确保文字可见
            talentPanelBackground.fillColor = new Color(0, 0, 40, 220);
            // 使用talentPanelTransform获取尺寸
            const talentPanelWidth = talentPanelTransform.width;
            const talentPanelHeight = talentPanelTransform.height;
            talentPanelBackground.rect(-talentPanelWidth / 2, -talentPanelHeight / 2, talentPanelWidth, talentPanelHeight);
            talentPanelBackground.fill();
            
            // 移除边框，避免与底部按钮容器重叠产生横线
            // talentPanelBackground.lineWidth = 2;
            // talentPanelBackground.strokeColor = new Color(100, 150, 255, 255);
            // talentPanelBackground.rect(-talentPanelWidth / 2, -talentPanelHeight / 2, talentPanelWidth, talentPanelHeight);
            // talentPanelBackground.stroke();
            
            // 天赋面板标题
            const talentLabel = talentPanel.addComponent(Label);
            talentLabel.string = '天赋面板 - 强化友方单位';
            talentLabel.fontSize = 28;
            talentLabel.color = new Color(100, 200, 255, 255);
            talentLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            talentLabel.verticalAlign = Label.VerticalAlign.TOP;
            // 标题位置：顶部居中，距离顶部50像素
            // 使用固定值，避免使用未定义的canvasHeight
            talentLabel.node.setPosition(0, 200, 0); // 固定Y坐标，确保标题可见
            
            // 添加 TalentSystem 组件到 TalentPanel
            const talentSystem = talentPanel.addComponent(TalentSystem);
            talentSystem.talentPanel = talentPanel;
        }
        
        // 初始隐藏
        talentPanel.active = false;
        
        // 天赋列表容器
        const talentList = new Node('TalentList');
        talentList.setParent(talentPanel);
        talentList.setPosition(0, 0, 0);
        
        // 天赋项配置
        const talentConfig = [
            { name: '攻击力提升', desc: '提升所有友方单位10%攻击力', color: new Color(255, 100, 100, 255) },
            { name: '防御力提升', desc: '提升所有友方单位10%防御力', color: new Color(100, 200, 100, 255) },
            { name: '生命值提升', desc: '提升所有友方单位15%生命值', color: new Color(150, 150, 255, 255) },
            { name: '攻击速度提升', desc: '提升所有友方单位15%攻击速度', color: new Color(255, 150, 100, 255) },
            { name: '移动速度提升', desc: '提升所有友方单位20%移动速度', color: new Color(255, 255, 100, 255) }
        ];
        
        // 计算天赋项的最佳位置
        const talentItemHeight = 90; // 适当增大天赋项高度
        const talentItemSpacing = 20; // 添加天赋项之间的间距
        const totalTalentHeight = (talentConfig.length * talentItemHeight) + ((talentConfig.length - 1) * talentItemSpacing);
        // 计算起始Y坐标，确保整个天赋列表在面板内垂直居中
        const startY = totalTalentHeight / 2 - talentItemHeight / 2;
        
        for (let i = 0; i < talentConfig.length; i++) {
            const talent = talentConfig[i];
            const talentItem = new Node(`TalentItem${i}`);
            talentItem.setParent(talentList);
            // 垂直居中排列天赋项，添加间距
            const itemY = startY - i * (talentItemHeight + talentItemSpacing);
            talentItem.setPosition(0, itemY, 0);
            
            // 天赋项背景 - 基于屏幕宽度百分比，实现居中
            const talentItemBg = talentItem.addComponent(Graphics);
            // 使用固定宽度，避免使用未定义的canvasWidth
            const talentItemWidth = 600; // 固定宽度，确保居中显示
            // 使用已经声明的talentItemHeight变量，不再重复声明
            
            talentItemBg.fillColor = new Color(20, 20, 60, 220);
            // 计算居中的矩形位置：x从-talentItemWidth/2开始，到talentItemWidth/2结束
            talentItemBg.roundRect(-talentItemWidth/2, -talentItemHeight/2, talentItemWidth, talentItemHeight, 10);
            talentItemBg.fill();
            talentItemBg.lineWidth = 2;
            talentItemBg.strokeColor = talent.color;
            talentItemBg.roundRect(-talentItemWidth/2, -talentItemHeight/2, talentItemWidth, talentItemHeight, 10);
            talentItemBg.stroke();
            
            // 天赋名称 - 创建独立子节点，确保可见
            const talentNameNode = new Node('TalentName');
            talentNameNode.setParent(talentItem);
            talentNameNode.setPosition(0, 15, 0); // 位置设为(0, 15)，使其在天赋项中靠上一点
            
            const talentNameLabel = talentNameNode.addComponent(Label);
            talentNameLabel.string = talent.name;
            talentNameLabel.fontSize = 30; // 进一步增大字体
            // 使用高对比度颜色，确保文字在深色背景上清晰可见
            talentNameLabel.color = new Color(255, 255, 255, 255); // 白色文字
            talentNameLabel.horizontalAlign = Label.HorizontalAlign.CENTER; // 居中对齐
            talentNameLabel.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 天赋描述 - 创建独立子节点，确保可见
            const talentDescNode = new Node('TalentDesc');
            talentDescNode.setParent(talentItem);
            talentDescNode.setPosition(0, -15, 0); // 位置设为(0, -15)，使其在天赋项中靠下一点
            
            const talentDescLabel = talentDescNode.addComponent(Label);
            talentDescLabel.string = talent.desc;
            talentDescLabel.fontSize = 22; // 进一步增大字体
            // 使用高对比度颜色，确保文字在深色背景上清晰可见
            talentDescLabel.color = new Color(100, 200, 255, 255); // 亮蓝色文字
            talentDescLabel.horizontalAlign = Label.HorizontalAlign.CENTER; // 居中对齐
            talentDescLabel.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 添加UITransform组件，确保点击区域正确
            const talentItemTransform = talentItem.getComponent(UITransform) || talentItem.addComponent(UITransform);
            talentItemTransform.setContentSize(talentItemWidth, talentItemHeight);
            talentItemTransform.setAnchorPoint(0.5, 0.5);
            
            // 添加Button组件，使天赋条目可点击
            const talentItemButton = talentItem.addComponent(Button);
            // 绑定点击事件
            talentItemButton.node.on(Button.EventType.CLICK, () => {
                console.debug(`天赋条目点击: ${talent.name}`);
                // 这里可以添加天赋选择的逻辑
                this.showAnnouncement(`已选择天赋: ${talent.name}`);
            }, this);
        }
        
        // 3. 创建设置面板 - 初始隐藏
        const settingsPanel = new Node('SettingsPanel');
        settingsPanel.setParent(bottomSelectionNode);
        settingsPanel.active = false; // 初始隐藏
        
        // 设置面板尺寸和位置 - 覆盖整个屏幕
        const settingsPanelTransform = settingsPanel.addComponent(UITransform);
        // 使用底部选区容器的尺寸，避免使用未定义的canvasWidth和canvasHeight
        settingsPanelTransform.setContentSize(panelWidth, panelHeight);
        settingsPanelTransform.setAnchorPoint(0.5, 0.5);
        
        // 位置：屏幕中心
        settingsPanel.setPosition(0, 0, 0);
        
        // 设置面板层级，确保在底部选区背景之上，但在底部按钮容器之下
        settingsPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
        
        // 添加半透明背景，确保内容可见且覆盖整个屏幕
        const settingsPanelBackground = settingsPanel.addComponent(Graphics);
        // 使用更不透明的背景色，确保文字可见
        settingsPanelBackground.fillColor = new Color(40, 0, 30, 220);
        // 背景从屏幕顶部到底部完全覆盖
        settingsPanelBackground.rect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);
        settingsPanelBackground.fill();
        
        // 移除边框，避免与底部按钮容器重叠产生横线
        // settingsPanelBackground.lineWidth = 2;
        // settingsPanelBackground.strokeColor = new Color(255, 100, 150, 255);
        // settingsPanelBackground.rect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight);
        // settingsPanelBackground.stroke();
        
        // 设置面板标题
        const settingsLabel = settingsPanel.addComponent(Label);
        settingsLabel.string = '设置面板 - 音效开关';
        settingsLabel.fontSize = 28;
        settingsLabel.color = new Color(255, 100, 150, 255);
        settingsLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        settingsLabel.verticalAlign = Label.VerticalAlign.TOP;
        // 标题位置：顶部居中，距离顶部50像素
        settingsLabel.node.setPosition(0, panelHeight / 2 - 100, 0);
        
        // 设置项容器
        const settingsList = new Node('SettingsList');
        settingsList.setParent(settingsPanel);
        settingsList.setPosition(0, 0, 0);
        
        // 设置项配置
        const settingNames = ['背景音乐', '音效', '语音', '振动'];
        
        // 计算设置项的最佳位置
        const settingItemHeight = 90;
        const totalSettingHeight = settingNames.length * settingItemHeight;
        const settingStartY = totalSettingHeight / 2 - settingItemHeight / 2;
        
        for (let i = 0; i < settingNames.length; i++) {
            const settingItem = new Node(`SettingItem${i}`);
            settingItem.setParent(settingsList);
            // 垂直居中排列设置项
            settingItem.setPosition(0, settingStartY - i * settingItemHeight, 0);
            
            // 设置项背景 - 基于屏幕宽度百分比，实现居中
            const settingItemBg = settingItem.addComponent(Graphics);
            const settingItemWidth = panelWidth * 0.8; // 使用面板宽度的80%，确保居中
            
            settingItemBg.fillColor = new Color(60, 10, 30, 220);
            // 计算居中的矩形位置：x从-settingItemWidth/2开始，到settingItemWidth/2结束
            settingItemBg.roundRect(-settingItemWidth/2, -settingItemHeight/2, settingItemWidth, settingItemHeight, 10);
            settingItemBg.fill();
            settingItemBg.lineWidth = 2;
            settingItemBg.strokeColor = new Color(255, 100, 150, 255);
            settingItemBg.roundRect(-settingItemWidth/2, -settingItemHeight/2, settingItemWidth, settingItemHeight, 10);
            settingItemBg.stroke();
            
            // 设置项名称 - 创建独立子节点，确保可见
            const settingNameNode = new Node('SettingName');
            settingNameNode.setParent(settingItem);
            settingNameNode.setPosition(0, 0, 0);
            
            const settingItemName = settingNameNode.addComponent(Label);
            settingItemName.string = settingNames[i];
            settingItemName.fontSize = 26; // 适当增大字体
            settingItemName.color = new Color(255, 200, 200, 255);
            settingItemName.horizontalAlign = Label.HorizontalAlign.CENTER; // 居中对齐
            settingItemName.verticalAlign = Label.VerticalAlign.CENTER;
            
            // 开关按钮容器 - 居中偏右显示
            const toggleContainer = new Node(`ToggleContainer${i}`);
            toggleContainer.setParent(settingItem);
            // 位置设为(settingItemWidth/4, 0)，使其在设置项中居中偏右
            toggleContainer.setPosition(settingItemWidth/4, 0, 0);
            
            // 开关背景
            const toggleBg = toggleContainer.addComponent(Graphics);
            toggleBg.fillColor = new Color(100, 50, 50, 200);
            toggleBg.roundRect(-35, -20, 70, 40, 20);
            toggleBg.fill();
            
            // 开关旋钮
            const toggleKnob = toggleContainer.addComponent(Graphics);
            toggleKnob.fillColor = new Color(255, 150, 150, 255);
            toggleKnob.circle(-15, 0, 15);
            toggleKnob.fill();
            
            // 设置UITransform，确保点击区域正确
            const toggleTransform = toggleContainer.addComponent(UITransform);
            toggleTransform.setContentSize(70, 40);
            toggleTransform.setAnchorPoint(0.5, 0.5);
            
            // 添加Button组件
            toggleContainer.addComponent(Button);
        }
        
        // 4. 创建底部标签页按钮容器 - 位于画面最底部
        const buttonContainer = new Node('ButtonContainer');
        buttonContainer.setParent(bottomSelectionNode);
        
        // 设置按钮容器尺寸和位置 - 高度为原来的一倍
        const buttonContainerTransform = buttonContainer.addComponent(UITransform);
        buttonContainerTransform.setContentSize(canvasWidth, tabAreaHeight);
        // 设置锚点为底部中心
        buttonContainerTransform.setAnchorPoint(0.5, 0);
        
        // 计算按钮容器位置：
        // 底部选区容器(bottomSelectionNode)的高度为canvasHeight，锚点为(0.5, 0.5)，位于屏幕中心
        // 所以底部选区容器的底部边缘在Y坐标：-canvasHeight/2
        // 按钮容器的锚点为(0.5, 0)，所以它的底部边缘在自身Y坐标0处
        // 因此，按钮容器的Y坐标应该设置为：-canvasHeight/2 + tabAreaHeight/2
        // 这样按钮容器的底部边缘就与底部选区容器的底部边缘对齐了
        const buttonContainerY = -canvasHeight / 2 + tabAreaHeight / 2;
        buttonContainer.setPosition(0, buttonContainerY, 0);
        
        // 确保容器可见
        buttonContainer.active = true;
        
        // 设置按钮容器层级，确保它位于所有面板之上，但在需要时可以被覆盖
        buttonContainer.setSiblingIndex(bottomSelectionNode.children.length - 1);
        
        // 重新确保游戏主体面板位于最高层级，确保开始游戏按钮可点击
        gameMainPanel.setSiblingIndex(bottomSelectionNode.children.length - 1);
        
        // 添加按钮容器背景 - 透明，让面板背景显示出来
        const buttonContainerBackground = buttonContainer.addComponent(Graphics);
        // 使用透明背景，让下方的面板背景显示出来
        buttonContainerBackground.fillColor = new Color(0, 0, 0, 0); // 完全透明
        buttonContainerBackground.rect(-canvasWidth / 2, 0, canvasWidth, tabAreaHeight);
        buttonContainerBackground.fill();
        
        // 移除边框，避免出现不必要的横线
        // 注释掉边框绘制代码
        // buttonContainerBackground.lineWidth = 2;
        // buttonContainerBackground.strokeColor = new Color(100, 150, 255, 255);
        // buttonContainerBackground.rect(-canvasWidth / 2, 0, canvasWidth, tabAreaHeight);
        // buttonContainerBackground.stroke();
        
        // 创建三个标签页按钮
        this.createSelectionButton(buttonContainer, '游戏', -250, bottomSelectionNode, [gameMainPanel, talentPanel, settingsPanel]);
        this.createSelectionButton(buttonContainer, '天赋', 0, bottomSelectionNode, [gameMainPanel, talentPanel, settingsPanel]);
        this.createSelectionButton(buttonContainer, '设置', 250, bottomSelectionNode, [gameMainPanel, talentPanel, settingsPanel]);
        
        // 绑定开始游戏事件
        startButtonComp.node.on(Button.EventType.CLICK, () => {
            console.log('StartGameButton clicked - Event triggered');
            
            // 1. 直接隐藏底部三页签，不依赖GameManager
            console.log('StartGameButton: Hiding BottomSelection directly');
            bottomSelectionNode.active = false;
            console.log('StartGameButton: BottomSelection hidden directly');
            
            // 2. 强制显示水晶节点，不依赖GameManager
            console.log('StartGameButton: Forcing Crystal to show directly');
            const crystal = find('Canvas/Crystal');
            if (crystal) {
                console.log('StartGameButton: Found Crystal at Canvas/Crystal');
                console.log('StartGameButton: Crystal current active state:', crystal.active);
                
                // 确保水晶节点及其所有父节点都处于激活状态
                let current = crystal;
                while (current) {
                    if (!current.active) {
                        console.log('StartGameButton: Activating parent node:', current.name);
                        current.active = true;
                    }
                    current = current.parent;
                }
                
                // 直接设置水晶节点为激活状态
                crystal.active = true;
                console.log('StartGameButton: Crystal shown successfully, new active state:', crystal.active);
            } else {
                console.error('StartGameButton: Crystal not found at Canvas/Crystal!');
            }
            
            // 3. 调用GameManager的startGame方法
            const gameManagerNode = find('GameManager');
            if (gameManagerNode) {
                console.log('StartGameButton: Found GameManager node');
                const gameManager = gameManagerNode.getComponent('GameManager') as any;
                if (gameManager) {
                    console.log('StartGameButton: Found GameManager component');
                    if (gameManager.startGame) {
                        console.log('StartGameButton: Calling gameManager.startGame()');
                        gameManager.startGame();
                    } else {
                        console.error('StartGameButton: gameManager.startGame() method not found');
                    }
                } else {
                    console.error('StartGameButton: GameManager component not found');
                }
            } else {
                console.error('StartGameButton: GameManager node not found');
            }
        }, this);
        
        console.debug('UIManager: BottomSelection created directly with new layout');
    }
    
    /**
     * 创建选区按钮
     */
    createSelectionButton(parent: Node, text: string, xPos: number, bottomSelectionNode: Node, panels: Node[]) {
        // 创建按钮节点
        const buttonNode = new Node(text + 'Button');
        buttonNode.setParent(parent);
        buttonNode.setPosition(xPos, 0, 0);
        
        // 确保按钮可见
        buttonNode.active = true;
        
        // 添加UITransform - 增大按钮尺寸，适应新的三页签区高度
        const uiTransform = buttonNode.addComponent(UITransform);
        uiTransform.setContentSize(200, 80); // 增大按钮尺寸，从150x40变为200x80
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 添加背景 - 透明，让底部选区背景显示出来
        const background = buttonNode.addComponent(Graphics);
        background.fillColor = new Color(0, 0, 0, 150); // 半透明黑色背景，让底部颜色透出来
        background.roundRect(-100, -40, 200, 80, 10); // 圆角矩形
        background.fill();
        
        // 添加边框 - 增强视觉效果
        background.lineWidth = 2;
        background.strokeColor = new Color(100, 150, 255, 255); // 蓝色边框，与天赋面板颜色匹配
        background.roundRect(-100, -40, 200, 80, 10);
        background.stroke();
        
        // 添加Label - 增大字体大小
        const labelNode = new Node('Label');
        labelNode.setParent(buttonNode);
        
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 24; // 增大字体，从20变为24
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加Button组件
        const button = buttonNode.addComponent(Button);
        
        // 绑定点击事件
        button.node.on(Button.EventType.CLICK, () => {
            console.debug(`${text} button clicked, panels: ${panels.length}`);
            
            // 直接获取面板引用，确保正确切换
            const gamePanel = panels[0];
            const talentPanel = panels[1];
            const settingsPanel = panels[2];
            
            console.debug(`UIManager: Panel references - Game: ${gamePanel?.name}, Talent: ${talentPanel?.name}, Settings: ${settingsPanel?.name}`);
            
            // 获取底部选区背景组件，用于更新整个区域的背景颜色
            let bottomSelectionBackground = bottomSelectionNode.getComponent(Graphics);
            if (!bottomSelectionBackground) {
                bottomSelectionBackground = bottomSelectionNode.addComponent(Graphics);
            }
            
            // 获取底部选区容器的尺寸，避免使用未定义的canvasWidth和canvasHeight
            const bottomSelectionTransform = bottomSelectionNode.getComponent(UITransform);
            const width = bottomSelectionTransform ? bottomSelectionTransform.width : 750;
            const height = bottomSelectionTransform ? bottomSelectionTransform.height : 640;
            
            // 根据按钮文本直接切换面板和背景颜色
            if (text === '游戏') {
                if (gamePanel) { 
                    gamePanel.active = true; 
                    // 确保激活的面板位于最前面（在按钮容器之下）
                    gamePanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
                    console.debug('UIManager: Showing Game panel'); 
                }
                if (talentPanel) { talentPanel.active = false; console.debug('UIManager: Hiding Talent panel'); }
                if (settingsPanel) { settingsPanel.active = false; console.debug('UIManager: Hiding Settings panel'); }
                
                // 切换到底部选区默认背景颜色
                bottomSelectionBackground.fillColor = new Color(0, 0, 0, 150); // 半透明黑色背景
                bottomSelectionBackground.rect(-width / 2, -height / 2, width, height);
                bottomSelectionBackground.fill();
            } else if (text === '天赋') {
                if (gamePanel) { gamePanel.active = false; console.debug('UIManager: Hiding Game panel'); }
                if (talentPanel) { 
                    talentPanel.active = true; 
                    // 确保激活的面板位于最前面（在按钮容器之下）
                    talentPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
                    console.debug('UIManager: Showing Talent panel'); 
                    
                    // 获取 TalentSystem 组件（应该在创建 TalentPanel 时已经添加）
                    const talentSystem = talentPanel.getComponent(TalentSystem);
                    if (talentSystem) {
                        // 调用createTalentPanelUI方法确保UI被正确创建
                        console.debug('UIManager: Calling createTalentPanelUI on TalentSystem');
                        talentSystem.createTalentPanelUI();
                    } else {
                        console.error('UIManager: TalentSystem component not found on TalentPanel!');
                    }
                }
                if (settingsPanel) { settingsPanel.active = false; console.debug('UIManager: Hiding Settings panel'); }
                
                // 切换到底部选区天赋面板背景颜色
                bottomSelectionBackground.fillColor = new Color(0, 0, 40, 220); // 天赋面板蓝色背景
                bottomSelectionBackground.rect(-width / 2, -height / 2, width, height);
                bottomSelectionBackground.fill();
            } else if (text === '设置') {
                if (gamePanel) { gamePanel.active = false; console.debug('UIManager: Hiding Game panel'); }
                if (talentPanel) { talentPanel.active = false; console.debug('UIManager: Hiding Talent panel'); }
                if (settingsPanel) { 
                    settingsPanel.active = true; 
                    // 确保激活的面板位于最前面（在按钮容器之下）
                    settingsPanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
                    console.debug('UIManager: Showing Settings panel'); 
                }
                
                // 切换到底部选区设置面板背景颜色
                bottomSelectionBackground.fillColor = new Color(40, 0, 30, 220); // 设置面板红色背景
                bottomSelectionBackground.rect(-width / 2, -height / 2, width, height);
                bottomSelectionBackground.fill();
            }
        }, this);
        
        return buttonNode;
    }
    
    /**
     * 自动创建CountdownPopup
     */
    private autoCreateCountdownPopup() {
        // 如果countdownPopup已经存在，不需要创建
        if (this.countdownPopup) {
            console.debug('UIManager: CountdownPopup already exists');
            return;
        }
        
        console.debug('UIManager: Auto-creating CountdownPopup');
        
        // 获取Canvas或屏幕尺寸
        const canvas = find('Canvas');
        let canvasWidth = 960;
        let canvasHeight = 640;
        
        if (canvas) {
            const canvasTransform = canvas.getComponent(UITransform);
            if (canvasTransform) {
                canvasWidth = canvasTransform.width;
                canvasHeight = canvasTransform.height;
            }
        }
        
        // 创建CountdownPopup节点
        const popupNode = new Node('CountdownPopup');
        popupNode.setParent(this.node);
        
        // 计算右上角位置：与最右保持50像素，与最上保持100像素（往上移100像素）
        const popupSize = 37.5; // 弹窗大小，缩小为原来的二分之一（37.5x37.5）
        const rightMargin = 50;
        const topMargin = 100; // 原来的200像素，往上移100像素
        
        // 计算位置：屏幕原点在中心，所以右上角坐标是 (canvasWidth/2 - margin - popupSize/2, canvasHeight/2 - margin - popupSize/2)
        const posX = (canvasWidth / 2) - rightMargin - (popupSize / 2);
        const posY = (canvasHeight / 2) - topMargin - (popupSize / 2);
        
        popupNode.setPosition(posX, posY, 0); // 右上角位置
        
        // 添加CountdownPopup组件
        this.countdownPopup = popupNode.addComponent(CountdownPopup);
        
        // 手动设置弹窗大小，确保是75x75
        let uiTransform = popupNode.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = popupNode.addComponent(UITransform);
        }
        uiTransform.setContentSize(popupSize, popupSize);
        
        console.debug(`UIManager: CountdownPopup created automatically at position (${posX}, ${posY}) with size ${popupSize}x${popupSize}`);
    }

    createEffects() {
        // 创建红边警告特效节点
        if (!this.warningNode) {
            this.warningNode = new Node('WarningEffect');
            const canvas = find('Canvas');
            if (canvas) {
                this.warningNode.setParent(canvas);
                this.warningNode.setSiblingIndex(0); 

                // 读取画布实际尺寸
                const canvasTransform = canvas.getComponent(UITransform);
                let width = 960;
                let height = 640;
                if (canvasTransform) {
                    width = canvasTransform.width;
                    height = canvasTransform.height;
                }

                const uiTransform = this.warningNode.addComponent(UITransform);
                uiTransform.setContentSize(width, height); // 和画布同大

                const graphics = this.warningNode.addComponent(Graphics);
                graphics.lineWidth = 20;
                graphics.strokeColor = new Color(255, 0, 0, 255); // 不透明红色

                // 在画布四边画一圈矩形边框（紧贴画布边缘）
                graphics.rect(-width / 2, -height / 2, width, height);
                graphics.stroke();

                this.warningNode.addComponent(UIOpacity).opacity = 0;
            }
        }

        // 创建公告提示节点
        if (!this.announcementNode) {
            this.announcementNode = new Node('Announcement');
            const canvas = find('Canvas');
            if (canvas) {
                this.announcementNode.setParent(canvas);
                this.announcementNode.setPosition(0, 100, 0); // 屏幕上方
                
                const label = this.announcementNode.addComponent(Label);
                label.string = "";
                label.fontSize = 40;
                label.color = Color.RED;
                label.isBold = true;
                
                this.announcementNode.active = false;
            }
        }
    }

    /**
     * 显示红边警告特效
     */
    showWarningEffect() {
        if (!this.warningNode) return;
        
        const opacityComp = this.warningNode.getComponent(UIOpacity);
        if (!opacityComp) return;
        
        this.warningNode.active = true;
        opacityComp.opacity = 0;
        
        // 闪烁动画
        tween(opacityComp)
            .to(0.2, { opacity: 150 })
            .to(0.2, { opacity: 0 })
            .to(0.2, { opacity: 150 })
            .to(0.2, { opacity: 0 })
            .to(0.2, { opacity: 150 })
            .to(0.5, { opacity: 0 })
            .call(() => {
                // this.warningNode.active = false; // 保持节点存在，只是不可见
            })
            .start();
            
        // 如果Graphics不支持设置透明度，我们可以用Sprite创建红色图片，这里假设Graphics可以
    }

    /**
     * 显示屏幕中间公告
     * @param message 公告内容
     */
    showAnnouncement(message: string) {
        if (!this.announcementNode) return;
        
        const label = this.announcementNode.getComponent(Label);
        if (label) {
            label.string = message;
        }
        
        this.announcementNode.active = true;
        this.announcementNode.setScale(0, 0, 1);
        const uiOpacity = this.announcementNode.getComponent(UIOpacity) || this.announcementNode.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        
        // 弹跳出现的动画
        tween(this.announcementNode)
            .to(0.5, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .delay(1.5)
            .to(0.3, { scale: new Vec3(0, 0, 1) }) // 或者淡出
            .call(() => {
                this.announcementNode.active = false;
            })
            .start();
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManagerClass);
            if (this.gameManager) {
                console.debug('UIManager: Found GameManager by name');
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找
        const scene = director.getScene();
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.gameManager = findInScene(scene, GameManagerClass);
            if (this.gameManager) {
                console.debug('UIManager: Found GameManager by recursive search');
                return;
            }
        }
        
        console.warn('UIManager: GameManager not found!');
    }

    onBuildButtonClick() {
        console.debug('UIManager: BuildButton clicked!');
        if (this.towerBuilder) {
            const builderScript = this.towerBuilder.getComponent('TowerBuilder') as any;
            if (builderScript) {
                if (builderScript.onBuildButtonClick) {
                    console.debug('UIManager: Calling TowerBuilder.onBuildButtonClick');
                    builderScript.onBuildButtonClick();
                } else {
                    console.error('UIManager: TowerBuilder script has no onBuildButtonClick method!');
                }
            } else {
                console.error('UIManager: TowerBuilder script not found on node!');
            }
        } else {
            console.error('UIManager: TowerBuilder node is null!');
        }
    }

    onRestartButtonClick() {
        console.debug('UIManager: RestartButton clicked!');
        
        // 重新查找GameManager
        this.findGameManager();
        
        if (this.gameManager) {
            console.debug('UIManager: Calling GameManager.restartGame');
            this.gameManager.restartGame();
        } else {
            console.warn('UIManager: GameManager is null! Trying to reload scene directly.');
            // 如果还是找不到，尝试直接重新加载场景
            const scene = director.getScene();
            if (scene && scene.name) {
                console.debug('UIManager: Reloading scene:', scene.name);
                director.loadScene(scene.name);
            } else {
                // 如果场景名称为空，尝试使用默认场景名称
                console.debug('UIManager: Scene name is empty, trying default name "scene"');
                director.loadScene('scene');
            }
        }
    }

    /**
     * 显示倒计时弹窗
     * @param onComplete 倒计时完成回调
     * @param onManualClose 手动关闭回调
     */
    showCountdownPopup(onComplete: () => void, onManualClose: () => void) {
        console.debug('UIManager: Showing countdown popup');
        
        this.onCountdownComplete = onComplete;
        this.onCountdownManualClose = onManualClose;
        
        // 确保CountdownPopup存在
        this.autoCreateCountdownPopup();
        
        if (this.countdownPopup) {
            console.debug('UIManager: CountdownPopup exists, calling show()');
            this.countdownPopup.show(
                this.onCountdownCompleteHandler.bind(this),
                this.onCountdownManualCloseHandler.bind(this)
            );
        } else {
            console.error('UIManager: CountdownPopup is null after auto-creation!');
            // 如果创建失败，直接调用onComplete
            onComplete();
        }
    }

    /**
     * 隐藏倒计时弹窗
     */
    hideCountdownPopup() {
        console.debug('UIManager: Hiding countdown popup');
        
        if (this.countdownPopup) {
            this.countdownPopup.hide();
        }
    }

    /**
     * 倒计时完成回调处理
     */
    private onCountdownCompleteHandler() {
        console.debug('UIManager: Countdown completed');
        
        if (this.onCountdownComplete) {
            this.onCountdownComplete();
        }
        
        this.onCountdownComplete = null;
        this.onCountdownManualClose = null;
    }

    /**
     * 手动关闭倒计时弹窗回调处理
     */
    private onCountdownManualCloseHandler() {
        console.debug('UIManager: Countdown manually closed');
        
        if (this.onCountdownManualClose) {
            this.onCountdownManualClose();
        }
        
        this.onCountdownComplete = null;
        this.onCountdownManualClose = null;
    }
    
    /**
     * 创建确认对话框
     */
    private createConfirmDialog(message: string, onConfirm: () => void, onCancel: () => void) {
        // 如果已存在确认框，先销毁
        if (this.confirmDialogNode && this.confirmDialogNode.isValid) {
            this.confirmDialogNode.destroy();
        }
        
        // 获取Canvas节点
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('UIManager: Canvas not found!');
            return;
        }
        
        // 创建确认框容器
        this.confirmDialogNode = new Node('ConfirmDialog');
        this.confirmDialogNode.setParent(canvas);
        
        // 确保确认框节点处于激活状态
        this.confirmDialogNode.active = true;
        
        // 设置确认框层级为最高
        this.confirmDialogNode.setSiblingIndex(canvas.children.length - 1);
        
        // 添加UITransform
        const uiTransform = this.confirmDialogNode.addComponent(UITransform);
        uiTransform.setContentSize(400, 200);
        uiTransform.setAnchorPoint(0.5, 0.5);
        
        // 居中显示
        this.confirmDialogNode.setPosition(0, 0, 0);
        
        // 添加半透明背景遮罩
        const maskNode = new Node('Mask');
        maskNode.setParent(this.confirmDialogNode);
        maskNode.setPosition(0, 0, -1);
        const maskTransform = maskNode.addComponent(UITransform);
        maskTransform.setContentSize(canvas.getComponent(UITransform)?.width || 960, canvas.getComponent(UITransform)?.height || 640);
        maskTransform.setAnchorPoint(0.5, 0.5);
        const maskGraphics = maskNode.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 150);
        maskGraphics.rect(-maskTransform.width/2, -maskTransform.height/2, maskTransform.width, maskTransform.height);
        maskGraphics.fill();
        
        // 添加确认框背景
        const background = this.confirmDialogNode.addComponent(Graphics);
        background.fillColor = new Color(40, 40, 60, 255);
        background.roundRect(-200, -100, 400, 200, 10);
        background.fill();
        background.lineWidth = 2;
        background.strokeColor = new Color(100, 150, 255, 255);
        background.roundRect(-200, -100, 400, 200, 10);
        background.stroke();
        
        // 添加标题
        const titleNode = new Node('Title');
        titleNode.setParent(this.confirmDialogNode);
        titleNode.setPosition(0, 50, 0);
        titleNode.active = true;
        
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '确认退出游戏';
        titleLabel.fontSize = 24;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加消息文本
        const messageNode = new Node('Message');
        messageNode.setParent(this.confirmDialogNode);
        messageNode.setPosition(0, 0, 0);
        messageNode.active = true;
        
        const messageLabel = messageNode.addComponent(Label);
        messageLabel.string = message;
        messageLabel.fontSize = 18;
        messageLabel.color = new Color(200, 200, 200, 255);
        messageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        messageLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 创建按钮容器
        const buttonContainer = new Node('ButtonContainer');
        buttonContainer.setParent(this.confirmDialogNode);
        buttonContainer.setPosition(0, -50, 0);
        buttonContainer.active = true;
        
        // 创建确认按钮
        const confirmButton = new Node('ConfirmButton');
        confirmButton.setParent(buttonContainer);
        confirmButton.setPosition(-80, 0, 0);
        confirmButton.active = true;
        
        // 添加Button组件
        const confirmButtonComp = confirmButton.addComponent(Button);
        
        // 添加UITransform
        const confirmButtonTransform = confirmButton.addComponent(UITransform);
        confirmButtonTransform.setContentSize(120, 50);
        confirmButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 按钮背景
        const confirmBg = confirmButton.addComponent(Graphics);
        confirmBg.fillColor = new Color(60, 150, 60, 255);
        confirmBg.roundRect(-60, -25, 120, 50, 8);
        confirmBg.fill();
        confirmBg.lineWidth = 2;
        confirmBg.strokeColor = new Color(100, 200, 100, 255);
        confirmBg.roundRect(-60, -25, 120, 50, 8);
        confirmBg.stroke();
        
        // 创建单独的文本节点作为按钮的子节点
        const confirmTextNode = new Node('ConfirmButtonText');
        confirmTextNode.setParent(confirmButton);
        confirmTextNode.active = true;
        
        // 居中显示在按钮上
        confirmTextNode.setPosition(0, 0, 1);
        
        // 添加Label组件
        const confirmButtonLabel = confirmTextNode.addComponent(Label);
        confirmButtonLabel.string = '确认';
        confirmButtonLabel.fontSize = 20;
        confirmButtonLabel.color = new Color(255, 255, 255, 255);
        confirmButtonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        confirmButtonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 设置Label的尺寸
        const confirmLabelTransform = confirmTextNode.addComponent(UITransform);
        confirmLabelTransform.setContentSize(120, 50);
        confirmLabelTransform.setAnchorPoint(0.5, 0.5);
        
        confirmButtonComp.node.on(Button.EventType.CLICK, () => {
            console.debug('UIManager: Confirm button clicked');
            onConfirm();
            // 销毁确认框
            if (this.confirmDialogNode && this.confirmDialogNode.isValid) {
                this.confirmDialogNode.destroy();
                this.confirmDialogNode = null;
            }
        }, this);
        
        // 创建取消按钮
        const cancelButton = new Node('CancelButton');
        cancelButton.setParent(buttonContainer);
        cancelButton.setPosition(80, 0, 0);
        cancelButton.active = true;
        
        // 添加Button组件
        const cancelButtonComp = cancelButton.addComponent(Button);
        
        // 添加UITransform
        const cancelButtonTransform = cancelButton.addComponent(UITransform);
        cancelButtonTransform.setContentSize(120, 50);
        cancelButtonTransform.setAnchorPoint(0.5, 0.5);
        
        // 按钮背景
        const cancelBg = cancelButton.addComponent(Graphics);
        cancelBg.fillColor = new Color(150, 60, 60, 255);
        cancelBg.roundRect(-60, -25, 120, 50, 8);
        cancelBg.fill();
        cancelBg.lineWidth = 2;
        cancelBg.strokeColor = new Color(200, 100, 100, 255);
        cancelBg.roundRect(-60, -25, 120, 50, 8);
        cancelBg.stroke();
        
        // 创建单独的文本节点作为按钮的子节点
        const cancelTextNode = new Node('CancelButtonText');
        cancelTextNode.setParent(cancelButton);
        cancelTextNode.active = true;
        
        // 居中显示在按钮上
        cancelTextNode.setPosition(0, 0, 1);
        
        // 添加Label组件
        const cancelButtonLabel = cancelTextNode.addComponent(Label);
        cancelButtonLabel.string = '取消';
        cancelButtonLabel.fontSize = 20;
        cancelButtonLabel.color = new Color(255, 255, 255, 255);
        cancelButtonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        cancelButtonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 设置Label的尺寸
        const cancelLabelTransform = cancelTextNode.addComponent(UITransform);
        cancelLabelTransform.setContentSize(120, 50);
        cancelLabelTransform.setAnchorPoint(0.5, 0.5);
        
        cancelButtonComp.node.on(Button.EventType.CLICK, () => {
            console.debug('UIManager: Cancel button clicked');
            onCancel();
            // 销毁确认框
            if (this.confirmDialogNode && this.confirmDialogNode.isValid) {
                this.confirmDialogNode.destroy();
                this.confirmDialogNode = null;
            }
        }, this);
        
        console.debug('UIManager: Confirm dialog created');
    }
    
    /**
     * 返回按钮事件方法，从游戏主体页面返回到三页签首页
     */
    onBackToHome() {
        console.debug('UIManager: onBackToHome called');
        
        // 显示确认框
        this.createConfirmDialog(
            '确定要退出游戏并返回首页吗？',
            () => {
                // 确认退出
                console.debug('UIManager: User confirmed exit to home');
                
                // 1. 使用已有的gameManager属性，如果不存在则查找
                if (!this.gameManager) {
                    console.debug('UIManager: GameManager not found, trying to find it');
                    this.findGameManager();
                }
                
                if (this.gameManager) {
                    console.debug('UIManager: Using existing GameManager, restarting game');
                    this.gameManager.restartGame();
                } else {
                    console.warn('UIManager: GameManager not found, cannot restart game');
                }
                
                // 2. 立即手动重置UI状态，确保游戏立即退出到首页
                // 查找或创建底部三页签UI
                let bottomSelectionNode = find('Canvas/BottomSelection');
                if (!bottomSelectionNode) {
                    console.debug('UIManager: BottomSelection not found, creating it');
                    this.createBottomSelectionUI();
                    bottomSelectionNode = find('Canvas/BottomSelection');
                }
                
                // 确保底部三页签显示
                if (bottomSelectionNode) {
                    console.debug('UIManager: Showing BottomSelection');
                    bottomSelectionNode.active = true;
                    
                    // 确保切换到游戏主体面板
                    const gamePanel = bottomSelectionNode.getChildByName('GameMainPanel');
                    const talentPanel = bottomSelectionNode.getChildByName('TalentPanel');
                    const settingsPanel = bottomSelectionNode.getChildByName('SettingsPanel');
                    
                    if (gamePanel) {
                        gamePanel.active = true;
                        gamePanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
                        console.debug('UIManager: GameMainPanel shown');
                    }
                    if (talentPanel) {
                        talentPanel.active = false;
                        console.debug('UIManager: TalentPanel hidden');
                    }
                    if (settingsPanel) {
                        settingsPanel.active = false;
                        console.debug('UIManager: SettingsPanel hidden');
                    }
                }
                
                // 3. 隐藏所有游戏元素
                const gameNodes = [
                    'Canvas/Crystal',
                    'Enemies',
                    'Towers',
                    'WarAncientTrees'
                ];
                
                for (const nodePath of gameNodes) {
                    const node = find(nodePath);
                    if (node) {
                        node.active = false;
                        console.debug(`UIManager: ${nodePath} hidden`);
                    }
                }
            },
            () => {
                // 取消退出
                console.debug('UIManager: User canceled exit to home');
            }
        );
    }
    
    /**
     * 手动重置UI状态
     */
    manualResetUI() {
        console.debug('UIManager: manualResetUI called');
        
        // 查找或创建底部三页签UI
        let bottomSelectionNode = find('Canvas/BottomSelection');
        if (!bottomSelectionNode) {
            console.debug('UIManager: BottomSelection not found, creating it');
            this.createBottomSelectionUI();
            bottomSelectionNode = find('Canvas/BottomSelection');
        }
        
        // 确保底部三页签显示
        if (bottomSelectionNode) {
            console.debug('UIManager: Showing BottomSelection');
            bottomSelectionNode.active = true;
            
            // 确保切换到游戏主体面板
            const gamePanel = bottomSelectionNode.getChildByName('GameMainPanel');
            const talentPanel = bottomSelectionNode.getChildByName('TalentPanel');
            const settingsPanel = bottomSelectionNode.getChildByName('SettingsPanel');
            
            if (gamePanel) {
                gamePanel.active = true;
                gamePanel.setSiblingIndex(bottomSelectionNode.children.length - 2);
                console.debug('UIManager: GameMainPanel shown');
            }
            if (talentPanel) {
                talentPanel.active = false;
                console.debug('UIManager: TalentPanel hidden');
            }
            if (settingsPanel) {
                settingsPanel.active = false;
                console.debug('UIManager: SettingsPanel hidden');
            }
        }
        
        // 隐藏所有游戏元素
        const gameNodes = [
            'Canvas/Crystal',
            'Enemies',
            'Towers',
            'WarAncientTrees'
        ];
        
        for (const nodePath of gameNodes) {
            const node = find(nodePath);
            if (node) {
                node.active = false;
                console.debug(`UIManager: ${nodePath} hidden`);
            }
        }
        
        console.debug('UIManager: UI reset completed');
    }
}