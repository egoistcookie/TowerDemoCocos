import { _decorator, Component, Node, Vec3, SpriteFrame, Prefab, instantiate, find } from 'cc';
import { Enemy } from './Enemy';
import { UnitManager } from '../UnitManager';
import { GameState } from '../GameState';
import { Fireball } from '../Fireball';
import { AudioManager } from '../AudioManager';

const { ccclass, property } = _decorator;

/**
 * 飞龙敌人单位
 * - 继承 Enemy
 * - 飞行移动，无视石墙寻路逻辑
 * - 直接朝最近的我方单位移动并攻击
 * - 攻击范围内没有我方单位则朝水晶移动并攻击
 * - 攻击范围：200像素
 * - 攻击方式：释放火球
 */
@ccclass('Dragon')
export class Dragon extends Enemy {
    @property(Prefab)
    fireballPrefab: Prefab = null!; // 火球预制体

    // 重写父类属性，设置飞龙的默认值
    maxHealth: number = 100;
    moveSpeed: number = 60;
    attackDamage: number = 15;
    attackInterval: number = 2.0;
    attackRange: number = 200; // 攻击范围200像素
    collisionRadius: number = 25;
    unitName: string = "飞龙";
    unitDescription: string = "强大的飞龙，能够飞行并释放火球攻击。";
    goldReward: number = 10;
    expReward: number = 15;

    @property({
        tooltip: "韧性（0-1）：1秒内遭受此百分比血量损失才会触发僵直。0表示没有抗性（受到攻击就会播放受击动画），1表示最大抗性（需要100%血量损失才触发僵直）"
    })
    tenacity: number = 0.25; // 韧性，默认0.25表示需要25%血量损失才触发僵直

    // 伤害计算相关属性
    private recentDamage: number = 0; // 最近1秒内受到的总伤害
    private damageTime: number = 0; // 最近一次伤害的时间戳
    private lastStaggerTime: number = -1; // 上次产生僵直的时间戳（-1表示从未产生过僵直）

    /**
     * 重写 update 方法，实现飞行移动逻辑
     */
    update(deltaTime: number) {
        // 如果被销毁，只更新动画，不执行其他逻辑
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            return;
        }

