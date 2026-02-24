import { _decorator, Component, Node, Label, Button, EventTouch, find, instantiate, Prefab, Vec3, Color, UIOpacity, Sprite, SpriteFrame, UITransform, Graphics, tween } from 'cc';
import { GameManager } from './GameManager';
import { DamageNumber } from './DamageNumber';
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
    private gameManager: GameManager = null!; // GameManager引用
    private initialCountdownTime: number = 60; // 初始倒计时时间（秒）
    private hideTween: any = null; // hide() 动画的tween引用，用于取消

    onLoad() {
        // 确保弹窗初始状态为隐藏
        this.node.active = false;
        
        // 自动创建必要的UI元素（如果没有在编辑器中配置）
        this.autoCreateUI();
    }

    start() {
        // 绑定关闭按钮事件
        if (this.closeButton) {
            this.closeButton.node.on(Button.EventType.CLICK, this.onCloseButtonClick, this);
        } else {
        }
        
        // 查找GameManager
        this.findGameManager();
    }
    
    /**
     * 查找GameManager
     */
    private findGameManager() {
        const gameManagerNode = find('Canvas/GameManager');
        if (gameManagerNode) {
            this.gameManager = gameManagerNode.getComponent(GameManager);
        }
    }
    
    /**
     * 自动创建必要的UI元素
     */
    private autoCreateUI() {
        
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
        //console.info(`[CountdownPopup] onPopupClick() 被调用，isShowingNextWaveText=${this.isShowingNextWaveText}, isCounting=${this.isCounting}, onManualClose存在=${!!this.onManualClose}`);
        // 如果正在显示"下一波敌人"文本，不处理点击（等待5秒后开始倒计时）
        if (this.isShowingNextWaveText) {
            //console.info(`[CountdownPopup] onPopupClick() 正在显示"下一波敌人"文本，忽略点击`);
            return;
        }
        
        // 如果正在倒计时，计算剩余时间并奖励金币
        if (this.isCounting && this.countdownTime > 0) {
            // 计算剩余倒计时时间（向上取整，确保至少奖励1金币）
            const remainingSeconds = Math.ceil(this.countdownTime);
            const goldReward = remainingSeconds;
            
            //console.info(`[CountdownPopup] onPopupClick() 倒计时中，剩余时间=${remainingSeconds}秒，奖励金币=${goldReward}`);
            
            // 添加金币奖励
            if (this.gameManager) {
                this.gameManager.addGold(goldReward);
            }
            
            // 在弹窗位置显示金币提示效果
            this.showGoldRewardEffect(goldReward);
        }
        
        this.isCounting = false;
        
        // 保存回调引用，因为hide()可能会清空它
        const savedOnManualClose = this.onManualClose;
        //console.info(`[CountdownPopup] onPopupClick() 保存回调引用，savedOnManualClose存在=${!!savedOnManualClose}`);
        
        // 先调用回调，再隐藏（避免hide()清空回调）
        if (savedOnManualClose) {
            //console.info(`[CountdownPopup] onPopupClick() 调用 onManualClose 回调`);
            savedOnManualClose();
        } else {
            console.warn(`[CountdownPopup] onPopupClick() onManualClose 回调不存在，无法继续下一波`);
        }
        
        // 然后隐藏弹窗
        this.hide();
    }
    
    /**
     * 显示金币奖励提示效果
     * @param goldAmount 金币数量
     */
    private showGoldRewardEffect(goldAmount: number) {
        // 创建金币提示节点
        const goldNode = new Node('GoldRewardEffect');
        
        // 添加到Canvas或场景
        const canvas = find('Canvas');
        if (canvas) {
            goldNode.setParent(canvas);
        } else {
            goldNode.setParent(this.node.scene);
        }
        
        // 设置位置（在弹窗位置）
        const popupWorldPos = this.node.worldPosition.clone();
        goldNode.setWorldPosition(popupWorldPos);
        
        // 添加UITransform组件
        const uiTransform = goldNode.addComponent(UITransform);
        uiTransform.setContentSize(100, 40);
        
        // 添加Label组件
        const label = goldNode.addComponent(Label);
        label.string = `+${goldAmount}`;
        label.fontSize = 24;
        label.color = new Color(255, 215, 0, 255); // 金色
        label.isBold = true;
        
        // 创建向上移动并淡出的动画效果
        const startPos = goldNode.position.clone();
        const endPos = startPos.clone();
        endPos.y += 60; // 向上移动60像素
        
        // 添加UIOpacity组件用于透明度动画
        const uiOpacity = goldNode.addComponent(UIOpacity);
        uiOpacity.opacity = 255;
        
        // 使用tween创建动画
        tween(goldNode)
            .to(1.0, { 
                position: endPos
            }, {
                easing: 'sineOut'
            })
            .parallel(
                tween().to(1.0, {}, {
                    onUpdate: (target, ratio) => {
                        if (uiOpacity) {
                            uiOpacity.opacity = 255 * (1 - ratio);
                        }
                    }
                })
            )
            .call(() => {
                if (goldNode && goldNode.isValid) {
                    goldNode.destroy();
                }
            })
            .start();
    }
    
    /**
     * 创建圆弧边框
     */
    private createArcBorder() {
        
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
        //console.info(`[CountdownPopup] show() 被调用，onComplete存在=${!!onComplete}, onManualClose存在=${!!onManualClose}`);
        
        // 取消之前的hide()动画（如果存在）
        if (this.hideTween) {
            //console.info(`[CountdownPopup] show() 取消之前的hide()动画`);
            tween(this.node).stop();
            this.hideTween = null;
            // 重置节点状态
            this.node.setScale(1, 1, 1);
            this.node.angle = 0;
            const uiOpacity = this.node.getComponent(UIOpacity);
            if (uiOpacity) {
                uiOpacity.opacity = 255;
            }
        }
        
        // 设置回调（必须在取消动画之后，避免被清空）
        this.onCountdownComplete = onComplete;
        this.onManualClose = onManualClose;
        //console.info(`[CountdownPopup] show() 设置回调后，onManualClose存在=${!!this.onManualClose}`);
        this.countdownTime = 60;
        this.initialCountdownTime = 60; // 保存初始倒计时时间
        
        // 确保GameManager已获取
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 初始状态：显示"下一波敌人"文本，不开始倒计时
        this.isCounting = false;
        this.isShowingNextWaveText = true;
        this.nextWaveTextTimer = 0;
        
        this.node.active = true;
        //console.info(`[CountdownPopup] show() 设置 node.active = true`);
        
        // 恢复显示状态（确保可见）
        const uiOpacity = this.node.getComponent(UIOpacity);
        if (uiOpacity) {
            uiOpacity.opacity = 255;
            //console.info(`[CountdownPopup] show() 设置 opacity = 255`);
        }
        
        // 恢复siblingIndex到最顶层
        if (this.node.parent) {
            const maxIndex = this.node.parent.children.length - 1;
            this.node.setSiblingIndex(maxIndex);
            //console.info(`[CountdownPopup] show() 设置 siblingIndex = ${maxIndex}`);
        }
        
        // 显示"下一波敌人"文本，隐藏倒计时
        if (this.nextWaveLabel) {
            this.nextWaveLabel.node.active = true;
            //console.info(`[CountdownPopup] show() 显示 nextWaveLabel`);
        }
        if (this.countdownLabel) {
            this.countdownLabel.node.active = false;
            //console.info(`[CountdownPopup] show() 隐藏 countdownLabel`);
        }
        
        //console.info(`[CountdownPopup] show() 完成，node.active=${this.node.active}, isShowingNextWaveText=${this.isShowingNextWaveText}, isCounting=${this.isCounting}`);
    }

    /**
     * 临时隐藏倒计时弹窗（不停止倒计时，用于显示增益卡片时）
     * 通过降低 siblingIndex 来隐藏，而不是设置 active = false
     */
    temporaryHide() {
        //console.info(`[CountdownPopup] temporaryHide() 被调用，当前 node.active=${this.node.active}, isCounting=${this.isCounting}, isShowingNextWaveText=${this.isShowingNextWaveText}`);
        // 将节点移到最底层，这样它会被其他UI遮挡
        // 但不设置 active = false，这样 update() 方法会继续执行，倒计时继续运行
        if (this.node.parent) {
            const oldIndex = this.node.getSiblingIndex();
            this.node.setSiblingIndex(0);
            //console.info(`[CountdownPopup] temporaryHide() 设置 siblingIndex: ${oldIndex} -> 0`);
        }
        // 也可以设置透明度为0，使其不可见
        const uiOpacity = this.node.getComponent(UIOpacity);
        if (uiOpacity) {
            const oldOpacity = uiOpacity.opacity;
            uiOpacity.opacity = 0;
            //console.info(`[CountdownPopup] temporaryHide() 设置 opacity: ${oldOpacity} -> 0`);
        }
        //console.info(`[CountdownPopup] temporaryHide() 完成，node.active=${this.node.active}`);
    }
    
    /**
     * 恢复显示倒计时弹窗（临时隐藏后恢复）
     */
    temporaryShow() {
        //console.info(`[CountdownPopup] temporaryShow() 被调用，当前 node.active=${this.node.active}, isCounting=${this.isCounting}, isShowingNextWaveText=${this.isShowingNextWaveText}`);
        // 确保节点是激活的
        if (!this.node.active) {
            this.node.active = true;
            //console.info(`[CountdownPopup] temporaryShow() 设置 node.active = true`);
        }
        // 恢复节点到最顶层
        if (this.node.parent) {
            const maxIndex = this.node.parent.children.length - 1;
            const oldIndex = this.node.getSiblingIndex();
            this.node.setSiblingIndex(maxIndex);
            //console.info(`[CountdownPopup] temporaryShow() 设置 siblingIndex: ${oldIndex} -> ${maxIndex}`);
        }
        // 恢复透明度
        const uiOpacity = this.node.getComponent(UIOpacity);
        if (uiOpacity) {
            const oldOpacity = uiOpacity.opacity;
            uiOpacity.opacity = 255;
            //console.info(`[CountdownPopup] temporaryShow() 设置 opacity: ${oldOpacity} -> 255`);
        }
        //console.info(`[CountdownPopup] temporaryShow() 完成，node.active=${this.node.active}`);
    }
    
    /**
     * 隐藏倒计时弹窗，添加泡沫破碎消失效果
     */
    hide() {
        //console.info(`[CountdownPopup] hide() 被调用，onManualClose存在=${!!this.onManualClose}`);
        this.isCounting = false;
        
        // 获取UIOpacity组件
        const uiOpacity = this.node.getComponent(UIOpacity);
        
        // 保存回调引用，因为动画完成后会清空
        const savedOnManualClose = this.onManualClose;
        const savedOnComplete = this.onCountdownComplete;
        
        // 使用tween创建泡沫破碎消失效果
        // 1. 先放大一点
        // 2. 然后缩小并旋转
        // 3. 同时降低透明度
        this.hideTween = tween(this.node)
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
                //console.info(`[CountdownPopup] hide() 动画完成，清空回调`);
                this.node.active = false;
                this.node.setScale(1, 1, 1);
                this.node.angle = 0; // 重置旋转角度为0度
                if (uiOpacity) {
                    uiOpacity.opacity = 255;
                }
                // 只有在动画正常完成时才清空回调（如果被show()取消，则不清空）
                if (this.hideTween) {
                    this.onCountdownComplete = null;
                    this.onManualClose = null;
                    this.hideTween = null;
                }
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
        }
    }

    /**
     * 关闭按钮点击事件
     */
    private onCloseButtonClick() {
        // 如果正在显示"下一波敌人"文本，不处理点击
        if (this.isShowingNextWaveText) {
            return;
        }
        
        // 如果正在倒计时，计算剩余时间并奖励金币
        if (this.isCounting && this.countdownTime > 0) {
            // 计算剩余倒计时时间（向上取整，确保至少奖励1金币）
            const remainingSeconds = Math.ceil(this.countdownTime);
            const goldReward = remainingSeconds;
            
            // 添加金币奖励
            if (this.gameManager) {
                this.gameManager.addGold(goldReward);
            }
            
            // 在弹窗位置显示金币提示效果
            this.showGoldRewardEffect(goldReward);
        }
        
        this.isCounting = false;
        if (this.onManualClose) {
            this.onManualClose();
        } else {
        }
        this.hide();
    }

    update(deltaTime: number) {
        // 如果节点未激活，不执行更新逻辑
        if (!this.node.active) {
            return;
        }
        
        // 如果正在显示"下一波敌人"文本
        if (this.isShowingNextWaveText) {
            this.nextWaveTextTimer += deltaTime;
            
            // 显示5秒后，切换到倒计时
            if (this.nextWaveTextTimer >= 5) {
                //console.info(`[CountdownPopup] update() 5秒后切换到倒计时，node.active=${this.node.active}`);
                
                // 隐藏"下一波敌人"文本，显示倒计时
                if (this.nextWaveLabel) {
                    this.nextWaveLabel.node.active = false;
                }
                if (this.countdownLabel) {
                    this.countdownLabel.node.active = true;
                    //console.info(`[CountdownPopup] update() 显示 countdownLabel`);
                }
                
                // 开始倒计时
                this.isShowingNextWaveText = false;
                this.isCounting = true;
                this.updateCountdownLabel();
                //console.info(`[CountdownPopup] update() 开始倒计时，isCounting=${this.isCounting}`);
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
                
                //console.info(`[CountdownPopup] update() 倒计时结束`);
                if (this.onCountdownComplete) {
                    this.onCountdownComplete();
                } else {
                }
                this.hide();
            }
        }
    }
}
