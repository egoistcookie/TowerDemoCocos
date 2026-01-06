import { _decorator, Component, Node, Vec3, find } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Arrow2：3级弓箭手专用的穿透箭
 * - 直线弹道（无抛物线）
 * - 穿透第一个敌人后继续飞行100像素
 */
@ccclass('Arrow2')
export class Arrow2 extends Component {
    @property
    speed: number = 500; // 弓箭飞行速度（像素/秒）

    @property
    damage: number = 10; // 伤害值

    private startPos: Vec3 = new Vec3();
    private direction: Vec3 = new Vec3(); // 飞行方向（归一化）
    private travelDistance: number = 0; // 总飞行距离
    private traveledDistance: number = 0; // 已飞行距离
    private onHitCallback: ((damage: number, hitPos: Vec3, enemy: Node) => void) | null = null;
    private isFlying: boolean = false;
    private gameManager: GameManager | null = null;
    private hasHitFirstTarget: boolean = false; // 是否已命中第一个目标
    private firstHitPos: Vec3 = new Vec3(); // 第一个命中点的位置
    private penetrationDistance: number = 100; // 穿透后继续飞行的距离（像素）
    private hitEnemies: Set<Node> = new Set(); // 已命中的敌人集合，避免重复伤害

    /**
     * 初始化穿透箭
     * @param startPos 起始位置
     * @param targetNode 目标节点（用于计算初始方向）
     * @param damage 伤害值
     * @param onHit 命中回调函数（参数：伤害值，命中位置，敌人节点）
     */
    init(startPos: Vec3, targetNode: Node, damage: number, onHit?: (damage: number, hitPos: Vec3, enemy: Node) => void) {
        this.startPos = startPos.clone();
        this.damage = damage;
        this.onHitCallback = onHit || null;
        this.hasHitFirstTarget = false;
        this.traveledDistance = 0;
        this.hitEnemies.clear(); // 清空已命中敌人集合

        // 设置初始位置
        this.node.setWorldPosition(this.startPos);

        // 计算初始方向（从起始位置指向目标）
        let targetPos: Vec3;
        if (targetNode && targetNode.isValid) {
            targetPos = targetNode.worldPosition.clone();
        } else {
            // 如果目标无效，使用起始位置前方
            targetPos = this.startPos.clone();
            targetPos.x += 200;
        }

        // 计算方向向量
        Vec3.subtract(this.direction, targetPos, this.startPos);
        const distance = this.direction.length();
        
        if (distance < 0.1) {
            // 距离太近，无法初始化
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0);
            return;
        }

        // 归一化方向
        this.direction.normalize();

        // 计算总飞行距离：到第一个目标的距离 + 穿透距离
        this.travelDistance = distance + this.penetrationDistance;

        // 设置初始旋转角度（指向目标）
        const angle = Math.atan2(this.direction.y, this.direction.x) * 180 / Math.PI;
        this.node.setRotationFromEuler(0, 0, angle);

        this.isFlying = true;
    }

    /**
     * 计算直线位置（无抛物线）
     * @param distance 已飞行距离
     */
    calculateStraightPosition(distance: number): Vec3 {
        const pos = new Vec3();
        Vec3.scaleAndAdd(pos, this.startPos, this.direction, distance);
        return pos;
    }

    /**
     * 命中目标（穿透）
     */
    hitTarget(hitPos: Vec3, enemy: Node) {
        if (!this.isFlying) {
            return; // 已经处理过了
        }

        // 检查是否已经命中过这个敌人
        if (this.hitEnemies.has(enemy)) {
            return; // 已经命中过，跳过
        }

        // 标记为已命中
        this.hitEnemies.add(enemy);

        // 调用命中回调
        if (this.onHitCallback) {
            this.onHitCallback(this.damage, hitPos, enemy);
        }

        // 如果还没命中第一个目标，记录命中位置，继续飞行
        if (!this.hasHitFirstTarget) {
            this.hasHitFirstTarget = true;
            this.firstHitPos = hitPos.clone();
            // 不停止飞行，继续穿透
        }
        // 如果已经命中第一个目标，继续飞行直到达到穿透距离
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
            // 飞行完成，销毁箭矢
            this.isFlying = false;
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0.1);
            return;
        }

        // 如果飞行时间过长（超过预期时间2倍），销毁弓箭（防止卡住）
        const expectedTime = this.travelDistance / this.speed;
        if (this.traveledDistance > this.travelDistance * 2) {
            this.isFlying = false;
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 0.1);
        }
    }

    /**
     * 检查是否命中敌人
     */
    checkHitEnemies(currentPos: Vec3) {
        const enemiesNode = find('Canvas/Enemies');
        if (!enemiesNode) {
            return;
        }

        const enemies = enemiesNode.children || [];
        const hitRadius = 30; // 命中判定半径

        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid || !enemy.active) {
                continue;
            }

            // 检查是否是敌人
            const enemyScript = enemy.getComponent('OrcWarlord') as any || 
                               enemy.getComponent('OrcWarrior') as any || 
                               enemy.getComponent('Enemy') as any ||
                               enemy.getComponent('TrollSpearman') as any;
            
            if (!enemyScript) {
                continue;
            }

            // 检查是否存活
            const isAlive = enemyScript.isAlive && enemyScript.isAlive();
            if (!isAlive) {
                continue;
            }

            // 计算距离
            const enemyPos = enemy.worldPosition;
            const distance = Vec3.distance(currentPos, enemyPos);

            // 如果距离足够近，认为命中
            if (distance < hitRadius) {
                // 命中敌人（穿透，不停止飞行）
                this.hitTarget(currentPos, enemy);
                // 继续飞行，不停止
                break; // 一次只命中一个敌人
            }
        }
    }
}

