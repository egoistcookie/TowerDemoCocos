import { _decorator, Component, Node, tween, Vec3, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ExplosionEffect')
export class ExplosionEffect extends Component {
    @property
    duration: number = 0.5;

    @property
    maxScale: number = 2.0;

    onLoad() {
        // 在onLoad中立即设置缩放为0，确保在显示前就隐藏
        // 这样即使预制体在场景中，也不会显示在屏幕中央
        this.node.setScale(0, 0, 1);
        
        // 如果节点有Sprite组件，也可以设置透明度为0作为双重保险
        const sprite = this.node.getComponent(Sprite);
        if (sprite) {
            const color = sprite.color.clone();
            color.a = 0;
            sprite.color = color;
        }
    }

    start() {
        // 确保初始缩放为0（双重保险）
        this.node.setScale(0, 0, 1);
        
        // 如果节点有Sprite组件，恢复透明度
        const sprite = this.node.getComponent(Sprite);
        if (sprite) {
            const color = sprite.color.clone();
            color.a = 255;
            sprite.color = color;
        }
        
        // 缩放动画
        tween(this.node)
            .to(this.duration, { 
                scale: new Vec3(this.maxScale, this.maxScale, 1)
            }, {
                easing: 'backOut'
            })
            .call(() => {
                // 淡出
                const spriteComp = this.node.getComponent(Sprite);
                if (spriteComp) {
                    tween(this.node)
                        .to(0.3, {}, {
                            onUpdate: (target, ratio) => {
                                if (spriteComp && this.node && this.node.isValid) {
                                    const color = spriteComp.color.clone();
                                    color.a = 255 * (1 - ratio);
                                    spriteComp.color = color;
                                }
                            }
                        })
                        .call(() => {
                            if (this.node && this.node.isValid) {
                                this.node.destroy();
                            }
                        })
                        .start();
                } else {
                    // 如果没有Sprite组件，直接销毁
                    this.scheduleOnce(() => {
                        if (this.node && this.node.isValid) {
                            this.node.destroy();
                        }
                    }, 0.3);
                }
            })
            .start();
    }
}

