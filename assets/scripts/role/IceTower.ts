import { _decorator, Node, Vec3, find, Prefab, instantiate, SpriteFrame, AudioClip, Graphics, UITransform, Color, EventTouch } from 'cc';
import { Build } from './Build';
import { UnitInfo } from '../UnitInfoPanel';
import { StoneWallGridPanel } from '../StoneWallGridPanel';
import { UnitType } from './WarAncientTree';
import { BuildingPool } from '../BuildingPool';
import { GameManager, GameState } from '../GameManager';
import { IceArrow } from '../IceArrow';
import { AudioManager } from '../AudioManager';
import { UnitManager } from '../UnitManager';
const { ccclass, property } = _decorator;

@ccclass('IceTower')
export class IceTower extends Build { 
    // 冰塔特有属性
    @property
    goldReward: number = 4; // 回收获得的金币

    // 攻击相关属性
    @property
    attackRange: number = 300; // 攻击范围

    @property
    attackDamage: number = 20; // 攻击伤害

    @property
    attackInterval: number = 1.5; // 攻击间隔（秒）

    @property(Prefab)
    iceArrowPrefab: Prefab = null!; // 冰箭预制体

    @property(AudioClip)
    shootSound: AudioClip = null!; // 冰箭射出时的音效

    @property(AudioClip)
    hitSound: AudioClip = null!; // 冰箭击中敌人时的音效

    // 攻击相关私有属性
    protected attackTimer: number = 0; // 攻击计时器
    protected currentTarget: Node = null!; // 当前攻击目标
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒）
    protected hasFoundFirstTarget: boolean = false; // 是否已经找到过第一个目标
    private unitManager: UnitManager = null!; // 单位管理器引用

    /**
     * 当冰塔从对象池激活时调用
     */
    onEnable() {
        super.onEnable();
        
        // 冰塔特有的初始化：监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onIceTowerClick, this);
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 获取UnitManager
        this.unitManager = UnitManager.getInstance();
    }

    protected start() {
        // 设置单位类型
        this.unitType = UnitType.BUILDING;
        
        // 调用父类start方法
        super.start();
        
        // 冰塔特有的初始化：监听点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onIceTowerClick, this);
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
        
        // 获取UnitManager
        this.unitManager = UnitManager.getInstance();
    }
    
    onDestroy() {
        // 移除点击事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onIceTowerClick, this);
        
        // 调用父类onDestroy
        super.onDestroy();
    }

    /**
     * 查找网格面板（重写以支持石墙网格）
     */
    protected findGridPanel() {
        const stoneWallGridPanelNode = find('StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            this.gridPanel = stoneWallGridPanelNode.getComponent(StoneWallGridPanel) as any;
        }
    }

    /**
     * 构造冰塔的单位信息（包含回收回调）
     */
    private buildUnitInfo(): UnitInfo {
        return {
            name: '冰元素塔',
            level: this.level,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            attackDamage: this.attackDamage,
            populationCost: 0,
            icon: this.cardIcon || this.defaultSpriteFrame,
            collisionRadius: this.collisionRadius,
            onSellClick: () => {
                this.onSellClick();
            }
        };
    }
    
    /**
     * 点击事件（冰塔特有）
     */
    onIceTowerClick(event: EventTouch) {
        // 检查是否正在拖拽建筑物
        let towerBuilderNode = find('TowerBuilder');
        if (!towerBuilderNode && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            towerBuilderNode = findNodeRecursive(this.node.scene, 'TowerBuilder');
        }
        
        let towerBuilder: any = null;
        if (towerBuilderNode) {
            towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
        } else if (this.node.scene) {
            const findComponentInScene = (node: Node, componentType: string): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findComponentInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            towerBuilder = findComponentInScene(this.node.scene, 'TowerBuilder');
        }
        
        if (towerBuilder && (towerBuilder as any).isLongPressActive) {
            return;
        }
        
        if ((this.node as any)._showingInfoPanel) {
            return;
        }
        
        if (towerBuilder && towerBuilder.isDraggingBuilding) {
            if (towerBuilder.endDraggingBuilding && typeof towerBuilder.endDraggingBuilding === 'function') {
                towerBuilder.endDraggingBuilding(event);
            }
            return;
        }

        event.propagationStopped = true;

        // 点击时显示九宫格信息面板（包含回收按钮）
        if (!this.unitSelectionManager) {
            this.findUnitSelectionManager();
        }
        if (this.unitSelectionManager) {
            this.unitSelectionManager.selectUnit(this.node, this.buildUnitInfo());
        }

        if (this.isMoving) {
            return;
        }

        if (this.selectionPanel && this.selectionPanel.isValid) {
            this.hideSelectionPanel();
            return;
        }

        this.startMoving(event);
    }
    
