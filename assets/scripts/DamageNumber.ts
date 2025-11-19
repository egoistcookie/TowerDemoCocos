import { _decorator, Component, Node, Label, tween, Vec3, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DamageNumber')
export class DamageNumber extends Component {
    @property
    duration: number = 1.0;
    
    @property
    moveDistance: number = 50;

    private label: Label = null!;

    start() {
        this.label = this.node.getComponent(Label);
        if (!this.label) {
            this.label = this.node.addComponent(Label);
        }
        
        // 设置初始位置
        const startPos = this.node.position.clone();
        const endPos = startPos.clone();
        endPos.y += this.moveDistance;

        // 向上移动并淡出
        tween(this.node)
            .to(this.duration, { 
                position: endPos
            }, {
                easing: 'sineOut'
            })
            .parallel(
                tween().to(this.duration, {}, {
                    onUpdate: (target, ratio) => {
                        if (this.label) {
                            const color = this.label.color.clone();
                            color.a = 255 * (1 - ratio);
                            this.label.color = color;
                        }
                    }
                })
            )
            .call(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            })
            .start();
    }

    setDamage(damage: number) {
        if (this.label) {
            this.label.string = `-${Math.floor(damage)}`;
            this.label.fontSize = 20;
            this.label.color = Color.WHITE;
        }
    }
}

