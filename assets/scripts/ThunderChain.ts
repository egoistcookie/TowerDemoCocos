import { _decorator, Component, Node, Vec3, find, Graphics, Color, UITransform, Sprite, SpriteFrame } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * 闪电链：在敌人之间传递攻击，最多弹射3次，每次弹射的目标都在上一目标的100像素范围之内
 * 一次攻击不能对同一单位造成两次伤害，被命中的敌人身上会有电火花特效
 */
@ccclass('ThunderChain')
export class ThunderChain extends Component {
    @property
    damage: number = 20; // 伤害值

    @property
    maxBounces: number = 3; // 最大弹射次数

    @property
    bounceRange: number = 100; // 弹射范围（像素）

    @property(SpriteFrame)
    lightningTexture: SpriteFrame = null!; // 闪电链贴图（可选）

    @property
    textureSegmentCount: number = 5; // 贴图分段数量（在起点和终点之间放置的贴图数量）

    private currentTarget: Node = null!; // 当前目标
    private hitEnemies: Set<Node> = new Set(); // 已命中的敌人集合
    private bounceCount: number = 0; // 当前弹射次数
    private onHitCallback: ((damage: number, enemy: Node) => void) | null = null;
    private gameManager: GameManager | null = null;
    private chainNodes: Node[] = []; // 闪电链节点数组（用于显示特效）
    private sparkNodes: Node[] = []; // 电火花节点数组（用于显示特效）

    /**
     * 初始化闪电链
     * @param startPos 起始位置（塔的位置）
     * @param firstTarget 第一个目标
     * @param damage 伤害值
     * @param onHit 命中回调函数
     */
    init(startPos: Vec3, firstTarget: Node, damage: number, onHit?: (damage: number, enemy: Node) => void) {
        this.damage = damage;
        this.onHitCallback = onHit || null;
        this.currentTarget = firstTarget;
        this.hitEnemies.clear();
        this.bounceCount = 0;
        this.chainNodes = [];
        this.sparkNodes = [];

        // 立即开始攻击第一个目标
        this.attackTarget(startPos, firstTarget);
    }

    /**
     * 攻击目标
     */
    private attackTarget(fromPos: Vec3, target: Node) {
        if (!target || !target.isValid || !target.active) {
            this.destroyChain();
            return;
        }

        // 检查是否已经命中过这个目标
        if (this.hitEnemies.has(target)) {
            this.destroyChain();
            return;
        }

        // 标记为已命中
        this.hitEnemies.add(target);
        this.bounceCount++;

        // 计算当前伤害：第一跳使用原始伤害，之后每一跳伤害缩减一半
        // bounceCount从1开始，所以第一跳时bounceCount=1，伤害=damage
        // 第二跳时bounceCount=2，伤害=damage/2
        // 第三跳时bounceCount=3，伤害=damage/4
        const currentDamage = this.damage / Math.pow(2, this.bounceCount - 1);

        // 显示闪电特效（起点往上移20像素）
        const adjustedFromPos = new Vec3(fromPos.x, fromPos.y + 20, fromPos.z);
        this.createLightningEffect(adjustedFromPos, target.worldPosition);

        // 显示电火花特效
        this.createSparkEffect(target.worldPosition);

        // 应用伤害（使用计算后的当前伤害）
        if (this.onHitCallback) {
            this.onHitCallback(currentDamage, target);
        }

        // 检查是否可以继续弹射
        if (this.bounceCount < this.maxBounces) {
            // 查找下一个目标
            const nextTarget = this.findNextTarget(target.worldPosition);
            if (nextTarget) {
                // 延迟一小段时间后攻击下一个目标（视觉效果）
                this.scheduleOnce(() => {
                    this.attackTarget(target.worldPosition, nextTarget);
                }, 0.1);
            } else {
                // 没有找到下一个目标，结束
                this.scheduleOnce(() => {
                    this.destroyChain();
                }, 0.3);
            }
        } else {
            // 达到最大弹射次数，结束
            this.scheduleOnce(() => {
                this.destroyChain();
            }, 0.3);
        }
    }

