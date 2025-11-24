import { _decorator, Component, Node, Vec3, find, Prefab, instantiate } from 'cc';
import { GameManager } from './GameManager';
import { HealthBar } from './HealthBar';
import { DamageNumber } from './DamageNumber';
const { ccclass, property } = _decorator;

@ccclass('MoonWell')
export class MoonWell extends Component {
    @property
    maxHealth: number = 80; // 月亮井的血量

    @property(Prefab)
    explosionEffect: Prefab = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    @property
    buildCost: number = 10; // 建造成本

    @property
    populationIncrease: number = 10; // 增加的人口上限

    private currentHealth: number = 80;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private gameManager: GameManager = null!;
    private hasIncreasedPopulation: boolean = false; // 标记是否已经增加过人口上限

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.hasIncreasedPopulation = false;

        // 查找游戏管理器
        this.findGameManager();

        // 创建血条
        this.createHealthBar();

        // 注意：不在start()中自动增加人口上限
        // 只有在通过TowerBuilder.buildMoonWell()建造时才会调用increasePopulationLimit()来增加人口上限
        // 这样可以避免场景中预先放置的月亮井导致人口上限异常增加
    }

    /**
     * 手动调用此方法来增加人口上限（由TowerBuilder调用）
     */
    increasePopulationLimit() {
        if (this.hasIncreasedPopulation) {
            console.warn('MoonWell: Population limit already increased for this well.');
            return;
        }

        // 使用延迟确保 GameManager 已经初始化完成
        this.scheduleOnce(() => {
            if (!this.gameManager) {
                // 如果第一次没找到，再尝试一次
                this.findGameManager();
            }
            
            if (this.gameManager) {
                const currentMax = this.gameManager.getMaxPopulation();
                const newMax = currentMax + this.populationIncrease;
                this.gameManager.setMaxPopulation(newMax);
                this.hasIncreasedPopulation = true;
                console.log(`MoonWell: Increased max population by ${this.populationIncrease}, from ${currentMax} to ${newMax}`);
            } else {
                console.error('MoonWell: GameManager not found! Cannot increase population limit.');
            }
        }, 0.1);
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
            if (this.gameManager) {
                return;
            }
        }
        
        console.warn('MoonWell: GameManager not found!');
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

        // 被摧毁时减少人口上限（只有增加过人口上限的月亮井才减少）
        if (this.hasIncreasedPopulation && this.gameManager) {
            const currentMax = this.gameManager.getMaxPopulation();
            const newMax = Math.max(10, currentMax - this.populationIncrease); // 至少保持初始的10人口上限
            this.gameManager.setMaxPopulation(newMax);
            console.log(`MoonWell: Decreased max population by ${this.populationIncrease}, new max: ${newMax}`);
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

        // 销毁节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.5);
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    getMaxHealth(): number {
        return this.maxHealth;
    }
}

