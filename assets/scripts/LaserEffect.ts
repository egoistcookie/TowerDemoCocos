import { _decorator, Component, Node, Vec3, Graphics, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LaserEffect')
export class LaserEffect extends Component {
    @property
    duration: number = 0.2;

    @property
    lineWidth: number = 3;

    @property
    color: string = '#ff0000';

    private graphics: Graphics = null!;

    start() {
        this.graphics = this.node.getComponent(Graphics);
        if (!this.graphics) {
            this.graphics = this.node.addComponent(Graphics);
        }
    }

    drawLaser(from: Vec3, to: Vec3) {
        if (!this.graphics) {
            return;
        }

        this.graphics.clear();
        this.graphics.strokeColor = this.graphics.strokeColor.fromHEX(this.color);
        this.graphics.lineWidth = this.lineWidth;
        
        // 转换为本地坐标
        const localFrom = new Vec3();
        const localTo = new Vec3();
        Vec3.subtract(localFrom, from, this.node.worldPosition);
        Vec3.subtract(localTo, to, this.node.worldPosition);
        
        this.graphics.moveTo(localFrom.x, localFrom.y);
        this.graphics.lineTo(localTo.x, localTo.y);
        this.graphics.stroke();

        // 延迟销毁
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, this.duration);
    }
}

