import { _decorator, Component, Node, Sprite, Label, Button, find, UITransform, Vec3, tween, Color, UIOpacity, Graphics, view, SpriteFrame } from 'cc';
import { BuffManager } from './BuffManager';
const { ccclass, property } = _decorator;

/**
 * 增益卡片数据接口
 */
export interface BuffCardData {
    unitId: string;              // 单位ID
    unitName: string;            // 单位名称
    unitIcon: SpriteFrame | null; // 单位图标
    buffType: string;            // 增益类型（如：攻击力、攻击速度、生命值等）
    buffValue: number;           // 增益数值
    buffDescription: string;     // 增益描述
    rarity: 'R' | 'SR' | 'SSR' | 'UR'; // 卡片稀有度
}

@ccclass('BuffCardPopup')
export class BuffCardPopup extends Component {
    @property(Node)
    container: Node = null!;
    
    @property(Node)
    cardContainer: Node = null!; // 卡片容器（包含三张卡片）
    
    @property(Node)
    card1: Node = null!; // 第一张卡片
    @property(Node)
    card2: Node = null!; // 第二张卡片
    @property(Node)
    card3: Node = null!; // 第三张卡片
    
    // 每张卡片的子节点
    @property(Sprite)
    card1Icon: Sprite = null!;
    @property(Sprite)
    card1Name: Sprite = null!; // 改为 Sprite，用于显示单位图片
    @property(Label)
    card1Description: Label = null!;
    @property(Button)
    card1Button: Button = null!;
    
    @property(Sprite)
    card2Icon: Sprite = null!;
    @property(Sprite)
    card2Name: Sprite = null!; // 改为 Sprite，用于显示单位图片
    @property(Label)
    card2Description: Label = null!;
    @property(Button)
    card2Button: Button = null!;
    
    @property(Sprite)
    card3Icon: Sprite = null!;
    @property(Sprite)
    card3Name: Sprite = null!; // 改为 Sprite，用于显示单位图片
    @property(Label)
    card3Description: Label = null!;
    @property(Button)
    card3Button: Button = null!;
    
    private gameManager: any = null!; // GameManager引用
    private maskLayer: Node = null!; // 遮罩层节点
    private cardData: BuffCardData[] = []; // 卡片数据数组
    private isRerollMode: boolean = false; // 是否为再抽一次模式（必定有一张UR）
    private rerollButton: Button = null!; // 再抽一次按钮
    private getAllButton: Button = null!; // 全部获取按钮
    private rerollButtonNode: Node = null!; // 再抽一次按钮节点
    private getAllButtonNode: Node = null!; // 全部获取按钮节点
    private videoAd: any = null; // 微信小游戏激励视频广告实例
    private videoAdCloseHandler: ((res: any) => void) | null = null; // 广告关闭事件处理器
    
    start() {
        // 查找GameManager
        let gmNode = find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent('GameManager' as any);
        }
        
        // 初始化微信小游戏激励视频广告
        this.initVideoAd();
        
        // 创建遮罩层
        this.createMaskLayer();
        
        // 初始隐藏
        if (this.container) {
            //console.info('[BuffCardPopup] start() 中设置 container.active = false，当前 active=', this.container.active);
            //console.info('[BuffCardPopup] start() 中检查 Graphics，bgGraphics.exists=', this.container.getComponent(Graphics)?.isValid);
            //console.info('[BuffCardPopup] start() 中检查 Graphics，bgGraphics.enabled=', this.container.getComponent(Graphics)?.enabled);
            this.container.active = false;
            //console.info('[BuffCardPopup] start() 中设置后 container.active=', this.container.active);
        }
        
