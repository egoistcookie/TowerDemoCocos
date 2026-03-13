import { _decorator, Component, Node, Vec3, find, Graphics, Color, UITransform } from 'cc';
import { GameManager, GameState } from './GameManager';
import { ColdEffectUpdater } from './ColdEffectUpdater';
const { ccclass, property } = _decorator;

/**
 * 冰箭：直线攻击，命中后造成减速效果，并显示寒气特效
 */
@ccclass('IceArrow')
export class IceArrow extends Component {
    @property
    speed: number = 600; // 冰箭飞行速度（像素/秒）

    @property
    damage: number = 15; // 单体基础伤害值

    @property
    aoeRadius: number = 70; // 范围伤害与减速的半径（像素）

    @property
    slowDownRatio: number = 0.5; // 减速比例（0.5表示减速50%）

    @property
    slowDownDuration: number = 2.0; // 减速持续时间（秒）

    private startPos: Vec3 = new Vec3();
    private direction: Vec3 = new Vec3(); // 飞行方向（归一化）
    private travelDistance: number = 0; // 总飞行距离
    private traveledDistance: number = 0; // 已飞行距离
    private onHitCallback: ((damage: number, hitPos: Vec3, enemy: Node, hitDirection: Vec3) => void) | null = null;
    private isFlying: boolean = false;
    private gameManager: GameManager | null = null;
    private hitEnemies: Set<Node> = new Set(); // 已命中的敌人集合，避免重复伤害

    /**
     * 初始化冰箭
     * @param startPos 起始位置
     * @param targetNode 目标节点（用于计算初始方向）
     * @param damage 伤害值
     * @param onHit 命中回调函数（参数：伤害值，命中位置，敌人节点，受击方向）
     */
    init(startPos: Vec3, targetNode: Node, damage: number, onHit?: (damage: number, hitPos: Vec3, enemy: Node, hitDirection: Vec3) => void) {
        this.startPos = startPos.clone();
        this.damage = damage;
        this.onHitCallback = onHit || null;
        this.traveledDistance = 0;
        this.hitEnemies.clear();

        // 设置初始位置
        this.node.setWorldPosition(this.startPos);

        // 计算初始方向
        let targetPos: Vec3;
        if (targetNode && targetNode.isValid) {
            targetPos = targetNode.worldPosition.clone();
        } else {
            targetPos = this.startPos.clone();
            targetPos.x += 200;
        }

        Vec3.subtract(this.direction, targetPos, this.startPos);
        const distance = this.direction.length();
        
        if (distance < 0.1) {
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0);
            return;
        }

        this.direction.normalize();
        this.travelDistance = distance;

        // 设置初始旋转角度
        const angle = Math.atan2(this.direction.y, this.direction.x) * 180 / Math.PI;
        this.node.setRotationFromEuler(0, 0, angle);