    /**
     * 回收按钮点击事件
     */
    onSellClick(event?: EventTouch) {
        if (event) {
            event.propagationStopped = true;
        }
        
        if (!this.gameManager) {
            this.findGameManager();
        }

        if (this.gameManager) {
            const refund = Math.floor(this.buildCost * 0.8);
            this.gameManager.addGold(refund);
        }

        this.hideSelectionPanel();
        this.die();
    }

    /**
     * 更新逻辑（处理攻击）
     */
    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                this.currentTarget = null!;
                return;
            }
        }

        // 处理攻击逻辑
        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;

        // 查找目标逻辑
        const needFindTarget = !this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active;
        const shouldFindByInterval = !this.hasFoundFirstTarget || this.targetFindTimer >= this.TARGET_FIND_INTERVAL;
        
        if (needFindTarget || shouldFindByInterval) {
            this.targetFindTimer = 0;
            this.findTarget();
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                this.hasFoundFirstTarget = true;
            }
        }

        // 处理攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                if (this.attackTimer >= this.attackInterval) {
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else {
                this.currentTarget = null!;
            }
        }
    }

    /**
     * 查找目标
     */
    private findTarget() {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        const myPos = this.node.worldPosition;
        const detectionRange = this.attackRange;
        const detectionRangeSq = detectionRange * detectionRange;

        let nearestTarget: Node | null = null;
        let minDistanceSq = detectionRangeSq;

        // 查找敌人
        const enemies = this.unitManager ? this.unitManager.getEnemiesInRange(myPos, detectionRange, true) : [];
        
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;

            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('OrcWarrior') as any ||
                               enemy.getComponent('TrollSpearman') as any;
            
            if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) continue;

            const dx = enemy.worldPosition.x - myPos.x;
            const dy = enemy.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= detectionRangeSq && distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestTarget = enemy;
            }
        }

        if (nearestTarget) {
            this.currentTarget = nearestTarget;
        }
    }

    /**
     * 攻击
     */
    private attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 播放攻击音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 创建冰箭
        this.createIceArrow();
    }

    /**
     * 创建冰箭
     */
    private createIceArrow() {
        if (!this.currentTarget || !this.currentTarget.isValid) {
            return;
        }

        // 创建冰箭节点
        let arrowNode: Node;
        if (this.iceArrowPrefab) {
            arrowNode = instantiate(this.iceArrowPrefab);
        } else {
            // 如果没有预制体，创建一个简单的节点
            arrowNode = new Node('IceArrow');
            const sprite = arrowNode.addComponent('Sprite' as any);
            // 可以设置一个蓝色的小圆点作为冰箭外观
        }

        // 设置父节点
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrowNode.setParent(parentNode);
        } else {
            arrowNode.setParent(this.node.parent);
        }

        // 设置初始位置（冰塔位置）
        const startPos = this.node.worldPosition.clone();
        arrowNode.setWorldPosition(startPos);

        arrowNode.active = true;

        // 获取或添加IceArrow组件
        let iceArrowScript = arrowNode.getComponent(IceArrow);
        if (!iceArrowScript) {
            iceArrowScript = arrowNode.addComponent(IceArrow);
        }

        // 初始化冰箭
        iceArrowScript.init(
            startPos,
            this.currentTarget,
            this.attackDamage,
            (damage: number, hitPos: Vec3, enemy: Node) => {
                // 命中回调
                this.onArrowHit(damage, enemy);
            }
        );
    }

    /**
     * 冰箭命中回调
     */
    private onArrowHit(damage: number, enemy: Node) {
        if (!enemy || !enemy.isValid || !enemy.active) {
            return;
        }

        // 播放命中音效
        if (this.hitSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.hitSound);
        }

        // 应用伤害
        const enemyScript = enemy.getComponent('Enemy') as any || 
                           enemy.getComponent('OrcWarlord') as any ||
                           enemy.getComponent('OrcWarrior') as any ||
                           enemy.getComponent('TrollSpearman') as any;
        
        if (enemyScript && enemyScript.takeDamage) {
            enemyScript.takeDamage(damage);
        }
    }
}
