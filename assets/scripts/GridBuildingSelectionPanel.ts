import { _decorator, Component, Node, Vec3, UITransform, Graphics, Color, Label, Sprite, SpriteFrame, EventTouch, find, Button, Camera } from 'cc';
import { TowerBuilder } from './TowerBuilder';
import { GamePopup } from './GamePopup';
import { GameManager } from './GameManager';
import { StoneWallGridPanel } from './StoneWallGridPanel';
const { ccclass, property } = _decorator;

/**
 * 网格建筑选择面板
 * 用于在石墙网格中点击后弹出选择框，选择建造石墙或哨塔
 */
@ccclass('GridBuildingSelectionPanel')
export class GridBuildingSelectionPanel extends Component {
    // 图标将从TowerBuilder获取，不需要在这里定义
    
    private panelNode: Node = null!; // 面板节点
    private stoneWallOption: Node = null!; // 石墙选项节点
    private watchTowerOption: Node = null!; // 哨塔选项节点
    private iceTowerOption: Node = null!; // 冰元素塔选项节点
    private thunderTowerOption: Node = null!; // 雷元素塔选项节点
    private towerBuilder: TowerBuilder = null!; // TowerBuilder引用
    private currentGridPos: { x: number; y: number; worldPos: Vec3 } | null = null; // 当前选择的网格位置
    private onCloseCallback: (() => void) | null = null; // 关闭回调

    onLoad() {
        this.createPanel();
    }

    start() {
        // 查找TowerBuilder
        this.findTowerBuilder();
    }

    /**
     * 查找TowerBuilder
     */
    private findTowerBuilder() {
        const towerBuilderNode = find('Canvas/TowerBuilder');
        if (towerBuilderNode) {
            this.towerBuilder = towerBuilderNode.getComponent(TowerBuilder);
        }
    }

    /**
     * 创建面板
     */
    private createPanel() {
        // 创建面板节点
        this.panelNode = new Node('GridBuildingSelectionPanel');
        this.panelNode.setParent(this.node);
        this.panelNode.setPosition(0, 0, 0);
        
        const panelTransform = this.panelNode.addComponent(UITransform);
        panelTransform.setContentSize(200, 200); // 增大面板以容纳2x2布局
        
        // 创建背景
        const bgGraphics = this.panelNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(50, 50, 50, 240);
        bgGraphics.roundRect(-100, -100, 200, 200, 10);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(255, 255, 255, 255);
        bgGraphics.lineWidth = 2;
        bgGraphics.roundRect(-100, -100, 200, 200, 10);
        bgGraphics.stroke();
        
        // 创建选项（2x2布局）
        // 第一行：石墙（左上）、哨塔（右上）
        this.stoneWallOption = this.createOption('StoneWall', -50, 50);
        this.watchTowerOption = this.createOption('WatchTower', 50, 50);
        
        // 第二行：冰塔（左下）、雷塔（右下）
        this.iceTowerOption = this.createOption('IceTower', -50, -50);
        this.thunderTowerOption = this.createOption('ThunderTower', 50, -50);
        
        // 初始隐藏
        this.hide();
    }

