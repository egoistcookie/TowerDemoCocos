import { _decorator, Component, Node, Label, Button, EventTouch, find, instantiate, Prefab, Vec3, Color, UIOpacity, Sprite, SpriteFrame, UITransform, Graphics, tween } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 倒计时弹窗组件
 * 用于第10波完成后显示1分钟倒计时
 * 支持手动关闭和自动关闭
 */
@ccclass('CountdownPopup')
export class CountdownPopup extends Component {
    @property(Label)
    countdownLabel: Label = null!;

    @property(Label)
    nextWaveLabel: Label = null!; // 显示"下一波敌人"的标签

    @property(Label)
    titleLabel: Label = null!;

    @property(Label)
    descriptionLabel: Label = null!;

    @property(Button)
    closeButton: Button = null!;

    private countdownTime: number = 60; // 倒计时时间（秒）
    private onCountdownComplete: (() => void) | null = null; // 倒计时完成回调
    private onManualClose: (() => void) | null = null; // 手动关闭回调
    private isCounting: boolean = false; // 是否正在倒计时
    private isShowingNextWaveText: boolean = false; // 是否正在显示"下一波敌人"文本
    private nextWaveTextTimer: number = 0; // 显示"下一波敌人"的计时器
    private arcBorderGraphics: any = null; // 圆弧边框的Graphics组件

    onLoad() {
        // 确保弹窗初始状态为隐藏
        this.node.active = false;
        
        // 自动创建必要的UI元素（如果没有在编辑器中配置）
        this.autoCreateUI();
    }

    start() {
        console.info('CountdownPopup: Start');
        // 绑定关闭按钮事件
        if (this.closeButton) {
            this.closeButton.node.on(Button.EventType.CLICK, this.onCloseButtonClick, this);
            console.info('CountdownPopup: Close button event bound');
        } else {
            console.warn('CountdownPopup: Close button is null!');
        }
    }
    
    /**
     * 自动创建必要的UI元素
     */
    private autoCreateUI() {
        console.info('CountdownPopup: Auto-creating UI elements');
        
        // 确保弹窗节点有UITransform组件
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
        }
        // 设置为圆形，宽高相等，缩小到原来的一半（75x75）
        const popupSize = 30;
        uiTransform.setContentSize(popupSize, popupSize);
        
