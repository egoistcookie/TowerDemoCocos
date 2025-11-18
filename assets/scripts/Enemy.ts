import { _decorator, Component, Node, Vec3, tween, Sprite, find } from 'cc';
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

    private currentHealth: number = 30;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        
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
        
        console.log('Enemy: Start at position:', this.node.worldPosition);
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
        // 优先查找附近的防御塔
        let towers: Node[] = [];
        const towersNode = find('Towers');
        if (towersNode) {
            towers = towersNode.children;
        }
        
        let nearestTower: Node = null!;
        let minDistance = Infinity;

        for (const tower of towers) {
            if (tower.active) {
                const towerScript = tower.getComponent('Tower') as any;
                if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
                    if (distance < minDistance && distance <= this.attackRange * 2) {
                        minDistance = distance;
                        nearestTower = tower;
                    }
                }
            }
        }

        if (nearestTower) {
            this.currentTarget = nearestTower;
        } else {
            // 没有防御塔，目标设为水晶
            if (this.targetCrystal && this.targetCrystal.isValid) {
                const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
                if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                    this.currentTarget = this.targetCrystal;
                } else {
                    // 调试：水晶脚本不存在或已死亡
                    if (!crystalScript) {
                        console.warn('Enemy: Crystal script not found on targetCrystal node');
                    }
                    this.currentTarget = null!;
                }
            } else {
                // 调试：没有目标水晶
                if (!this.targetCrystal) {
                    console.warn('Enemy: targetCrystal is null in findTarget()');
                } else if (!this.targetCrystal.isValid) {
                    console.warn('Enemy: targetCrystal is invalid in findTarget()');
                }
                this.currentTarget = null!;
            }
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

        const towerScript = this.currentTarget.getComponent('Tower') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const targetScript = towerScript || crystalScript;
        if (targetScript && targetScript.takeDamage) {
            targetScript.takeDamage(this.attackDamage);
        }
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        this.stopMoving();

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
                                if (sprite) {
                                    const color = sprite.color.clone();
                                    color.a = startOpacity * (1 - ratio);
                                    sprite.color = color;
                                }
                            }
                        })
                    )
                    .call(() => {
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

