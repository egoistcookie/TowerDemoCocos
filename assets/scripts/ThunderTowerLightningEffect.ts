import { _decorator, Component, Node, Graphics, Color, Vec3, UITransform, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 雷塔顶部电光特效
 * 白金色折线绕顶端旋转的效果
 */
@ccclass('ThunderTowerLightningEffect')
export class ThunderTowerLightningEffect extends Component {
    private graphics: Graphics = null!;
    private effectNode: Node = null!;
    private animationTime: number = 0;
    private readonly animationSpeed: number = 2.0; // 旋转速度
    private readonly effectRadius: number = 15; // 特效半径（保持当前大小）
    private readonly lineCount: number = 3; // 折线数量

    onLoad() {
        // 创建特效节点
        this.effectNode = new Node('LightningEffect');
        this.effectNode.setParent(this.node);
        
        // 设置位置在塔顶（往上偏移一定距离）
        const towerHeight = 50; // 假设塔的高度约为50像素
        this.effectNode.setPosition(0, towerHeight, 0);
        
        // 添加UITransform
        const transform = this.effectNode.addComponent(UITransform);
        transform.setContentSize(this.effectRadius * 2, this.effectRadius * 2);
        
        // 添加Graphics组件
        this.graphics = this.effectNode.addComponent(Graphics);
    }

    update(deltaTime: number) {
        if (!this.graphics || !this.effectNode || !this.effectNode.isValid) {
            return;
        }

        // 更新动画时间
        this.animationTime += deltaTime * this.animationSpeed;

        // 清除之前的绘制
        this.graphics.clear();

        // 白金色：金色偏白
        const goldColor = new Color(255, 248, 220, 255);
        const brightGoldColor = new Color(255, 255, 200, 255);

        // 绘制多条绕顶端旋转的折线
        for (let i = 0; i < this.lineCount; i++) {
            // 每条线的颜色略有不同
            const colorLerp = i / (this.lineCount - 1);
            const currentColor = new Color();
            Color.lerp(currentColor, goldColor, brightGoldColor, colorLerp);
            this.graphics.strokeColor = currentColor;
            
            // 线条宽度略有变化
            this.graphics.lineWidth = 1 + (i % 2);

            // 计算折线的起点和终点（围绕中心旋转）
            const baseAngle = (i / this.lineCount) * Math.PI * 2;
            const rotationSpeed = 1.0 + i * 0.3; // 每条线旋转速度不同
            const currentAngle = baseAngle + this.animationTime * rotationSpeed;

            // 绘制一条缠绕的折线（从中心向外，然后绕圈）
            const segments = 6; // 折线的段数
            const startRadius = 3;
            const endRadius = this.effectRadius;

            // 起点在中心附近
            const startX = Math.cos(currentAngle) * startRadius;
            const startY = Math.sin(currentAngle) * startRadius;
            this.graphics.moveTo(startX, startY);

            // 绘制折线的各个段
            for (let j = 1; j <= segments; j++) {
                const t = j / segments;
                const radius = startRadius + (endRadius - startRadius) * t;
                
                // 添加旋转和波动效果
                const angle = currentAngle + t * Math.PI * 2 + Math.sin(this.animationTime * 2 + i) * 0.5;
                const offsetX = Math.cos(angle) * radius * (0.8 + Math.sin(this.animationTime * 3 + i) * 0.2);
                const offsetY = Math.sin(angle) * radius * (0.8 + Math.cos(this.animationTime * 3 + i) * 0.2);
                
                this.graphics.lineTo(offsetX, offsetY);
            }

            this.graphics.stroke();
        }
    }

    onDestroy() {
        if (this.effectNode && this.effectNode.isValid) {
            this.effectNode.destroy();
        }
    }
}
