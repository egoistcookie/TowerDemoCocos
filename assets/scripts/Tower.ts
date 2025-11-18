import { _decorator, Component, Node, Vec3, Prefab, instantiate, find } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Tower')
export class Tower extends Component {
    @property
    maxHealth: number = 50;

    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 10;

    @property
    attackInterval: number = 1.0;

    @property(Prefab)
    bulletPrefab: Prefab = null!;

    @property(Node)
    explosionEffect: Node = null!;

    private currentHealth: number = 50;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        this.attackTimer += deltaTime;

        // 查找目标
        this.findTarget();

        // 攻击目标
        if (this.currentTarget && this.attackTimer >= this.attackInterval) {
            this.attack();
            this.attackTimer = 0;
        }
    }

    findTarget() {
        const enemies = find('Enemies')?.children || [];
        let nearestEnemy: Node = null!;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy.active) {
                const enemyScript = enemy.getComponent('Enemy') as any;
                if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, enemy.worldPosition);
                    if (distance <= this.attackRange && distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }
            }
        }

        this.currentTarget = nearestEnemy;
    }

    attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
            // 创建子弹或直接造成伤害
            if (this.bulletPrefab) {
                this.createBullet();
            } else {
                // 直接伤害
                if (enemyScript.takeDamage) {
                    enemyScript.takeDamage(this.attackDamage);
                }
            }
        }
    }

    createBullet() {
        if (!this.bulletPrefab || !this.currentTarget) {
            return;
        }

        const bullet = instantiate(this.bulletPrefab);
        bullet.setParent(this.node.parent);
        bullet.setWorldPosition(this.node.worldPosition);

        // 简单的子弹移动逻辑（可以创建Bullet脚本）
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        direction.normalize();

        // 直接造成伤害（简化处理）
        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.takeDamage) {
            enemyScript.takeDamage(this.attackDamage);
        }

        // 销毁子弹
        this.scheduleOnce(() => {
            if (bullet && bullet.isValid) {
                bullet.destroy();
            }
        }, 0.1);
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyTower();
        }
    }

    destroyTower() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        // 触发爆炸效果
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            explosion.setParent(this.node.parent);
            explosion.setWorldPosition(this.node.worldPosition);

            this.scheduleOnce(() => {
                if (explosion && explosion.isValid) {
                    explosion.destroy();
                }
            }, 1.0);
        }

        // 隐藏防御塔
        this.node.active = false;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }
}

