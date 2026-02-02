import { _decorator, Component, Node, Vec3, find } from 'cc';
import { GameManager, GameState } from './GameManager';
import { AudioManager } from './AudioManager';
import { GreenOrbExplosionEffect } from './GreenOrbExplosionEffect';

const { ccclass, property } = _decorator;

/**
 * 绿色法球类
 * - 直线飞行（非弧线）
 * - 命中目标造成伤害
 * - 参考 Fireball 的实现
 */
@ccclass('GreenOrb')
export class GreenOrb extends Component {
    @property
    speed: number = 500; // 法球飞行速度（像素/秒）

    @property
    damage: number = 25; // 伤害值

    private startPos: Vec3 = new Vec3();
    private direction: Vec3 = new Vec3(); // 飞行方向（归一化）
    private travelDistance: number = 0; // 总飞行距离
    private traveledDistance: number = 0; // 已飞行距离
    private isFlying: boolean = false;
    private gameManager: GameManager | null = null;
    private targetNode: Node = null!;
    private onHitCallback: ((damage: number) => void) | null = null;

    /**
     * 初始化绿色法球
     * @param startPos 起始位置
     * @param targetNode 目标节点（用于计算初始方向）
     * @param damage 伤害值
     * @param onHit 命中回调函数
     */
    init(startPos: Vec3, targetNode: Node, damage: number, onHit?: (damage: number) => void) {
        this.startPos = startPos.clone();
        this.targetNode = targetNode;
        this.damage = damage;
        this.onHitCallback = onHit || null;
        this.traveledDistance = 0;

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

        // 计算总飞行距离：到目标的距离
        this.travelDistance = distance;

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

        // 更新旋转角度，使法球始终指向飞行方向
        const direction = new Vec3();
        Vec3.subtract(direction, currentPos, this.startPos);
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }

        // 检查是否命中目标（提前命中）
        if (this.targetNode && this.targetNode.isValid && this.targetNode.active) {
            const targetPos = this.targetNode.worldPosition;
            const distance = Vec3.distance(currentPos, targetPos);
            if (distance < 30) { // 命中判定半径
                this.hitTarget();
                return;
            }
        }

        // 检查是否到达目标位置或超过飞行距离
        if (this.traveledDistance >= this.travelDistance) {
            // 到达目标位置，命中
            this.hitTarget();
            return;
        }

        // 如果目标已失效，销毁法球
        if (this.targetNode && (!this.targetNode.isValid || !this.targetNode.active)) {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
            return;
        }
    }

    /**
     * 命中目标
     */
    private hitTarget() {
        if (!this.isFlying) {
            return; // 已经命中过了
        }

        this.isFlying = false;

        // 获取命中位置
        const hitPos = this.node.worldPosition.clone();

        // 调用命中回调
        if (this.onHitCallback) {
            this.onHitCallback(this.damage);
        }

        // 播放爆炸特效
        this.playExplosionEffect(hitPos);

        // 销毁法球节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1);
    }

    /**
     * 播放爆炸特效
     */
    private playExplosionEffect(explosionPos: Vec3) {
        // 创建爆炸特效节点
        const explosionNode = new Node('GreenOrbExplosionEffect');
        
        // 设置父节点
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            explosionNode.setParent(parentNode);
        } else {
            explosionNode.setParent(this.node.parent);
        }

        // 设置位置
        explosionNode.setWorldPosition(explosionPos);
        explosionNode.active = true;

        // 添加 GreenOrbExplosionEffect 组件
        const explosionScript = explosionNode.addComponent(GreenOrbExplosionEffect);
        explosionScript.init();
    }
}
