import { _decorator, Component, Node, Vec3, tween, Sprite, find, Prefab, instantiate, Label, Color } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {
    @property
    maxHealth: number = 30;

    @property
    moveSpeed: number = 50;

    @property
    attackDamage: number = 5;

    @property
    attackInterval: number = 2.0;

    @property
    attackRange: number = 50;

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    private currentHealth: number = 30;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    
    @property
    goldReward: number = 2; // 消灭敌人获得的金币

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 如果targetCrystal没有设置，尝试查找
        if (!this.targetCrystal) {
            // 使用 find 函数查找节点
            let crystalNode = find('Crystal');
            
            // 如果找不到，尝试从场景根节点递归查找
            if (!crystalNode && this.node.scene) {
                const findInScene = (node: Node, name: string): Node | null => {
                    if (node.name === name) {
                        return node;
                    }
                    for (const child of node.children) {
                        const found = findInScene(child, name);
                        if (found) return found;
                    }
                    return null;
                };
                crystalNode = findInScene(this.node.scene, 'Crystal');
            }
            
            if (crystalNode) {
                this.targetCrystal = crystalNode;
                console.log('Enemy: Found crystal node:', crystalNode.name, 'at position:', crystalNode.worldPosition);
            } else {
                console.error('Enemy: Cannot find Crystal node!');
            }
        } else {
            console.log('Enemy: targetCrystal already set:', this.targetCrystal.name, 'at position:', this.targetCrystal.worldPosition);
        }
        
        // 创建血条
        this.createHealthBar();
        
        console.log('Enemy: Start at position:', this.node.worldPosition);
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 30, 0); // 在敌人上方
        
        // 添加HealthBar组件
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找GameManager组件
        const scene = this.node.scene;
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
            this.gameManager = findInScene(scene, GameManager);
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 更新攻击计时器
        this.attackTimer += deltaTime;

        // 查找目标（优先防御塔，然后水晶）
        this.findTarget();

        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    this.attack();
                    this.attackTimer = 0;
                }
            } else {
                // 不在攻击范围内，继续移动
                this.moveTowardsTarget(deltaTime);
            }
        } else {
            // 没有目标，向水晶移动
            if (this.targetCrystal && this.targetCrystal.isValid) {
                this.moveTowardsCrystal(deltaTime);
            } else {
                // 调试：如果没有目标水晶
                if (!this.targetCrystal) {
                    console.warn('Enemy: No targetCrystal set!');
                } else if (!this.targetCrystal.isValid) {
                    console.warn('Enemy: targetCrystal is invalid!');
                }
            }
        }
    }

    findTarget() {
        // 使用递归查找Towers容器（更可靠）
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
        
        // 优先查找附近的防御塔（在攻击范围内）
        let towers: Node[] = [];
        let towersNode = find('Towers');
        
        // 如果直接查找失败，尝试递归查找
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }
        
        if (towersNode) {
            towers = towersNode.children;
        } else {
            // 调试：每60帧输出一次，避免刷屏
            if (Math.random() < 0.016) {
                console.warn('Enemy: Towers container not found!');
            }
        }
        
        let nearestTower: Node = null!;
        let minDistance = Infinity;

        // 查找攻击范围内的防御塔（优先攻击防御塔）
        for (const tower of towers) {
            if (tower && tower.active && tower.isValid) {
                const towerScript = tower.getComponent('Tower') as any;
                // 检查防御塔是否存活
                if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
                    // 如果防御塔在攻击范围内，优先选择最近的
                    if (distance <= this.attackRange && distance < minDistance) {
                        minDistance = distance;
                        nearestTower = tower;
                    }
                }
            }
        }

        // 如果找到防御塔，优先攻击防御塔
        if (nearestTower) {
            // 调试：找到防御塔时输出日志（每60帧一次）
            if (Math.random() < 0.016) {
                console.log(`Enemy: Found target tower at distance ${minDistance.toFixed(2)}, attacking tower!`);
            }
            this.currentTarget = nearestTower;
            return;
        }
        
        // 没有防御塔在攻击范围内，目标设为水晶
        if (this.targetCrystal && this.targetCrystal.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                this.currentTarget = this.targetCrystal;
            } else {
                this.currentTarget = null!;
            }
        } else {
            this.currentTarget = null!;
        }
    }

    moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget) {
            return;
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, direction, this.moveSpeed * deltaTime);
            this.node.setWorldPosition(newPos);
        }
    }

    moveTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        const crystalWorldPos = this.targetCrystal.worldPosition;
        const enemyWorldPos = this.node.worldPosition;
        
        const direction = new Vec3();
        Vec3.subtract(direction, crystalWorldPos, enemyWorldPos);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            const moveDistance = this.moveSpeed * deltaTime;
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, enemyWorldPos, direction, moveDistance);
            this.node.setWorldPosition(newPos);
            
            // 调试日志（每60帧输出一次，避免刷屏）
            if (Math.random() < 0.016) { // 约每60帧一次
                console.log('Enemy moving:', {
                    from: enemyWorldPos,
                    to: crystalWorldPos,
                    distance: distance.toFixed(2),
                    moveDistance: moveDistance.toFixed(2)
                });
            }
        }
    }

    stopMoving() {
        // 停止移动逻辑（如果需要）
    }

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const towerScript = this.currentTarget.getComponent('Tower') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const targetScript = towerScript || crystalScript;
        
        if (targetScript && targetScript.takeDamage) {
            targetScript.takeDamage(this.attackDamage);
            // 根据目标类型输出日志
            if (towerScript) {
                console.log(`Enemy: Attacked tower, dealt ${this.attackDamage} damage`);
            } else if (crystalScript) {
                console.log(`Enemy: Attacked crystal, dealt ${this.attackDamage} damage`);
            }
        } else {
            // 目标无效，清除目标
            this.currentTarget = null!;
        }
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 显示伤害数字
        this.showDamageNumber(damage);

        this.currentHealth -= damage;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    showDamageNumber(damage: number) {
        // 创建伤害数字节点
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            // 如果没有预制体，创建简单的Label节点
            damageNode = new Node('DamageNumber');
            const label = damageNode.addComponent(Label);
            label.string = `-${Math.floor(damage)}`;
            label.fontSize = 20;
            label.color = Color.WHITE;
        }
        
        // 添加到Canvas或场景
        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
        } else {
            damageNode.setParent(this.node.scene);
        }
        
        // 设置位置（在敌人上方）
        damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 30, 0));
        
        // 如果有DamageNumber组件，设置伤害值
        const damageScript = damageNode.getComponent(DamageNumber);
        if (damageScript) {
            damageScript.setDamage(damage);
        } else {
            // 如果没有组件，手动添加动画
            const label = damageNode.getComponent(Label);
            if (label) {
                const startPos = damageNode.position.clone();
                const endPos = startPos.clone();
                endPos.y += 50;
                
                tween(damageNode)
                    .to(1.0, { position: endPos })
                    .parallel(
                        tween().to(1.0, {}, {
                            onUpdate: (target, ratio) => {
                                const color = label.color.clone();
                                color.a = 255 * (1 - ratio);
                                label.color = color;
                            }
                        })
                    )
                    .call(() => {
                        if (damageNode && damageNode.isValid) {
                            damageNode.destroy();
                        }
                    })
                    .start();
            }
        }
    }

    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        this.stopMoving();

        // 奖励金币
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
            console.log(`Enemy: Died, rewarded ${this.goldReward} gold`);
        }

        // 销毁血条节点
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }

        // 倒下动画（旋转）
        tween(this.node)
            .to(0.3, { angle: 90 })
            .call(() => {
                // 渐隐消失
                const sprite = this.node.getComponent(Sprite);
                const startOpacity = sprite ? sprite.color.a : 255;
                
                tween(this.node)
                    .to(1.0, { 
                        position: this.node.position.clone().add3f(0, -20, 0)
                    })
                    .parallel(
                        tween().to(1.0, {}, {
                            onUpdate: (target, ratio) => {
                                if (sprite && this.node && this.node.isValid) {
                                    const color = sprite.color.clone();
                                    color.a = startOpacity * (1 - ratio);
                                    sprite.color = color;
                                }
                            }
                        })
                    )
                    .call(() => {
                        // 确保节点被真正销毁
                        if (this.node && this.node.isValid) {
                            this.node.destroy();
                        }
                    })
                    .start();
            })
            .start();
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }
}