    /**
     * 查找下一个弹射目标
     */
    private findNextTarget(fromPos: Vec3): Node | null {
        const enemiesNode = find('Canvas/Enemies');
        if (!enemiesNode) return null;

        const rangeSq = this.bounceRange * this.bounceRange;
        let nearestEnemy: Node | null = null;
        let minDistanceSq = rangeSq;

        for (const enemy of enemiesNode.children) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;
            if (this.hitEnemies.has(enemy)) continue; // 已命中过

            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('OrcWarrior') as any ||
                               enemy.getComponent('TrollSpearman') as any;
            
            if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) continue;

            const dx = enemy.worldPosition.x - fromPos.x;
            const dy = enemy.worldPosition.y - fromPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= rangeSq && distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestEnemy = enemy;
            }
        }

        return nearestEnemy;
    }

    /**
     * 创建闪电特效
     */
    private createLightningEffect(fromPos: Vec3, toPos: Vec3) {
        // 如果有贴图，使用贴图方式
        if (this.lightningTexture) {
            this.createLightningEffectWithTexture(fromPos, toPos);
        } else {
            // 否则使用Graphics绘制
            this.createLightningEffectWithGraphics(fromPos, toPos);
        }
    }

    /**
     * 使用贴图创建闪电特效
     * 创建一个贴图节点，宽度固定30像素，长度等于两点之间的实际距离
     */
    private createLightningEffectWithTexture(fromPos: Vec3, toPos: Vec3) {
        // 输出起始和结束位置的坐标
        //console.info(`[ThunderChain] 起始位置 fromPos: (${fromPos.x.toFixed(2)}, ${fromPos.y.toFixed(2)}, ${fromPos.z.toFixed(2)})`);
        //console.info(`[ThunderChain] 结束位置 toPos: (${toPos.x.toFixed(2)}, ${toPos.y.toFixed(2)}, ${toPos.z.toFixed(2)})`);
        
        // 计算方向和距离
        const direction = new Vec3();
        Vec3.subtract(direction, toPos, fromPos);
        const distance = direction.length();
        
        // 如果距离太近（小于20像素），不显示贴图，避免出现原贴图尺寸
        const minDistance = 20;
        if (distance < minDistance) {
            //console.info(`[ThunderChain] 距离太近 (${distance.toFixed(2)} < ${minDistance})，跳过贴图显示`);
            return;
        }
        
        const canvas = find('Canvas');
        const parent = canvas || this.node.scene || this.node.parent;
        // 原图是沿x轴平放的，计算从x轴正方向到目标方向的角度
        // 由于Cocos Creator的旋转系统，可能需要调整
        let angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
        
        // 尝试不同的角度调整方式（根据实际效果选择）
        // 如果贴图方向不对，可以尝试：
        // angle = angle - 90; // 如果贴图原本是垂直向上的
        // angle = angle + 90; // 如果贴图原本是垂直向下的
        // angle = -angle; // 如果旋转方向相反
        
        // 先尝试不调整，如果方向不对再调整
        // 如果贴图是沿x轴平放的，标准计算应该是正确的
        
        //console.info(`[ThunderChain] 距离: ${distance.toFixed(2)}, 计算角度: ${angle.toFixed(2)}°, 方向向量: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)})`);

        // 固定宽度为10像素，长度为两点之间的实际距离
        const textureWidth = 10;
        const textureLength = distance;

        // 创建容器节点（用于管理所有贴图段）
        const containerNode = new Node('LightningContainer');
        containerNode.setParent(parent);
        containerNode.active = true;
        // 将容器节点位置设置到起点（防御塔位置）
        containerNode.setWorldPosition(fromPos);
        this.chainNodes.push(containerNode);

        // 创建单个贴图节点，从起点到终点
        const lightningNode = new Node('LightningTexture');
        lightningNode.setParent(containerNode);
        lightningNode.active = true;
        
        // 添加UITransform并设置尺寸
        const transform = lightningNode.addComponent(UITransform);
        // 锚点设置在底部中心 (0.5, 0)，这样贴图会从起点（防御塔位置）延伸到终点
        transform.setAnchorPoint(0.5, 0);
        // 设置尺寸：宽度10，长度等于实际距离
        transform.setContentSize(textureWidth, textureLength);

        // 添加Sprite组件
        const sprite = lightningNode.addComponent(Sprite);
        // 重要：先设置sizeMode和其他属性，再设置spriteFrame
        // 使用 CUSTOM 模式，让贴图按照 UITransform 的尺寸显示
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.trim = false;
        // 然后设置 spriteFrame
        sprite.spriteFrame = this.lightningTexture;
        
        // 设置节点本地位置为 (0, 0)，因为父节点（容器）已经在起点（防御塔位置）
        lightningNode.setPosition(0, 0, 0);

        // 设置旋转角度，让贴图指向目标方向
        lightningNode.setRotationFromEuler(0, 0, angle - 90);
        
        // 输出详细日志，帮助调试
        //console.info(`[ThunderChain] 贴图节点创建 - 尺寸: (${textureWidth}, ${textureLength.toFixed(2)}), sizeMode: ${sprite.sizeMode}, type: ${sprite.type}, trim: ${sprite.trim}`);
        //console.info(`[ThunderChain] UITransform尺寸: (${transform.width.toFixed(2)}, ${transform.height.toFixed(2)}), 锚点: (${transform.anchorX}, ${transform.anchorY})`);
        
        // 使用 scheduleOnce 延迟一帧，确保所有属性都已应用
        this.scheduleOnce(() => {
            if (lightningNode && lightningNode.isValid && sprite && sprite.isValid && transform && transform.isValid) {
                // 再次确认尺寸和位置
                transform.setContentSize(textureWidth, textureLength);
                lightningNode.setPosition(0, 0, 0);
                // 再次确认Sprite属性
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.type = Sprite.Type.SIMPLE;
                sprite.trim = false;
                // 强制刷新 Sprite
                sprite.enabled = false;
                sprite.enabled = true;
                
                // 输出验证日志
                //console.info(`[ThunderChain] 延迟后验证 - UITransform尺寸: (${transform.width.toFixed(2)}, ${transform.height.toFixed(2)}), sizeMode: ${sprite.sizeMode}`);
                
                // 检查是否使用了原图尺寸（如果spriteFrame存在，检查其原始尺寸）
                if (sprite.spriteFrame) {
                    const originalSize = sprite.spriteFrame.originalSize;
                    //console.info(`[ThunderChain] 原图尺寸: (${originalSize.width}, ${originalSize.height})`);
                    // 如果UITransform的尺寸和原图尺寸相同，说明可能使用了原图尺寸
                    if (Math.abs(transform.width - originalSize.width) < 1 && Math.abs(transform.height - originalSize.height) < 1) {
                        console.warn(`[ThunderChain] 警告：检测到可能使用了原图尺寸！UITransform: (${transform.width}, ${transform.height}), 原图: (${originalSize.width}, ${originalSize.height})`);
                    }
                }
            }
        }, 0);

        // 淡出并销毁
        this.scheduleOnce(() => {
            if (containerNode && containerNode.isValid) {
                containerNode.destroy();
            }
        }, 0.2);
    }

    /**
     * 使用Graphics绘制闪电特效（多条白金色曲折折线）
     */
    private createLightningEffectWithGraphics(fromPos: Vec3, toPos: Vec3) {
        const lightningNode = new Node('Lightning');
        const canvas = find('Canvas');
        if (canvas) {
            lightningNode.setParent(canvas);
        } else if (this.node.scene) {
            lightningNode.setParent(this.node.scene);
        } else {
            lightningNode.setParent(this.node.parent);
        }

        const transform = lightningNode.addComponent(UITransform);
        transform.setContentSize(200, 200);

        const graphics = lightningNode.addComponent(Graphics);
        
        // 计算相对位置
        const centerPos = new Vec3();
        Vec3.lerp(centerPos, fromPos, toPos, 0.5);
        lightningNode.setWorldPosition(centerPos);

        // 计算方向和距离
        const direction = new Vec3();
        Vec3.subtract(direction, toPos, fromPos);
        const distance = direction.length();
        direction.normalize();

        // 白金色：金色偏白 (255, 248, 220) 或更亮的金色 (255, 255, 200)
        const goldColor = new Color(255, 248, 220, 255); // 白金色
        const brightGoldColor = new Color(255, 255, 200, 255); // 更亮的白金色

        // 绘制多条曲折折线（3-5条）
        const lineCount = 3 + Math.floor(Math.random() * 3); // 3-5条线
        const segments = 10; // 每条线的分段数
        const offsetRange = 15; // 曲折偏移范围

        // 计算起点和终点的相对位置
        const startPos = new Vec3();
        Vec3.subtract(startPos, fromPos, centerPos);
        const endPos = new Vec3();
        Vec3.subtract(endPos, toPos, centerPos);

        for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
            // 每条线的颜色略有不同（从白金色到亮白金色）
            const colorLerp = lineIndex / (lineCount - 1);
            const currentColor = new Color();
            Color.lerp(currentColor, goldColor, brightGoldColor, colorLerp);
            graphics.strokeColor = currentColor;
            
            // 线条宽度略有变化（2-4像素）
            graphics.lineWidth = 2 + (lineIndex % 3);

            // 绘制一条曲折折线
            graphics.moveTo(startPos.x, startPos.y);

            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const nextPos = new Vec3();
                Vec3.lerp(nextPos, startPos, endPos, t);

                // 添加随机偏移（曲折效果）
                // 使用不同的随机种子，让每条线的曲折程度不同
                const randomSeed = lineIndex * 1000 + i;
                const random1 = (Math.sin(randomSeed) + 1) / 2; // 使用sin函数生成伪随机数
                const random2 = (Math.cos(randomSeed * 1.3) + 1) / 2;
                
                const offsetX = (random1 - 0.5) * offsetRange;
                const offsetY = (random2 - 0.5) * offsetRange;
                nextPos.x += offsetX;
                nextPos.y += offsetY;

                graphics.lineTo(nextPos.x, nextPos.y);
            }

            graphics.stroke();
        }

        this.chainNodes.push(lightningNode);

        // 淡出并销毁
        this.scheduleOnce(() => {
            if (lightningNode && lightningNode.isValid) {
                lightningNode.destroy();
            }
        }, 0.2);
    }

    /**
     * 创建电火花特效（更明显）
     */
    private createSparkEffect(pos: Vec3) {
        const sparkNode = new Node('Spark');
        const canvas = find('Canvas');
        if (canvas) {
            sparkNode.setParent(canvas);
        } else if (this.node.scene) {
            sparkNode.setParent(this.node.scene);
        } else {
            sparkNode.setParent(this.node.parent);
        }

        sparkNode.setWorldPosition(pos);

        const transform = sparkNode.addComponent(UITransform);
        transform.setContentSize(60, 60); // 缩小尺寸

        const graphics = sparkNode.addComponent(Graphics);

        // 绘制电火花（更多线条，更粗，更亮）
        // 外层大电火花（12条）
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const length = 10 + Math.random() * 15; // 缩小线条长度
            const endX = Math.cos(angle) * length;
            const endY = Math.sin(angle) * length;

            graphics.strokeColor = new Color(255, 255, 100, 255); // 更亮的黄色
            graphics.lineWidth = 3; // 稍微缩小线条宽度
            graphics.moveTo(0, 0);
            graphics.lineTo(endX, endY);
            graphics.stroke();
        }
        
        // 内层小电火花（8条）
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.PI / 8; // 偏移角度
            const length = 6 + Math.random() * 9; // 缩小线条长度
            const endX = Math.cos(angle) * length;
            const endY = Math.sin(angle) * length;

            graphics.strokeColor = new Color(255, 255, 200, 255); // 更亮的白色
            graphics.lineWidth = 2; // 稍微缩小线条宽度
            graphics.moveTo(0, 0);
            graphics.lineTo(endX, endY);
            graphics.stroke();
        }
        
        // 中心亮点
        graphics.fillColor = new Color(255, 255, 255, 255); // 白色
        graphics.circle(0, 0, 2); // 缩小中心亮点
        graphics.fill();

        // 将电火花节点添加到跟踪数组
        this.sparkNodes.push(sparkNode);

        // 淡出并销毁（稍微延长显示时间）
        this.scheduleOnce(() => {
            if (sparkNode && sparkNode.isValid) {
                // 从数组中移除
                const index = this.sparkNodes.indexOf(sparkNode);
                if (index > -1) {
                    this.sparkNodes.splice(index, 1);
                }
                sparkNode.destroy();
            }
        }, 0.5); // 延长到0.5秒
    }

    /**
     * 销毁闪电链
     */
    private destroyChain() {
        // 清理所有闪电链特效节点
        for (const node of this.chainNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.chainNodes = [];

        // 清理所有电火花特效节点
        for (const node of this.sparkNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.sparkNodes = [];

        // 销毁自身
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1);
    }
}
