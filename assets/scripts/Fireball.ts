import { _decorator, Component, Node, Vec3, find } from 'cc';
import { GameManager, GameState } from './GameManager';
import { FireballExplosionEffect } from './FireballExplosionEffect';
import { UnitManager } from './UnitManager';

const { ccclass, property } = _decorator;

/**
 * 火球类
 * - 直线飞行（非弧线）
 * - 在落点造成直径30的范围伤害
 * - 有爆炸特效
 */
@ccclass('Fireball')
export class Fireball extends Component {
    @property
    speed: number = 600; // 火球飞行速度（像素/秒）

    @property
    damage: number = 15; // 伤害值

    @property
    explosionRadius: number = 15; // 爆炸范围半径（直径30，半径15）

    private startPos: Vec3 = new Vec3();
    private direction: Vec3 = new Vec3(); // 飞行方向（归一化）
    private travelDistance: number = 0; // 总飞行距离
    private traveledDistance: number = 0; // 已飞行距离
    private isFlying: boolean = false;
    private gameManager: GameManager | null = null;
    private targetNode: Node = null!;
    private unitManager: UnitManager | null = null;

    /**
     * 初始化火球
     * @param startPos 起始位置
     * @param targetNode 目标节点（用于计算初始方向）
     * @param damage 伤害值
     */
    init(startPos: Vec3, targetNode: Node, damage: number) {
        this.startPos = startPos.clone();
        this.targetNode = targetNode;
        this.damage = damage;
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

        // 检查是否到达目标位置或超过飞行距离
        if (this.traveledDistance >= this.travelDistance) {
            // 到达目标位置，爆炸
            this.explode(currentPos);
            return;
        }

        // 检查是否命中目标（提前爆炸）
        if (this.targetNode && this.targetNode.isValid) {
            const targetPos = this.targetNode.worldPosition;
            const distance = Vec3.distance(currentPos, targetPos);
            if (distance < 20) { // 命中判定半径
                this.explode(currentPos);
                return;
            }
        }
    }

    /**
     * 爆炸：造成范围伤害并播放爆炸特效
     */
    private explode(explosionPos: Vec3) {
        if (!this.isFlying) {
            return; // 已经爆炸过了
        }

        this.isFlying = false;

        // 获取单位管理器
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        // 造成范围伤害
        this.dealAreaDamage(explosionPos);

        // 播放爆炸特效
        this.playExplosionEffect(explosionPos);

        // 销毁火球节点
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1);
    }

    /**
     * 造成范围伤害
     */
    private dealAreaDamage(explosionPos: Vec3) {
        const radius = this.explosionRadius;
        const radiusSq = radius * radius;

        // 获取所有我方单位
        let friendlyUnits: Node[] = [];

        if (this.unitManager) {
            // 防御塔
            const towers = this.unitManager.getTowers();
            friendlyUnits.push(...towers);

            // 弓箭手
            const towersList = this.unitManager.getTowers();
            for (const tower of towersList) {
                const arrowerScript = tower.getComponent('Arrower') as any;
                if (arrowerScript && arrowerScript.isAlive && arrowerScript.isAlive()) {
                    friendlyUnits.push(tower);
                }
            }

            // 女猎手
            const hunters = this.unitManager.getHunters();
            friendlyUnits.push(...hunters);

            // 精灵剑士
            const swordsmen = this.unitManager.getElfSwordsmans();
            friendlyUnits.push(...swordsmen);

            // 牧师
            for (const tower of towersList) {
                const priestScript = tower.getComponent('Priest') as any;
                if (priestScript && priestScript.isAlive && priestScript.isAlive()) {
                    friendlyUnits.push(tower);
                }
            }
        } else {
            // 降级方案：直接查找节点
            const towersNode = find('Canvas/Towers');
            if (towersNode) {
                friendlyUnits.push(...towersNode.children);
            }

            const huntersNode = find('Canvas/Hunters');
            if (huntersNode) {
                friendlyUnits.push(...huntersNode.children);
            }

            const swordsmenNode = find('Canvas/ElfSwordsmans');
            if (swordsmenNode) {
                friendlyUnits.push(...swordsmenNode.children);
            }
        }

        // 对范围内的所有我方单位造成伤害
        for (const unit of friendlyUnits) {
            if (!unit || !unit.isValid || !unit.active) {
                continue;
            }

            // 检查单位是否存活
            const unitScript = unit.getComponent('Arrower') as any ||
                              unit.getComponent('Hunter') as any ||
                              unit.getComponent('ElfSwordsman') as any ||
                              unit.getComponent('Priest') as any ||
                              unit.getComponent('WatchTower') as any;

            if (!unitScript || !unitScript.isAlive || !unitScript.isAlive()) {
                continue;
            }

            // 计算距离
            const unitPos = unit.worldPosition;
            const dx = unitPos.x - explosionPos.x;
            const dy = unitPos.y - explosionPos.y;
            const distanceSq = dx * dx + dy * dy;

            // 如果在爆炸范围内，造成伤害
            if (distanceSq <= radiusSq) {
                if (unitScript.takeDamage && typeof unitScript.takeDamage === 'function') {
                    unitScript.takeDamage(this.damage);
                }
            }
        }
    }

    /**
     * 播放爆炸特效
     */
    private playExplosionEffect(explosionPos: Vec3) {
        // 创建爆炸特效节点
        const explosionNode = new Node('FireballExplosionEffect');
        
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

        // 添加 FireballExplosionEffect 组件
        const explosionScript = explosionNode.addComponent(FireballExplosionEffect);
        explosionScript.init();
    }
}
