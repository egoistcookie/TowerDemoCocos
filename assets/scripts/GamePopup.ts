import { _decorator, Component, Node, Vec3, tween, UIOpacity, UITransform, Sprite, SpriteFrame, Label, Color, Graphics, Prefab, instantiate, find, view, EventTouch } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GamePopup')
export class GamePopup extends Component {
    private content: Node = null!; // 弹窗内容容器
    
    @property(SpriteFrame)
    private backgroundSprite: SpriteFrame = null!; // 背景SpriteFrame，用于支持背景贴图
    
    private background: Sprite = null!; // 背景Sprite组件
    private messageLabel: Label = null!; // 消息标签
    private backgroundGraphics: Graphics = null!; // 背景Graphics，用于纯色背景
    
    private isShowing: boolean = false;
    private autoHideTimer: number = 0;
    private autoHideDelay: number = 2.0; // 默认2秒后自动隐藏

    // 遮罩层节点，使弹窗始终处于最上层并遮挡其他元素
    private maskLayer: Node | null = null;
    
    start() {
        this.node.active = false; // 初始隐藏
        
        // 初始化所有必要的组件和节点
        this.initComponents();
        
        // 设置默认样式
        this.setDefaultStyle();
        
        // 确保内容容器初始隐藏
        if (this.content) {
            this.content.active = false;
        }

        // 确保初始时弹窗在最上层
        this.ensureOnTopWithMask(false);
    }
    
    /**
     * 初始化所有必要的组件和节点
     */
    private initComponents() {
        
        // 查找或创建Content节点
        this.content = this.node.getChildByName('Content');
        if (!this.content) {
            this.content = new Node('Content');
            this.content.setParent(this.node);
            this.content.setPosition(0, 0, 0);
            const contentTransform = this.content.addComponent(UITransform);
            contentTransform.setContentSize(400, 200);
        }
        
        // 查找或创建Background节点
        let bgNode = this.content.getChildByName('Background');
        if (!bgNode) {
            bgNode = new Node('Background');
            bgNode.setParent(this.content);
            bgNode.setPosition(0, 0, 0);
            const bgTransform = bgNode.addComponent(UITransform);
            bgTransform.setContentSize(400, 200);
        }
        
        // 初始化Background组件（如果用户在编辑器中设置了，则使用用户设置的，否则自动创建）
        if (!this.background) {
            this.background = bgNode.getComponent(Sprite);
            if (!this.background) {
                this.background = bgNode.addComponent(Sprite);
            }
        }
        
        // 如果用户在编辑器中设置了backgroundSprite，则应用到background组件
        if (this.backgroundSprite) {
            this.background.spriteFrame = this.backgroundSprite;
            this.background.enabled = true;
            // 隐藏背景Graphics
            if (this.backgroundGraphics) {
                this.backgroundGraphics.clear();
            }
        }
        
        // 初始化BackgroundGraphics组件
        this.backgroundGraphics = bgNode.getComponent(Graphics);
        if (!this.backgroundGraphics) {
            this.backgroundGraphics = bgNode.addComponent(Graphics);
        }
        
        // 查找或创建MessageLabel节点
        let labelNode = this.content.getChildByName('MessageLabel');
        if (!labelNode) {
            labelNode = new Node('MessageLabel');
            labelNode.setParent(this.content);
            labelNode.setPosition(0, 0, 0);
            const labelTransform = labelNode.addComponent(UITransform);
            labelTransform.setContentSize(380, 180);
        }
        
        // 初始化MessageLabel组件
        this.messageLabel = labelNode.getComponent(Label);
        if (!this.messageLabel) {
            this.messageLabel = labelNode.addComponent(Label);
            this.messageLabel.string = '';
            this.messageLabel.color = Color.WHITE;
            this.messageLabel.fontSize = 24;
            this.messageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.messageLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }
        
        // 确保文本在背景之上
        this.ensureTextOnTop();
        
    }
    
