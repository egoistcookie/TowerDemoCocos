import { _decorator, Component, Node, find, Graphics, UITransform, Color, EventTouch, Camera, Vec3, Sprite, SpriteFrame, resources } from 'cc';
import { UnitInfoPanel, UnitInfo } from './UnitInfoPanel';
const { ccclass, property } = _decorator;

/**
 * 单位选择管理器
 * 统一管理单位选择和信息面板显示
 */
@ccclass('UnitSelectionManager')
export class UnitSelectionManager extends Component {
    @property(Node)
    unitInfoPanelNode: Node = null!; // 单位信息面板节点

    private unitInfoPanel: UnitInfoPanel = null!; // 单位信息面板组件
    private currentSelectedUnit: Node = null!; // 当前选中的单位节点（单选）
    private currentSelectedUnits: Node[] = []; // 当前选中的单位节点数组（多选）
    private currentRangeDisplayNode: Node = null!; // 当前范围显示节点

    start() {
        this.initUnitInfoPanel();
        this.setupGlobalClickHandler();
    }
    
    /**
     * 设置全局点击处理器，用于取消选择
     */
    setupGlobalClickHandler() {
        const canvas = find('Canvas');
        if (canvas) {
            // 监听Canvas的触摸结束事件，用于取消选择
            canvas.on(Node.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        }
    }
    
    /**
     * 全局触摸结束事件处理
     */
    onGlobalTouchEnd(event: EventTouch) {
        // 如果没有选中任何单位（单选或多选），直接返回
        if (!this.currentSelectedUnit && this.currentSelectedUnits.length === 0) {
           //console.info('[UnitSelectionManager.onGlobalTouchEnd] 没有选中任何单位，直接返回');
            return;
        }
        
        // 检查点击位置是否在当前选中的单位上
        const touchLocation = event.getLocation();
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }
        
        // 检查点击位置是否在信息面板上
        const unitInfoPanel = this.unitInfoPanel;
        if (unitInfoPanel) {
            const panelNode = unitInfoPanel.panelNode;
            if (panelNode && panelNode.active) {
                const panelTransform = panelNode.getComponent(UITransform);
                if (panelTransform) {
                    const panelWorldPos = panelNode.worldPosition;
                    const panelScreenPos = new Vec3();
                    camera.worldToScreen(panelWorldPos, panelScreenPos);
                    
                    // 计算面板在屏幕上的边界
                    const panelWidth = panelTransform.width;
                    const panelHeight = panelTransform.height;
                    const panelLeft = panelScreenPos.x - panelWidth / 2;
                    const panelRight = panelScreenPos.x + panelWidth / 2;
                    const panelBottom = panelScreenPos.y - panelHeight / 2;
                    const panelTop = panelScreenPos.y + panelHeight / 2;
                    
                    // 检查点击位置是否在面板内
                    if (touchLocation.x >= panelLeft && 
                        touchLocation.x <= panelRight && 
                        touchLocation.y >= panelBottom && 
                        touchLocation.y <= panelTop) {
                        // 点击在信息面板上，不取消选择
                       //console.info('[UnitSelectionManager.onGlobalTouchEnd] 点击在信息面板上，不取消选择');
                        return;
                    }
                }
            }
        }
        
        // 检查点击位置是否在选中的单位上（单选或多选）
        if (this.currentSelectedUnit) {
            const unitWorldPos = this.currentSelectedUnit.worldPosition;
            const unitScreenPos = new Vec3();
            camera.worldToScreen(unitWorldPos, unitScreenPos);
            
            const distanceToUnit = Math.sqrt(
                Math.pow(touchLocation.x - unitScreenPos.x, 2) +
                Math.pow(touchLocation.y - unitScreenPos.y, 2)
            );
            
            const collisionRadius = 50;
            if (distanceToUnit <= collisionRadius) {
                // 点击在单位上，不取消选择
               //console.info('[UnitSelectionManager.onGlobalTouchEnd] 点击在单选单位上，不取消选择，单位名称:', this.currentSelectedUnit?.name);
                return;
            }
        } else if (this.currentSelectedUnits.length > 0) {
            // 多选模式：检查是否点击在任何一个选中的单位上
            for (const unitNode of this.currentSelectedUnits) {
                if (!unitNode || !unitNode.isValid) continue;
                
                const unitWorldPos = unitNode.worldPosition;
                const unitScreenPos = new Vec3();
                camera.worldToScreen(unitWorldPos, unitScreenPos);
                
                const distanceToUnit = Math.sqrt(
                    Math.pow(touchLocation.x - unitScreenPos.x, 2) +
                    Math.pow(touchLocation.y - unitScreenPos.y, 2)
                );
                
                const collisionRadius = 50;
                if (distanceToUnit <= collisionRadius) {
                    // 点击在单位上，不取消选择
                   //console.info('[UnitSelectionManager.onGlobalTouchEnd] 点击在多选单位上，不取消选择，单位名称:', unitNode?.name);
                    return;
                }
            }
        }
        
        // 点击不在单位和信息面板上，取消选择
        // 注意：延迟清除选择，让单位的globalTouchHandler先处理移动操作
        // 这样单位可以在清除选择前响应移动命令
        // 延迟一帧清除选择，确保单位的globalTouchHandler先执行
        // 使用scheduleOnce延迟到下一帧，让Role.globalTouchHandler先处理移动
        this.scheduleOnce(() => {
            // 延迟清除选择，确保单位的globalTouchHandler先执行
            // 此时如果单位已经处理了移动，globalTouchHandler会被清除，不会重复处理
            this.clearSelection();
        }, 0.01);
    }