    /**
     * 创建选项
     */
    private createOption(buildingType: string, x: number, y: number, icon: SpriteFrame | null = null): Node {
        const optionNode = new Node(buildingType + 'Option');
        optionNode.setParent(this.panelNode);
        optionNode.setPosition(x, y, 0);
        
        const optionTransform = optionNode.addComponent(UITransform);
        optionTransform.setContentSize(80, 100);
        
        // 创建背景
        const bgGraphics = optionNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(80, 80, 80, 255);
        bgGraphics.roundRect(-40, -50, 80, 100, 5);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(200, 200, 200, 255);
        bgGraphics.lineWidth = 2;
        bgGraphics.roundRect(-40, -50, 80, 100, 5);
        bgGraphics.stroke();
        
        // 创建图标（始终创建，稍后更新）
        const iconNode = new Node('Icon');
        iconNode.setParent(optionNode);
        iconNode.setPosition(0, 20, 0);
        iconNode.active = true; // 确保图标节点可见
        
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(30, 30); // 缩小图标大小以适配选择框
        
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.enabled = true; // 确保Sprite组件启用
        iconSprite.type = Sprite.Type.SIMPLE; // 设置为简单模式
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM; // 使用自定义大小
        if (icon) {
            iconSprite.spriteFrame = icon;
        }
        
        // 创建名称标签
        const nameLabelNode = new Node('NameLabel');
        nameLabelNode.setParent(optionNode);
        nameLabelNode.setPosition(0, -10, 0);
        
        const nameLabelTransform = nameLabelNode.addComponent(UITransform);
        nameLabelTransform.setContentSize(80, 20);
        
        const nameLabel = nameLabelNode.addComponent(Label);
        nameLabel.string = buildingType === 'StoneWall' ? '石墙' : '哨塔';
        nameLabel.fontSize = 16;
        nameLabel.color = Color.WHITE;
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        nameLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 创建金币标签
        const costLabelNode = new Node('CostLabel');
        costLabelNode.setParent(optionNode);
        costLabelNode.setPosition(0, -35, 0);
        
        const costLabelTransform = costLabelNode.addComponent(UITransform);
        costLabelTransform.setContentSize(80, 20);
        
        const costLabel = costLabelNode.addComponent(Label);
        costLabel.string = '0'; // 稍后更新
        costLabel.fontSize = 14;
        costLabel.color = Color.YELLOW;
        costLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        costLabel.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 添加按钮组件
        const button = optionNode.addComponent(Button);
        button.transition = Button.Transition.NONE;
        
        // 添加点击事件
        optionNode.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            this.onOptionClick(buildingType);
        }, this);
        
        return optionNode;
    }

    /**
     * 更新选项的金币显示和图标
     */
    private updateCostLabels() {
        if (!this.towerBuilder) {
            console.warn('[GridBuildingSelectionPanel] TowerBuilder not found, cannot update cost labels');
            return;
        }
        
        // 更新石墙金币和图标
        const stoneWallCost = this.towerBuilder.getActualBuildCost('StoneWall');
        const stoneWallCostLabel = this.stoneWallOption?.getChildByName('CostLabel')?.getComponent(Label);
        if (stoneWallCostLabel) {
            stoneWallCostLabel.string = stoneWallCost.toString();
            console.info('[GridBuildingSelectionPanel] 石墙金币:', stoneWallCost);
        } else {
            console.warn('[GridBuildingSelectionPanel] 石墙金币标签未找到');
        }
        
        // 更新石墙图标
        const stoneWallIconNode = this.stoneWallOption?.getChildByName('Icon');
        if (stoneWallIconNode) {
            const iconSprite = stoneWallIconNode.getComponent(Sprite);
            const iconTransform = stoneWallIconNode.getComponent(UITransform);
            if (iconSprite && iconTransform) {
                if (this.towerBuilder.stoneWallIcon) {
                    iconSprite.spriteFrame = this.towerBuilder.stoneWallIcon;
                    iconSprite.enabled = true;
                    iconSprite.type = Sprite.Type.SIMPLE;
                    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    // 确保图标大小适配
                    iconTransform.setContentSize(30, 30);
                    console.info('[GridBuildingSelectionPanel] 石墙图标已设置');
                } else {
                    console.warn('[GridBuildingSelectionPanel] 石墙图标未找到');
                }
            }
        } else {
            console.warn('[GridBuildingSelectionPanel] 石墙图标节点未找到');
        }
        
        // 更新哨塔金币和图标
        const watchTowerCost = this.towerBuilder.getActualBuildCost('WatchTower');
        const watchTowerCostLabel = this.watchTowerOption?.getChildByName('CostLabel')?.getComponent(Label);
        if (watchTowerCostLabel) {
            watchTowerCostLabel.string = watchTowerCost.toString();
            console.info('[GridBuildingSelectionPanel] 哨塔金币:', watchTowerCost);
        } else {
            console.warn('[GridBuildingSelectionPanel] 哨塔金币标签未找到');
        }
        
        // 更新哨塔图标
        const watchTowerIconNode = this.watchTowerOption?.getChildByName('Icon');
        if (watchTowerIconNode) {
            const iconSprite = watchTowerIconNode.getComponent(Sprite);
            const iconTransform = watchTowerIconNode.getComponent(UITransform);
            if (iconSprite && iconTransform) {
                if (this.towerBuilder.watchTowerIcon) {
                    iconSprite.spriteFrame = this.towerBuilder.watchTowerIcon;
                    iconSprite.enabled = true;
                    iconSprite.type = Sprite.Type.SIMPLE;
                    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    iconTransform.setContentSize(30, 30);
                    console.info('[GridBuildingSelectionPanel] 哨塔图标已设置');
                } else {
                    console.warn('[GridBuildingSelectionPanel] 哨塔图标未找到');
                }
            }
        } else {
            console.warn('[GridBuildingSelectionPanel] 哨塔图标节点未找到');
        }
        
        // 更新冰塔金币和图标
        const iceTowerCost = this.towerBuilder.getActualBuildCost('IceTower', 20);
        const iceTowerCostLabel = this.iceTowerOption?.getChildByName('CostLabel')?.getComponent(Label);
        if (iceTowerCostLabel) {
            iceTowerCostLabel.string = iceTowerCost.toString();
            console.info('[GridBuildingSelectionPanel] 冰塔金币:', iceTowerCost);
        } else {
            console.warn('[GridBuildingSelectionPanel] 冰塔金币标签未找到');
        }
        
        const iceTowerIconNode = this.iceTowerOption?.getChildByName('Icon');
        if (iceTowerIconNode) {
            const iconSprite = iceTowerIconNode.getComponent(Sprite);
            const iconTransform = iceTowerIconNode.getComponent(UITransform);
            if (iconSprite && iconTransform) {
                if (this.towerBuilder.iceTowerIcon) {
                    iconSprite.spriteFrame = this.towerBuilder.iceTowerIcon;
                    iconSprite.enabled = true;
                    iconSprite.type = Sprite.Type.SIMPLE;
                    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    iconTransform.setContentSize(30, 30);
                    console.info('[GridBuildingSelectionPanel] 冰塔图标已设置');
                } else {
                    console.warn('[GridBuildingSelectionPanel] 冰塔图标未找到');
                }
            }
        } else {
            console.warn('[GridBuildingSelectionPanel] 冰塔图标节点未找到');
        }
        
        // 更新雷塔金币和图标
        const thunderTowerCost = this.towerBuilder.getActualBuildCost('ThunderTower', 30);
        const thunderTowerCostLabel = this.thunderTowerOption?.getChildByName('CostLabel')?.getComponent(Label);
        if (thunderTowerCostLabel) {
            thunderTowerCostLabel.string = thunderTowerCost.toString();
            console.info('[GridBuildingSelectionPanel] 雷塔金币:', thunderTowerCost);
        } else {
            console.warn('[GridBuildingSelectionPanel] 雷塔金币标签未找到');
        }
        
        const thunderTowerIconNode = this.thunderTowerOption?.getChildByName('Icon');
        if (thunderTowerIconNode) {
            const iconSprite = thunderTowerIconNode.getComponent(Sprite);
            const iconTransform = thunderTowerIconNode.getComponent(UITransform);
            if (iconSprite && iconTransform) {
                if (this.towerBuilder.thunderTowerIcon) {
                    iconSprite.spriteFrame = this.towerBuilder.thunderTowerIcon;
                    iconSprite.enabled = true;
                    iconSprite.type = Sprite.Type.SIMPLE;
                    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    iconTransform.setContentSize(30, 30);
                    console.info('[GridBuildingSelectionPanel] 雷塔图标已设置');
                } else {
                    console.warn('[GridBuildingSelectionPanel] 雷塔图标未找到');
                }
            }
        } else {
            console.warn('[GridBuildingSelectionPanel] 雷塔图标节点未找到');
        }
    }

    /**
     * 选项点击事件
     */
    private onOptionClick(buildingType: string) {
        console.info('[GridBuildingSelectionPanel] 选项点击:', buildingType);
        
        if (!this.currentGridPos) {
            console.warn('[GridBuildingSelectionPanel] 当前网格位置为空');
            return;
        }
        
        // 确保TowerBuilder已找到
        if (!this.towerBuilder) {
            this.findTowerBuilder();
            if (!this.towerBuilder) {
                console.error('[GridBuildingSelectionPanel] TowerBuilder未找到');
                GamePopup.showMessage('建造系统未初始化');
                return;
            }
        }
        
        // 检查金币是否足够
        let cost = 0;
        if (buildingType === 'StoneWall') {
            cost = this.towerBuilder.getActualBuildCost('StoneWall');
        } else if (buildingType === 'WatchTower') {
            cost = this.towerBuilder.getActualBuildCost('WatchTower');
        } else if (buildingType === 'IceTower') {
            cost = this.towerBuilder.getActualBuildCost('IceTower', 20);
        } else if (buildingType === 'ThunderTower') {
            cost = this.towerBuilder.getActualBuildCost('ThunderTower', 30);
        }
        
        console.info('[GridBuildingSelectionPanel] 建造成本:', cost, '建筑类型:', buildingType);
        
        // 查找GameManager检查金币
        const gameManagerNode = find('Canvas/GameManager');
        if (gameManagerNode) {
            const gameManager = gameManagerNode.getComponent(GameManager);
            if (gameManager) {
                if (!gameManager.canAfford(cost)) {
                    // 金币不足，显示提示
                    console.warn('[GridBuildingSelectionPanel] 金币不足，需要:', cost);
                    GamePopup.showMessage('金币不足');
                    return;
                }
            } else {
                console.error('[GridBuildingSelectionPanel] GameManager组件未找到');
                GamePopup.showMessage('游戏管理器未初始化');
                return;
            }
        } else {
            // 如果找不到GameManager，也显示提示
            console.error('[GridBuildingSelectionPanel] GameManager节点未找到');
            GamePopup.showMessage('游戏管理器未初始化');
            return;
        }
        
        // 对于哨塔，需要检查两个网格是否都被占用
        if (buildingType === 'WatchTower') {
            // 查找StoneWallGridPanel检查网格占用
            const gridPanelNode = find('Canvas/StoneWallGridPanel');
            if (gridPanelNode) {
                const gridPanel = gridPanelNode.getComponent(StoneWallGridPanel);
                if (gridPanel) {
                    // 检查第二个网格是否存在且未被占用
                    if (this.currentGridPos.y + 1 >= gridPanel.gridHeight) {
                        // 第二个网格超出范围，无法放置哨塔
                        console.warn('[GridBuildingSelectionPanel] 第二个网格超出范围');
                        GamePopup.showMessage('无法在此位置建造哨塔');
                        return;
                    }
                    if (gridPanel.isGridOccupied(this.currentGridPos.x, this.currentGridPos.y + 1)) {
                        // 第二个网格被占用，无法放置哨塔
                        console.warn('[GridBuildingSelectionPanel] 第二个网格被占用');
                        GamePopup.showMessage('无法在此位置建造哨塔');
                        return;
                    }
                }
            }
        }
        
        // 建造建筑
        console.info('[GridBuildingSelectionPanel] 开始建造，位置:', this.currentGridPos.worldPos);
        if (buildingType === 'StoneWall') {
            this.towerBuilder.buildStoneWall(this.currentGridPos.worldPos);
            console.info('[GridBuildingSelectionPanel] 石墙建造调用完成');
        } else if (buildingType === 'WatchTower') {
            this.towerBuilder.buildWatchTower(this.currentGridPos.worldPos);
            console.info('[GridBuildingSelectionPanel] 哨塔建造调用完成');
        } else if (buildingType === 'IceTower') {
            this.towerBuilder.buildIceTower(this.currentGridPos.worldPos);
            console.info('[GridBuildingSelectionPanel] 冰塔建造调用完成');
        } else if (buildingType === 'ThunderTower') {
            this.towerBuilder.buildThunderTower(this.currentGridPos.worldPos);
            console.info('[GridBuildingSelectionPanel] 雷塔建造调用完成');
        }
        
        // 关闭面板
        this.hide();
    }

    /**
     * 显示面板
     * @param gridX 网格X坐标
     * @param gridY 网格Y坐标
     * @param worldPos 世界坐标
     * @param onClose 关闭回调
     */
    show(gridX: number, gridY: number, worldPos: Vec3, onClose?: () => void) {
        this.currentGridPos = { x: gridX, y: gridY, worldPos };
        this.onCloseCallback = onClose || null;
        
        // 确保TowerBuilder已找到
        if (!this.towerBuilder) {
            this.findTowerBuilder();
        }
        
        // 更新金币显示和图标
        this.updateCostLabels();
        
        // 设置面板位置（在网格位置上方）
        this.panelNode.setWorldPosition(worldPos.x, worldPos.y + 60, 0);
        
        // 确保选择框显示在最上层（设置较高的z-index）
        // 通过设置siblingIndex来确保选择框在Canvas的所有子节点中排在最前面
        const canvas = find('Canvas');
        if (canvas && this.node.parent === canvas) {
            // 将选择框节点移到Canvas的最后（最后添加的节点会显示在最上层）
            this.node.setSiblingIndex(canvas.children.length - 1);
        }
        
        // 显示面板
        this.panelNode.active = true;
        this.node.active = true; // 确保父节点也激活
        
        // 添加点击外部关闭的监听
        this.scheduleOnce(() => {
            if (canvas) {
                canvas.once(Node.EventType.TOUCH_END, this.onCanvasClick, this);
            }
        }, 0.1);
    }

    /**
     * Canvas点击事件（点击外部关闭）
     */
    private onCanvasClick(event: EventTouch) {
        // 检查点击是否在面板内
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (cameraNode) {
            const camera = cameraNode.getComponent(Camera);
            if (camera) {
                const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
                const worldPos = new Vec3();
                camera.screenToWorld(screenPos, worldPos);
                
                const panelWorldPos = this.panelNode.worldPosition;
                const panelTransform = this.panelNode.getComponent(UITransform);
                if (panelTransform) {
                    const panelWidth = panelTransform.width;
                    const panelHeight = panelTransform.height;
                    const panelLeft = panelWorldPos.x - panelWidth / 2;
                    const panelRight = panelWorldPos.x + panelWidth / 2;
                    const panelTop = panelWorldPos.y + panelHeight / 2;
                    const panelBottom = panelWorldPos.y - panelHeight / 2;
                    
                    // 如果点击在面板外，关闭面板
                    if (worldPos.x < panelLeft || worldPos.x > panelRight || 
                        worldPos.y < panelBottom || worldPos.y > panelTop) {
                        this.hide();
                    }
                }
            }
        }
    }

    /**
     * 隐藏面板
     */
    hide() {
        this.panelNode.active = false;
        this.currentGridPos = null;
        
        // 移除Canvas点击监听
        const canvas = find('Canvas');
        if (canvas) {
            canvas.off(Node.EventType.TOUCH_END, this.onCanvasClick, this);
        }
        
        // 调用关闭回调
        if (this.onCloseCallback) {
            this.onCloseCallback();
            this.onCloseCallback = null;
        }
    }
}
