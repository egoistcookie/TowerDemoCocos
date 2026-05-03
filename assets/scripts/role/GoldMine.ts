import { _decorator, Node, Vec3, find, Prefab, instantiate, SpriteFrame, AudioClip, Graphics, UITransform, Color, EventTouch, Sprite, Label, UIOpacity, tween, LabelOutline } from 'cc';
import { Build } from './Build';
import { UnitInfo } from '../UnitInfoPanel';
import { GameManager, GameState } from '../GameManager';
import { AudioManager } from '../AudioManager';
import { UnitManager } from '../UnitManager';
import { getEnemyLikeScript } from '../EnemyScriptLookup';
const { ccclass, property } = _decorator;

// 占领状态枚举
enum CaptureState {
    Neutral = 0,  // 中立
    Friendly = 1, // 我方
    Enemy = 2     // 敌方
}

@ccclass('GoldMine')
export class GoldMine extends Build {
    // 金矿属性
    @property
    goldOutputRate: number = 1; // 每秒产出的金币

    @property
    captureRange: number = 200; // 占领判定范围

    // 口号相关
    @property
    battleCryChance: number = 0.3; // 触发口号的概率（30%）

    @property({ type: [String] })
    friendlyBattleCries: string[] = ["金币金币！", "守护我们的金矿！", "布灵布灵~"]; // 我方占领时口号

    @property({ type: [String] })
    enemyBattleCries: string[] = ["还回来！", "不能让兽人占领！", "这是我们的！"]; // 敌方占领时口号

    private battleCryTimer: number = 0; // 口号触发计时器
    private readonly BATTLE_CRY_INTERVAL: number = 3.0; // 口号触发间隔（秒）

    // 金矿无敌，不需要生命值

    // 占领相关属性
    private captureState: CaptureState = CaptureState.Friendly; // 当前占领状态，初始属于我方
    private captureProgress: number = 0; // 占领进度（0-5 秒）
    private readonly CAPTURE_TIME: number = 5.0; // 占领所需时间（秒）
    private captureIndicator: Node = null!; // 占领指示器节点（圆弧）
    private captureIndicatorGraphics: Graphics = null!; // 占领指示器 Graphics 组件
    private unitManager: UnitManager = null!; // 单位管理器引用

    // 金币产出相关
    private goldOutputTimer: number = 0; // 金币产出计时器
    private tempVec3_1: Vec3 = new Vec3(); // 临时 Vec3 对象，避免 clone 创建

    // 动画相关 - 在预制体中配置动画帧序列
    @property([SpriteFrame])
    runningFrames: SpriteFrame[] = []; // 运行动画帧序列

    @property
    frameRate: number = 12; // 动画帧率（每秒帧数）

    @property(AudioClip)
    runningSound: AudioClip = null!; // 运行动画音效

    private currentFrameIndex: number = 0; // 当前帧索引
    private frameTimer: number = 0; // 帧切换计时器
    private isRunning: boolean = false; // 是否正在播放运行动画

    // 金矿无敌，不需要血条

    start() {
        // 初始化单位管理器
        this.unitManager = UnitManager.getInstance();

        // 获取 Sprite 组件（从父类继承）
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }

        // 创建占领指示器
        this.createCaptureIndicator();

        // 设置初始状态为敌方
        this.captureState = CaptureState.Enemy;
        this.isRunning = true;

