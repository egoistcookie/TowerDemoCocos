import { _decorator, Node, Vec3, find, Prefab, instantiate, SpriteFrame, AudioClip } from 'cc';
import { Build } from './Build';
import { UnitInfo } from './UnitInfoPanel';
import { StoneWallGridPanel } from './StoneWallGridPanel';
import { UnitType } from './WarAncientTree';
import { BuildingPool } from './BuildingPool';
import { GameManager, GameState } from './GameManager';
import { Arrow } from './Arrow';
import { AudioManager } from './AudioManager';
const { ccclass, property } = _decorator;

@ccclass('WatchTower')
export class WatchTower extends Build {
    // 哨塔特有属性
    @property
    goldReward: number = 2; // 回收获得的金币

    // 攻击相关属性
    @property
    attackRange: number = 250; // 攻击范围

    @property
    attackDamage: number = 15; // 攻击伤害

    @property
    attackInterval: number = 1.2; // 攻击间隔（秒）

    @property(Prefab)
    arrowPrefab: Prefab = null!; // 弓箭预制体

    @property(AudioClip)
    shootSound: AudioClip = null!; // 箭矢射出时的音效

    @property(AudioClip)
    hitSound: AudioClip = null!; // 箭矢击中敌人时的音效

    // 攻击相关私有属性
    protected attackTimer: number = 0; // 攻击计时器
    protected currentTarget: Node = null!; // 当前攻击目标
    protected targetFindTimer: number = 0; // 目标查找计时器
    protected readonly TARGET_FIND_INTERVAL: number = 0.2; // 目标查找间隔（秒）
    protected hasFoundFirstTarget: boolean = false; // 是否已经找到过第一个目标

    /**
     * 当哨塔从对象池激活时调用（用于对象池复用）
     */
    onEnable() {
        // 调用父类onEnable方法
        super.onEnable();
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
    }

    protected start() {
        // 设置单位类型
        this.unitType = UnitType.BUILDING;
        
        // 调用父类start方法
        super.start();
        
        // 初始化攻击相关属性
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.targetFindTimer = 0;
        this.hasFoundFirstTarget = false;
    }

    /**
     * 查找网格面板（重写以支持石墙网格）
     */
    protected findGridPanel() {
        // 查找石墙网格面板
        const stoneWallGridPanelNode = find('StoneWallGridPanel');
        if (stoneWallGridPanelNode) {
            // 使用类型断言，因为StoneWallGridPanel和BuildingGridPanel有相同的方法接口
            this.gridPanel = stoneWallGridPanelNode.getComponent(StoneWallGridPanel) as any;
        }
    }

    /**
     * 构造哨塔的单位信息（包含回收回调，供九宫格面板使用）
     */
    private buildUnitInfo(): UnitInfo {
        return {
            name: '哨塔',
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
     * 更新逻辑（处理攻击）
     */
    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 检查游戏状态
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止攻击
                this.currentTarget = null!;
                return;
            }
        }

        this.attackTimer += deltaTime;
        this.targetFindTimer += deltaTime;

        // 查找目标逻辑
        const needFindTarget = !this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active;
        const shouldFindByInterval = !this.hasFoundFirstTarget || this.targetFindTimer >= this.TARGET_FIND_INTERVAL;
        