        // 绑定卡片点击事件
        if (this.card1Button) {
            this.card1Button.node.on(Button.EventType.CLICK, () => this.onCardClick(0), this);
        }
        if (this.card2Button) {
            this.card2Button.node.on(Button.EventType.CLICK, () => this.onCardClick(1), this);
        }
        if (this.card3Button) {
            this.card3Button.node.on(Button.EventType.CLICK, () => this.onCardClick(2), this);
        }
    }
    
    /**
     * 创建遮罩层
     */
    private createMaskLayer() {
        if (this.maskLayer && this.maskLayer.isValid) {
            this.maskLayer.destroy();
        }
        
        const canvasNode = find('Canvas');
        if (!canvasNode) return;
        
        this.maskLayer = new Node('BuffCardMask');
        this.maskLayer.setParent(canvasNode);
        // 遮罩层应该在容器之下，所以不设置到最高层
        // 在showMaskLayer()中会动态调整
        
        const uiTransform = this.maskLayer.addComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        uiTransform.setContentSize(visibleSize.width * 2, visibleSize.height * 2);
        this.maskLayer.setPosition(0, 0, 0);
        
        const graphics = this.maskLayer.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180);
        graphics.rect(-visibleSize.width, -visibleSize.height, visibleSize.width * 2, visibleSize.height * 2);
        graphics.fill();
        
        const uiOpacity = this.maskLayer.addComponent(UIOpacity);
        uiOpacity.opacity = 0;
        
        this.maskLayer.active = false;
        
        // 阻止触摸事件穿透
        this.maskLayer.on(Node.EventType.TOUCH_START, (event: any) => {
            event.propagationStopped = true;
        }, this);
    }
    
    private onCloseCallback: (() => void) | null = null;
    
    /**
     * 显示增益卡片弹窗
     * @param cards 卡片数据数组（最多3张）
     * @param onClose 可选的回调函数，在卡片弹窗关闭时调用
     */
    show(cards: BuffCardData[], onClose?: () => void) {
        //console.info('[BuffCardPopup] show() 被调用，cards数量=', cards.length);
        if (!this.container) {
            console.error('[BuffCardPopup] container节点不存在');
            return;
        }
        
        //console.info('[BuffCardPopup] container节点存在，isValid=', this.container.isValid, 'active=', this.container.active);
        
        // 限制最多3张卡片
        this.cardData = cards.slice(0, 3);
        
        // 如果没有任何卡片，不显示
        if (this.cardData.length === 0) {
            console.warn('[BuffCardPopup] 没有卡片数据，不显示');
            if (onClose) onClose();
            return;
        }
        
        //console.info('[BuffCardPopup] 卡片数据有效，数量=', this.cardData.length);
        this.onCloseCallback = onClose || null;
        
        // 重置所有卡片状态（确保第二次显示时状态正确）
        this.resetCardsState();
        
        // 暂停游戏
        if (this.gameManager) {
            //console.info('[BuffCardPopup] 暂停游戏');
            this.gameManager.pauseGame();
        } else {
            console.warn('[BuffCardPopup] gameManager不存在');
        }
        
        // 更新卡片显示（设置卡片数据）
        this.updateCards();
        
        // 显示遮罩层（置灰效果，参考UnitIntroPopup的实现）
        this.showMaskLayer();
        
        // 设置容器为最上层（在遮罩层之上，参考UnitIntroPopup的实现）
        this.container.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 重置容器透明度（确保可见）
        const containerOpacity = this.container.getComponent(UIOpacity);
        if (containerOpacity) {
            containerOpacity.opacity = 255;
        }
        
        // 创建按钮（如果不存在）
        this.createButtons();
        
        // 显示弹窗（参考UnitIntroPopup的实现，不重新绘制Graphics，直接使用创建时绘制的内容）
        this.container.active = true;
        
        // 重置再抽一次模式标志
        this.isRerollMode = false;
    }
    
    /**
     * 创建再抽一次和全部获取按钮
     */
    private createButtons() {
        if (!this.container) return;
        
        // 获取容器尺寸
        const containerTransform = this.container.getComponent(UITransform);
        if (!containerTransform) return;
        
        const containerHeight = containerTransform.height;
        const buttonY = -containerHeight / 2 - 60; // 按钮位置在卡片下方
        
        // 创建再抽一次按钮（如果不存在）
        if (!this.rerollButtonNode || !this.rerollButtonNode.isValid) {
            this.rerollButtonNode = new Node('RerollButton');
            this.rerollButtonNode.setParent(this.container);
            const rerollTransform = this.rerollButtonNode.addComponent(UITransform);
            rerollTransform.setContentSize(150, 45);
            rerollTransform.setAnchorPoint(0.5, 0.5);
            this.rerollButtonNode.setPosition(-100, buttonY, 0);
            
            // 按钮背景
            const rerollBg = this.rerollButtonNode.addComponent(Graphics);
            rerollBg.fillColor = new Color(100, 150, 255, 255);
            rerollBg.roundRect(-75, -22.5, 150, 45, 8);
            rerollBg.fill();
            rerollBg.strokeColor = new Color(150, 200, 255, 255);
            rerollBg.lineWidth = 2;
            rerollBg.roundRect(-75, -22.5, 150, 45, 8);
            rerollBg.stroke();
            
            // 按钮组件
            this.rerollButton = this.rerollButtonNode.addComponent(Button);
            this.rerollButton.transition = Button.Transition.COLOR;
            this.rerollButton.normalColor = new Color(255, 255, 255, 255);
            this.rerollButton.hoverColor = new Color(200, 220, 255, 255);
            this.rerollButton.pressedColor = new Color(150, 180, 255, 255);
            
            // 按钮文字
            const rerollLabelNode = new Node('RerollLabel');
            rerollLabelNode.setParent(this.rerollButtonNode);
            const rerollLabelTransform = rerollLabelNode.addComponent(UITransform);
            rerollLabelTransform.setContentSize(150, 45);
            const rerollLabel = rerollLabelNode.addComponent(Label);
            rerollLabel.string = '再抽一次';
            rerollLabel.fontSize = 20;
            rerollLabel.color = new Color(255, 255, 255, 255);
            rerollLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            
            // 绑定点击事件
            this.rerollButton.node.on(Button.EventType.CLICK, () => this.onRerollClick(), this);
        }
        
        // 创建全部获取按钮（如果不存在）
        if (!this.getAllButtonNode || !this.getAllButtonNode.isValid) {
            this.getAllButtonNode = new Node('GetAllButton');
            this.getAllButtonNode.setParent(this.container);
            const getAllTransform = this.getAllButtonNode.addComponent(UITransform);
            getAllTransform.setContentSize(150, 45);
            getAllTransform.setAnchorPoint(0.5, 0.5);
            this.getAllButtonNode.setPosition(100, buttonY, 0);
            
            // 按钮背景
            const getAllBg = this.getAllButtonNode.addComponent(Graphics);
            getAllBg.fillColor = new Color(100, 255, 100, 255);
            getAllBg.roundRect(-75, -22.5, 150, 45, 8);
            getAllBg.fill();
            getAllBg.strokeColor = new Color(150, 255, 150, 255);
            getAllBg.lineWidth = 2;
            getAllBg.roundRect(-75, -22.5, 150, 45, 8);
            getAllBg.stroke();
            
            // 按钮组件
            this.getAllButton = this.getAllButtonNode.addComponent(Button);
            this.getAllButton.transition = Button.Transition.COLOR;
            this.getAllButton.normalColor = new Color(255, 255, 255, 255);
            this.getAllButton.hoverColor = new Color(200, 255, 200, 255);
            this.getAllButton.pressedColor = new Color(150, 255, 150, 255);
            
            // 按钮文字
            const getAllLabelNode = new Node('GetAllLabel');
            getAllLabelNode.setParent(this.getAllButtonNode);
            const getAllLabelTransform = getAllLabelNode.addComponent(UITransform);
            getAllLabelTransform.setContentSize(150, 45);
            const getAllLabel = getAllLabelNode.addComponent(Label);
            getAllLabel.string = '全部获取';
            getAllLabel.fontSize = 20;
            getAllLabel.color = new Color(255, 255, 255, 255);
            getAllLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            
            // 绑定点击事件
            this.getAllButton.node.on(Button.EventType.CLICK, () => this.onGetAllClick(), this);
        }
        
        // 确保按钮可见
        if (this.rerollButtonNode) {
            this.rerollButtonNode.active = true;
        }
        if (this.getAllButtonNode) {
            this.getAllButtonNode.active = true;
        }
    }
    
    /**
     * 初始化微信小游戏激励视频广告
     */
    private initVideoAd() {
        // 检查是否在微信小游戏环境中
        const wx = (window as any).wx;
        if (wx && wx.createRewardedVideoAd) {
            try {
                this.videoAd = wx.createRewardedVideoAd({
                    adUnitId: 'adunit-e4a8d497181fe16d'
                });
                
                // 监听广告加载事件
                this.videoAd.onLoad(() => {
                    console.log('[BuffCardPopup] 激励视频广告加载成功');
                });
                
                // 监听广告错误事件
                this.videoAd.onError((err: any) => {
                    console.error('[BuffCardPopup] 激励视频广告错误:', err);
                });
            } catch (error) {
                console.error('[BuffCardPopup] 创建激励视频广告失败:', error);
                this.videoAd = null;
            }
        } else {
            console.warn('[BuffCardPopup] 不在微信小游戏环境中，无法创建激励视频广告');
            this.videoAd = null;
        }
    }
    
    /**
     * 显示激励视频广告
     * @param onSuccess 广告观看成功回调
     * @param onFail 广告观看失败回调
     */
    private showVideoAd(onSuccess: () => void, onFail?: () => void) {
        if (!this.videoAd) {
            // 如果没有广告实例，直接执行成功回调（降级处理）
            console.warn('[BuffCardPopup] 激励视频广告未初始化，直接执行操作');
            onSuccess();
            return;
        }
        
        // 使用标志位防止重复执行回调
        let isCallbackExecuted = false;
        const executeCallback = (success: boolean) => {
            if (isCallbackExecuted) {
                console.warn('[BuffCardPopup] 广告回调已被执行，忽略重复调用');
                return;
            }
            isCallbackExecuted = true;
            
            if (success) {
                console.log('[BuffCardPopup] 激励视频广告观看完成');
                onSuccess();
            } else {
                console.log('[BuffCardPopup] 激励视频广告中途退出');
                if (onFail) {
                    onFail();
                }
            }
        };
        
        // 移除之前的 onClose 监听器（如果存在）
        if (this.videoAdCloseHandler) {
            // 注意：微信小游戏 API 可能不支持 offClose，但我们可以尝试
            if (this.videoAd.offClose && typeof this.videoAd.offClose === 'function') {
                this.videoAd.offClose(this.videoAdCloseHandler);
            }
        }
        
        // 创建新的关闭事件处理器
        this.videoAdCloseHandler = (res: any) => {
            if (res && res.isEnded) {
                // 正常播放结束，可以下发游戏奖励
                executeCallback(true);
            } else {
                // 播放中途退出，不下发游戏奖励
                executeCallback(false);
            }
        };
        
        // 监听用户点击关闭广告按钮的事件（在显示前绑定）
        this.videoAd.onClose(this.videoAdCloseHandler);
        
        // 显示广告
        this.videoAd.show()
            .catch(() => {
                // 失败重试
                console.log('[BuffCardPopup] 广告显示失败，尝试加载后重试');
                this.videoAd.load()
                    .then(() => {
                        return this.videoAd.show();
                    })
                    .catch((err: any) => {
                        console.error('[BuffCardPopup] 激励视频广告显示失败', err);
                        if (!isCallbackExecuted) {
                            isCallbackExecuted = true;
                            if (onFail) {
                                onFail();
                            } else {
                                // 默认降级处理：直接执行成功回调
                                onSuccess();
                            }
                        }
                    });
            });
    }
    
    /**
     * 再抽一次按钮点击事件
     */
    private onRerollClick() {
        if (!this.gameManager) {
            console.error('[BuffCardPopup] GameManager不存在，无法再抽一次');
            return;
        }
        
        // 显示激励视频广告，观看完成后执行再抽一次
        this.showVideoAd(() => {
            this.executeReroll();
        }, () => {
            console.warn('[BuffCardPopup] 广告观看失败，无法再抽一次');
        });
    }
    
    /**
     * 执行再抽一次逻辑
     */
    private executeReroll() {
        if (!this.gameManager) {
            return;
        }
        
        // 设置再抽一次模式标志（必定有一张UR）
        this.isRerollMode = true;
        
        // 重新生成卡片（通过GameManager）
        const newCards = this.gameManager.generateBuffCards(true); // 传入true表示再抽一次模式
        if (newCards && newCards.length > 0) {
            // 更新卡片数据
            this.cardData = newCards.slice(0, 3);
            // 重置卡片状态
            this.resetCardsState();
            // 更新卡片显示
            this.updateCards();
        } else {
            console.warn('[BuffCardPopup] 再抽一次失败，没有生成新卡片');
        }
    }
    
    /**
     * 全部获取按钮点击事件
     */
    private onGetAllClick() {
        // 显示激励视频广告，观看完成后执行全部获取
        this.showVideoAd(() => {
            this.executeGetAll();
        }, () => {
            console.warn('[BuffCardPopup] 广告观看失败，无法全部获取');
        });
    }
    
    /**
     * 执行全部获取逻辑
     */
    private executeGetAll() {
        // 应用所有三张卡片的增益效果
        for (let i = 0; i < this.cardData.length; i++) {
            this.applyBuff(this.cardData[i]);
        }
        
        // 隐藏弹窗，三张卡片同时翻转
        this.hideWithAllCardsFlipped();
    }
    
    /**
     * 隐藏弹窗，所有卡片同时翻转
     */
    private hideWithAllCardsFlipped() {
        if (!this.container) return;
        
        // 获取所有卡片节点
        const cards = [this.card1, this.card2, this.card3];
        const cardCount = this.cardData.length;
        
        // 跟踪完成的卡片数量
        let completedCards = 0;
        const totalActiveCards = cardCount;
        
        // 完成回调函数
        const onCardEffectComplete = () => {
            completedCards++;
            // 当所有卡片特效完成后，恢复游戏
            if (completedCards >= totalActiveCards) {
                // 隐藏容器和遮罩层
                if (this.container && this.container.isValid) {
                    this.container.active = false;
                }
                this.hideMaskLayer();
                
                // 继续游戏
                if (this.gameManager) {
                    this.gameManager.resumeGame();
                }
                
                // 调用关闭回调
                if (this.onCloseCallback) {
                    this.onCloseCallback();
                    this.onCloseCallback = null;
                }
            }
        };
        
        // 为每张卡片添加翻转特效
        for (let i = 0; i < cardCount && i < cards.length; i++) {
            const card = cards[i];
            if (!card || !card.isValid || !card.active) {
                continue;
            }
            
            // 所有卡片都执行翻转特效（X轴翻转 + 淡出）
            const cardOpacity = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
            cardOpacity.opacity = 255;
            
            // 保存原始位置和缩放
            const originalPosition = card.position.clone();
            const originalScale = card.scale.clone();
            
            tween(card)
                .parallel(
                    // X轴翻转：scaleX从1到-1，保持Y坐标不变
                    tween(card).to(0.5, { 
                        scale: new Vec3(-1, originalScale.y, originalScale.z) 
                    }, { easing: 'sineInOut' }),
                    tween(cardOpacity).to(0.5, { opacity: 0 })
                )
                .call(() => {
                    // 恢复原始状态（为下次使用做准备）
                    if (card && card.isValid) {
                        card.setScale(originalScale);
                        card.setPosition(originalPosition);
                    }
                    onCardEffectComplete();
                })
                .start();
        }
    }
    
    /**
     * 强制重新绘制所有Graphics（参考BuildingGridPanel的做法）
     */
    private forceRedrawGraphics() {
        //console.info('[BuffCardPopup] forceRedrawGraphics() 被调用');
        
        // 重新绘制容器背景Graphics
        const bgGraphics = this.container.getComponent(Graphics);
        if (bgGraphics) {
            // 确保Graphics组件已启用（参考BuildingGridPanel的做法）
            bgGraphics.enabled = true;
            bgGraphics.clear();
            const uiTransform = this.container.getComponent(UITransform);
            if (uiTransform) {
                const popupWidth = uiTransform.width;
                const popupHeight = uiTransform.height;
                //console.info('[BuffCardPopup] 绘制容器背景，尺寸=', popupWidth, 'x', popupHeight, '锚点=', uiTransform.anchorX, uiTransform.anchorY);
                // 使用更明显的颜色进行测试（红色背景，确保可见）
                bgGraphics.fillColor = new Color(255, 0, 0, 255); // 红色，完全不透明
                bgGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 15);
                bgGraphics.fill();
                bgGraphics.strokeColor = new Color(255, 255, 0, 255); // 黄色边框
                bgGraphics.lineWidth = 5; // 更粗的边框
                bgGraphics.roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 15);
                bgGraphics.stroke();
                //console.info('[BuffCardPopup] Graphics绘制完成，fillColor=', bgGraphics.fillColor, 'strokeColor=', bgGraphics.strokeColor);
                //console.info('[BuffCardPopup] 容器背景Graphics已重新绘制，enabled=', bgGraphics.enabled, 'container.active=', this.container.active);
            } else {
                console.warn('[BuffCardPopup] 容器UITransform组件不存在！');
            }
        } else {
            console.warn('[BuffCardPopup] 容器背景Graphics组件不存在！');
        }
        
        // 重新绘制所有卡片的背景Graphics
        const cards = [this.card1, this.card2, this.card3];
        cards.forEach((card, index) => {
            if (card && card.active) {
                const cardBg = card.getChildByName('CardBackground');
                if (cardBg && cardBg.active) {
                    const cardBgGraphics = cardBg.getComponent(Graphics);
                    if (cardBgGraphics) {
                        // 确保Graphics组件已启用
                        cardBgGraphics.enabled = true;
                        cardBgGraphics.clear();
                        const cardTransform = card.getComponent(UITransform);
                        if (cardTransform) {
                            const cardWidth = cardTransform.width;
                            const cardHeight = cardTransform.height;
                            cardBgGraphics.fillColor = new Color(50, 50, 50, 255);
                            cardBgGraphics.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
                            cardBgGraphics.fill();
                            cardBgGraphics.strokeColor = new Color(100, 100, 100, 255);
                            cardBgGraphics.lineWidth = 2;
                            cardBgGraphics.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
                            cardBgGraphics.stroke();
                            //console.info(`[BuffCardPopup] 卡片${index + 1}背景Graphics已重新绘制，enabled=`, cardBgGraphics.enabled);
                        }
                    } else {
                        console.warn(`[BuffCardPopup] 卡片${index + 1}背景Graphics组件不存在！`);
                    }
                } else {
                    console.warn(`[BuffCardPopup] 卡片${index + 1}背景节点不存在或未激活！cardBg=`, cardBg, 'active=', cardBg?.active);
                }
            }
        });
    }
    
    /**
     * 重置所有卡片状态（用于第二次显示时恢复初始状态）
     */
    private resetCardsState() {
        const cards = [this.card1, this.card2, this.card3];
        
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (!card || !card.isValid) {
                continue;
            }
            
            // 重置缩放为(1, 1, 1)
            card.setScale(1, 1, 1);
            
            // 重置角度为0
            card.angle = 0;
            
            // 重置透明度
            const cardOpacity = card.getComponent(UIOpacity);
            if (cardOpacity) {
                cardOpacity.opacity = 255;
            }
            
            // 确保卡片节点是激活的
            card.active = true;
        }
        
        // 重置容器透明度
        if (this.container) {
            const containerOpacity = this.container.getComponent(UIOpacity);
            if (containerOpacity) {
                containerOpacity.opacity = 255;
            }
        }
    }
    
    /**
     * 更新卡片显示
     */
    private updateCards() {
        //console.info('[BuffCardPopup] updateCards() 被调用，cardData.length=', this.cardData.length);
        //console.info('[BuffCardPopup] card1存在=', !!this.card1, 'card2存在=', !!this.card2, 'card3存在=', !!this.card3);
        
        const cardCount = this.cardData.length;
        
        // 动态调整卡片位置，根据实际显示的卡片数量居中布局
        if (cardCount === 1) {
            // 只有1张卡片，居中显示
            if (this.card1) {
                this.card1.setPosition(0, 0, 0);
                //console.info('[BuffCardPopup] 1张卡片，居中显示，位置=', this.card1.position);
            }
        } else if (cardCount === 2) {
            // 2张卡片，左右分布
            if (this.card1 && this.card2) {
                const card1Transform = this.card1.getComponent(UITransform);
                const card2Transform = this.card2.getComponent(UITransform);
                if (card1Transform && card2Transform) {
                    const spacing = 20;
                    const totalWidth = card1Transform.width + card2Transform.width + spacing;
                    this.card1.setPosition(-totalWidth / 2 + card1Transform.width / 2, 0, 0);
                    this.card2.setPosition(totalWidth / 2 - card2Transform.width / 2, 0, 0);
                    //console.info('[BuffCardPopup] 2张卡片，左右分布');
                }
            }
        } else if (cardCount === 3) {
            // 3张卡片，保持原有布局（已在创建时设置好位置）
            //console.info('[BuffCardPopup] 3张卡片，保持原有布局');
        }
        
        // 更新第一张卡片
        if (this.cardData.length > 0 && this.card1) {
            //console.info('[BuffCardPopup] 更新第一张卡片');
            this.updateCard(this.card1, this.card1Icon, this.card1Name, this.card1Description, this.cardData[0]);
            this.card1.active = true;
            //console.info('[BuffCardPopup] card1 active=', this.card1.active, 'position=', this.card1.position);
        } else if (this.card1) {
            console.warn('[BuffCardPopup] 第一张卡片数据不存在，隐藏卡片');
            this.card1.active = false;
        } else {
            console.warn('[BuffCardPopup] card1节点不存在');
        }
        
        // 更新第二张卡片
        if (this.cardData.length > 1 && this.card2) {
            //console.info('[BuffCardPopup] 更新第二张卡片');
            this.updateCard(this.card2, this.card2Icon, this.card2Name, this.card2Description, this.cardData[1]);
            this.card2.active = true;
        } else if (this.card2) {
            console.warn('[BuffCardPopup] 第二张卡片数据不存在，隐藏卡片');
            this.card2.active = false;
        } else {
            console.warn('[BuffCardPopup] card2节点不存在');
        }
        
        // 更新第三张卡片
        if (this.cardData.length > 2 && this.card3) {
            //console.info('[BuffCardPopup] 更新第三张卡片');
            this.updateCard(this.card3, this.card3Icon, this.card3Name, this.card3Description, this.cardData[2]);
            this.card3.active = true;
        } else if (this.card3) {
            console.warn('[BuffCardPopup] 第三张卡片数据不存在，隐藏卡片');
            this.card3.active = false;
        } else {
            console.warn('[BuffCardPopup] card3节点不存在');
        }
    }
    
    /**
     * 更新单张卡片
     */
    private updateCard(cardNode: Node, icon: Sprite, unitImageSprite: Sprite, descLabel: Label, data: BuffCardData) {
        // 顶部的图标（可以隐藏或用于其他用途）
        if (icon) {
            icon.spriteFrame = null; // 顶部图标不再使用
            icon.node.active = false; // 隐藏顶部图标
        }
        // 中间的单位图片（从预制体的 unitIcon 获取）
        //console.info(`[BuffCardPopup] updateCard: 单位=${data.unitName}, unitId=${data.unitId}, unitIcon存在=${!!data.unitIcon}, unitImageSprite存在=${!!unitImageSprite}, 稀有度=${data.rarity}`);
        if (data.unitIcon && unitImageSprite) {
            // 确保图片节点是激活的
            if (!unitImageSprite.node.active) {
                unitImageSprite.node.active = true;
            }
            unitImageSprite.spriteFrame = data.unitIcon;
            //console.info(`[BuffCardPopup] updateCard: 已设置单位图片，单位=${data.unitName}, spriteFrame=${!!unitImageSprite.spriteFrame}`);
        } else if (unitImageSprite) {
            unitImageSprite.node.active = false;
            console.warn(`[BuffCardPopup] updateCard: 单位图片不存在，隐藏图片节点，单位=${data.unitName}`);
        }
        // 描述标签
        if (descLabel) {
            descLabel.string = data.buffDescription;
        }
        
        // 根据稀有度更新边框颜色（必须在最后执行，确保边框正确显示）
        this.updateCardBorder(cardNode, data.rarity);
    }
    
    /**
     * 根据稀有度更新卡片边框颜色
     */
    private updateCardBorder(cardNode: Node, rarity: 'R' | 'SR' | 'SSR' | 'UR') {
        const cardBg = cardNode.getChildByName('CardBackground');
        if (!cardBg) {
            console.warn(`[BuffCardPopup] updateCardBorder: 找不到CardBackground节点，卡片=${cardNode.name}`);
            return;
        }
        
        const cardBgGraphics = cardBg.getComponent(Graphics);
        if (!cardBgGraphics) {
            console.warn(`[BuffCardPopup] updateCardBorder: 找不到Graphics组件，卡片=${cardNode.name}`);
            return;
        }
        
        // 根据稀有度设置边框颜色
        let borderColor: Color;
        let lineWidth: number;
        switch (rarity) {
            case 'R':
                // 银色边框 (200, 200, 200) - 更明显的银色，避免太接近白色
                borderColor = new Color(200, 200, 200, 255);
                lineWidth = 3;
                break;
            case 'SR':
                // 铜色边框 (184, 115, 51) - 更明显的铜色
                borderColor = new Color(184, 115, 51, 255);
                lineWidth = 3;
                break;
            case 'SSR':
                // 金色边框 (255, 215, 0)
                borderColor = new Color(255, 215, 0, 255);
                lineWidth = 4; // SSR边框更粗
                break;
            case 'UR':
                // UR边框：紫金色渐变效果，使用更亮的紫金色 (255, 100, 255)
                borderColor = new Color(255, 100, 255, 255);
                lineWidth = 5; // UR边框最粗
                break;
            default:
                borderColor = new Color(100, 100, 100, 255);
                lineWidth = 2;
        }
        
        //console.info(`[BuffCardPopup] updateCardBorder: 卡片=${cardNode.name}, 稀有度=${rarity}, 边框颜色=(${borderColor.r}, ${borderColor.g}, ${borderColor.b}), 线宽=${lineWidth}`);
        
        // 清除旧的边框并重新绘制
        const uiTransform = cardBg.getComponent(UITransform);
        if (uiTransform) {
            const cardWidth = uiTransform.width;
            const cardHeight = uiTransform.height;
            
            // 清除旧的绘制
            cardBgGraphics.clear();
            
            // 重新绘制背景
            cardBgGraphics.fillColor = new Color(50, 50, 50, 255);
            cardBgGraphics.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
            cardBgGraphics.fill();
            
            // 绘制新颜色的边框
            cardBgGraphics.strokeColor = borderColor;
            cardBgGraphics.lineWidth = lineWidth;
            cardBgGraphics.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
            cardBgGraphics.stroke();
            
            //console.info(`[BuffCardPopup] updateCardBorder: 边框已更新，实际颜色=(${cardBgGraphics.strokeColor.r}, ${cardBgGraphics.strokeColor.g}, ${cardBgGraphics.strokeColor.b})`);
        } else {
            console.warn(`[BuffCardPopup] updateCardBorder: 找不到UITransform组件，卡片=${cardNode.name}`);
        }
    }
    
    /**
     * 卡片点击事件
     */
    private onCardClick(index: number) {
        if (index < 0 || index >= this.cardData.length) {
            return;
        }
        
        const cardData = this.cardData[index];
        
        // 应用增益效果
        this.applyBuff(cardData);
        
        // 隐藏弹窗，带特效
        this.hideWithEffects(index);
    }
    
    /**
     * 应用增益效果
     */
    private applyBuff(cardData: BuffCardData) {
        if (!this.gameManager) {
            return;
        }
        
        // 获取增益管理器
        const buffManager = BuffManager.getInstance();
        
        // 处理全局增益（人口、金币等）
        if (cardData.buffType === 'populationIncrease') {
            // 增加人口上限
            if (this.gameManager && this.gameManager.getMaxPopulation) {
                const currentMaxPopulation = this.gameManager.getMaxPopulation();
                this.gameManager.setMaxPopulation(currentMaxPopulation + cardData.buffValue);
                //console.info(`[BuffCardPopup] 人口上限增加 ${cardData.buffValue}，当前上限: ${currentMaxPopulation + cardData.buffValue}`);
            } else {
                console.error('[BuffCardPopup] GameManager 或 getMaxPopulation 方法不存在');
            }
            // 保存到增益管理器
            buffManager.addBuff('global', cardData.buffType, cardData.buffValue);
            return;
        }
        
        if (cardData.buffType === 'goldReward' || cardData.buffType === 'goldIncrease') {
            // 增加金币
            if (this.gameManager && this.gameManager.addGold) {
                this.gameManager.addGold(cardData.buffValue);
                //console.info(`[BuffCardPopup] 获得 ${cardData.buffValue} 金币`);
            } else {
                console.error('[BuffCardPopup] GameManager 或 addGold 方法不存在');
            }
            // 保存到增益管理器
            buffManager.addBuff('global', cardData.buffType, cardData.buffValue);
            return;
        }
        
        // 处理单位增益
        if (!cardData.unitId) {
            console.warn('[BuffCardPopup] 单位增益卡片缺少 unitId');
            return;
        }
        
        // 保存增益到管理器（新单位生成时会自动应用）
        buffManager.addBuff(cardData.unitId, cardData.buffType, cardData.buffValue);
        
        // 获取所有已上场的该类型单位
        const units = this.getUnitsByType(cardData.unitId);
        
        // 应用增益到所有已存在的单位
        for (const unit of units) {
            if (!unit || !unit.isValid || !unit.active) {
                continue;
            }
            
            const unitScript = unit.getComponent(cardData.unitId) as any;
            if (!unitScript) {
                // 尝试其他可能的组件名
                const roleScript = unit.getComponent('Role') as any;
                const buildScript = unit.getComponent('Build') as any;
                const script = roleScript || buildScript;
                if (script) {
                    this.applyBuffToUnit(script, cardData);
                }
            } else {
                this.applyBuffToUnit(unitScript, cardData);
            }
        }
    }
    
    /**
     * 应用增益到单个单位
     */
    private applyBuffToUnit(unitScript: any, cardData: BuffCardData) {
        // 保存原始属性（如果还没有保存）
        if (!unitScript._originalAttackDamage) {
            unitScript._originalAttackDamage = unitScript.attackDamage || 0;
        }
        if (!unitScript._originalAttackInterval) {
            unitScript._originalAttackInterval = unitScript.attackInterval || 1;
        }
        if (!unitScript._originalMaxHealth) {
            unitScript._originalMaxHealth = unitScript.maxHealth || 0;
        }
        if (!unitScript._originalCurrentHealth) {
            unitScript._originalCurrentHealth = unitScript.currentHealth || 0;
        }
        if (!unitScript._originalMoveSpeed) {
            unitScript._originalMoveSpeed = unitScript.moveSpeed || 0;
        }
        
        // 初始化累积增幅百分比（如果还没有）
        if (unitScript._buffAttackDamagePercent === undefined) {
            unitScript._buffAttackDamagePercent = 0;
        }
        if (unitScript._buffAttackSpeedPercent === undefined) {
            unitScript._buffAttackSpeedPercent = 0;
        }
        if (unitScript._buffMaxHealthPercent === undefined) {
            unitScript._buffMaxHealthPercent = 0;
        }
        if (unitScript._buffMoveSpeedPercent === undefined) {
            unitScript._buffMoveSpeedPercent = 0;
        }
        
        // 根据增益类型应用效果（叠加）
        switch (cardData.buffType) {
            case 'attackDamage':
                // 攻击力提升（百分比叠加）
                unitScript._buffAttackDamagePercent += cardData.buffValue;
                const damageMultiplier = 1 + unitScript._buffAttackDamagePercent / 100;
                unitScript.attackDamage = Math.floor(unitScript._originalAttackDamage * damageMultiplier);
                //console.info(`[BuffCardPopup] 应用攻击力增幅 ${cardData.buffValue}%，累积增幅 ${unitScript._buffAttackDamagePercent}%，最终攻击力: ${unitScript.attackDamage}`);
                break;
            case 'attackSpeed':
                // 攻击速度提升（减少攻击间隔，百分比叠加）
                unitScript._buffAttackSpeedPercent += cardData.buffValue;
                const speedMultiplier = 1 + unitScript._buffAttackSpeedPercent / 100;
                unitScript.attackInterval = unitScript._originalAttackInterval / speedMultiplier;
                //console.info(`[BuffCardPopup] 应用攻击速度增幅 ${cardData.buffValue}%，累积增幅 ${unitScript._buffAttackSpeedPercent}%，最终攻击间隔: ${unitScript.attackInterval}`);
                break;
            case 'maxHealth':
                // 生命值提升（百分比叠加）
                unitScript._buffMaxHealthPercent += cardData.buffValue;
                const healthMultiplier = 1 + unitScript._buffMaxHealthPercent / 100;

                // 记录旧的最大生命值，用于按比例调整当前血量
                const oldMaxHealth = unitScript.maxHealth || unitScript._originalMaxHealth || 1;
                const newMaxHealth = Math.floor(unitScript._originalMaxHealth * healthMultiplier);
                unitScript.maxHealth = newMaxHealth;

                // 按比例调整当前生命值，保持血量百分比不变
                if (unitScript.currentHealth !== undefined) {
                    const currentHealthRatio = (unitScript.currentHealth || oldMaxHealth) / oldMaxHealth;
                    unitScript.currentHealth = Math.floor(unitScript.maxHealth * currentHealthRatio);
                }

                // 同步刷新血条组件（Role / Enemy / Build 等都有 healthBar）
                if (unitScript.healthBar && typeof unitScript.healthBar.setMaxHealth === 'function') {
                    unitScript.healthBar.setMaxHealth(unitScript.maxHealth);
                    const curHp = unitScript.currentHealth !== undefined ? unitScript.currentHealth : unitScript.maxHealth;
                    unitScript.healthBar.setHealth(curHp);
                }

                // 同步刷新单位信息面板（如果当前被选中）
                if (unitScript.unitSelectionManager && unitScript.unitSelectionManager.isUnitSelected &&
                    unitScript.unitSelectionManager.isUnitSelected(unitScript.node)) {
                    unitScript.unitSelectionManager.updateUnitInfo({
                        currentHealth: unitScript.currentHealth !== undefined ? unitScript.currentHealth : unitScript.maxHealth,
                        maxHealth: unitScript.maxHealth
                    });
                }

                //console.info(`[BuffCardPopup] 应用生命值增幅 ${cardData.buffValue}%，累积增幅 ${unitScript._buffMaxHealthPercent}%，最终生命上限: ${unitScript.maxHealth}`);
                break;
            case 'moveSpeed':
                // 移动速度提升（百分比叠加）
                unitScript._buffMoveSpeedPercent += cardData.buffValue;
                const moveMultiplier = 1 + unitScript._buffMoveSpeedPercent / 100;
                unitScript.moveSpeed = unitScript._originalMoveSpeed * moveMultiplier;
                //console.info(`[BuffCardPopup] 应用移动速度增幅 ${cardData.buffValue}%，累积增幅 ${unitScript._buffMoveSpeedPercent}%，最终移动速度: ${unitScript.moveSpeed}`);
                break;
        }
    }
    
    /**
     * 根据单位类型获取所有单位
     */
    private getUnitsByType(unitId: string): Node[] {
        const units: Node[] = [];
        
        // 单位ID到容器路径的映射
        const unitContainerMap: Record<string, string[]> = {
            'Arrower': ['Canvas/Towers'],
            'Hunter': ['Canvas/Hunters'],
            'ElfSwordsman': ['Canvas/Swordsmen'],
            'Priest': ['Canvas/Towers'],
            'WatchTower': ['Canvas/WatchTowers'],
            'IceTower': ['Canvas/IceTowers'],
            'ThunderTower': ['Canvas/ThunderTowers'],
            'WarAncientTree': ['Canvas/WarAncientTrees'],
            'HunterHall': ['Canvas/HunterHalls'],
            'SwordsmanHall': ['Canvas/SwordsmanHalls'],
            'Church': ['Canvas/Churches'],
        };
        
        const containers = unitContainerMap[unitId] || [];
        
        for (const containerPath of containers) {
            const container = find(containerPath);
            if (container) {
                for (const child of container.children) {
                    if (child && child.isValid && child.active) {
                        // 检查是否有对应的组件
                        const script = child.getComponent(unitId) as any ||
                                      child.getComponent('Role') as any ||
                                      child.getComponent('Build') as any;
                        if (script) {
                            units.push(child);
                        }
                    }
                }
            }
        }
        
        return units;
    }
    
    /**
     * 显示遮罩层
     */
    private showMaskLayer() {
        if (!this.maskLayer || !this.maskLayer.isValid) {
            this.createMaskLayer();
        }
        if (this.maskLayer && this.container) {
            // 确保遮罩层在容器之下（参考UnitIntroPopup的实现）
            const canvasNode = find('Canvas');
            if (canvasNode) {
                // 设置遮罩层的siblingIndex（在容器之下，使用Number.MAX_SAFE_INTEGER - 1）
                this.maskLayer.setSiblingIndex(Number.MAX_SAFE_INTEGER - 1);
                // 容器的siblingIndex在show()中已经设置为Number.MAX_SAFE_INTEGER，这里不再设置
            }
            this.maskLayer.active = true;
            const uiOpacity = this.maskLayer.getComponent(UIOpacity);
            if (uiOpacity) {
                uiOpacity.opacity = 0;
                tween(uiOpacity)
                    .to(0.3, { opacity: 255 })
                    .start();
            }
        }
    }
    
    /**
     * 隐藏遮罩层
     */
    private hideMaskLayer() {
        if (this.maskLayer && this.maskLayer.isValid) {
            const uiOpacity = this.maskLayer.getComponent(UIOpacity);
            if (uiOpacity) {
                tween(uiOpacity)
                    .to(0.3, { opacity: 0 })
                    .call(() => {
                        if (this.maskLayer && this.maskLayer.isValid) {
                            this.maskLayer.active = false;
                        }
                    })
                    .start();
            } else {
                this.maskLayer.active = false;
            }
        }
    }
    
    /**
     * 隐藏弹窗（带特效）
     * @param selectedIndex 被选中的卡片索引（-1表示没有选中，使用普通淡出）
     */
    private hideWithEffects(selectedIndex: number = -1) {
        if (!this.container) return;
        
        // 获取所有卡片节点
        const cards = [this.card1, this.card2, this.card3];
        const cardCount = this.cardData.length;
        
        // 计算最长特效时间（用于确定何时恢复游戏）
        const maxEffectTime = Math.max(0.5, 0.4); // 选中卡片0.5秒，其他卡片0.4秒
        
        // 跟踪完成的卡片数量
        let completedCards = 0;
        const totalActiveCards = cardCount;
        
        // 完成回调函数
        const onCardEffectComplete = () => {
            completedCards++;
            // 当所有卡片特效完成后，恢复游戏
            if (completedCards >= totalActiveCards) {
                // 隐藏容器和遮罩层
                if (this.container && this.container.isValid) {
                    this.container.active = false;
                }
                this.hideMaskLayer();
                
                // 继续游戏
                if (this.gameManager) {
                    this.gameManager.resumeGame();
                }
                
                // 调用关闭回调
                if (this.onCloseCallback) {
                    this.onCloseCallback();
                    this.onCloseCallback = null;
                }
            }
        };
        
        // 为每张卡片添加特效
        for (let i = 0; i < cardCount && i < cards.length; i++) {
            const card = cards[i];
            if (!card || !card.isValid || !card.active) {
                continue;
            }
            
            if (i === selectedIndex) {
                // 被选中的卡片：X轴翻转特效（scaleX从1到-1，Y坐标不变）+ 淡出
                const cardOpacity = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
                cardOpacity.opacity = 255;
                
                // 保存原始位置和缩放
                const originalPosition = card.position.clone();
                const originalScale = card.scale.clone();
                
                tween(card)
                    .parallel(
                        // X轴翻转：scaleX从1到-1，保持Y坐标不变
                        tween(card).to(0.5, { 
                            scale: new Vec3(-1, originalScale.y, originalScale.z) 
                        }, { easing: 'sineInOut' }),
                        tween(cardOpacity).to(0.5, { opacity: 0 })
                    )
                    .call(() => {
                        // 恢复原始状态（为下次使用做准备）
                        if (card && card.isValid) {
                            card.setScale(originalScale);
                            card.setPosition(originalPosition);
                        }
                        onCardEffectComplete();
                    })
                    .start();
            } else {
                // 其他卡片：消散特效（缩小 + 淡出）
                const cardOpacity = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
                cardOpacity.opacity = 255;
                
                const originalScale = card.scale.clone();
                tween(card)
                    .parallel(
                        tween(card).to(0.4, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' }),
                        tween(cardOpacity).to(0.4, { opacity: 0 })
                    )
                    .call(() => {
                        // 恢复原始缩放（为下次使用做准备）
                        if (card && card.isValid) {
                            card.setScale(originalScale);
                        }
                        onCardEffectComplete();
                    })
                    .start();
            }
        }
    }
    
    /**
     * 隐藏弹窗（普通淡出，用于非点击关闭的情况）
     */
    hide() {
        if (!this.container) return;
        
        // 播放淡出动画
        const uiOpacity = this.container.getComponent(UIOpacity);
        if (uiOpacity) {
            tween(uiOpacity)
                .to(0.3, { opacity: 0 })
                .call(() => {
                    if (this.container && this.container.isValid) {
                        this.container.active = false;
                    }
                    this.hideMaskLayer();
                    
                    // 继续游戏
                    if (this.gameManager) {
                        this.gameManager.resumeGame();
                    }
                    
                    // 调用关闭回调
                    if (this.onCloseCallback) {
                        this.onCloseCallback();
                        this.onCloseCallback = null;
                    }
                })
                .start();
        } else {
            this.container.active = false;
            this.hideMaskLayer();
            
            // 继续游戏
            if (this.gameManager) {
                this.gameManager.resumeGame();
            }
            
            // 调用关闭回调
            if (this.onCloseCallback) {
                this.onCloseCallback();
                this.onCloseCallback = null;
            }
        }
    }
}
