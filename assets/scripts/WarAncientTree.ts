import { _decorator, Component, Node, Vec3, Prefab, instantiate, find, Sprite, SpriteFrame, Color, Graphics, UITransform } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
import { Arrow } from './Arrow';
const { ccclass, property } = _decorator;

@ccclass('WarAncientTree')
export class WarAncientTree extends Component {
    @property
    maxHealth: number = 100;

    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 15;

    @property
    attackInterval: number = 1.5;

    @property(Prefab)
    arrowPrefab: Prefab = null!;

    @property(Prefab)
    towerPrefab: Prefab = null!; // 生产的Tower预制体

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    // 攻击动画相关属性
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = [];

    @property
    attackAnimationDuration: number = 0.5;

    // 生产相关属性
    @property
    maxTowerCount: number = 4; // 最多生产4个Tower

    @property
    productionInterval: number = 2.0; // 每2秒生产一个

    @property
    spawnOffset: number = 20; // Tower出现在前方20像素

    private currentHealth: number = 100;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private attackTimer: number = 0;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private sprite: Sprite = null!;
    private defaultSpriteFrame: SpriteFrame = null!;
    private defaultScale: Vec3 = new Vec3(1, 1, 1);
    private isPlayingAttackAnimation: boolean = false;

    // 生产相关
    private producedTowerCount: number = 0; // 已生产的Tower数量
    private productionTimer: number = 0; // 生产计时器
    private towerContainer: Node = null!; // Tower容器

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.currentTarget = null!;
        this.isPlayingAttackAnimation = false;
        this.producedTowerCount = 0;
        this.productionTimer = 0;

        // 获取Sprite组件
        this.sprite = this.node.getComponent(Sprite);
        if (this.sprite && this.sprite.spriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
        }
        this.defaultScale = this.node.scale.clone();

        // 查找游戏管理器
        this.findGameManager();

        // 查找Tower容器
        this.findTowerContainer();