    /**
     * 设置默认样式
     */
    private setDefaultStyle() {
        // 设置节点大小
        const transform = this.node.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(400, 200);
        }
        
        // 设置背景
        if (this.backgroundGraphics) {
            this.backgroundGraphics.fillColor = new Color(0, 0, 0, 200);
            this.backgroundGraphics.roundRect(-200, -100, 400, 200, 10);
            this.backgroundGraphics.fill();
        }
        
        // 设置消息标签
        if (this.messageLabel) {
            this.messageLabel.color = Color.WHITE;
            this.messageLabel.fontSize = 24;
            this.messageLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.messageLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }
    }
    
    /**
     * 显示弹窗
     * @param message 消息内容
     * @param autoHide 是否自动隐藏
     * @param delay 自动隐藏延迟时间（秒）
     */
    show(message: string, autoHide: boolean = true, delay: number = 2.0) {
        
        // 详细日志
        
        // 检查必要的属性是否存在
        if (!this.node) {
            return;
        }
        
        if (!this.content) {
            // 尝试重新获取content
            this.content = this.node.getChildByName('Content');
            if (!this.content) {
                return;
            } else {
            }
        }
        
        // 在显示前，确保弹窗和遮罩层位于最上层
        this.ensureOnTopWithMask(true);

        // 设置消息
        if (this.messageLabel) {
            this.messageLabel.string = message;

            // 强制更新文本布局，确保文本大小被正确计算
            const textNode = this.messageLabel.node;
            // 先显示节点，确保文本渲染
            textNode.active = true;
            this.content.active = true;
            this.node.active = true;

            // 等待一帧，让文本渲染完成
            setTimeout(() => {
            this.adjustBackgroundSizeToText();
            }, 0);
        } else {
            // 尝试重新获取messageLabel
            const labelNode = this.content.getChildByName('MessageLabel');
            if (labelNode) {
                this.messageLabel = labelNode.getComponent(Label);
                if (this.messageLabel) {
                    this.messageLabel.string = message;

                    // 强制更新文本布局，确保文本大小被正确计算
                    // 先显示节点，确保文本渲染
                    labelNode.active = true;
                    this.content.active = true;
                    this.node.active = true;

                    // 等待一帧，让文本渲染完成
                    setTimeout(() => {
                    this.adjustBackgroundSizeToText();
                    }, 0);
                }
            }
        }
        
        // 确保文本在背景之上
        this.ensureTextOnTop();
        
        // 设置自动隐藏参数
        this.autoHideDelay = delay;
        this.autoHideTimer = 0;
        
        // 显示弹窗
        this.node.active = true;
        this.content.active = true;
        this.isShowing = true;
        
        // 动画显示
        this.content.setScale(0.8, 0.8, 1);
        
        // 获取或添加UIOpacity组件
        let opacity = this.content.getComponent(UIOpacity);
        if (!opacity) {
            opacity = this.content.addComponent(UIOpacity);
        }
        opacity.opacity = 0;
        
        // 执行动画
        tween(this.content)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
        
        tween(opacity)
            .to(0.2, { opacity: 255 }, { easing: 'backOut' })
            .start();
        
        // 如果需要自动隐藏，启动计时器；否则禁用自动隐藏
        if (autoHide) {
            this.autoHideTimer = 0;
        } else {
            this.autoHideTimer = -1;
        }
    }
    
    /**
     * 隐藏弹窗
     */
    hide() {
        if (!this.isShowing) {
            return;
        }
        
        
        // 检查必要的属性是否存在
        if (!this.node || !this.content) {
            this.isShowing = false;
            return;
        }
        
        // 无动画隐藏：立即关闭弹窗和遮罩
        const opacity = this.content.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
        }

        // 隐藏遮罩层
        if (this.maskLayer && this.maskLayer.isValid) {
            this.maskLayer.active = false;
        }

        this.node.active = false;
        this.content.active = false;
        this.isShowing = false;

        // 关闭后停止自动隐藏计时
        this.autoHideTimer = -1;
    }
    
    /**
     * 设置背景贴图
     * @param spriteFrame 背景贴图
     */
    setBackgroundSprite(spriteFrame: SpriteFrame) {
        if (!this.background || !this.messageLabel) {
            return;
        }
        
        // 设置背景贴图
        this.backgroundSprite = spriteFrame;
        this.background.spriteFrame = spriteFrame;
        this.background.enabled = true;
        
        // 隐藏背景Graphics
        if (this.backgroundGraphics) {
            this.backgroundGraphics.clear();
        }
        
        // 确保文本在背景之上
        this.ensureTextOnTop();
        
        // 适配背景贴图大小到文字
        this.adjustBackgroundSizeToText();
    }
    
    /**
     * 获取当前背景贴图
     * @returns 当前背景贴图，如果没有则返回null
     */
    getBackgroundSprite(): SpriteFrame | null {
        return this.backgroundSprite;
    }
    
    /**
     * 确保文本在背景之上
     */
    ensureTextOnTop() {
        if (this.messageLabel && this.background) {
            // 获取文本节点和背景节点
            const textNode = this.messageLabel.node;
            const bgNode = this.background.node;
            
            // 确保文本节点和背景节点在同一个父节点下
            if (textNode.parent !== bgNode.parent) {
                // 如果不在同一个父节点下，将文本节点移动到背景节点的父节点下
                textNode.setParent(bgNode.parent);
            }
            
            // 设置文本节点的zIndex高于背景节点
            textNode.setSiblingIndex(bgNode.getSiblingIndex() + 1);
            
            // 确保文本节点的位置在背景节点之上（z轴）
            textNode.setPosition(textNode.position.x, textNode.position.y, -1);
            bgNode.setPosition(bgNode.position.x, bgNode.position.y, 0);
            
        }
    }
    
    /**
     * 适配背景贴图大小到文字
     */
    adjustBackgroundSizeToText() {
        if (!this.messageLabel || !this.background) {
            return;
        }
        
        // 获取文本节点和背景节点
        const textNode = this.messageLabel.node;
        const bgNode = this.background.node;
        
        // 获取文本的UITransform组件
        const textTransform = textNode.getComponent(UITransform);
        if (!textTransform) {
            return;
        }
        
        // 获取背景节点的UITransform组件
        const bgTransform = bgNode.getComponent(UITransform);
        if (!bgTransform) {
            return;
        }
        
        // 获取背景Sprite组件
        const bgSprite = this.background;
        
        // 计算文本的实际大小
        const textWidth = textTransform.width;
        const textHeight = textTransform.height;
        
        // 添加一些边距
        const padding = 20;
        const newWidth = textWidth + padding * 2;
        const newHeight = textHeight + padding * 2;
        
        // 设置背景节点的大小
        bgTransform.setContentSize(newWidth, newHeight);
        
        // 设置背景Sprite的sizeMode为CUSTOM，确保它适配节点大小
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        
        // 更新整个弹窗的大小
        const popupTransform = this.node.getComponent(UITransform);
        if (popupTransform) {
            popupTransform.setContentSize(newWidth, newHeight);
        }
        
        // 更新内容容器的大小
        if (this.content) {
            const contentTransform = this.content.getComponent(UITransform);
            if (contentTransform) {
                contentTransform.setContentSize(newWidth, newHeight);
            }
        }
        
    }
    
    /**
     * 设置背景颜色
     * @param color 背景颜色
     */
    setBackgroundColor(color: Color) {
        if (this.backgroundGraphics) {
            this.backgroundGraphics.clear();
            this.backgroundGraphics.fillColor = color;
            this.backgroundGraphics.roundRect(-200, -100, 400, 200, 10);
            this.backgroundGraphics.fill();
        }
        if (this.background) {
            this.background.enabled = false;
        }
    }
    
    /**
     * 更新
     */
    update(deltaTime: number) {
        if (this.isShowing && this.autoHideTimer >= 0) {
            this.autoHideTimer += deltaTime;
            if (this.autoHideTimer >= this.autoHideDelay) {
                this.hide();
            }
        }
    }

    /**
     * 确保弹窗和遮罩层始终位于最上层，并根据需要创建遮罩
     * @param activateMask 是否激活遮罩层
     */
    private ensureOnTopWithMask(activateMask: boolean) {
        const canvas = find('Canvas');
        if (!canvas) {
            return;
        }

        // 创建或更新遮罩层（参考 UnitIntroPopup 的做法）
        if (!this.maskLayer || !this.maskLayer.isValid) {
            this.maskLayer = new Node('GamePopupMask');
            this.maskLayer.setParent(canvas);

            // 添加 UITransform 覆盖整个屏幕
            const uiTransform = this.maskLayer.addComponent(UITransform);
            const visibleSize = view.getVisibleSize();
            uiTransform.setContentSize(visibleSize.width * 2, visibleSize.height * 2);
            this.maskLayer.setPosition(0, 0, 0);

            // 半透明黑色遮罩
            const graphics = this.maskLayer.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 180);
            graphics.rect(-visibleSize.width, -visibleSize.height, visibleSize.width * 2, visibleSize.height * 2);
            graphics.fill();

            // 阻止触摸事件穿透（capture 模式）
            this.maskLayer.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
                event.propagationStopped = true;
            }, this, true);
            this.maskLayer.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
                event.propagationStopped = true;
            }, this, true);
            this.maskLayer.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                // 点击任意位置立即关闭提示框
                event.propagationStopped = true;
                this.hide();
            }, this, true);
            this.maskLayer.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => {
                event.propagationStopped = true;
            }, this, true);
        }

        // 遮罩层位于 Canvas 最上层（但低于弹窗自身）
        this.maskLayer.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        this.maskLayer.active = activateMask;

        // 弹窗节点位于所有 UI 之上
        this.node.setParent(canvas);
        this.node.setSiblingIndex(Number.MAX_SAFE_INTEGER);
    }
    
    /**
     * 创建并初始化GamePopup
     * @returns GamePopup实例
     */
    static createInstance(): GamePopup {
        
        // 查找Canvas
        const canvas = find('Canvas');
        if (!canvas) {
            return null;
        }
        
        // 创建节点
        const popupNode = new Node('GamePopup');
        
        // 设置父节点为Canvas
        popupNode.setParent(canvas);
        
        // 设置位置为屏幕中心
        popupNode.setPosition(0, 0, 0);
        
        // 添加UITransform
        const transform = popupNode.addComponent(UITransform);
        transform.setContentSize(400, 200);
        
        // 添加GamePopup组件
        const popup = popupNode.addComponent(GamePopup);
        
        // 立即初始化组件，不依赖start方法
        popup.initComponents();
        
        // 设置默认样式
        popup.setDefaultStyle();
        
        // 确保节点初始隐藏
        popupNode.active = false;
        
        
        return popup;
    }
    
    /**
     * 显示简单消息弹窗（静态方法，方便调用）
     * @param message 消息内容
     * @param autoHide 是否自动隐藏
     * @param delay 自动隐藏延迟时间（秒）
     */
    static showMessage(message: string, autoHide: boolean = true, delay: number = 2.0) {
        
        // 查找现有的GamePopup实例
        let popupNode = find('Canvas/GamePopup');
        let popup: GamePopup;
        
        if (popupNode) {
            popup = popupNode.getComponent(GamePopup);
            // 确保已完成初始化（避免依赖 start，第一次弹出时就能正确缩放）
            if (popup) {
                popup.initComponents();
                popup.setDefaultStyle();
            }
        } else {
            // 创建新实例
            popup = GamePopup.createInstance();
        }
        
        if (popup) {
            popup.show(message, autoHide, delay);
        } else {
        }
    }
}