        if (needFindTarget || shouldFindByInterval) {
            this.targetFindTimer = 0; // 重置计时器
            this.findTarget();
            // 如果找到了目标，标记为已找到第一个目标
            if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                this.hasFoundFirstTarget = true;
            }
        }

        // 处理攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，进行攻击
                if (this.attackTimer >= this.attackInterval) {
                    // 再次检查游戏状态，确保游戏仍在进行
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else {
                // 超出攻击范围，清除目标
                this.currentTarget = null!;
            }
        }
    }

    /**
     * 查找攻击目标
     */
    private findTarget() {
        if (this.isDestroyed) {
            return;
        }

        const myPos = this.node.worldPosition;
        let nearestTarget: Node | null = null;
        let minDistance = this.attackRange;

        // 查找所有敌人容器
        const enemyContainers = ['Canvas/Enemies', 'Canvas/Orcs', 'Canvas/TrollSpearmans', 'Canvas/OrcWarriors', 'Canvas/OrcWarlords'];
        const allEnemies: Node[] = [];

        for (const containerName of enemyContainers) {
            const containerNode = find(containerName);
            if (containerNode) {
                allEnemies.push(...containerNode.children);
            }
        }

        // 查找最近的敌人
        for (const enemy of allEnemies) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;

            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('OrcWarrior') as any ||
                               enemy.getComponent('TrollSpearman') as any;
            
            if (!enemyScript) continue;

            // 检查敌人是否存活
            if (enemyScript.isAlive && !enemyScript.isAlive()) continue;

            const distance = Vec3.distance(myPos, enemy.worldPosition);
            
            if (distance <= this.attackRange && distance < minDistance) {
                minDistance = distance;
                nearestTarget = enemy;
            }
        }

        // 设置当前目标
        if (nearestTarget) {
            this.currentTarget = nearestTarget;
        } else {
            this.currentTarget = null!;
        }
    }

    /**
     * 攻击目标
     */
    private attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 获取敌人脚本
        const enemyScript = this.currentTarget.getComponent('Enemy') as any || 
                           this.currentTarget.getComponent('OrcWarlord') as any ||
                           this.currentTarget.getComponent('OrcWarrior') as any ||
                           this.currentTarget.getComponent('TrollSpearman') as any;
        
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 播放射击音效
        if (this.shootSound && AudioManager.Instance) {
            AudioManager.Instance.playSFX(this.shootSound);
        }

        // 创建弓箭
        if (this.arrowPrefab) {
            this.createArrow();
        } else {
            // 如果没有弓箭预制体，直接造成伤害
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
            }
        }
    }

    /**
     * 创建弓箭
     */
    private createArrow() {
        if (!this.arrowPrefab || !this.currentTarget) {
            return;
        }

        // 检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        // 创建弓箭节点
        const arrow = instantiate(this.arrowPrefab);
        
        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrow.setParent(parentNode);
        } else {
            arrow.setParent(this.node.parent);
        }

        // 设置初始位置（哨塔位置）
        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);

        // 确保节点激活
        arrow.active = true;

        // 获取或添加Arrow组件
        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            arrowScript = arrow.addComponent(Arrow);
        }

        // 保存当前目标的引用，避免回调函数中引用失效的目标
        const targetNode = this.currentTarget;
        
        // 初始化弓箭，设置命中回调
        arrowScript.init(
            startPos,
            targetNode,
            this.attackDamage,
            (damage: number) => {
                // 播放箭矢击中音效
                if (this.hitSound) {
                    AudioManager.Instance?.playSFX(this.hitSound);
                }
                
                // 检查目标是否仍然有效
                if (targetNode && targetNode.isValid && targetNode.active) {
                    // 获取敌人脚本
                    const enemyScript = targetNode.getComponent('Enemy') as any || 
                                       targetNode.getComponent('OrcWarlord') as any ||
                                       targetNode.getComponent('OrcWarrior') as any ||
                                       targetNode.getComponent('TrollSpearman') as any;
                    
                    if (enemyScript && enemyScript.takeDamage) {
                        enemyScript.takeDamage(damage);
                    }
                }
            }
        );
    }

    /**
     * 死亡（重写以添加金币奖励逻辑）
     */
    protected die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 释放网格占用（确保能找到网格面板）
        if (!this.gridPanel) {
            this.findGridPanel();
        }
        if (this.gridPanel && this.gridX >= 0 && this.gridY >= 0) {
            this.gridPanel.releaseGrid(this.gridX, this.gridY);
        }

        // 播放爆炸特效
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            const canvas = find('Canvas');
            if (canvas) {
                explosion.setParent(canvas);
            } else if (this.node.scene) {
                explosion.setParent(this.node.scene);
            }
            explosion.setWorldPosition(this.node.worldPosition);
            explosion.active = true;
        }

        // 给玩家奖励金币（哨塔特有）
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
        }

        // 性能优化：使用对象池回收建筑物，而不是直接销毁
        const buildingPool = BuildingPool.getInstance();
        if (buildingPool && this.prefabName) {
            // 清理状态
            this.currentTarget = null!;
            this.attackTimer = 0;
            this.targetFindTimer = 0;
            this.hasFoundFirstTarget = false;
            
            // 回收到对象池
            buildingPool.release(this.node, this.prefabName);
        } else {
            // 如果没有对象池，直接销毁
            this.node.destroy();
        }
    }

    /**
     * 检查是否存活
     */
    public isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }
}

