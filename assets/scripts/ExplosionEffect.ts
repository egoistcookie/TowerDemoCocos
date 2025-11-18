import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ExplosionEffect')
export class ExplosionEffect extends Component {
    @property
    duration: number = 0.5;

    @property
    maxScale: number = 2.0;

    start() {
        // 缩放动画
        const originalScale = this.node.scale.clone();
        this.node.setScale(0.1, 0.1, 1);
        
        tween(this.node)
            .to(this.duration, { 
                scale: new Vec3(this.maxScale, this.maxScale, 1)
            }, {
                easing: 'backOut'
            })
            .call(() => {
                // 淡出
                tween(this.node)
                    .to(0.3, {}, {
                        onUpdate: (target, ratio) => {
                            // 可以通过修改透明度实现淡出
                        }
                    })
                    .call(() => {
                        if (this.node && this.node.isValid) {
                            this.node.destroy();
                        }
                    })
                    .start();
            })
            .start();
    }
}

