import { _decorator, Component, Node, Graphics, UITransform, Color, Label, LabelOutline } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HealthBar')
export class HealthBar extends Component {
    @property
    barWidth: number = 40;

    @property
    barHeight: number = 4;

    @property
    offsetY: number = 30; // 血条在单位上方的偏移

    @property
    isBossBar: boolean = false; // 是否为 Boss 血条（用于美化）

    @property
    bossName: string = ""; // Boss 名称

    private graphics: Graphics = null!;
    private maxHealth: number = 100;
    private currentHealth: number = 100;
    private nameLabel: Label = null!;

    start() {
        // 添加 UITransform 组件
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            this.node.addComponent(UITransform);
        }

        // 添加 Graphics 组件
        this.graphics = this.node.getComponent(Graphics);
        if (!this.graphics) {
            this.graphics = this.node.addComponent(Graphics);
        }

        // 如果是 Boss 血条，创建名称标签
        if (this.isBossBar) {
            this.createNameLabel();
        }

        // 设置节点大小
        if (uiTransform) {
            uiTransform.setContentSize(this.barWidth + 4, this.barHeight + 4);
        }
    }

    /**
     * 创建 Boss 名称标签（带黑边）
     */
    private createNameLabel() {
        // 查找是否已有名称标签节点
        const labelNode = this.node.getChildByName('NameLabel');
        if (labelNode) {
            this.nameLabel = labelNode.getComponent(Label);
            if (this.nameLabel) {
                this.nameLabel.string = this.bossName;
                // 确保有 LabelOutline
                if (!labelNode.getComponent(LabelOutline)) {
                    const outline = labelNode.addComponent(LabelOutline);
                    outline.color = new Color(0, 0, 0, 255);
                    outline.width = 3;
                }
                return;
            }
        }

        // 创建名称标签节点
        const labelNodeNew = new Node('NameLabel');
        labelNodeNew.setParent(this.node);

        // 添加 Label 组件
        this.nameLabel = labelNodeNew.addComponent(Label);
        this.nameLabel.string = this.bossName;
        this.nameLabel.fontSize = 16;
        this.nameLabel.color = new Color(255, 220, 100, 255); // 金黄色

        // 添加 LabelOutline 组件（黑边）
        const labelOutline = labelNodeNew.addComponent(LabelOutline);
        labelOutline.color = new Color(0, 0, 0, 255); // 黑色
        labelOutline.width = 3; // 边框宽度

        // 添加 UITransform
        const labelUITransform = labelNodeNew.addComponent(UITransform);
        labelUITransform.setContentSize(120, 24);

        // 设置位置：血条左侧，靠近血条一些
        labelNodeNew.setPosition(-this.barWidth / 2 - 55, 0, 0);
    }

    setMaxHealth(maxHealth: number) {
        this.maxHealth = maxHealth;
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
        const barY = -this.barHeight / 2;

        if (this.isBossBar) {
            const cornerRadius = 4; // 血条圆角半径

            // 1. 绘制背景（深红色）- 圆角矩形
            this.graphics.fillColor = new Color(80, 20, 20, 255);
            this.drawRoundedRect(barX, barY, this.barWidth, this.barHeight, cornerRadius);
            this.graphics.fill();

            // 2. 绘制血量（根据百分比变色）- 圆角矩形
            if (healthPercent > 0) {
                const fillColor = this.getHealthColor(healthPercent);
                this.graphics.fillColor = fillColor;
                const bloodWidth = this.barWidth * healthPercent;
                // 血量条右端圆角：满血时与血条一致，否则小圆角
                const rightCorner = healthPercent >= 0.95 ? cornerRadius : 2;
                this.drawRoundedRect(barX, barY, bloodWidth, this.barHeight, rightCorner);
                this.graphics.fill();
            }

            // 3. 绘制外边框（深色）- 圆角矩形描边
            this.graphics.strokeColor = new Color(40, 40, 40, 255);
            this.graphics.lineWidth = 3;
            this.drawRoundedRectStroke(barX, barY, this.barWidth, this.barHeight, cornerRadius);
            this.graphics.stroke();

        } else {
            // 普通血条：保持原有样式
            // 绘制黑色边框
            this.graphics.strokeColor = Color.BLACK;
            this.graphics.lineWidth = 1.5;
            this.graphics.rect(barX - 1, barY - 1, this.barWidth + 2, this.barHeight + 2);
            this.graphics.stroke();

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
    }

    /**
     * 绘制圆角矩形填充（使用二次贝塞尔曲线）
     */
    private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
        const g = this.graphics;
        const r = Math.min(radius, height / 2, width / 2);

        g.moveTo(x + r, y);
        g.lineTo(x + width - r, y);
        // 右上角
        g.quadraticCurveTo(x + width, y, x + width, y + r);
        g.lineTo(x + width, y + height - r);
        // 右下角
        g.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        g.lineTo(x + r, y + height);
        // 左下角
        g.quadraticCurveTo(x, y + height, x, y + height - r);
        g.lineTo(x, y + r);
        // 左上角
        g.quadraticCurveTo(x, y, x + r, y);
        g.close();
    }

    /**
     * 绘制圆角矩形描边（使用二次贝塞尔曲线）
     */
    private drawRoundedRectStroke(x: number, y: number, width: number, height: number, radius: number) {
        const g = this.graphics;
        const r = Math.min(radius, height / 2, width / 2);

        g.moveTo(x + r, y);
        g.lineTo(x + width - r, y);
        // 右上角
        g.quadraticCurveTo(x + width, y, x + width, y + r);
        g.lineTo(x + width, y + height - r);
        // 右下角
        g.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        g.lineTo(x + r, y + height);
        // 左下角
        g.quadraticCurveTo(x, y + height, x, y + height - r);
        g.lineTo(x, y + r);
        // 左上角
        g.quadraticCurveTo(x, y, x + r, y);
        g.close();
    }

    /**
     * 根据血量百分比返回颜色（绿->黄->红）
     */
    private getHealthColor(healthPercent: number): Color {
        if (healthPercent >= 0.6) {
            // 60%-100%: 绿色
            return new Color(60, 220, 60, 255);
        } else if (healthPercent >= 0.3) {
            // 30%-60%: 黄色渐变
            const t = (healthPercent - 0.3) / 0.3;
            const r = Math.floor(255 - t * 105);
            const g = 220;
            const b = Math.floor(60 * (1 - t));
            return new Color(r, g, b, 255);
        } else {
            // 0%-30%: 红色
            const t = healthPercent / 0.3;
            const r = 255;
            const g = Math.floor(60 * t);
            const b = 60;
            return new Color(r, g, b, 255);
        }
    }

    /**
     * 设置 Boss 名称
     */
    setBossName(name: string) {
        this.bossName = name;
        if (this.nameLabel) {
            this.nameLabel.string = name;
        }
    }

    getOffsetY(): number {
        return this.offsetY;
    }
}