        // 播放运行动画（如果有）
        this.playRunningAnimation();
    }

    onEnable() {
        // 重置状态
        this.captureState = CaptureState.Enemy;
        this.captureProgress = 0;
        this.goldOutputTimer = 0;
        this.isRunning = true;
        this.currentFrameIndex = 0;

        // 获取 Sprite 组件（如果之前没有）
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }

        // 播放运行动画
        this.playRunningAnimation();
    }

    update(deltaTime: number) {
        if (!this.node.isValid || !this.node.active) return;

        // 检查游戏状态
        const gameManager = this.getGameManager();
        if (!gameManager) return;

        const gameState = gameManager.getGameState();
        if (gameState !== GameState.Playing) {
            return;
        }

        // 处理占领逻辑
        this.updateCapture(deltaTime);

        // 处理金币产出逻辑
        if (this.captureState === CaptureState.Friendly) {
            this.goldOutputTimer += deltaTime;
            if (this.goldOutputTimer >= 1.0) {
                this.goldOutputTimer = 0;
                this.outputGold();
            }
            // 播放运行动画
            if (!this.isRunning) {
                this.playRunningAnimation();
            }
            // 更新动画帧
            if (this.runningFrames.length > 0 && this.sprite) {
                this.updateAnimationFrame(deltaTime);
            }
        } else {
            // 非我方占领时停止运行
            if (this.isRunning) {
                this.stopRunningAnimation();
            }
        }
    }

    /**
     * 更新动画帧
     */
    private updateAnimationFrame(deltaTime: number) {
        if (this.runningFrames.length === 0 || !this.sprite) return;

        this.frameTimer += deltaTime;
        const frameInterval = 1.0 / this.frameRate;

        if (this.frameTimer >= frameInterval) {
            this.frameTimer = 0;
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.runningFrames.length;
            this.sprite.spriteFrame = this.runningFrames[this.currentFrameIndex];
        }
    }

    /**
     * 获取 GameManager
     */
    private getGameManager(): GameManager | null {
        const managers = find('Canvas/GameManager');
        if (managers) {
            return managers.getComponent('GameManager') as GameManager;
        }
        return null;
    }

    /**
     * 更新占领逻辑
     */
    private updateCapture(deltaTime: number) {
        // 获取范围内的单位数量
        const myPos = this.node.worldPosition;
        const friendlyCount = this.getFriendlyUnitsInRange(myPos, this.captureRange);
        const enemyCount = this.getEnemyUnitsInRange(myPos, this.captureRange);

        // 金矿为我方占领时，只要范围内有我方的单位，每隔 3 秒判定一次，30% 概率触发口号
        // 金矿为敌方占领时，只要范围内有我方的单位，每隔 3 秒判定一次，30% 概率触发夺回口号
        if (friendlyCount > 0 && (this.captureState === CaptureState.Friendly || this.captureState === CaptureState.Enemy)) {
            this.battleCryTimer += deltaTime;
            if (this.battleCryTimer >= this.BATTLE_CRY_INTERVAL) {
                this.battleCryTimer = 0;
                  //console.log(`[GoldMine] 口号判定：随机数=${Math.random()}, 阈值=${this.battleCryChance}, 我方单位数=${friendlyCount}, 占领状态=${this.captureState}`);
                // 30% 概率触发口号
                if (Math.random() < this.battleCryChance) {
                      //console.log(`[GoldMine] 触发言号！`);
                    this.tryPlayBattleCryForUnit();
                }
            }
        } else {
            // 没有我方单位时，重置计时器
            this.battleCryTimer = 0;
        }

        // 判断当前优势方
        const friendlyAdvantage = friendlyCount > enemyCount;
        const enemyAdvantage = enemyCount > friendlyCount;
        const isBalanced = friendlyCount === enemyCount;

        // 确定当前优势方
        let currentAdvantage: 'friendly' | 'enemy' | 'balanced' = 'balanced';
        if (friendlyAdvantage) {
            currentAdvantage = 'friendly';
        } else if (enemyAdvantage) {
            currentAdvantage = 'enemy';
        }

        // 处理占领进度
        // 金矿为敌方占领时，只要我方单位在范围内且数量多于敌方，就可以开始读条夺回
        // 金矿为我方占领时，只要敌方单位在范围内且数量多于我方，就可以开始读条夺取
        if (friendlyAdvantage && this.captureState !== CaptureState.Friendly) {
            // 我方优势且金矿不属于我方，增加占领进度
            this.captureProgress += deltaTime;
            this.showCaptureIndicator(true); // 显示绿色圆弧（我方）
            this.updateCaptureIndicator(this.captureProgress / this.CAPTURE_TIME, true);

            if (this.captureProgress >= this.CAPTURE_TIME) {
                // 占领完成，设置为我方
                this.captureState = CaptureState.Friendly;
                this.captureProgress = 0;
                this.hideCaptureIndicator();
                  //console.log('[GoldMine] 被我方占领');
                // 播放占领成功音效
                this.playCaptureSuccessSound();
            }
        } else if (enemyAdvantage && this.captureState !== CaptureState.Enemy) {
            // 敌方优势且金矿不属于敌方，增加占领进度
            this.captureProgress += deltaTime;
            this.showCaptureIndicator(false); // 显示红色圆弧（敌方）
            this.updateCaptureIndicator(this.captureProgress / this.CAPTURE_TIME, false);

            if (this.captureProgress >= this.CAPTURE_TIME) {
                // 占领完成，设置为敌方
                this.captureState = CaptureState.Enemy;
                this.captureProgress = 0;
                this.hideCaptureIndicator();
                  //console.log('[GoldMine] 被敌方占领');
                // 播放被敌人占领音效
                this.playEnemyCaptureSound();
            }
        } else {
            // 平衡状态或已占领，隐藏指示器并重置进度
            if (isBalanced || (this.captureState === CaptureState.Friendly && !friendlyAdvantage) || (this.captureState === CaptureState.Enemy && !enemyAdvantage)) {
                this.captureProgress = 0;
                this.hideCaptureIndicator();
            }
        }
    }

    /**
     * 获取范围内的友好单位数量（只计算可移动单位，不包括防御塔、建筑物和石墙）
     */
    private getFriendlyUnitsInRange(center: Vec3, range: number): number {
        let count = 0;
        const rangeSq = range * range;

        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        // 只计算可移动单位：弓箭手、牧师、女猎手、精灵剑士、法师
        const friendlyContainers = [
            'Canvas/Towers',      // Arrower, Priest
            'Canvas/EagleArchers', // EagleArcher
            'Canvas/Hunters',     // Hunter
            'Canvas/ElfSwordsmans', // ElfSwordsman
            'Canvas/Mages'        // Mage
        ];

        const scriptsToCheck = ['Arrower', 'EagleArcher', 'Priest', 'Hunter', 'ElfSwordsman', 'Mage'];

        for (const containerName of friendlyContainers) {
            const containerNode = find(containerName);
            if (containerNode && containerNode.isValid) {
                for (const unit of containerNode.children) {
                    if (!unit || !unit.isValid || !unit.active) continue;

                    for (const scriptName of scriptsToCheck) {
                        const script = unit.getComponent(scriptName) as any;
                        if (script && script.isAlive && typeof script.isAlive === 'function' && script.isAlive()) {
                            const dx = unit.worldPosition.x - center.x;
                            const dy = unit.worldPosition.y - center.y;
                            if (dx * dx + dy * dy <= rangeSq) {
                                count++;
                            }
                            break; // 找到一个脚本就停止检查
                        }
                    }
                }
            }
        }

        return count;
    }

    /**
     * 获取范围内第一个我方单位节点
     */
    private getFirstFriendlyUnitNodeInRange(center: Vec3, range: number): Node | null {
        const rangeSq = range * range;

        const friendlyContainers = [
            'Canvas/Towers',
            'Canvas/EagleArchers',
            'Canvas/Hunters',
            'Canvas/ElfSwordsmans',
            'Canvas/Mages'
        ];

        const scriptsToCheck = ['Arrower', 'EagleArcher', 'Priest', 'Hunter', 'ElfSwordsman', 'Mage'];

        for (const containerName of friendlyContainers) {
            const containerNode = find(containerName);
            if (containerNode && containerNode.isValid) {
                for (const unit of containerNode.children) {
                    if (!unit || !unit.isValid || !unit.active) continue;

                    for (const scriptName of scriptsToCheck) {
                        const script = unit.getComponent(scriptName) as any;
                        if (script && script.isAlive && typeof script.isAlive === 'function' && script.isAlive()) {
                            const dx = unit.worldPosition.x - center.x;
                            const dy = unit.worldPosition.y - center.y;
                            if (dx * dx + dy * dy <= rangeSq) {
                                return unit;
                            }
                            break;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * 获取范围内的敌方单位数量
     */
    private getEnemyUnitsInRange(center: Vec3, range: number): number {
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        if (this.unitManager) {
            const enemies = this.unitManager.getEnemiesInRange(center, range, true);
            return enemies.length;
        }

        // 降级方案：直接查找
        let count = 0;
        const rangeSq = range * range;
        const enemyContainers = [
            'Canvas/Enemies',
            'Canvas/Orcs',
            'Canvas/TrollSpearmans',
            'Canvas/OrcWarriors',
            'Canvas/OrcWarlords',
            'Canvas/MinotaurWarriors',
            'Canvas/Dragons',
            'Canvas/Boss',
            'Canvas/Portals'
        ];

        for (const containerName of enemyContainers) {
            const containerNode = find(containerName);
            if (containerNode && containerNode.isValid) {
                for (const enemy of containerNode.children) {
                    if (!enemy || !enemy.isValid || !enemy.active) continue;
                    const enemyScript = getEnemyLikeScript(enemy);
                    if (enemyScript && enemyScript.isAlive && enemyScript.isAlive()) {
                        const dx = enemy.worldPosition.x - center.x;
                        const dy = enemy.worldPosition.y - center.y;
                        if (dx * dx + dy * dy <= rangeSq) {
                            count++;
                        }
                    }
                }
            }
        }

        return count;
    }

    /**
     * 创建占领指示器
     */
    private createCaptureIndicator() {
        // 创建指示器节点
        this.captureIndicator = new Node('CaptureIndicator');
        this.captureIndicator.setParent(this.node);
        this.captureIndicator.setPosition(0, 0, 0);

        const uiTransform = this.captureIndicator.addComponent(UITransform);
        uiTransform.setContentSize(this.captureRange * 2, this.captureRange * 2);

        // 创建 Graphics 组件用于绘制圆弧
        this.captureIndicatorGraphics = this.captureIndicator.addComponent(Graphics);

        // 初始隐藏
        this.captureIndicator.active = false;
    }

    /**
     * 显示占领指示器
     */
    private showCaptureIndicator(isFriendly: boolean) {
        if (this.captureIndicator && this.captureIndicator.isValid) {
            this.captureIndicator.active = true;
        }
    }

    /**
     * 更新占领指示器进度
     */
    private updateCaptureIndicator(progress: number, isFriendly: boolean) {
        if (!this.captureIndicator || !this.captureIndicator.isValid || !this.captureIndicatorGraphics) {
            return;
        }

        // 清除之前的绘制
        this.captureIndicatorGraphics.clear();

        // 设置绘制参数
        const radius = this.captureRange; // 使用占领范围作为半径
        const lineWidth = 6; // 线条宽度
        const centerX = 0;
        const centerY = 0;

        // 设置颜色
        const color = isFriendly ? new Color(0, 255, 0, 200) : new Color(255, 0, 0, 200); // 绿色或红色

        // 绘制圆弧（从 -90 度开始，顺时针绘制）
        const startAngle = -Math.PI / 2; // -90 度
        const endAngle = startAngle + (Math.PI * 2 * progress); // 根据进度计算结束角度

        this.captureIndicatorGraphics.strokeColor = color;
        this.captureIndicatorGraphics.lineWidth = lineWidth;
        this.captureIndicatorGraphics.circle(centerX, centerY, radius);
        this.captureIndicatorGraphics.stroke();

        // 绘制填充扇形（使用 arc 替代方案）
        this.captureIndicatorGraphics.fillColor = new Color(color.r, color.g, color.b, 50);

        // 使用 bezierCurveTo 或 lineTo 近似绘制扇形
        const segments = 20; // 分段数，越多越圆滑
        const angleStep = (endAngle - startAngle) / segments;

        this.captureIndicatorGraphics.moveTo(centerX, centerY);
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + angleStep * i;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (i === 0) {
                this.captureIndicatorGraphics.lineTo(x, y);
            } else {
                this.captureIndicatorGraphics.lineTo(x, y);
            }
        }
        this.captureIndicatorGraphics.lineTo(centerX, centerY);
        this.captureIndicatorGraphics.fill();
    }

    /**
     * 隐藏占领指示器
     */
    private hideCaptureIndicator() {
        if (this.captureIndicator && this.captureIndicator.isValid) {
            this.captureIndicator.active = false;
        }
    }

    /**
     * 产出金币
     */
    private outputGold() {
        const gameManager = this.getGameManager();
        if (!gameManager) return;

        // 调用 GameManager 的增加金币方法
        const goldOutput = this.goldOutputRate;
        // 使用反射调用 addGold 方法
        if ((gameManager as any).addGold) {
            (gameManager as any).addGold(goldOutput);
        }

        // 显示 +1 gold 飘字
        this.showGoldRewardText();
    }

    /**
     * 显示金币奖励飘字
     */
    private showGoldRewardText() {
        if (!this.node || !this.node.isValid) return;

        const canvas = find('Canvas');
        const parentNode = canvas || this.node.scene || this.node.parent;
        if (!parentNode) return;

        const basePos = this.tempVec3_1.set(this.node.worldPosition);
        basePos.y += 50; // 在金矿上方显示

        const n = new Node('GoldRewardText');
        n.setParent(parentNode);

        // 放到石墙（索引 30）之后，UI 层之前，确保不被石墙遮挡
        // 参考 DamageNumber 的位置（索引 48-50）
        try {
            n.setSiblingIndex(48);
        } catch {}

        n.setWorldPosition(basePos);

        let label: Label | null = n.getComponent(Label);
        if (!label) label = n.addComponent(Label);
        label.string = '+1 gold';
        label.fontSize = 20;
        label.color = new Color(255, 215, 0, 255); // 金色

        // 添加 LabelOutline 组件实现描边效果
        let outline = label.node.getComponent(LabelOutline);
        if (!outline) {
            outline = label.node.addComponent(LabelOutline);
        }
        outline.color = new Color(0, 0, 0, 255);
        outline.width = 2;

        const opacity = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
        opacity.opacity = 255;

        const floatUp = 30; // 上浮距离

        tween(n)
            .delay(0.1)
            .to(0.8, { worldPosition: new Vec3(basePos.x, basePos.y + floatUp, basePos.z) }, { easing: 'sineOut' })
            .parallel(tween(opacity).to(0.8, { opacity: 0 }))
            .call(() => {
                if (n && n.isValid) n.destroy();
            })
            .start();
    }

    /**
     * 播放运行动画
     */
    private playRunningAnimation() {
        // 播放运行音效（如果有）
        if (this.runningSound) {
            const audioManager = find('Canvas/AudioManager');
            if (audioManager) {
                const audioComp = audioManager.getComponent('AudioManager') as AudioManager;
                if (audioComp && audioComp.playSFX) {
                    audioComp.playSFX(this.runningSound);
                }
            }
        }
    }

    /**
     * 停止运行动画
     */
    private stopRunningAnimation() {
        this.isRunning = false;
    }

    /**
     * 播放占领成功音效
     */
    private playCaptureSuccessSound() {
        // 可以在这里播放占领成功的音效
        // 暂时留空，后续可以添加音效
    }

    /**
     * 播放被敌人占领音效
     */
    private playEnemyCaptureSound() {
        // 可以在这里播放被敌人占领的音效
        // 暂时留空，后续可以添加音效
    }

    /**
     * 尝试播放口号（30% 概率）- 由我方单位触发
     */
    private tryPlayBattleCryForUnit() {
        // 根据占领状态选择口号数组
        const cries = this.captureState === CaptureState.Friendly ? this.friendlyBattleCries : this.enemyBattleCries;

        // 获取进入范围的我方单位（取第一个）
        const unit = this.getFirstFriendlyUnitNodeInRange(this.node.worldPosition, this.captureRange);
          //console.log(`[GoldMine] 获取单位结果：${unit ? '找到' : '未找到'}`);
        if (unit && unit.isValid && unit.active) {
            // 调用单位的 createDialog 方法发出口号
            const unitScript = unit.getComponent('Role') as any;
            if (unitScript && unitScript.createDialog) {
                const cry = cries[Math.floor(Math.random() * cries.length)];
                  //console.log(`[GoldMine] 单位 ${unit.name} 发出口号：${cry}`);
                unitScript.createDialog(cry, false);
            }
        }
    }

    onDestroy() {
        // 清理
    }
}