        this.isFlying = true;
    }

    /**
     * 计算直线位置
     */
    calculateStraightPosition(distance: number): Vec3 {
        const pos = new Vec3();
        Vec3.scaleAndAdd(pos, this.startPos, this.direction, distance);
        return pos;
    }

    /**
     * 命中目标（触发范围伤害与范围减速）
     */
    hitTarget(hitPos: Vec3, enemy: Node) {
        if (!this.isFlying) {
            return;
        }

        // 标记冰箭已命中，后续不再参与碰撞检测
        this.isFlying = false;

        // 在命中点执行范围效果
        this.applyAreaDamageAndSlow(hitPos);

        // 为主命中目标创建寒气特效（视觉效果中心仍然跟随某个敌人）
        if (enemy && enemy.isValid) {
            this.createColdEffect(enemy);
        }

        // 延迟销毁冰箭节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1);
    }

    /**
     * 在命中点附近执行范围伤害与范围减速
     */
    private applyAreaDamageAndSlow(hitPos: Vec3) {
        const enemiesNode = find('Canvas/Enemies');
        if (!enemiesNode) return;

        const radius = this.aoeRadius > 0 ? this.aoeRadius : 80;
        const radiusSq = radius * radius;

        for (const enemy of enemiesNode.children) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;

            const enemyScript = enemy.getComponent('Enemy') as any ||
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('OrcWarrior') as any ||
                               enemy.getComponent('TrollSpearman') as any;

            if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) continue;

            const dx = enemy.worldPosition.x - hitPos.x;
            const dy = enemy.worldPosition.y - hitPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= radiusSq) {
                // 记录为已命中的敌人，避免重复处理
                if (!this.hitEnemies.has(enemy)) {
                    this.hitEnemies.add(enemy);
                }

                // 对范围内敌人应用减速
                this.applySlowDown(enemy);

                // 调用命中回调，让冰塔结算伤害（每个敌人都算一次伤害）
                if (this.onHitCallback) {
                    // 使用冰箭飞行方向作为受击方向
                    const hitDirection = this.direction.clone().normalize();
                    this.onHitCallback(this.damage, hitPos, enemy, hitDirection);
                }
            }
        }
    }

    /**
     * 应用减速效果
     */
    private applySlowDown(enemy: Node) {
        const enemyScript = enemy.getComponent('Enemy') as any || 
                           enemy.getComponent('OrcWarlord') as any ||
                           enemy.getComponent('OrcWarrior') as any ||
                           enemy.getComponent('TrollSpearman') as any;
        
        if (enemyScript && enemyScript.moveSpeed) {
            // 保存原始速度（如果还没有保存）
            if (!enemyScript._iceOriginalSpeed) {
                enemyScript._iceOriginalSpeed = enemyScript.moveSpeed;
            }
            
            const originalSpeed = enemyScript._iceOriginalSpeed;
            const slowedSpeed = originalSpeed * this.slowDownRatio;
            
            // 应用减速
            enemyScript.moveSpeed = slowedSpeed;
            
            // 设置减速标记（使用时间戳）
            const endTime = Date.now() + this.slowDownDuration * 1000;
            enemyScript._iceSlowDownEndTime = endTime;
            
            // 定时恢复速度（使用scheduleOnce）
            this.scheduleOnce(() => {
                if (enemy && enemy.isValid && enemyScript) {
                    const now = Date.now();
                    if (now >= enemyScript._iceSlowDownEndTime) {
                        // 恢复原始速度
                        if (enemyScript._iceOriginalSpeed !== undefined) {
                            enemyScript.moveSpeed = enemyScript._iceOriginalSpeed;
                            enemyScript._iceOriginalSpeed = undefined;
                            enemyScript._iceSlowDownEndTime = undefined;
                        }
                    }
                }
            }, this.slowDownDuration);
        }
    }

    /**
     * 创建寒气特效（跟随敌人移动，2秒后消散，敌人死亡时也消散）
     */
    private createColdEffect(enemy: Node) {
        const effectNode = new Node('ColdEffect');
        const canvas = find('Canvas');
        if (canvas) {
            effectNode.setParent(canvas);
        } else if (this.node.scene) {
            effectNode.setParent(this.node.scene);
        } else {
            effectNode.setParent(this.node.parent);
        }
        
        const transform = effectNode.addComponent(UITransform);
        transform.setContentSize(60, 60);
        
        const graphics = effectNode.addComponent(Graphics);
        
        // 添加更新组件来管理特效
        const updater = effectNode.addComponent(ColdEffectUpdater);
        updater.init(enemy, graphics, this.slowDownDuration);
        
        // 2秒后强制销毁（防止组件没有正确执行）
        this.scheduleOnce(() => {
            if (effectNode && effectNode.isValid) {
                effectNode.destroy();
            }
        }, this.slowDownDuration);
    }

    /**
     * 检查是否命中敌人
     */
    private checkHitEnemies(currentPos: Vec3) {
        const enemiesNode = find('Canvas/Enemies');
        if (!enemiesNode) return;

        const hitRadius = 20; // 命中判定半径
        const hitRadiusSq = hitRadius * hitRadius;

        for (const enemy of enemiesNode.children) {
            if (!enemy || !enemy.isValid || !enemy.active) continue;
            if (this.hitEnemies.has(enemy)) continue; // 已命中过

            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('OrcWarrior') as any ||
                               enemy.getComponent('TrollSpearman') as any;
            
            if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) continue;

            const dx = enemy.worldPosition.x - currentPos.x;
            const dy = enemy.worldPosition.y - currentPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= hitRadiusSq) {
                this.hitTarget(currentPos, enemy);
                return; // 只命中第一个敌人
            }
        }
    }

    update(deltaTime: number) {
        if (!this.isFlying) {
            return;
        }

        // 检查游戏状态
        if (!this.gameManager) {
            this.gameManager = find('GameManager')?.getComponent(GameManager);
        }
        
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                return;
            }
        }

        // 计算移动距离
        const moveDistance = this.speed * deltaTime;
        this.traveledDistance += moveDistance;

        // 计算当前位置
        const currentPos = this.calculateStraightPosition(this.traveledDistance);
        this.node.setWorldPosition(currentPos);

        // 检查是否命中敌人
        this.checkHitEnemies(currentPos);

        // 检查是否达到最大飞行距离
        if (this.traveledDistance >= this.travelDistance) {
            this.isFlying = false;
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0.1);
            return;
        }
    }
}
