import { _decorator, Component, Node, Vec3, tween, UIOpacity, UITransform, Sprite, SpriteFrame, Label, Color, Graphics, Prefab, instantiate, find, view, EventTouch, BlockInputEvents, director } from 'cc';
import { GameManager } from './GameManager';
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

            // 设置 Label 的 overflow 为 RESIZE_HEIGHT，确保能正确计算文本高度
            this.messageLabel.overflow = Label.Overflow.RESIZE_HEIGHT;

            // 强制更新文本布局，确保文本大小被正确计算
            const textNode = this.messageLabel.node;
            // 先显示节点，确保文本渲染
            textNode.active = true;
            this.content.active = true;
            this.node.active = true;

            // 等待一帧，让文本渲染完成
            setTimeout(() => {
                // 再次确保获取最新的文本尺寸
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
        // 注意：第一次显示时，文本可能还没有完全渲染，需要验证尺寸是否有效
        let textWidth = textTransform.width;
        let textHeight = textTransform.height;

        // 如果文本尺寸为 0 或无效值，使用默认最小尺寸
        if (textWidth <= 0 || !isFinite(textWidth)) {
            textWidth = 100;
        }
        if (textHeight <= 0 || !isFinite(textHeight)) {
            textHeight = 30;
        }

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

            // 使用 BlockInputEvents 阻止所有输入事件穿透
            this.maskLayer.addComponent(BlockInputEvents);

            // 点击遮罩任意位置立即关闭提示框
            this.maskLayer.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                this.hide();
            }, this);
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

    /**
     * 显示狙击技能目标选择提示框
     * @param options 配置选项
     * @param options.unitIcon 单位图标 SpriteFrame
     * @param options.unitName 单位名称
     * @param options.unitDescription 单位描述
     * @param options.availableEnemyTypes 可选的敌人类型列表
     * @param options.currentPriorityType 当前已选择的优先攻击目标类型
     * @param options.allowMaskClose 是否允许点击遮罩层关闭（默认 true）
     * @param callback 回调函数，参数为选择的类型（null 表示清除选择）
     */
    static showSnipeTargetSelection(
        options: {
            unitIcon: SpriteFrame | null,
            unitName: string,
            unitDescription: string,
            availableEnemyTypes: string[],
            currentPriorityType: string | null,
            allowMaskClose?: boolean
        },
        callback: (selectedType: string | null) => void
    ) {
        const canvas = find('Canvas');
        if (!canvas) {
            console.error('[GamePopup] Canvas not found');
            return;
        }

        // 获取屏幕尺寸
        const canvasTransform = canvas.getComponent(UITransform);
        const screenWidth = canvasTransform?.width || 750;
        const screenHeight = canvasTransform?.height || 1334;

        // 设置弹窗尺寸（与 UnitIntroPopup 一致）
        const popupHeight = screenHeight / 3;
        const popupWidth = screenWidth - 100;

        // 创建弹窗主节点
        const popupNode = new Node('SnipeTargetPopup');
        popupNode.setParent(canvas);
        popupNode.setPosition(0, 0, 0);

        // 设置弹窗尺寸和锚点
        const uiTransform = popupNode.addComponent(UITransform);
        uiTransform.setContentSize(popupWidth, popupHeight);
        uiTransform.setAnchorPoint(0.5, 0.5); // 锚点设为中心，这样位置 (0,0) 就在屏幕中心

        // 添加 UIOpacity 组件（用于淡入动画）
        const uiOpacity = popupNode.addComponent(UIOpacity);
        uiOpacity.opacity = 0;

        // 添加背景 Graphics
        const bgGraphics = popupNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(0, 0, 0, 200);
        bgGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 15);
        bgGraphics.fill();

        // 添加高亮边框
        bgGraphics.strokeColor = new Color(100, 200, 255, 255);
        bgGraphics.lineWidth = 3;
        bgGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 15);
        bgGraphics.stroke();

        console.log('[GamePopup] 创建狙击目标选择弹窗');

        // 计算左右区域的宽度
        const halfWidth = popupWidth / 2;

        // === 左侧：单位图标区域 ===
        const iconNode = new Node('UnitIcon');
        iconNode.setParent(popupNode);
        iconNode.setPosition(-halfWidth / 2, 0, 0);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(halfWidth * 0.8, popupHeight * 0.8);

        if (options.unitIcon) {
            const iconSprite = iconNode.addComponent(Sprite);
            iconSprite.spriteFrame = options.unitIcon;
            iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }

        // === 右侧：内容区域 ===
        const contentNode = new Node('Content');
        contentNode.setParent(popupNode);
        contentNode.setPosition(halfWidth / 2, 0, 0);
        const contentTransform = contentNode.addComponent(UITransform);
        contentTransform.setContentSize(halfWidth, popupHeight);

        // 标题
        const titleNode = new Node('Title');
        titleNode.setParent(contentNode);
        titleNode.setPosition(0, popupHeight / 2 - 40, 0);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '角鹰射手';
        titleLabel.fontSize = 32;
        titleLabel.color = new Color(255, 255, 255, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        // 描述文本
        const descNode = new Node('Description');
        descNode.setParent(contentNode);
        descNode.setPosition(0, popupHeight * 0.25 - 30, 0);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = options.unitDescription;
        descLabel.fontSize = 24;
        descLabel.color = new Color(255, 255, 255, 255);
        descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        descLabel.verticalAlign = Label.VerticalAlign.TOP;
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(halfWidth * 0.9, popupHeight * 0.2);

        console.log('[GamePopup] 描述文本内容:', options.unitDescription);
        console.log('[GamePopup] 描述文本位置:', descNode.position);
        console.log('[GamePopup] 弹窗尺寸:', popupWidth, popupHeight);

        // === 敌人类型按钮容器（在描述文字下方） ===
        // 按钮容器位于右侧内容区域，y 坐标为负值表示在内容区域下方
        const buttonContainer = new Node('ButtonContainer');
        buttonContainer.setParent(contentNode);
        buttonContainer.setPosition(0, 0, 0);
        const buttonContainerTransform = buttonContainer.addComponent(UITransform);
        buttonContainerTransform.setContentSize(halfWidth, popupHeight * 0.35);

        // 创建敌人类型按钮
        const enemyTypes = options.availableEnemyTypes;
        const unitNames = GamePopup.getUnitTypeNameMap();
        const cols = 3; // 每排 3 个按钮
        const rows = Math.ceil(enemyTypes.length / cols);
        const buttonWidth = 80;
        const buttonHeight = 36;
        const horizontalSpacing = 15;
        const verticalSpacing = 12;
        const startX = -((cols * buttonWidth + (cols - 1) * horizontalSpacing) / 2) + buttonWidth / 2;
        const startY = -((rows - 1) * (buttonHeight + verticalSpacing)) / 2;

        console.log('[GamePopup] 按钮容器位置:', buttonContainer.position);
        console.log('[GamePopup] 按钮数量:', enemyTypes.length, '行列数:', rows, 'x', cols);
        console.log('[GamePopup] 按钮尺寸:', buttonWidth, 'x', buttonHeight);

        enemyTypes.forEach((enemyType, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (buttonWidth + horizontalSpacing);
            const y = startY - row * (buttonHeight + verticalSpacing);

            const btnNode = new Node('Btn_' + enemyType);
            btnNode.setParent(buttonContainer);
            btnNode.setPosition(x, y, 0);
            const btnTransform = btnNode.addComponent(UITransform);
            btnTransform.setContentSize(buttonWidth, buttonHeight);

            // 按钮背景（圆角矩形）
            const btnBgGraphics = btnNode.addComponent(Graphics);
            btnBgGraphics.fillColor = new Color(50, 50, 50, 200);
            btnBgGraphics.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
            btnBgGraphics.fill();

            // 按钮边框
            btnBgGraphics.strokeColor = new Color(100, 200, 255, 255);
            btnBgGraphics.lineWidth = 2;
            btnBgGraphics.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
            btnBgGraphics.stroke();

            // 选中的高亮
            if (options.currentPriorityType === enemyType) {
                const highlightGraphics = btnNode.addComponent(Graphics);
                highlightGraphics.fillColor = new Color(255, 200, 0, 100);
                highlightGraphics.roundRect(-buttonWidth / 2 + 2, -buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4, 6);
                highlightGraphics.fill();
                highlightGraphics.strokeColor = new Color(255, 200, 0, 255);
                highlightGraphics.lineWidth = 2;
                highlightGraphics.roundRect(-buttonWidth / 2 + 2, -buttonHeight / 2 + 2, buttonWidth - 4, buttonHeight - 4, 6);
                highlightGraphics.stroke();
            }

            // 按钮文本（敌人类型名称）- 最后添加，确保在最上层
            const btnLabelNode = new Node('Label');
            btnLabelNode.setParent(btnNode);
            btnLabelNode.setPosition(0, 0, 1); // z 轴设为 1，确保在背景之上
            const btnLabel = btnLabelNode.addComponent(Label);
            btnLabel.string = unitNames[enemyType] || enemyType;
            btnLabel.fontSize = 16;
            btnLabel.color = new Color(255, 255, 255, 255);
            btnLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            btnLabel.verticalAlign = Label.VerticalAlign.CENTER;

            // 确保文本节点在子节点列表中处于最顶层
            btnLabelNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);

            console.log('[GamePopup] 创建按钮:', enemyType, '文本:', unitNames[enemyType], '位置:', x, y);

            // 触摸按下效果
            btnNode.on(Node.EventType.TOUCH_START, () => {
                const btnGraphics = btnNode.getComponent(Graphics);
                if (btnGraphics) {
                    btnGraphics.fillColor = new Color(80, 80, 80, 200);
                    btnGraphics.clear();
                    btnGraphics.fillColor = new Color(80, 80, 80, 200);
                    btnGraphics.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
                    btnGraphics.fill();
                    btnGraphics.strokeColor = new Color(150, 220, 255, 255);
                    btnGraphics.lineWidth = 2;
                    btnGraphics.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
                    btnGraphics.stroke();
                }
            });
        });

        // 清除选择按钮（与最后一排按钮保持 30 像素间隔）
        const clearBtnNode = new Node('ClearBtn');
        clearBtnNode.setParent(contentNode);
        // 计算最后一排按钮的底部位置，然后向下 30 像素
        const lastRowY = startY - (rows - 1) * (buttonHeight + verticalSpacing);
        const clearBtnY = lastRowY - buttonHeight / 2 - 30;
        clearBtnNode.setPosition(0, clearBtnY, 0);
        const clearBtnTransform = clearBtnNode.addComponent(UITransform);
        clearBtnTransform.setContentSize(160, 40);

        const clearBtnGraphics = clearBtnNode.addComponent(Graphics);
        clearBtnGraphics.fillColor = new Color(80, 80, 80, 200);
        clearBtnGraphics.roundRect(-80, -20, 160, 40, 8);
        clearBtnGraphics.fill();
        clearBtnGraphics.strokeColor = new Color(150, 150, 150, 255);
        clearBtnGraphics.lineWidth = 2;
        clearBtnGraphics.roundRect(-80, -20, 160, 40, 8);
        clearBtnGraphics.stroke();

        const clearBtnLabelNode = new Node('Label');
        clearBtnLabelNode.setParent(clearBtnNode);
        clearBtnLabelNode.setPosition(0, 0, 1);
        const clearBtnLabel = clearBtnLabelNode.addComponent(Label);
        clearBtnLabel.string = '清除优先目标';
        clearBtnLabel.fontSize = 18;
        clearBtnLabel.color = new Color(200, 200, 200, 255);
        clearBtnLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        clearBtnLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 确保文本节点在子节点列表中处于最顶层
        clearBtnLabelNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);

        // 创建遮罩层
        const maskLayer = new Node('SnipePopupMask');
        maskLayer.setParent(canvas);
        const maskTransform = maskLayer.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        maskTransform.setContentSize(visibleSize.width, visibleSize.height);
        maskLayer.setPosition(0, 0, 0);

        const maskGraphics = maskLayer.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 180);
        maskGraphics.rect(-visibleSize.width / 2, -visibleSize.height / 2, visibleSize.width, visibleSize.height);
        maskGraphics.fill();

        // 注意：不添加 BlockInputEvents 组件，因为它可能会影响渲染
        // 游戏已经暂停，输入事件本来就不会被处理

        // 设置层级：遮罩层在下，弹窗在上
        maskLayer.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
        popupNode.setSiblingIndex(Number.MAX_SAFE_INTEGER);

        console.log('[GamePopup] 遮罩层尺寸:', visibleSize.width, 'x', visibleSize.height);

        // 激活节点
        maskLayer.active = true;
        popupNode.active = true;

        console.log('[GamePopup] 弹窗位置:', popupNode.position);
        console.log('[GamePopup] 弹窗尺寸:', uiTransform.contentSize);
        console.log('[GamePopup] 弹窗锚点:', uiTransform.anchorPoint);
        console.log('[GamePopup] 弹窗父节点:', popupNode.parent?.name);
        console.log('[GamePopup] 弹窗 siblingIndex:', popupNode.getSiblingIndex());
        console.log('[GamePopup] 遮罩层 siblingIndex:', maskLayer.getSiblingIndex());

        // 暂停游戏（在显示弹窗之前立即暂停，确保输入被阻挡）
        // GameManager 在 Canvas 下，所以需要先获取 Canvas，再获取其子节点 GameManager
        const gameManagerNode = canvas.getChildByName('GameManager');
        const gameManager = gameManagerNode?.getComponent(GameManager);
        let gamePausedByPopup = false;
        if (gameManager) {
            gameManager.pauseGame();
            gamePausedByPopup = true;
            console.log('[GamePopup] 游戏已暂停');
        } else {
            // 尝试通过 director 获取
            console.log('[GamePopup] 未找到 GameManager，尝试直接暂停游戏时间');
            director.getScheduler().setTimeScale(0);
            gamePausedByPopup = true;
        }

        // 注意：不能使用 tween 动画，因为游戏已暂停（timeScale=0），动画不会播放
        // 直接设置不透明度为 255
        uiOpacity.opacity = 255;

        console.log('[GamePopup] 弹窗创建完成，opacity=', uiOpacity.opacity);
        console.log('[GamePopup] 弹窗是否激活:', popupNode.active);
        console.log('[GamePopup] 遮罩层是否激活:', maskLayer.active);

        // 定义关闭函数
        const closePopup = () => {
            console.log('[GamePopup] closePopup 被调用');
            // 恢复游戏
            if (gamePausedByPopup) {
                if (gameManager) {
                    gameManager.resumeGame();
                    console.log('[GamePopup] 游戏已恢复 (GameManager)');
                } else {
                    director.getScheduler().setTimeScale(1);
                    console.log('[GamePopup] 游戏已恢复 (director)');
                }
                gamePausedByPopup = false;
            }
            // 先销毁遮罩层，再销毁弹窗
            maskLayer.destroy();
            popupNode.destroy();
            console.log('[GamePopup] 遮罩层和弹窗已销毁');
        };

        // 绑定按钮点击事件
        buttonContainer.children.forEach((btnNode) => {
            btnNode.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true; // 阻止事件传播
                const enemyType = btnNode.name.replace('Btn_', '');
                console.log(`[GamePopup] 点击狙击目标按钮：${enemyType}, 当前选择：${options.currentPriorityType || '无'}`);
                callback(enemyType);
                closePopup();
            });
        });

        // 绑定清除选择按钮事件
        const clearBtnNode2 = contentNode.getChildByName('ClearBtn');
        if (clearBtnNode2) {
            clearBtnNode2.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true; // 阻止事件传播
                console.log(`[GamePopup] 点击清除狙击目标按钮`);
                callback(null);
                closePopup();
            });
        }

        // 绑定遮罩点击事件（仅在 allowMaskClose 为 true 时允许关闭）
        const allowMaskClose = options.allowMaskClose !== false; // 默认为 true
        if (allowMaskClose) {
            maskLayer.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true; // 阻止事件传播
                console.log(`[GamePopup] 点击遮罩层关闭`);
                callback(null);
                closePopup();
            });
        } else {
            console.log('[GamePopup] 禁用点击遮罩层关闭');
        }
    }

    private static getUnitTypeNameMap(): Record<string, string> {
        return {
            'Orc': '兽人',
            'OrcWarrior': '兽人战士',
            'OrcWarlord': '兽人督军',
            'TrollSpearman': '巨魔投矛手',
            'Dragon': '飞龙',
            'OrcShaman': '兽人萨满',
            'MinotaurWarrior': '牛头人领主'
        };
    }
}
