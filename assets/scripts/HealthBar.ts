import { _decorator, Component, Node, Graphics, UITransform, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HealthBar')
export class HealthBar extends Component {
    @property
    barWidth: number = 40;
    
    @property
    barHeight: number = 4;
    
    @property
    offsetY: number = 30; // 血条在单位上方的偏移

    private graphics: Graphics = null!;
    private maxHealth: number = 100;
    private currentHealth: number = 100;

    start() {
        // 添加UITransform组件
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            this.node.addComponent(UITransform);
        }
        
        // 添加Graphics组件
        this.graphics = this.node.getComponent(Graphics);
        if (!this.graphics) {
            this.graphics = this.node.addComponent(Graphics);
        }
        
        // 设置节点大小
        if (uiTransform) {
            uiTransform.setContentSize(this.barWidth + 4, this.barHeight + 4);
        }
    }

    setMaxHealth(maxHealth: number) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.updateBar();
    }

    setHealth(currentHealth: number) {
        this.currentHealth = Math.max(0, Math.min(currentHealth, this.maxHealth));
        this.updateBar();
    }

    updateBar() {
        if (!this.graphics) {
            return;
        }

        this.graphics.clear();
        
        const healthPercent = this.maxHealth > 0 ? this.currentHealth / this.maxHealth : 0;
        const barX = -this.barWidth / 2;
        const barY = 0;

        // 绘制背景（红色）
        this.graphics.fillColor = Color.RED;
        this.graphics.rect(barX, barY, this.barWidth, this.barHeight);
        this.graphics.fill();

        // 绘制血量（绿色）
        if (healthPercent > 0) {
            this.graphics.fillColor = Color.GREEN;
            this.graphics.rect(barX, barY, this.barWidth * healthPercent, this.barHeight);
            this.graphics.fill();
        }
    }

    getOffsetY(): number {
        return this.offsetY;
    }
}

