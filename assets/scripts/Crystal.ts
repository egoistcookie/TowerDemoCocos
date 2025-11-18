import { _decorator, Component, Node, EventTarget, instantiate } from 'cc';
const { ccclass, property } = _decorator;

const eventTarget = new EventTarget();

@ccclass('Crystal')
export class Crystal extends Component {
    @property
    maxHealth: number = 100;

    @property(Node)
    explosionEffect: Node = null!;

    private currentHealth: number = 100;
    private isDestroyed: boolean = false;

    start() {
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
    }

    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        this.currentHealth -= damage;
        
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.destroyCrystal();
        }
    }

    destroyCrystal() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        
        // 触发爆炸效果
        if (this.explosionEffect) {
            const explosion = instantiate(this.explosionEffect);
            explosion.setParent(this.node.parent);
            explosion.setWorldPosition(this.node.worldPosition);
            
            // 延迟销毁爆炸效果节点
            this.scheduleOnce(() => {
                if (explosion && explosion.isValid) {
                    explosion.destroy();
                }
            }, 1.0);
        }

        // 通知游戏管理器
        eventTarget.emit('crystal-destroyed');
        
        // 隐藏水晶
        this.node.active = false;
    }

    getHealth(): number {
        return this.currentHealth;
    }

    getMaxHealth(): number {
        return this.maxHealth;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    static getEventTarget(): EventTarget {
        return eventTarget;
    }
}