        // 确保弹窗节点有UIOpacity组件，用于实现透明度动画
        let uiOpacity = this.node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = this.node.addComponent(UIOpacity);
            uiOpacity.opacity = 255;
        }
        
        // 移除可能存在的Sprite组件，改用Graphics绘制圆形背景
        const existingSprite = this.node.getComponent(Sprite);
        if (existingSprite) {
            this.node.removeComponent(Sprite);
        }
        
        // 使用Graphics组件绘制圆形背景
        let bgGraphics = this.node.getComponent(Graphics);
        if (!bgGraphics) {
            bgGraphics = this.node.addComponent(Graphics);
        }
        
        // 绘制半透明灰色圆形背景
        bgGraphics.clear();
        bgGraphics.fillColor = new Color(50, 50, 50, 150); // 半透明灰色
        const radius = popupSize / 2; // 半径为弹窗宽度的一半
        bgGraphics.circle(0, 0, radius);
        bgGraphics.fill();
        
        // 添加圆弧边框
        this.createArcBorder();
        
        // 添加点击事件，直接点击弹窗关闭
        this.node.on(Node.EventType.TOUCH_END, this.onPopupClick, this);
        
        // 如果没有nextWaveLabel，创建一个
        if (!this.nextWaveLabel) {
            const nextWaveNode = new Node('NextWaveLabel');
            nextWaveNode.setParent(this.node);
            nextWaveNode.setPosition(0, 0, 0);
            // 添加UITransform，调整大小以适应小弹窗
            const nextWaveUITransform = nextWaveNode.addComponent(UITransform);
            nextWaveUITransform.setContentSize(60, 30);
            // 添加Label，用于显示"下一波敌人"
            this.nextWaveLabel = nextWaveNode.addComponent(Label);
            this.nextWaveLabel.string = '下一波敌人';
            this.nextWaveLabel.fontSize = 24; // 适合小弹窗的字体大小
            this.nextWaveLabel.color = Color.YELLOW;
            this.nextWaveLabel.isBold = true;
            console.info('CountdownPopup: Created NextWaveLabel');
        }
        
        // 如果没有countdownLabel，创建一个
        if (!this.countdownLabel) {
            const countdownNode = new Node('CountdownLabel');
            countdownNode.setParent(this.node);
            countdownNode.setPosition(0, 0, 0);
            // 添加UITransform，调整大小以适应小弹窗
            const countdownUITransform = countdownNode.addComponent(UITransform);
            countdownUITransform.setContentSize(40, 20);
            // 添加Label，保持字体大小不变
            this.countdownLabel = countdownNode.addComponent(Label);
            this.countdownLabel.string = '60';
            this.countdownLabel.fontSize = 24; // 保持字体大小不变
            this.countdownLabel.color = Color.YELLOW;
            this.countdownLabel.isBold = true;
            console.info('CountdownPopup: Created CountdownLabel');
        }
        
        // 确保已经存在的countdownLabel字体大小不变
        if (this.countdownLabel) {
            this.countdownLabel.fontSize = 24; // 保持字体大小不变
        }
        
        // 隐藏标题、描述和关闭按钮
        if (this.titleLabel) {
            this.titleLabel.node.active = false;
        }
        if (this.descriptionLabel) {
            this.descriptionLabel.node.active = false;
        }
        if (this.closeButton) {
            this.closeButton.node.active = false;
        }
    }
    
    /**
     * 弹窗点击事件处理
     */
    private onPopupClick() {
        console.info('CountdownPopup: Popup clicked');
        this.isCounting = false;
        if (this.onManualClose) {
            this.onManualClose();
        } else {
            console.warn('CountdownPopup: onManualClose is null!');
        }
        this.hide();
    }
    
    /**
     * 创建圆弧边框
     */
    private createArcBorder() {
        console.info('CountdownPopup: Creating arc border');
        
        // 创建圆弧边框节点
        const arcNode = new Node('ArcBorder');
        arcNode.setParent(this.node);
        arcNode.setPosition(0, 0, 0);
        
        // 添加Graphics组件用于绘制圆弧
        const graphics = arcNode.addComponent(Graphics) as Graphics;
        graphics.lineWidth = 10;
        // 初始颜色为透明
        graphics.strokeColor = new Color(255, 0, 0, 0);
        
        // 保存graphics组件引用
        this.arcBorderGraphics = graphics;
        
        console.info('CountdownPopup: Arc border created');
    }
    
    /**
     * 更新圆弧边框
     * @param progress 进度值，0-1
     */
    private updateArcBorder(progress: number) {
        if (!this.arcBorderGraphics) {
            return;
        }
        
        // 清除之前的绘制
        this.arcBorderGraphics.clear();
        
        // 设置线宽
        this.arcBorderGraphics.lineWidth = 10;
        
        // 根据进度计算透明度和颜色
        // 初始透明，逐渐变为红色
        const alpha = Math.floor(progress * 255);
        this.arcBorderGraphics.strokeColor = new Color(255, 0, 0, alpha);
        
        // 获取当前弹窗大小，计算圆半径
        const uiTransform = this.node.getComponent(UITransform);
        const radius = uiTransform ? (uiTransform.width / 2) - 5 : 32.5; // 半径 = 弹窗宽度的一半 - 5
        const startAngle = -Math.PI / 2; // 顶部
        const endAngle = startAngle + (progress * Math.PI * 2); // 顺时针绘制
        
        this.arcBorderGraphics.arc(0, 0, radius, startAngle, endAngle);
        this.arcBorderGraphics.stroke();
    }

    /**
     * 显示倒计时弹窗
     * @param onComplete 倒计时完成回调
     * @param onManualClose 手动关闭回调
     */
    show(onComplete: () => void, onManualClose: () => void) {
        this.onCountdownComplete = onComplete;
        this.onManualClose = onManualClose;
        this.countdownTime = 60;
        
        // 初始状态：显示"下一波敌人"文本，不开始倒计时
        this.isCounting = false;
        this.isShowingNextWaveText = true;
        this.nextWaveTextTimer = 0;
        
        this.node.active = true;
        
        // 显示"下一波敌人"文本，隐藏倒计时
        if (this.nextWaveLabel) {
            this.nextWaveLabel.node.active = true;
        }
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
        }
        
        console.info('CountdownPopup: Popup shown, displaying "下一波敌人" text for 2 seconds');
    }

    /**
     * 隐藏倒计时弹窗，添加泡沫破碎消失效果
     */
    hide() {
        console.info('CountdownPopup: Showing bubble burst effect');
        
        this.isCounting = false;
        
        // 获取UIOpacity组件
        const uiOpacity = this.node.getComponent(UIOpacity);
        
        // 使用tween创建泡沫破碎消失效果
        // 1. 先放大一点
        // 2. 然后缩小并旋转
        // 3. 同时降低透明度
        tween(this.node)
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) }) // 稍微放大
            .to(0.3, {
                scale: new Vec3(0.1, 0.1, 1), // 缩小
                angle: 360 // 旋转360度（使用angle属性，单位为度）
            }, { easing: 'bounceOut' })
            .parallel(
                // 同时降低透明度
                tween(uiOpacity)
                    .to(0.3, { opacity: 0 })
            )
            .call(() => {
                // 动画完成后，重置状态并隐藏节点
                this.node.active = false;
                this.node.setScale(1, 1, 1);
                this.node.angle = 0; // 重置旋转角度为0度
                if (uiOpacity) {
                    uiOpacity.opacity = 255;
                }
                this.onCountdownComplete = null;
                this.onManualClose = null;
                console.info('CountdownPopup: Popup hidden');
            })
            .start();
    }

    /**
     * 更新倒计时标签
     */
    private updateCountdownLabel() {
        if (this.countdownLabel) {
            // 只显示秒数，不需要显示分钟
            const seconds = Math.ceil(this.countdownTime); // 使用ceil确保显示的是剩余秒数
            const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
            this.countdownLabel.string = secondsStr;
        } else {
            console.warn('CountdownPopup: CountdownLabel is null!');
        }
    }

    /**
     * 关闭按钮点击事件
     */
    private onCloseButtonClick() {
        console.info('CountdownPopup: Close button clicked');
        this.isCounting = false;
        if (this.onManualClose) {
            this.onManualClose();
        } else {
            console.warn('CountdownPopup: onManualClose is null!');
        }
        this.hide();
    }

    update(deltaTime: number) {
        // 如果正在显示"下一波敌人"文本
        if (this.isShowingNextWaveText) {
            this.nextWaveTextTimer += deltaTime;
            
            // 显示5秒后，切换到倒计时
            if (this.nextWaveTextTimer >= 5) {
                console.info('CountdownPopup: Switching from "下一波敌人" text to countdown');
                
                // 隐藏"下一波敌人"文本，显示倒计时
                if (this.nextWaveLabel) {
                    this.nextWaveLabel.node.active = false;
                }
                if (this.countdownLabel) {
                    this.countdownLabel.node.active = true;
                }
                
                // 开始倒计时
                this.isShowingNextWaveText = false;
                this.isCounting = true;
                this.updateCountdownLabel();
            }
            return;
        }
        
        // 如果正在倒计时
        if (this.isCounting) {
            this.countdownTime -= deltaTime;

            // 计算进度（0-1），0表示开始，1表示结束
            const progress = 1 - (this.countdownTime / 60);
            
            // 更新倒计时标签
            this.updateCountdownLabel();
            
            // 更新圆弧边框
            this.updateArcBorder(progress);

            if (this.countdownTime <= 0) {
                this.countdownTime = 0;
                this.isCounting = false;
                
                // 倒计时结束，边框变为完全红色
                this.updateArcBorder(1);
                
                console.info('CountdownPopup: Countdown completed');
                if (this.onCountdownComplete) {
                    this.onCountdownComplete();
                } else {
                    console.warn('CountdownPopup: onCountdownComplete is null!');
                }
                this.hide();
            }
        }
    }
}