        // 检查游戏状态
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                this.stopMoving();
                this.currentTarget = null!;
                return;
            }
        }

        // 更新攻击计时器
        this.attackTimer += deltaTime;

        // 查找最近的我方单位（降低查找频率）
        this.targetFindTimer += deltaTime;
        if (this.targetFindTimer >= this.TARGET_FIND_INTERVAL) {
            this.targetFindTimer = 0;
            this.findNearestFriendlyUnit();
        }

        // 处理移动和攻击逻辑
        if (this.currentTarget && this.currentTarget.isValid) {
            const targetPos = this.currentTarget.worldPosition;
            const dragonPos = this.node.worldPosition;
            const dx = targetPos.x - dragonPos.x;
            const dy = targetPos.y - dragonPos.y;
            const distanceSq = dx * dx + dy * dy;
            const attackRangeSq = this.attackRange * this.attackRange;

            // 检查距离是否在攻击范围内
            if (distanceSq <= attackRangeSq) {
                // 在攻击范围内，停止移动并攻击
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else {
                // 不在攻击范围内，朝目标飞行移动
                this.flyTowardsTarget(deltaTime);
            }
        } else if (this.targetCrystal && this.targetCrystal.isValid) {
            // 没有目标，朝水晶移动
            const crystalPos = this.targetCrystal.worldPosition;
            const dragonPos = this.node.worldPosition;
            const dx = crystalPos.x - dragonPos.x;
            const dy = crystalPos.y - dragonPos.y;
            const distanceSq = dx * dx + dy * dy;
            const attackRangeSq = this.attackRange * this.attackRange;

            // 检查距离是否在攻击范围内
            if (distanceSq <= attackRangeSq) {
                // 在攻击范围内，停止移动并攻击
                this.stopMoving();
                if (this.attackTimer >= this.attackInterval) {
                    if (this.gameManager && this.gameManager.getGameState() === GameState.Playing) {
                        this.attack();
                        this.attackTimer = 0;
                    }
                }
            } else {
                // 不在攻击范围内，朝水晶飞行移动
                this.flyTowardsCrystal(deltaTime);
            }
        }

        // 更新动画
        this.updateAnimation(deltaTime);
    }

    /**
     * 查找最近的我方单位
     */
    private findNearestFriendlyUnit() {
        let nearestUnit: Node = null!;
        let minDistanceSq = Infinity;

        // 获取单位管理器
        if (!this.unitManager) {
            this.unitManager = UnitManager.getInstance();
        }

        const myPos = this.node.worldPosition;

        // 查找所有我方单位：防御塔、弓箭手、女猎手、剑士、牧师、建筑物
        let friendlyUnits: Node[] = [];

        if (this.unitManager) {
            // 防御塔
            const towers = this.unitManager.getTowers();
            friendlyUnits.push(...towers);

            // 弓箭手（在Towers容器中）
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

            // 牧师（在Towers容器中）
            for (const tower of towersList) {
                const priestScript = tower.getComponent('Priest') as any;
                if (priestScript && priestScript.isAlive && priestScript.isAlive()) {
                    friendlyUnits.push(tower);
                }
            }

            // 建筑物：战争古树、猎手大厅、剑士大厅、教堂
            const buildings = this.unitManager.getBuildings();
            friendlyUnits.push(...buildings);
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

            // 建筑物
            const warAncientTreesNode = find('Canvas/WarAncientTrees');
            if (warAncientTreesNode) {
                friendlyUnits.push(...warAncientTreesNode.children);
            }

            const hunterHallsNode = find('Canvas/HunterHalls');
            if (hunterHallsNode) {
                friendlyUnits.push(...hunterHallsNode.children);
            }

            const swordsmanHallsNode = find('Canvas/SwordsmanHalls');
            if (swordsmanHallsNode) {
                friendlyUnits.push(...swordsmanHallsNode.children);
            }

            const churchesNode = find('Canvas/Churches');
            if (churchesNode) {
                friendlyUnits.push(...churchesNode.children);
            }
        }

        // 查找最近的我方单位
        for (const unit of friendlyUnits) {
            if (!unit || !unit.isValid || !unit.active) {
                continue;
            }

            // 检查单位是否存活（包括建筑物）
            const unitScript = unit.getComponent('Arrower') as any ||
                              unit.getComponent('Hunter') as any ||
                              unit.getComponent('ElfSwordsman') as any ||
                              unit.getComponent('Priest') as any ||
                              unit.getComponent('WatchTower') as any ||
                              unit.getComponent('WarAncientTree') as any ||
                              unit.getComponent('HunterHall') as any ||
                              unit.getComponent('SwordsmanHall') as any ||
                              unit.getComponent('Church') as any;

            if (!unitScript || !unitScript.isAlive || !unitScript.isAlive()) {
                continue;
            }

            // 计算距离
            const dx = unit.worldPosition.x - myPos.x;
            const dy = unit.worldPosition.y - myPos.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                nearestUnit = unit;
            }
        }

        // 设置当前目标：如果找到我方单位，优先攻击；否则攻击水晶
        if (nearestUnit) {
            this.currentTarget = nearestUnit;
        } else if (this.targetCrystal && this.targetCrystal.isValid) {
            // 没有找到我方单位，攻击水晶
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                this.currentTarget = this.targetCrystal;
            } else {
                this.currentTarget = null!;
            }
        } else {
            this.currentTarget = null!;
        }
    }

    /**
     * 朝目标飞行移动（无视石墙，但有碰撞体积）
     */
    private flyTowardsTarget(deltaTime: number) {
        if (!this.currentTarget || !this.currentTarget.isValid) {
            return;
        }

        const targetPos = this.currentTarget.worldPosition;
        const currentPos = this.node.worldPosition;

        // 计算方向
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        const distance = direction.length();

        if (distance < 0.01) {
            return;
        }

        // 归一化方向
        direction.normalize();

        // 应用敌人避让逻辑（Dragon之间互相避让）
        const finalDirection = this.calculateDragonAvoidanceDirection(currentPos, direction, deltaTime);

        // 计算新位置（直接飞行，无视石墙，但有碰撞体积）
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, currentPos, finalDirection, moveDistance);

        // 限制位置在屏幕范围内
        const clampedPos = this.clampPositionToScreen(newPos);
        this.node.setWorldPosition(clampedPos);

        // 根据移动方向翻转
        this.flipDirection(finalDirection);

        // 播放行走动画
        this.playWalkAnimation();
    }

    /**
     * 朝水晶飞行移动（无视石墙，但有碰撞体积）
     */
    private flyTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        const crystalPos = this.targetCrystal.worldPosition;
        const currentPos = this.node.worldPosition;

        // 计算方向
        const direction = new Vec3();
        Vec3.subtract(direction, crystalPos, currentPos);
        const distance = direction.length();

        if (distance < 0.01) {
            return;
        }

        // 归一化方向
        direction.normalize();

        // 应用敌人避让逻辑（Dragon之间互相避让）
        const finalDirection = this.calculateDragonAvoidanceDirection(currentPos, direction, deltaTime);

        // 计算新位置（直接飞行，无视石墙，但有碰撞体积）
        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3();
        Vec3.scaleAndAdd(newPos, currentPos, finalDirection, moveDistance);

        // 限制位置在屏幕范围内
        const clampedPos = this.clampPositionToScreen(newPos);
        this.node.setWorldPosition(clampedPos);

        // 根据移动方向翻转
        this.flipDirection(finalDirection);

        // 播放行走动画
        this.playWalkAnimation();
    }

    /**
     * 计算Dragon避让方向（Dragon之间互相避让，参考Enemy的calculateEnemyAvoidanceDirection）
     */
    private calculateDragonAvoidanceDirection(currentPos: Vec3, desiredDirection: Vec3, deltaTime: number): Vec3 {
        const avoidanceForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxStrength = 0;

        // 检测范围：碰撞半径的4倍
        const detectionRange = this.collisionRadius * 4;

        // 查找所有敌人容器（包括Dragon）
        const enemyContainers = ['Canvas/Enemies'];
        const allEnemies: Node[] = [];

        for (const containerName of enemyContainers) {
            const containerNode = find(containerName);
            if (containerNode) {
                allEnemies.push(...containerNode.children);
            }
        }

        // 检查附近的敌人（包括其他Dragon）
        for (const enemy of allEnemies) {
            if (!enemy || !enemy.isValid || !enemy.active || enemy === this.node) {
                continue;
            }

            // 获取敌人的脚本组件（包括Dragon）
            const enemyScript = enemy.getComponent('Dragon') as any;
            
            if (!enemyScript) {
                continue;
            }

            // 检查敌人是否存活
            if (enemyScript.isAlive && !enemyScript.isAlive()) {
                continue;
            }

            const enemyPos = enemy.worldPosition;
            const distance = Vec3.distance(currentPos, enemyPos);
            
            // 获取敌人的碰撞半径
            const otherRadius = enemyScript.collisionRadius || 20;
            const minDistance = this.collisionRadius + otherRadius;

            if (distance < detectionRange && distance > 0.1) {
                const avoidDir = new Vec3();
                Vec3.subtract(avoidDir, currentPos, enemyPos);
                avoidDir.normalize();
                
                // 距离越近，避障力越强
                let strength = 1 - (distance / detectionRange);
                
                // 如果已经在碰撞范围内，大幅增强避障力
                if (distance < minDistance) {
                    strength = 2.0; // 强制避障
                }
                
                Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, avoidDir, strength);
                maxStrength = Math.max(maxStrength, strength);
                obstacleCount++;
            }
        }

        // 如果有障碍物，应用避障力
        if (obstacleCount > 0 && avoidanceForce.length() > 0.1) {
            avoidanceForce.normalize();
            
            // 根据障碍物强度调整混合比例
            // 如果障碍物很近（maxStrength > 1），优先避障
            const avoidanceWeight = maxStrength > 2.0 ? 0.7 : (maxStrength > 1.0 ? 0.5 : 0.3);
            const finalDir = new Vec3();
            Vec3.lerp(finalDir, desiredDirection, avoidanceForce, avoidanceWeight);
            finalDir.normalize();
            
            return finalDir;
        }

        // 没有障碍物，返回期望方向
        return desiredDirection;
    }

    /**
     * 重写攻击方法，释放火球（参考投矛手的攻击逻辑）
     */
    protected attack() {
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        const targetPos = this.currentTarget.worldPosition;
        const dragonPos = this.node.worldPosition;
        const dx = targetPos.x - dragonPos.x;
        const dy = targetPos.y - dragonPos.y;
        const distanceSq = dx * dx + dy * dy;
        const attackRangeSq = this.attackRange * this.attackRange;

        // 检查距离是否在攻击范围内
        if (distanceSq > attackRangeSq) {
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
            }
            return;
        }

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 保存当前目标，用于攻击动画中途释放火球
        const currentTarget = this.currentTarget;
        
        // 设置攻击回调函数，在动画播放中途（约50%处）释放火球
        this.attackCallback = () => {
            if (currentTarget && currentTarget.isValid && currentTarget.active) {
                this.createFireball(currentTarget);
            }
        };

        // 播放攻击动画（使用重写的方法）
        this.playAttackAnimation();
    }

    /**
     * 重写播放攻击动画方法，使用动画帧方式，在动画中途调用createFireball（参考投矛手）
     */
    playAttackAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 如果正在播放动画，不重复播放
        if (this.isPlayingAttackAnimation) {
            return;
        }

        // 如果没有Sprite组件或没有动画帧，直接返回
        if (!this.sprite) {
            return;
        }

        // 如果没有设置动画帧，直接返回
        if (!this.attackAnimationFrames || this.attackAnimationFrames.length === 0) {
            return;
        }

        // 检查帧是否有效
        const validFrames = this.attackAnimationFrames.filter(frame => frame != null);
        if (validFrames.length === 0) {
            return;
        }

        // 停止所有动画
        this.stopAllAnimations();
        
        // 标记正在播放动画
        this.isPlayingAttackAnimation = true;

        const frames = validFrames;
        const frameCount = frames.length;
        const frameDuration = this.attackAnimationDuration / frameCount; // 每帧的时长

        // 使用update方法播放动画（更可靠）
        let animationTimer = 0;
        let lastFrameIndex = -1; // 记录上一帧的索引，避免重复设置
        let hasThrownFireball = false; // 标记是否已经释放火球
        
        // 立即播放第一帧
        if (frames[0]) {
            this.sprite.spriteFrame = frames[0];
            lastFrameIndex = 0;
        }
        
        // 使用update方法逐帧播放
        const animationUpdate = (deltaTime: number) => {
            if (!this.sprite || !this.sprite.isValid || this.isDestroyed) {
                this.isPlayingAttackAnimation = false;
                this.unschedule(animationUpdate);
                return;
            }

            animationTimer += deltaTime;
            
            // 计算当前应该显示的帧索引
            const targetFrameIndex = Math.min(Math.floor(animationTimer / frameDuration), frameCount - 1);
            
            // 在动画播放到约50%时释放火球（只执行一次）
            if (!hasThrownFireball && animationTimer >= this.attackAnimationDuration * 0.5) {
                hasThrownFireball = true;
                if (this.attackCallback) {
                    // 调用攻击回调函数（释放火球）
                    this.attackCallback();
                }
            }
            
            // 检查动画是否完成
            if (animationTimer >= this.attackAnimationDuration) {
                // 确保播放最后一帧
                if (lastFrameIndex < frameCount - 1 && frames[frameCount - 1]) {
                    this.sprite.spriteFrame = frames[frameCount - 1];
                }
                // 动画播放完成，恢复默认SpriteFrame
                this.restoreDefaultSprite();
                this.unschedule(animationUpdate);
                
                // 清除回调
                this.attackCallback = null;
                
                // 动画结束后切换回待机动画
                this.playIdleAnimation();
                return;
            }
            
            // 更新到当前帧（只在帧变化时更新）
            if (targetFrameIndex !== lastFrameIndex && targetFrameIndex < frameCount && frames[targetFrameIndex]) {
                this.sprite.spriteFrame = frames[targetFrameIndex];
                lastFrameIndex = targetFrameIndex;
            }
        };
        
        // 开始动画更新（每帧更新）
        this.schedule(animationUpdate, 0);
    }

    /**
     * 创建火球（参考投矛手的createSpear方法）
     */
    private createFireball(targetNode: Node) {
        if (!this.fireballPrefab) {
            return;
        }

        // 检查目标是否有效
        if (!targetNode.isValid || !targetNode.active) {
            return;
        }

        const targetPos = targetNode.worldPosition;
        const enemyPos = this.node.worldPosition;

        // 创建火球节点
        const fireballNode = instantiate(this.fireballPrefab);

        // 设置父节点（添加到场景或Canvas）
        const canvas = find('Canvas');
        const scene = this.node.scene;
        const parentNode = canvas || scene || this.node.parent;
        if (parentNode) {
            fireballNode.setParent(parentNode);
        } else {
            fireballNode.setParent(this.node.parent);
        }

        // 设置初始位置（飞龙位置）
        const startPos = this.node.worldPosition.clone();
        fireballNode.setWorldPosition(startPos);

        // 确保节点激活
        fireballNode.active = true;

        // 获取或添加 Fireball 组件
        let fireballScript = fireballNode.getComponent(Fireball);
        if (!fireballScript) {
            fireballScript = fireballNode.addComponent(Fireball);
        }

        // 播放攻击音效
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }

        // 初始化火球
        fireballScript.init(startPos, targetNode, this.attackDamage);
    }

    /**
     * 重写受击方法，应用韧性机制
     */
    takeDamage(damage: number) {
        if (this.isDestroyed) {
            return;
        }

        // 显示伤害数字
        this.showDamageNumber(damage);

        // 处理韧性为0的情况：没有抗性，每次受到伤害都触发僵直（仍需检查僵直冷却）
        if (this.tenacity <= 0) {
            const timeSinceLastStagger = this.lastStaggerTime < 0 ? Infinity : (this.attackTimer - this.lastStaggerTime);
            if (timeSinceLastStagger > 2.0) {
                // 记录僵直时间
                this.lastStaggerTime = this.attackTimer;
                // 被攻击时停止移动
                this.stopMoving();
                // 播放受击动画
                this.playHitAnimation();
            }
        } else {
            // 计算韧性阈值：需要受到最大生命值的 tenacity 百分比才会触发僵直
            // 例如：tenacity = 0.25 表示需要受到25%血量损失才触发僵直
            const threshold = this.maxHealth * Math.min(1, Math.max(0, this.tenacity));

            // 如果距离上次伤害超过1秒，重置累计伤害
            if (this.damageTime > 0 && this.attackTimer - this.damageTime > 1.0) {
                this.recentDamage = 0;
            }

            // 更新最近伤害和时间
            this.recentDamage += damage;
            this.damageTime = this.attackTimer;

            // 检查是否应该产生僵直：
            // 1. 最近1秒内受到的伤害大于等于韧性阈值
            // 2. 距离上次产生僵直超过2秒（或从未产生过僵直）
            const timeSinceLastStagger = this.lastStaggerTime < 0 ? Infinity : (this.attackTimer - this.lastStaggerTime);
            const canStagger = this.recentDamage >= threshold && timeSinceLastStagger > 2.0;

            if (canStagger) {
                // 记录僵直时间
                this.lastStaggerTime = this.attackTimer;
                // 重置累计伤害（因为已经产生僵直了，重新开始计算）
                this.recentDamage = 0;
                this.damageTime = this.attackTimer; // 重置伤害时间戳，确保下次计算从当前时间开始

                // 被攻击时停止移动
                this.stopMoving();

                // 播放受击动画
                this.playHitAnimation();
            }
        }

        this.currentHealth -= damage;

        // 更新血条
        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    /**
     * 重写 onEnable 方法，重置韧性相关状态
     */
    onEnable() {
        // 调用父类的 onEnable
        super.onEnable();

        // 重置韧性相关状态
        this.recentDamage = 0;
        this.damageTime = 0;
        this.lastStaggerTime = -1; // 重置僵直时间
    }
}
