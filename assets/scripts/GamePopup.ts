import { _decorator, Component, Node, Vec3, tween, UIOpacity, UITransform, Sprite, SpriteFrame, Label, Color, Graphics, Prefab, instantiate, find } from 'cc';
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
    
    start() {
        console.debug('GamePopup.start: Initializing');
        this.node.active = false; // 初始隐藏
        
        // 初始化所有必要的组件和节点
        this.initComponents();
        
        // 设置默认样式
        this.setDefaultStyle();
        
        // 确保内容容器初始隐藏
        if (this.content) {
            this.content.active = false;
        }
    }
    
    /**
     * 初始化所有必要的组件和节点
     */
    private initComponents() {
        console.debug('GamePopup.initComponents: Initializing components');
        
        // 查找或创建Content节点
        this.content = this.node.getChildByName('Content');
        if (!this.content) {
            console.debug('GamePopup.initComponents: Creating Content node');
            this.content = new Node('Content');
            this.content.setParent(this.node);
            this.content.setPosition(0, 0, 0);
            const contentTransform = this.content.addComponent(UITransform);
            contentTransform.setContentSize(400, 200);
        }
        
        // 查找或创建Background节点
        let bgNode = this.content.getChildByName('Background');
        if (!bgNode) {
            console.debug('GamePopup.initComponents: Creating Background node');
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
            console.debug('GamePopup.initComponents: Creating MessageLabel node');
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
        
        console.debug('GamePopup.initComponents: Components initialized successfully');
        console.debug('GamePopup.initComponents: content:', this.content);
        console.debug('GamePopup.initComponents: messageLabel:', this.messageLabel);
        console.debug('GamePopup.initComponents: background:', this.background);
        console.debug('GamePopup.initComponents: backgroundGraphics:', this.backgroundGraphics);
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
        console.debug('GamePopup.show: Showing message:', message);
        
        // 详细日志
        console.debug('GamePopup.show: this:', this);
        console.debug('GamePopup.show: this.node:', this.node);
        console.debug('GamePopup.show: this.content:', this.content);
        
        // 检查必要的属性是否存在
        if (!this.node) {
            console.error('GamePopup.show: this.node is undefined!');
            return;
        }
        
        if (!this.content) {
            console.error('GamePopup.show: this.content is undefined!');
            // 尝试重新获取content
            this.content = this.node.getChildByName('Content');
            if (!this.content) {
                console.error('GamePopup.show: Failed to get content node!');
                return;
            } else {
                console.debug('GamePopup.show: Content node found after retry:', this.content);
            }
        }
        
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
            console.error('GamePopup.show: this.messageLabel is undefined!');
            // 尝试重新获取messageLabel
            const labelNode = this.content.getChildByName('MessageLabel');
            if (labelNode) {
                this.messageLabel = labelNode.getComponent(Label);
                if (this.messageLabel) {
                    this.messageLabel.string = message;
                    console.debug('GamePopup.show: MessageLabel found after retry:', this.messageLabel);
                    
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
        
        // 如果需要自动隐藏，启动计时器
        if (autoHide) {
            this.autoHideTimer = 0;
        }
    }
    
    /**
     * 隐藏弹窗
     */
    hide() {
        if (!this.isShowing) {
            return;
        }
        
        console.debug('GamePopup.hide: Hiding popup');
        
        // 检查必要的属性是否存在
        if (!this.node || !this.content) {
            console.error('GamePopup.hide: node or content is undefined!');
            this.isShowing = false;
            return;
        }
        
        // 动画隐藏
        const opacity = this.content.getComponent(UIOpacity);
        if (!opacity) {
            // 如果没有UIOpacity组件，直接隐藏
            this.node.active = false;
            this.content.active = false;
            this.isShowing = false;
            return;
        }
        
        tween(this.content)
            .to(0.2, { scale: new Vec3(0.8, 0.8, 1) }, { easing: 'backIn' })
            .start();
        
        tween(opacity)
            .to(0.2, { opacity: 0 }, { easing: 'backIn' })
            .call(() => {
                if (this.node && this.content) {
                    this.node.active = false;
                    this.content.active = false;
                    this.isShowing = false;
                }
            })
            .start();
    }
    
    /**
     * 设置背景贴图
     * @param spriteFrame 背景贴图
     */
    setBackgroundSprite(spriteFrame: SpriteFrame) {
        if (!this.background || !this.messageLabel) {
            console.error('GamePopup.setBackgroundSprite: background or messageLabel is undefined!');
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
            
            console.debug('GamePopup.ensureTextOnTop: Text node zIndex set above background, z position:', textNode.position.z);
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
        
        console.debug('GamePopup.adjustBackgroundSizeToText: Background size adjusted to text, new size:', newWidth, newHeight);
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
     * 创建并初始化GamePopup
     * @returns GamePopup实例
     */
    static createInstance(): GamePopup {
        console.debug('GamePopup.createInstance: Creating popup instance');
        
        // 查找Canvas
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('GamePopup.createInstance: Canvas not found!');
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
        
        console.debug('GamePopup.createInstance: Popup created, node:', popup.node, 'content:', popup.content);
        
        return popup;
    }
    
    /**
     * 显示简单消息弹窗（静态方法，方便调用）
     * @param message 消息内容
     * @param autoHide 是否自动隐藏
     * @param delay 自动隐藏延迟时间（秒）
     */
    static showMessage(message: string, autoHide: boolean = true, delay: number = 2.0) {
        console.debug('GamePopup.showMessage: Showing message:', message);
        
        // 查找现有的GamePopup实例
        let popupNode = find('Canvas/GamePopup');
        let popup: GamePopup;
        
        if (popupNode) {
            popup = popupNode.getComponent(GamePopup);
        } else {
            // 创建新实例
            popup = GamePopup.createInstance();
        }
        
        if (popup) {
            popup.show(message, autoHide, delay);
        } else {
            console.error('GamePopup.showMessage: Failed to create or find GamePopup instance!');
        }
    }
}
