import { _decorator, Component, Node, Graphics, UITransform, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ManaBar')
export class ManaBar extends Component {
    @property
    barWidth: number = 40;
    
    @property
    barHeight: number = 4;
    
    @property
    offsetY: number = 20; // 蓝量条在血条下方的偏移

    private graphics: Graphics = null!;
    private maxMana: number = 100;
    private currentMana: number = 100;

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

    setMaxMana(maxMana: number) {
        this.maxMana = maxMana;
        this.currentMana = maxMana;
        this.updateBar();
    }

    setMana(currentMana: number) {
        this.currentMana = Math.max(0, Math.min(currentMana, this.maxMana));
        this.updateBar();
    }

    updateBar() {
        if (!this.graphics) {
            return;
        }

        this.graphics.clear();
        
        const manaPercent = this.maxMana > 0 ? this.currentMana / this.maxMana : 0;
        const barX = -this.barWidth / 2;
        const barY = 0;

        // 绘制黑色边框
        this.graphics.strokeColor = Color.BLACK;
        this.graphics.lineWidth = 1.5;
        this.graphics.rect(barX - 1, barY - 1, this.barWidth + 2, this.barHeight + 2);
        this.graphics.stroke();

        // 绘制背景（深蓝色）
        this.graphics.fillColor = new Color(20, 20, 60, 255);
        this.graphics.rect(barX, barY, this.barWidth, this.barHeight);
        this.graphics.fill();

        // 绘制蓝量（蓝色）
        if (manaPercent > 0) {
            this.graphics.fillColor = new Color(100, 150, 255, 255);
            this.graphics.rect(barX, barY, this.barWidth * manaPercent, this.barHeight);
            this.graphics.fill();
        }
    }

    getOffsetY(): number {
        return this.offsetY;
    }
}