        // 创建血条
        this.createHealthBar();
    }

    findGameManager() {
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

        let gmNode = find('GameManager');
        if (!gmNode && this.node.scene) {
            gmNode = findNodeRecursive(this.node.scene, 'GameManager');
        }
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
        }
    }

    findTowerContainer() {
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

        let towersNode = find('Towers');
        if (!towersNode && this.node.scene) {
            towersNode = findNodeRecursive(this.node.scene, 'Towers');
        }
        if (towersNode) {
            this.towerContainer = towersNode;
        } else {
            // 如果找不到，创建一个新的容器
            this.towerContainer = new Node('Towers');
            const canvas = find('Canvas');
            if (canvas) {
                this.towerContainer.setParent(canvas);
            } else if (this.node.scene) {
                this.towerContainer.setParent(this.node.scene);
            }
        }
    }

    createHealthBar() {
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 50, 0);

        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    update(deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        // 更新攻击计时器
        this.attackTimer += deltaTime;

        // 查找目标
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.findTarget();
        }

        // 攻击逻辑
        if (this.currentTarget && this.attackTimer >= this.attackInterval) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            if (distance <= this.attackRange) {
                this.attack();
                this.attackTimer = 0;
            } else {
                // 目标超出范围，清除目标
                this.currentTarget = null!;
            }
        }

        // 生产Tower逻辑
        if (this.producedTowerCount < this.maxTowerCount) {
            this.productionTimer += deltaTime;
            if (this.productionTimer >= this.productionInterval) {
                this.produceTower();
                this.productionTimer = 0;
            }
        }
    }

    findTarget() {
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

        const scene = this.node.scene;
        let enemiesNode = find('Enemies');

        if (!enemiesNode && scene) {
            enemiesNode = findNodeRecursive(scene, 'Enemies');
        }

        if (!enemiesNode) {
            this.currentTarget = null!;
            return;
        }

        const enemies = enemiesNode.children || [];
        let nearestEnemy: Node = null!;
        let minDistance = Infinity;

        for (const enemy of enemies) {
            if (enemy && enemy.active && enemy.isValid) {
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

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
            // 播放攻击动画，动画完成后才攻击
            this.playAttackAnimation(() => {
                this.executeAttack();
            });
        } else {
            this.currentTarget = null!;
        }
    }

    executeAttack() {
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active || this.isDestroyed) {
            return;
        }

        const enemyScript = this.currentTarget.getComponent('Enemy') as any;
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            this.currentTarget = null!;
            return;
        }

        // 创建弓箭特效
        if (this.arrowPrefab) {
            this.createArrow();
        } else {
            // 直接伤害（无特效）
            if (enemyScript.takeDamage) {
                enemyScript.takeDamage(this.attackDamage);
            }
        }
    }

    playAttackAnimation(onComplete?: () => void) {
        if (this.isPlayingAttackAnimation) {
            return;
        }

        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
            if (!this.sprite) {
                if (onComplete) onComplete();
                return;
            }
        }

        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        // 根据敌人位置决定是否翻转
        let shouldFlip = false;
        if (this.currentTarget && this.currentTarget.isValid) {
            const treePos = this.node.worldPosition;
            const enemyPos = this.currentTarget.worldPosition;
            shouldFlip = enemyPos.x < treePos.x;

            if (shouldFlip) {
                this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    this.healthBarNode.setScale(-1, 1, 1);
                }
            } else {
                this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
                if (this.healthBarNode && this.healthBarNode.isValid) {
                    this.healthBarNode.setScale(1, 1, 1);
                }
            }
        }

        this.isPlayingAttackAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount;
        let animationTimer = 0;
        let lastFrameIndex = -1;

        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }

        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                if (onComplete) onComplete();
                return;
            }

            animationTimer += deltaTime;

            if (animationTimer >= this.attackAnimationDuration) {
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                if (onComplete) {
                    onComplete();
                }
                return;
            }

            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };

        this.schedule(animationUpdate, 0);
    }

    restoreDefaultSprite() {
        if (this.sprite && this.sprite.isValid && this.defaultSpriteFrame) {
            this.sprite.spriteFrame = this.defaultSpriteFrame;
        }
        if (this.node && this.node.isValid) {
            this.node.setScale(this.defaultScale.x, this.defaultScale.y, this.defaultScale.z);
        }
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.setScale(1, 1, 1);
        }
        this.isPlayingAttackAnimation = false;
    }

    createArrow() {
        if (!this.arrowPrefab || !this.currentTarget) {
            return;
        }

        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            return;
        }

        const arrow = instantiate(this.arrowPrefab);

        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            arrow.setParent(parentNode);
        } else {
            arrow.setParent(this.node.parent);
        }

        const startPos = this.node.worldPosition.clone();
        arrow.setWorldPosition(startPos);
        arrow.active = true;

        let arrowScript = arrow.getComponent(Arrow);
        if (!arrowScript) {
            arrowScript = arrow.addComponent(Arrow);
        }

        arrowScript.init(
            startPos,
            this.currentTarget,
            this.attackDamage,
            (damage: number) => {
                const enemyScript = this.currentTarget?.getComponent('Enemy') as any;
                if (enemyScript && enemyScript.takeDamage) {
                    enemyScript.takeDamage(damage);
                }
            }
        );
    }

    produceTower() {
        if (!this.towerPrefab || !this.towerContainer) {
            console.warn('WarAncientTree: Cannot produce tower - prefab or container missing');
            return;
        }

        if (this.producedTowerCount >= this.maxTowerCount) {
            return;
        }

        // 计算Tower出现位置（战争古树下方100像素）
        const treePos = this.node.worldPosition.clone();
        const spawnPos = new Vec3(treePos.x, treePos.y - this.spawnOffset, treePos.z);

        // 创建Tower
        const tower = instantiate(this.towerPrefab);
        tower.setParent(this.towerContainer);
        tower.setWorldPosition(spawnPos);
        tower.active = true;

        // 设置Tower的建造成本（如果需要）
        const towerScript = tower.getComponent('Tower') as any;
        if (towerScript) {
            towerScript.buildCost = 0; // 由战争古树生产的Tower建造成本为0
        }

        this.producedTowerCount++;
        console.log(`WarAncientTree: Produced tower ${this.producedTowerCount}/${this.maxTowerCount} at position (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)})`);
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;

        // 显示伤害数字
        if (this.damageNumberPrefab) {
            const damageNode = instantiate(this.damageNumberPrefab);
            const canvas = find('Canvas');
            if (canvas) {
                damageNode.setParent(canvas);
            } else if (this.node.scene) {
                damageNode.setParent(this.node.scene);
            }
            damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 50, 0));
            const damageScript = damageNode.getComponent(DamageNumber);
            if (damageScript) {
                damageScript.setDamage(damage);
            }
        }

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.die();
        }
    }

    die() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

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

        // 销毁节点
        this.node.destroy();
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }
}

