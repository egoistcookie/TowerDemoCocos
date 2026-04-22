import { _decorator, Component, Node, Color, UITransform, Graphics, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 狙击手瞄准标记 - 显示在敌人头顶的红色准星
 */
@ccclass('SniperMark')
export class SniperMark extends Component {
    @property
    markSize: number = 40; // 准星大小

    @property
    pulseSpeed: number = 3; // 脉冲速度（每秒脉冲次数）

    @property
    pulseIntensity: number = 50; // 脉冲强度（颜色变化范围）

    private baseColor: Color = new Color(255, 0, 0, 200); // 基础红色
    private pulseTimer: number = 0;
    private parentEnemy: Node = null!;
    private graphics: Graphics = null!;

    start() {
        // 获取或创建 Graphics 组件
        this.graphics = this.node.getComponent(Graphics);
        if (!this.graphics) {
            this.graphics = this.node.addComponent(Graphics);
        }

        // 绘制准星（圆形加十字线）
        this.drawCrosshair();

        // 查找父节点（敌人）
        this.parentEnemy = this.node.parent;

        // 设置准星不受敌人翻转影响，始终正向显示
        this.updateOrientation();
    }

    /**
     * 更新准星方向，使其不受敌人翻转影响
     */
    private updateOrientation() {
        if (!this.parentEnemy || !this.parentEnemy.isValid) {
            return;
        }

        // 检查敌人的缩放方向
        const enemyScaleX = this.parentEnemy.scale.x;
        // 如果敌人翻转了，准星也需要翻转回来以保持正向
        if (enemyScaleX < 0) {
            this.node.setScale(-1, 1, 1);
        } else {
            this.node.setScale(1, 1, 1);
        }
    }

    /**
     * 绘制准星
     */
    private drawCrosshair() {
        const g = this.graphics;
        const size = this.markSize;
        const half = size / 2;

        g.clear();

        // 绘制外圆环（中心对齐）
        g.strokeColor = this.baseColor;
        g.lineWidth = 3;
        g.circle(0, 0, half - 4);
        g.stroke();

        // 绘制中心十字线（中心对齐）
        g.moveTo(-8, 0);
        g.lineTo(8, 0);
        g.moveTo(0, -8);
        g.lineTo(0, 8);
        g.stroke();

        // 绘制四个角标记（中心对齐）
        const cornerLen = 8;
        const margin = 4;
        // 左上
        g.moveTo(-half + margin, -half + cornerLen);
        g.lineTo(-half + margin, 0);
        g.lineTo(-half + margin + cornerLen, 0);
        // 右上
        g.lineTo(half - margin, 0);
        g.lineTo(half - margin, -half + cornerLen);
        // 右下
        g.lineTo(half - margin, half - cornerLen);
        g.lineTo(half - margin, 0);
        g.lineTo(half - margin - cornerLen, 0);
        // 左下
        g.lineTo(-half + margin + cornerLen, 0);
        g.lineTo(-half + margin, 0);
        g.lineTo(-half + margin, half - cornerLen);
        g.stroke();
    }

    update(deltaTime: number) {
        if (!this.parentEnemy || !this.parentEnemy.isValid) {
            return;
        }

        // 更新准星方向，使其不受敌人翻转影响
        this.updateOrientation();

        // 脉冲效果：改变颜色透明度
        this.pulseTimer += deltaTime * this.pulseSpeed * Math.PI * 2;
        const alphaOffset = Math.sin(this.pulseTimer) * this.pulseIntensity;

        const newAlpha = Math.max(100, Math.min(255, this.baseColor.a + alphaOffset));
        this.graphics.strokeColor = new Color(255, 0, 0, newAlpha);

        // 重新绘制准星
        this.drawCrosshair();
    }

    /**
     * 销毁准星标记
     */
    destroyMark() {
        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }
}