    /**
     * 初始化单位信息面板
     */
    initUnitInfoPanel() {
        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }

        // 创建或获取单位信息面板节点
        if (!this.unitInfoPanelNode) {
            this.unitInfoPanelNode = new Node('UnitInfoPanel');
            this.unitInfoPanelNode.setParent(canvas);
        }

        // 获取或添加UnitInfoPanel组件
        this.unitInfoPanel = this.unitInfoPanelNode.getComponent(UnitInfoPanel);
        if (!this.unitInfoPanel) {
            this.unitInfoPanel = this.unitInfoPanelNode.addComponent(UnitInfoPanel);
        }

        // 设置panelNode引用
        if (this.unitInfoPanel) {
            this.unitInfoPanel.panelNode = this.unitInfoPanelNode;
        }
    }

    /**
     * 选中单位（单选）
     * @param unitNode 单位节点
     * @param unitInfo 单位信息
     */
    selectUnit(unitNode: Node, unitInfo: UnitInfo) {
        // 保存之前选中的单位，用于清除其globalTouchHandler
        const previousUnit = this.currentSelectedUnit;
        const previousUnits = [...this.currentSelectedUnits];
        
        // 清除之前的选择（不清除globalTouchHandler）
        this.clearSelection();

        // 设置当前选中的单位
        this.currentSelectedUnit = unitNode;
        this.currentSelectedUnits = []; // 清除多选

        // 清除之前选中单位的globalTouchHandler（防止旧单位继续响应点击）
        // 注意：这不会影响当前选中单位，因为它会重新注册globalTouchHandler
        if (previousUnit && previousUnit.isValid && previousUnit !== unitNode) {
            this.clearUnitTouchHandler(previousUnit);
        }
        for (const prevUnit of previousUnits) {
            if (prevUnit && prevUnit.isValid && prevUnit !== unitNode) {
                this.clearUnitTouchHandler(prevUnit);
            }
        }

        // 显示单位信息面板
        if (this.unitInfoPanel) {
            this.unitInfoPanel.showUnitInfo(unitInfo);
        }

        // 显示范围
        this.showRangeDisplay(unitNode, unitInfo);
    }

    /**
     * 选中多个单位（多选）
     * @param unitNodes 单位节点数组
     */
    selectMultipleUnits(unitNodes: Node[]) {
        if (unitNodes.length === 0) {
           //console.info('[UnitSelectionManager] selectMultipleUnits: 传入单位数量为0，清除选择');
            this.clearSelection();
            return;
        }

        // 清除之前的选择
        this.clearSelection();

        // 设置当前选中的单位数组
        this.currentSelectedUnits = unitNodes.filter(node => node && node.isValid && node.active);
        this.currentSelectedUnit = null!; // 清除单选

        if (this.currentSelectedUnits.length === 0) {
           //console.info('[UnitSelectionManager] selectMultipleUnits: 过滤后没有有效单位，返回');
            return;
        }

        // 获取第一个单位的信息
        const firstUnit = this.currentSelectedUnits[0];
        const unitInfo = this.getUnitInfo(firstUnit);
        if (!unitInfo) {
           //console.info('[UnitSelectionManager] selectMultipleUnits: 无法获取单位信息，返回');
            return;
        }

        // 确保unitInfoPanel已初始化
        if (!this.unitInfoPanel) {
           //console.info('[UnitSelectionManager] selectMultipleUnits: unitInfoPanel未初始化，初始化中');
            this.initUnitInfoPanel();
        }

        // 显示单位信息面板（使用第一个单位的信息，但标记为多选模式）
        if (this.unitInfoPanel) {
            this.unitInfoPanel.showMultipleUnitsInfo(unitInfo, this.currentSelectedUnits);
        } else {
           //console.info('[UnitSelectionManager] selectMultipleUnits: unitInfoPanel仍然为null，无法显示');
        }

        // 多选时不显示攻击范围
        // this.showRangeDisplay(firstUnit, unitInfo);
    }

    /**
     * 获取单位信息（辅助方法）
     */
    private getUnitInfo(unitNode: Node): UnitInfo | null {
        if (!unitNode || !unitNode.isValid) {
           //console.info('[UnitSelectionManager] getUnitInfo: 节点无效');
            return null;
        }

       //console.info('[UnitSelectionManager] getUnitInfo: 开始获取单位信息，节点名称=', unitNode.name);

        // 首先尝试使用Role组件（所有单位都继承自Role）
        // 使用字符串 'Role' 避免循环引用（Role.ts 导入了 UnitSelectionManager）
        const roleScript = unitNode.getComponent('Role') as any;
       //console.info('[UnitSelectionManager] getUnitInfo: roleScript存在=', !!roleScript);
        
        if (roleScript) {
            // 计算升级费用：1到2级是10金币，此后每次升级多10金币
            // 公式：10 + (level - 1) * 10
            const level = roleScript.level !== undefined ? roleScript.level : 1;
            const upgradeCost = level < 3 ? (10 + (level - 1) * 10) : undefined;
            
            const currentHealth = roleScript.currentHealth !== undefined ? roleScript.currentHealth : (roleScript.maxHealth || 0);
            const maxHealth = roleScript.maxHealth || 0;
            const attackDamage = roleScript.attackDamage !== undefined ? roleScript.attackDamage : 0;
            const attackInterval = roleScript.attackInterval || 1;
            const attackFrequency = attackInterval ? 1.0 / attackInterval : 0;
            
           //console.info(`[UnitSelectionManager] getUnitInfo: 单位=${roleScript.unitName}, currentHealth=${currentHealth}, maxHealth=${maxHealth}, attackDamage=${attackDamage}, attackInterval=${attackInterval}, attackFrequency=${attackFrequency}`);
            
            return {
                name: roleScript.unitName || '单位',
                level: level,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                attackDamage: attackDamage,
                populationCost: 1,
                icon: roleScript.cardIcon || roleScript.defaultSpriteFrame,
                collisionRadius: roleScript.collisionRadius,
                attackRange: roleScript.attackRange,
                attackFrequency: attackFrequency,
                moveSpeed: roleScript.moveSpeed,
                isDefending: roleScript.isDefending !== undefined ? roleScript.isDefending : false,
                upgradeCost: upgradeCost, // 传递升级费用用于显示
                onUpgradeClick: level < 3 ? () => roleScript.onUpgradeClick && roleScript.onUpgradeClick() : undefined,
                onSellClick: () => roleScript.onSellClick && roleScript.onSellClick(),
                onDefendClick: () => roleScript.onDefendClick && roleScript.onDefendClick()
            };
        }

        // 备用方案：尝试从各种单位类型获取信息
       //console.info('[UnitSelectionManager] getUnitInfo: roleScript不存在，尝试备用方案');
        const arrowerScript = unitNode.getComponent('Arrower') as any;
        if (arrowerScript) {
           //console.info('[UnitSelectionManager] getUnitInfo: 使用Arrower组件，maxHealth=', arrowerScript.maxHealth);
            const level = arrowerScript.level || 1;
            const upgradeCost = level < 3 ? (10 + (level - 1) * 10) : undefined;
            return {
                name: arrowerScript.unitName || '弓箭手',
                level: level,
                currentHealth: arrowerScript.currentHealth || arrowerScript.maxHealth || 0,
                maxHealth: arrowerScript.maxHealth || 0,
                attackDamage: arrowerScript.attackDamage || 0,
                populationCost: 1,
                icon: arrowerScript.cardIcon || arrowerScript.defaultSpriteFrame,
                collisionRadius: arrowerScript.collisionRadius,
                attackRange: arrowerScript.attackRange,
                attackFrequency: arrowerScript.attackInterval ? 1.0 / arrowerScript.attackInterval : 0,
                moveSpeed: arrowerScript.moveSpeed,
                isDefending: arrowerScript.isDefending,
                upgradeCost: upgradeCost, // 传递升级费用用于显示
                onUpgradeClick: level < 3 ? () => arrowerScript.onUpgradeClick && arrowerScript.onUpgradeClick() : undefined,
                onSellClick: () => arrowerScript.onSellClick && arrowerScript.onSellClick(),
                onDefendClick: () => arrowerScript.onDefendClick && arrowerScript.onDefendClick()
            };
        }

        const hunterScript = unitNode.getComponent('Hunter') as any;
        if (hunterScript) {
            const level = hunterScript.level || 1;
            const upgradeCost = level < 3 ? (10 + (level - 1) * 10) : undefined;
            return {
                name: hunterScript.unitName || '女猎手',
                level: level,
                currentHealth: hunterScript.currentHealth || hunterScript.maxHealth || 0,
                maxHealth: hunterScript.maxHealth || 0,
                attackDamage: hunterScript.attackDamage || 0,
                populationCost: 1,
                icon: hunterScript.cardIcon || hunterScript.defaultSpriteFrame,
                collisionRadius: hunterScript.collisionRadius,
                attackRange: hunterScript.attackRange,
                attackFrequency: hunterScript.attackInterval ? 1.0 / hunterScript.attackInterval : 0,
                moveSpeed: hunterScript.moveSpeed,
                isDefending: hunterScript.isDefending,
                upgradeCost: upgradeCost, // 传递升级费用用于显示
                onUpgradeClick: level < 3 ? () => hunterScript.onUpgradeClick && hunterScript.onUpgradeClick() : undefined,
                onSellClick: () => hunterScript.onSellClick && hunterScript.onSellClick(),
                onDefendClick: () => hunterScript.onDefendClick && hunterScript.onDefendClick()
            };
        }

        const swordsmanScript = unitNode.getComponent('ElfSwordsman') as any;
        if (swordsmanScript) {
            const level = swordsmanScript.level || 1;
            const upgradeCost = level < 3 ? (10 + (level - 1) * 10) : undefined;
            return {
                name: swordsmanScript.unitName || '精灵剑士',
                level: level,
                currentHealth: swordsmanScript.currentHealth || swordsmanScript.maxHealth || 0,
                maxHealth: swordsmanScript.maxHealth || 0,
                attackDamage: swordsmanScript.attackDamage || 0,
                populationCost: 1,
                icon: swordsmanScript.cardIcon || swordsmanScript.defaultSpriteFrame,
                collisionRadius: swordsmanScript.collisionRadius,
                attackRange: swordsmanScript.attackRange,
                attackFrequency: swordsmanScript.attackInterval ? 1.0 / swordsmanScript.attackInterval : 0,
                moveSpeed: swordsmanScript.moveSpeed,
                isDefending: swordsmanScript.isDefending,
                upgradeCost: upgradeCost, // 传递升级费用用于显示
                onUpgradeClick: level < 3 ? () => swordsmanScript.onUpgradeClick && swordsmanScript.onUpgradeClick() : undefined,
                onSellClick: () => swordsmanScript.onSellClick && swordsmanScript.onSellClick(),
                onDefendClick: () => swordsmanScript.onDefendClick && swordsmanScript.onDefendClick()
            };
        }

        const priestScript = unitNode.getComponent('Priest') as any;
        if (priestScript) {
            const level = priestScript.level || 1;
            const upgradeCost = level < 3 ? (10 + (level - 1) * 10) : undefined;
            return {
                name: priestScript.unitName || '牧师',
                level: level,
                currentHealth: priestScript.currentHealth || priestScript.maxHealth || 0,
                maxHealth: priestScript.maxHealth || 0,
                attackDamage: priestScript.attackDamage || 0,
                populationCost: 1,
                icon: priestScript.cardIcon || priestScript.defaultSpriteFrame,
                collisionRadius: priestScript.collisionRadius,
                attackRange: priestScript.attackRange,
                attackFrequency: priestScript.attackInterval ? 1.0 / priestScript.attackInterval : 0,
                moveSpeed: priestScript.moveSpeed,
                isDefending: priestScript.isDefending,
                upgradeCost: upgradeCost, // 传递升级费用用于显示
                onUpgradeClick: level < 3 ? () => priestScript.onUpgradeClick && priestScript.onUpgradeClick() : undefined,
                onSellClick: () => priestScript.onSellClick && priestScript.onSellClick(),
                onDefendClick: () => priestScript.onDefendClick && priestScript.onDefendClick()
            };
        }

        return null;
    }

    /**
     * 清除选择
     */
    clearSelection() {
        // 隐藏信息面板
        if (this.unitInfoPanel) {
            this.unitInfoPanel.hide();
        }

        // 隐藏范围显示
        this.hideRangeDisplay();

        // 先保存当前选中的单位，然后清除选中状态
        const selectedUnit = this.currentSelectedUnit;
        const selectedUnits = [...this.currentSelectedUnits]; // 复制数组，避免引用问题
        
        // 重要：先清除所有单位的globalTouchHandler，防止在清除选中状态后仍响应触摸事件
        // 这样Role.globalTouchHandler就不会在清除选择后执行了
        if (selectedUnit && selectedUnit.isValid) {
            this.clearUnitTouchHandler(selectedUnit);
        }
        
        // 清除多选单位的globalTouchHandler
        for (const unitNode of selectedUnits) {
            if (unitNode && unitNode.isValid) {
                this.clearUnitTouchHandler(unitNode);
            }
        }
        
        // 清除当前选中单位（在清除globalTouchHandler之后）
        this.currentSelectedUnit = null!;
        this.currentSelectedUnits = [];
        
        // 清除单选单位的高亮
        if (selectedUnit && selectedUnit.isValid) {
            this.clearUnitHighlight(selectedUnit);
        }
        
        // 清除多选单位的高亮
        for (const unitNode of selectedUnits) {
            if (unitNode && unitNode.isValid) {
                this.clearUnitHighlight(unitNode);
            }
        }
        
    }
    
    /**
     * 清除单位的高亮（辅助方法）
     * @param unitNode 单位节点
     */
    private clearUnitHighlight(unitNode: Node) {
        if (!unitNode || !unitNode.isValid) {
            return;
        }
        
        // 尝试获取Role组件（所有单位都继承自Role）
        const roleScript = unitNode.getComponent('Role') as any;
        if (roleScript && roleScript.setHighlight) {
            roleScript.setHighlight(false);
        }
        
        // 尝试获取Arrower组件（弓箭手）
        const arrowerScript = unitNode.getComponent('Arrower') as any;
        if (arrowerScript && arrowerScript.setHighlight) {
            arrowerScript.setHighlight(false);
        }
        
        // 尝试获取Hunter组件（女猎手）
        const hunterScript = unitNode.getComponent('Hunter') as any;
        if (hunterScript && hunterScript.setHighlight) {
            hunterScript.setHighlight(false);
        }
        
        // 尝试获取ElfSwordsman组件（精灵剑士）
        const swordsmanScript = unitNode.getComponent('ElfSwordsman') as any;
        if (swordsmanScript && swordsmanScript.setHighlight) {
            swordsmanScript.setHighlight(false);
        }
        
        // 尝试获取Priest组件（牧师）
        const priestScript = unitNode.getComponent('Priest') as any;
        if (priestScript && priestScript.setHighlight) {
            priestScript.setHighlight(false);
        }
        
        // 尝试获取建筑物组件
        const warAncientTreeScript = unitNode.getComponent('WarAncientTree') as any;
        if (warAncientTreeScript && warAncientTreeScript.setHighlight) {
            warAncientTreeScript.setHighlight(false);
        }
        
        const hunterHallScript = unitNode.getComponent('HunterHall') as any;
        if (hunterHallScript && hunterHallScript.setHighlight) {
            hunterHallScript.setHighlight(false);
        }
        
        const swordsmanHallScript = unitNode.getComponent('SwordsmanHall') as any;
        if (swordsmanHallScript && swordsmanHallScript.setHighlight) {
            swordsmanHallScript.setHighlight(false);
        }
        
        const churchScript = unitNode.getComponent('Church') as any;
        if (churchScript && churchScript.setHighlight) {
            churchScript.setHighlight(false);
        }
        
        const buildScript = unitNode.getComponent('Build') as any;
        if (buildScript && buildScript.setHighlight) {
            buildScript.setHighlight(false);
        }
    }
    
    /**
     * 清除单位的全局触摸监听器（辅助方法）
     * 用于清除单位的globalTouchHandler，防止单位继续响应点击移动
     * @param unitNode 单位节点
     */
    private clearUnitTouchHandler(unitNode: Node) {
        if (!unitNode || !unitNode.isValid) {
           //console.info('[UnitSelectionManager.clearUnitTouchHandler] 单位节点无效，无法清除globalTouchHandler');
            return;
        }
        
        
        // 尝试获取Role组件（所有单位都继承自Role）
        const roleScript = unitNode.getComponent('Role') as any;
        if (roleScript && roleScript.hideSelectionPanel) {
            // 不调用hideSelectionPanel，因为它会再次调用clearSelection导致循环
            // 直接清除globalTouchHandler
            if (roleScript.globalTouchHandler) {
                const canvas = find('Canvas');
                if (canvas) {
                    canvas.off(Node.EventType.TOUCH_END, roleScript.globalTouchHandler, roleScript);
                } else {
                   //console.info('[UnitSelectionManager.clearUnitTouchHandler] 找不到Canvas节点，无法清除监听器，单位名称:', unitNode?.name);
                }
                roleScript.globalTouchHandler = null!;
            } else {
               //console.info('[UnitSelectionManager.clearUnitTouchHandler] Role组件没有globalTouchHandler，无需清除，单位名称:', unitNode?.name);
            }
        } else {
           //console.info('[UnitSelectionManager.clearUnitTouchHandler] 找不到Role组件或hideSelectionPanel方法，单位名称:', unitNode?.name);
        }
        
        // 尝试获取Build组件（建筑物）
        const buildScript = unitNode.getComponent('Build') as any;
        if (buildScript && buildScript.globalTouchHandler) {
            const canvas = find('Canvas');
            if (canvas) {
                canvas.off(Node.EventType.TOUCH_END, buildScript.globalTouchHandler, buildScript);
            } else {
               //console.info('[UnitSelectionManager.clearUnitTouchHandler] 找不到Canvas节点，无法清除监听器，单位名称:', unitNode?.name);
            }
            buildScript.globalTouchHandler = null;
        }
        
    }

    /**
     * 显示范围显示
     */
    showRangeDisplay(unitNode: Node, unitInfo: UnitInfo) {
        // 先隐藏之前的范围显示
        this.hideRangeDisplay();

        const canvas = find('Canvas');
        if (!canvas) return;

        // 创建范围显示节点
        this.currentRangeDisplayNode = new Node('UnitRangeDisplay');
        this.currentRangeDisplayNode.setParent(canvas);
        this.currentRangeDisplayNode.setWorldPosition(unitNode.worldPosition);

        // 添加UITransform
        const uiTransform = this.currentRangeDisplayNode.addComponent(UITransform);
        const maxRange = Math.max(
            unitInfo.collisionRadius || 0,
            unitInfo.attackRange || 0,
            unitInfo.healRange || 0
        );
        uiTransform.setContentSize(maxRange * 2, maxRange * 2);

        // 绘制占地范围（如果有）
        if (unitInfo.collisionRadius && unitInfo.collisionRadius > 0) {
            const collisionNode = new Node('CollisionRange');
            collisionNode.setParent(this.currentRangeDisplayNode);
            collisionNode.setPosition(0, 0, 0);
            const collisionGraphics = collisionNode.addComponent(Graphics);
            collisionGraphics.fillColor = new Color(0, 100, 255, 80); // 蓝色半透明
            collisionGraphics.circle(0, 0, unitInfo.collisionRadius);
            collisionGraphics.fill();
            collisionGraphics.strokeColor = new Color(0, 100, 255, 200); // 蓝色边框
            collisionGraphics.lineWidth = 2;
            collisionGraphics.circle(0, 0, unitInfo.collisionRadius);
            collisionGraphics.stroke();
        }

        // 绘制攻击范围（如果有）- 使用背景图
        if (unitInfo.attackRange && unitInfo.attackRange > 0) {
            const attackNode = new Node('AttackRange');
            attackNode.setParent(this.currentRangeDisplayNode);
            attackNode.setPosition(0, 0, 0);
            
            // 添加UITransform设置大小
            const attackTransform = attackNode.addComponent(UITransform);
            const attackRangeSize = unitInfo.attackRange * 2; // 直径为攻击范围的两倍
            attackTransform.setContentSize(attackRangeSize, attackRangeSize);
            
            // 添加Sprite组件显示背景图
            const attackSprite = attackNode.addComponent(Sprite);
            attackSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            
            // 设置50%透明度（alpha = 128，255的一半）
            attackSprite.color = new Color(255, 255, 255, 128);
            
            // 加载背景图
            resources.load('textures/mofazhen/spriteFrame', SpriteFrame, (err, spriteFrame) => {
                if (err) {
                    console.error('[UnitSelectionManager] 加载攻击范围背景图失败:', err);
                    return;
                }
                if (attackSprite && attackSprite.node && attackSprite.node.isValid && spriteFrame) {
                    attackSprite.spriteFrame = spriteFrame;
                    // 确保透明度设置生效
                    attackSprite.color = new Color(255, 255, 255, 128);
                }
            });
        }

        // 绘制治疗范围（如果有）
        if (unitInfo.healRange && unitInfo.healRange > 0) {
            const healNode = new Node('HealRange');
            healNode.setParent(this.currentRangeDisplayNode);
            healNode.setPosition(0, 0, 0);
            const healGraphics = healNode.addComponent(Graphics);
            healGraphics.fillColor = new Color(0, 255, 0, 100); // 绿色半透明
            healGraphics.circle(0, 0, unitInfo.healRange);
            healGraphics.fill();
            healGraphics.strokeColor = new Color(0, 255, 0, 200); // 绿色边框
            healGraphics.lineWidth = 2;
            healGraphics.circle(0, 0, unitInfo.healRange);
            healGraphics.stroke();
        }
    }

    /**
     * 隐藏范围显示
     */
    hideRangeDisplay() {
        if (this.currentRangeDisplayNode && this.currentRangeDisplayNode.isValid) {
            this.currentRangeDisplayNode.destroy();
            this.currentRangeDisplayNode = null!;
        }
    }

    /**
     * 更新单位信息（用于实时更新生命值等）
     */
    updateUnitInfo(unitInfo: Partial<UnitInfo>) {
        if (this.unitInfoPanel) {
            this.unitInfoPanel.updateUnitInfo(unitInfo);
        }
    }

    /**
     * 获取当前选中的单位
     */
    getCurrentSelectedUnit(): Node | null {
        return this.currentSelectedUnit;
    }

    /**
     * 检查是否选中了指定单位
     */
    isUnitSelected(unitNode: Node): boolean {
        return this.currentSelectedUnit === unitNode;
    }
    
    /**
     * 更新范围显示位置，使其跟随选中的单位移动
     */
    update(deltaTime: number) {
        // 如果有选中的单位和范围显示节点，更新范围显示节点的位置
        if (this.currentSelectedUnit && this.currentSelectedUnit.isValid && this.currentRangeDisplayNode && this.currentRangeDisplayNode.isValid) {
            this.currentRangeDisplayNode.setWorldPosition(this.currentSelectedUnit.worldPosition);
        }
    }
}

