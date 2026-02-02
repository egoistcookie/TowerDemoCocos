import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Graphics, Color, tween } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 绿色法球爆炸特效类
 * - 支持贴图动画
 * - 没有配置贴图时使用Graphics绘制圆形作为原始特效
 * - 参考 FireballExplosionEffect 的实现
 */
@ccclass('GreenOrbExplosionEffect')
export class GreenOrbExplosionEffect extends Component {
    @property({ type: SpriteFrame })
    explosionFrames: SpriteFrame[] = []; // 爆炸动画帧

    @property
    explosionDuration: number = 0.5; // 爆炸动画总时长

    @property
    radius: number = 15; // 原始特效的半径（直径30）

    private sprite: Sprite = null!;
    private graphics: Graphics = null!;
    private animationTimer: number = 0;
    private currentFrameIndex: number = -1;
    private isPlaying: boolean = false;
    private useSpriteAnimation: boolean = false; // 是否使用贴图动画

    /**
     * 初始化爆炸特效
     */
    init() {
        // 检查是否有配置贴图动画帧
        if (this.explosionFrames && this.explosionFrames.length > 0) {
            // 使用贴图动画
            this.useSpriteAnimation = true;
            this.initSpriteAnimation();
        } else {
            // 使用原始特效（Graphics绘制圆形）
            this.useSpriteAnimation = false;
            this.initGraphicsEffect();
        }
    }

    /**
     * 初始化贴图动画
     */
    private initSpriteAnimation() {
        // 添加 Sprite 组件
        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            this.sprite = this.node.addComponent(Sprite);
        }

        // 添加 UITransform 组件（如果没有）
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
            uiTransform.setContentSize(60, 60); // 设置爆炸特效大小
        }

        // 初始化动画状态
        this.animationTimer = 0;
        this.currentFrameIndex = -1;
        this.isPlaying = true;

        // 立即播放第一帧
        if (this.explosionFrames.length > 0 && this.explosionFrames[0]) {
            this.sprite.spriteFrame = this.explosionFrames[0];
            this.currentFrameIndex = 0;
        }
    }

    /**
     * 初始化原始特效（Graphics绘制圆形）
     */
    private initGraphicsEffect() {
        // 添加 Graphics 组件
        this.graphics = this.node.getComponent(Graphics);
        if (!this.graphics) {
            this.graphics = this.node.addComponent(Graphics);
        }

        // 添加 UITransform 组件（如果没有）
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
            uiTransform.setContentSize(this.radius * 2, this.radius * 2);
        }

        // 初始化动画状态
        this.animationTimer = 0;
        this.isPlaying = true;

        // 绘制初始圆形（从小到大，带透明度变化）
        this.drawCircle(0);
    }

    /**
     * 绘制圆形特效（绿色主题）
     * @param progress 进度值（0-1）
     */
    private drawCircle(progress: number) {
        if (!this.graphics) {
            return;
        }

        this.graphics.clear();

        // 根据进度计算大小和透明度
        const currentRadius = this.radius * (0.3 + progress * 0.7); // 从30%大小到100%大小
        const alpha = Math.floor(255 * (1 - progress)); // 从完全不透明到完全透明

        // 绘制填充圆形（绿色主题）
        this.graphics.fillColor = new Color(0, 255, 100, alpha); // 绿色
        this.graphics.circle(0, 0, currentRadius);
        this.graphics.fill();

        // 绘制边框（亮绿色边框）
        this.graphics.strokeColor = new Color(100, 255, 150, alpha); // 亮绿色边框
        this.graphics.lineWidth = 2;
        this.graphics.circle(0, 0, currentRadius);
        this.graphics.stroke();
    }

    update(deltaTime: number) {
        if (!this.isPlaying) {
            return;
        }

        this.animationTimer += deltaTime;

        if (this.useSpriteAnimation) {
            // 使用贴图动画
            this.updateSpriteAnimation();
        } else {
            // 使用原始特效
            this.updateGraphicsEffect();
        }
    }

    /**
     * 更新贴图动画
     */
    private updateSpriteAnimation() {
        if (!this.sprite) {
            return;
        }

        // 计算当前应该播放的帧索引
        if (this.explosionFrames.length > 0 && this.explosionDuration > 0) {
            const totalFrames = this.explosionFrames.length;
            const frameTime = this.explosionDuration / totalFrames;
            const frameIndex = Math.floor(this.animationTimer / frameTime);

            // 如果帧索引发生变化，更新贴图
            if (frameIndex !== this.currentFrameIndex && frameIndex < totalFrames) {
                this.currentFrameIndex = frameIndex;
                if (this.explosionFrames[frameIndex]) {
                    this.sprite.spriteFrame = this.explosionFrames[frameIndex];
                }
            }

            // 如果动画播放完成，销毁节点
            if (this.animationTimer >= this.explosionDuration) {
                this.isPlaying = false;
                this.scheduleOnce(() => {
                    if (this.node && this.node.isValid) {
                        this.node.destroy();
                    }
                }, 0);
            }
        } else {
            // 如果没有动画帧，直接销毁
            this.isPlaying = false;
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0);
        }
    }

    /**
     * 更新原始特效
     */
    private updateGraphicsEffect() {
        if (!this.graphics) {
            return;
        }

        // 计算进度（0-1）
        const progress = Math.min(this.animationTimer / this.explosionDuration, 1);

        // 绘制当前帧的圆形
        this.drawCircle(progress);

        // 如果动画播放完成，销毁节点
        if (this.animationTimer >= this.explosionDuration) {
            this.isPlaying = false;
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0);
        }
    }
}
