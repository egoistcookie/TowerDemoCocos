/**
 * 牛头人战士
 * 继承Boss基类，拥有比兽人督军更高的数值
 * 技能：增强版战争咆哮、战争践踏
 * 
 * 实现说明：
 * 1. 数值比OrcWarlord更高：
 *    - maxHealth: 200 (OrcWarlord: 100)
 *    - attackDamage: 30 (OrcWarlord: 15)
 *    - moveSpeed: 20 (OrcWarlord: 30，更慢体现boss压迫感)
 *    - tenacity: 0.4 (OrcWarlord: 0.3，更抗打)
 * 
 * 2. 增强版战争咆哮（重写Boss基类方法）：
 *    - warcryEffect: 0.4 (OrcWarlord: 0.25，40%增幅)
 *    - warcryRange: 300 (OrcWarlord: 200，范围更广)
 *    - warcryDuration: 12 (OrcWarlord: 10，持续时间更长)
 * 
 * 3. 战争践踏技能：
 *    - 范围：200像素
 *    - 伤害：两倍攻击力（attackDamage * 2）
 *    - 冷却：20秒
 *    - 影响所有我方单位（Role和Build、防御塔）
 * 
 * 注意：由于OrcWarlord代码量很大（2494行），此文件为基础结构
 * 需要从OrcWarlord.ts复制以下方法的完整实现：
 * - onEnable(), start(), createHealthBar(), findGameManager()
 * - update(), findTarget(), moveTowardsTarget(), moveTowardsCrystal()
 * - attack(), dealDamage(), takeDamage(), die()
 * - 所有动画相关方法（playIdleAnimation, playWalkAnimation等）
 * - clearAttachedWeapons(), flipDirection()等辅助方法
 */

import { _decorator, Node, Vec3, Sprite, find, Prefab, SpriteFrame, UITransform, AudioClip } from 'cc';
import { GameManager, GameState } from '../GameManager';
import { HealthBar } from '../HealthBar';
import { DamageNumber } from '../DamageNumber';
import { AudioManager } from '../AudioManager';
import { UnitType } from '../role/WarAncientTree';
import { EnemyPool } from '../EnemyPool';
import { UnitManager } from '../UnitManager';
import { Boss } from './Boss';
const { ccclass, property } = _decorator;

@ccclass('MinotaurWarrior')
export class MinotaurWarrior extends Boss {
    // 基础属性（数值比OrcWarlord更高）
    @property
    maxHealth: number = 200; // 比OrcWarlord的100更高

    @property
    moveSpeed: number = 20; // 比OrcWarlord的30更慢，体现boss压迫感

    @property
    attackDamage: number = 30; // 比OrcWarlord的15更高

    @property
    attackInterval: number = 2.5; // 比OrcWarlord的2.0稍慢

    @property
    attackRange: number = 80; // 比OrcWarlord的70稍大

    @property
    collisionRadius: number = 15; // 比OrcWarlord的10更大

    @property({
        tooltip: "韧性（0-1）：1秒内遭受此百分比血量损失才会触发僵直"
    })
    tenacity: number = 0.4; // 比OrcWarlord的0.3更高，更抗打

    @property(Node)
    targetCrystal: Node = null!;

    @property(Prefab)
    damageNumberPrefab: Prefab = null!;

    // 单位类型
    public unitType: UnitType = UnitType.ENEMY;
    
    // 单位信息属性
    @property
    unitName: string = "牛头人战士";
    
    @property
    unitDescription: string = "强大的牛头人战士，拥有极高的生命值和攻击力，能够释放增强版战争咆哮和战争践踏技能。";
    
    @property(SpriteFrame)
    unitIcon: SpriteFrame = null!;

    // 动画帧属性
    @property(SpriteFrame)
    idleAnimationFrames: SpriteFrame[] = [];
    
    @property(SpriteFrame)
    walkAnimationFrames: SpriteFrame[] = [];
    
    @property(SpriteFrame)
    attackAnimationFrames: SpriteFrame[] = [];
    
    @property(SpriteFrame)
    hitAnimationFrames: SpriteFrame[] = [];
    
    @property(SpriteFrame)
    deathAnimationFrames: SpriteFrame[] = [];

    // 动画时长属性
    @property
    idleAnimationDuration: number = 1.0;
    
    @property
    walkAnimationDuration: number = 1.0;
    
    @property
    attackAnimationDuration: number = 1.0; // 比OrcWarlord的0.8稍长
    
    @property
    hitAnimationDuration: number = 0.3;
    
    @property
    deathAnimationDuration: number = 1.0;

    // 增强版战争咆哮属性（重写Boss基类的默认值）
    @property
    warcryCooldown: number = 25; // 比OrcWarlord的30更短
    
    @property
    warcryDuration: number = 12; // 比OrcWarlord的10更长
    
    @property
    warcryEffect: number = 0.4; // 比OrcWarlord的0.25更高（40%增幅）
    
    @property
    warcryRange: number = 300; // 比OrcWarlord的200更广
    
    @property(AudioClip)
    warcrySound: AudioClip = null!;
    
    @property(SpriteFrame)
    warcryAnimationFrames: SpriteFrame[] = [];
    
    @property
    warcryAnimationDuration: number = 1.2;

    // 战争践踏技能属性
    @property
    stompCooldown: number = 20; // 战争践踏冷却时间（秒）
    
    @property
    stompRange: number = 200; // 战争践踏范围（像素）
    
    @property
    stompDamageMultiplier: number = 2.0; // 伤害倍率（两倍攻击力）
    
    @property(AudioClip)
    stompSound: AudioClip = null!; // 战争践踏音效
    
    @property(SpriteFrame)
    stompAnimationFrames: SpriteFrame[] = []; // 战争践踏动画帧
    
    @property
    stompAnimationDuration: number = 1.0; // 战争践踏动画时长

    // 私有属性（需要从OrcWarlord复制）
    private currentHealth: number = 200;
    private healthBar: HealthBar = null!;
    private healthBarNode: Node = null!;
    private isDestroyed: boolean = false;
    private currentTarget: Node = null!;
    private gameManager: GameManager = null!;
    private unitManager: UnitManager = null!;
    
    @property
    goldReward: number = 10; // 比OrcWarlord的5更高
    
    @property
    expReward: number = 20; // 比OrcWarlord的10更高
    
    @property(AudioClip)
    deathSound: AudioClip = null!;
    
    @property(AudioClip)
    attackSound: AudioClip = null!;

    // 动画相关私有属性
    private sprite: Sprite = null!;
    private uiTransform: UITransform = null!;
    private currentAnimationFrameIndex: number = 0;
    private animationTimer: number = 0;
    private isPlayingIdleAnimation: boolean = false;
    private isPlayingWalkAnimation: boolean = false;
    private isPlayingAttackAnimation: boolean = false;
    private isPlayingHitAnimation: boolean = false;
    private isPlayingDeathAnimation: boolean = false;
    private defaultSpriteFrame: SpriteFrame = null!;
    private defaultScale: Vec3 = new Vec3(1, 1, 1);
    private isHit: boolean = false;
    private attackComplete: boolean = false;
    
    // 伤害计算相关属性
    private recentDamage: number = 0;
    private damageTime: number = 0;
    private lastStaggerTime: number = -1;

    // 战争践踏私有属性
    private stompTimer: number = 0; // 战争践踏冷却计时器
    private isPlayingStompAnimation: boolean = false; // 是否正在播放战争践踏动画
    private wasPlayingAttackBeforeStomp: boolean = false; // 战争践踏前是否正在攻击
    
    // 对象池相关
    public prefabName: string = "MinotaurWarrior";

    /**
     * 重写Boss基类的战争咆哮方法，增强效果
     */
    protected releaseWarcry() {
        // 调用父类方法
        super.releaseWarcry();
        // 可以在这里添加额外的视觉效果等
    }

    /**
     * 重写Boss基类的查找附近敌人方法，扩大范围
     */
    protected findNearbyEnemies() {
        // 使用更大的范围（已在属性中设置warcryRange = 300）
        super.findNearbyEnemies();
    }

    /**
     * 重写Boss基类的应用buff方法，增强效果
     */
    protected applyWarcryBuff(enemy: Node, enemyScript: any, currentTime: number) {
        // 使用增强的效果值（已在属性中设置warcryEffect = 0.4）
        super.applyWarcryBuff(enemy, enemyScript, currentTime);
    }

    /**
     * 释放战争践踏技能
     * 对周围200像素内所有我方单位造成两倍攻击力伤害
     */
    private releaseStomp() {
        // 播放战争践踏音效
        if (this.stompSound) {
            AudioManager.Instance.playSFX(this.stompSound);
        }
        
        // 计算伤害值（两倍攻击力）
        const stompDamage = this.attackDamage * this.stompDamageMultiplier;
        
        // 查找范围内的所有我方单位
        const friendlyUnits: Node[] = [];
        
        // 查找所有角色（Role）
        const findRoles = (node: Node) => {
            const roleScript = node.getComponent('Arrower') as any ||
                              node.getComponent('Hunter') as any ||
                              node.getComponent('ElfSwordsman') as any ||
                              node.getComponent('Priest') as any;
            if (roleScript && roleScript.isAlive && roleScript.isAlive()) {
                friendlyUnits.push(node);
            }
            for (const child of node.children) {
                findRoles(child);
            }
        };
        
        // 查找所有建筑物（Build）
        const findBuildings = (node: Node) => {
            const buildScript = node.getComponent('WatchTower') as any ||
                               node.getComponent('IceTower') as any ||
                               node.getComponent('ThunderTower') as any ||
                               node.getComponent('WarAncientTree') as any ||
                               node.getComponent('HunterHall') as any ||
                               node.getComponent('StoneWall') as any;
            if (buildScript && buildScript.isAlive && buildScript.isAlive()) {
                friendlyUnits.push(node);
            }
            for (const child of node.children) {
                findBuildings(child);
            }
        };
        
        // 从场景中查找
        const scene = this.node.scene;
        if (scene) {
            findRoles(scene);
            findBuildings(scene);
        }
        
        // 也可以从UnitManager获取（性能更好）
        if (this.unitManager) {
            // 获取所有角色（Arrower和Priest在Towers容器中）
            const towers = this.unitManager.getTowers();
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active) {
                    const roleScript = tower.getComponent('Arrower') as any ||
                                      tower.getComponent('Priest') as any;
                    if (roleScript && roleScript.isAlive && roleScript.isAlive()) {
                        friendlyUnits.push(tower);
                    }
                }
            }
            
            // 获取Hunter
            const hunters = this.unitManager.getHunters();
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        friendlyUnits.push(hunter);
                    }
                }
            }
            
            // 获取ElfSwordsman
            const elfSwordsmans = this.unitManager.getElfSwordsmans();
            for (const swordsman of elfSwordsmans) {
                if (swordsman && swordsman.isValid && swordsman.active) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        friendlyUnits.push(swordsman);
                    }
                }
            }
            
            // 获取所有建筑物
            const buildings = this.unitManager.getBuildings();
            for (const building of buildings) {
                if (building && building.isValid && building.active) {
                    const buildScript = building.getComponent('WatchTower') as any ||
                                       building.getComponent('IceTower') as any ||
                                       building.getComponent('ThunderTower') as any ||
                                       building.getComponent('WarAncientTree') as any ||
                                       building.getComponent('HunterHall') as any;
                    if (buildScript && buildScript.isAlive && buildScript.isAlive()) {
                        friendlyUnits.push(building);
                    }
                }
            }
            
            // 获取石墙（StoneWall不在getBuildings中）
            const stoneWalls = this.unitManager.getStoneWalls();
            for (const wall of stoneWalls) {
                if (wall && wall.isValid && wall.active) {
                    const wallScript = wall.getComponent('StoneWall') as any;
                    if (wallScript && wallScript.isAlive && wallScript.isAlive()) {
                        friendlyUnits.push(wall);
                    }
                }
            }
        }
        
        // 对范围内的所有我方单位造成伤害
        const bossPos = this.node.worldPosition;
        const rangeSq = this.stompRange * this.stompRange;
        
        for (const unit of friendlyUnits) {
            if (!unit || !unit.isValid || !unit.active) {
                continue;
            }
            
            // 计算距离
            const unitPos = unit.worldPosition;
            const dx = unitPos.x - bossPos.x;
            const dy = unitPos.y - bossPos.y;
            const distanceSq = dx * dx + dy * dy;
            
            // 如果在范围内，造成伤害
            if (distanceSq <= rangeSq) {
                const unitScript = unit.getComponent('Arrower') as any ||
                                  unit.getComponent('Hunter') as any ||
                                  unit.getComponent('ElfSwordsman') as any ||
                                  unit.getComponent('Priest') as any ||
                                  unit.getComponent('WatchTower') as any ||
                                  unit.getComponent('IceTower') as any ||
                                  unit.getComponent('ThunderTower') as any ||
                                  unit.getComponent('WarAncientTree') as any ||
                                  unit.getComponent('HunterHall') as any ||
                                  unit.getComponent('StoneWall') as any;
                
                if (unitScript && unitScript.takeDamage && typeof unitScript.takeDamage === 'function') {
                    unitScript.takeDamage(stompDamage);
                }
            }
        }
        
        // 重置战争践踏冷却计时器
        this.stompTimer = 0;
    }

    /**
     * 播放战争践踏动画
     */
    private playStompAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        if (this.isPlayingStompAnimation) {
            return;
        }

        // 如果正在播放攻击动画，保存状态
        this.wasPlayingAttackBeforeStomp = this.isPlayingAttackAnimation;
        
        // 停止其他动画
        this.stopAllAnimations();
        this.isPlayingStompAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        
        // 如果没有战争践踏动画帧，直接释放效果
        if (this.stompAnimationFrames.length === 0) {
            this.releaseStomp();
            this.isPlayingStompAnimation = false;
            // 如果之前正在攻击，重新开始攻击
            if (this.wasPlayingAttackBeforeStomp) {
                this.wasPlayingAttackBeforeStomp = false;
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.attack();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    /**
     * 更新战争践踏动画
     */
    private updateStompAnimation() {
        if (this.stompAnimationFrames.length === 0) {
            this.isPlayingStompAnimation = false;
            this.playIdleAnimation();
            return;
        }

        const frameDuration = this.stompAnimationDuration / this.stompAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.stompAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.stompAnimationFrames[frameIndex];
                
                // 在动画中间点释放战争践踏效果
                const stompPoint = Math.floor(this.stompAnimationFrames.length * 0.5);
                if (frameIndex === stompPoint) {
                    this.releaseStomp();
                }
            }
        } else {
            // 战争践踏动画播放完成
            this.isPlayingStompAnimation = false;
            
            // 如果之前正在攻击，重新开始攻击
            if (this.wasPlayingAttackBeforeStomp) {
                this.wasPlayingAttackBeforeStomp = false;
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.attack();
                } else {
                    this.playIdleAnimation();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    /**
     * 初始化方法（需要从OrcWarlord.ts复制，但需要添加战争践踏相关初始化）
     */
    onEnable() {
        // 注意：需要从OrcWarlord.ts复制完整的onEnable()实现
        // 但需要添加以下初始化：
        this.stompTimer = 0;
        this.isPlayingStompAnimation = false;
        this.wasPlayingAttackBeforeStomp = false;
        
        // 调用父类的清理方法（如果有）
        // 注意：Boss基类没有onEnable，所以这里需要完整实现
    }

    /**
     * 更新方法（需要从OrcWarlord.ts复制，但需要添加战争践踏逻辑）
     */
    update(deltaTime: number) {
        // 注意：需要从OrcWarlord.ts复制完整的update()实现
        // 但需要添加以下逻辑：
        
        // 1. 更新战争践踏冷却计时器（如果不在播放战争践踏动画）
        if (!this.isPlayingStompAnimation) {
            this.stompTimer += deltaTime;
        }
        
        // 2. 检查是否可以释放战争践踏
        // 注意：需要检查是否正在播放其他动画（攻击、战争咆哮等）
        if (this.stompTimer >= this.stompCooldown && 
            !this.isHit && 
            !this.isPlayingStompAnimation && 
            !this.isPlayingWarcryAnimation && 
            !this.isPlayingAttackAnimation) {
            this.playStompAnimation();
        }
        
        // 3. 更新战争践踏动画
        if (this.isPlayingStompAnimation) {
            this.updateStompAnimation();
        }
        
        // 4. 调用父类的updateWarcryBuffs（更新战争咆哮buff）
        this.updateWarcryBuffs(deltaTime);
        
        // 注意：还需要从OrcWarlord.ts复制以下逻辑：
        // - 游戏状态检查
        // - 攻击计时器更新
        // - 目标查找
        // - 移动逻辑
        // - 攻击逻辑
        // - 动画更新
    }

    /**
     * 停止所有动画（需要从OrcWarlord.ts复制，但需要添加战争践踏）
     */
    private stopAllAnimations() {
        // 注意：需要从OrcWarlord.ts复制，但需要添加：
        this.isPlayingStompAnimation = false;
        // 其他动画停止逻辑...
    }

    /**
     * 播放待机动画（需要从OrcWarlord.ts复制）
     */
    private playIdleAnimation() {
        // 注意：需要从OrcWarlord.ts复制完整实现
    }

    /**
     * 攻击方法（需要从OrcWarlord.ts复制）
     */
    private attack() {
        // 注意：需要从OrcWarlord.ts复制完整实现
    }

    // 注意：以下方法需要从OrcWarlord.ts复制完整的实现：
    // - start()
    // - createHealthBar()
    // - findGameManager()
    // - findTarget()
    // - moveTowardsTarget()
    // - moveTowardsCrystal()
    // - dealDamage()
    // - takeDamage()
    // - die()
    // - 所有动画相关方法（playWalkAnimation, playAttackAnimation, updateIdleAnimation等）
    // - clearAttachedWeapons()
    // - flipDirection()
    // - 等等...
    
    // 重要提示：
    // 由于OrcWarlord.ts代码量很大（2494行），建议：
    // 1. 复制OrcWarlord.ts的完整代码
    // 2. 修改继承关系：extends Boss 而不是 extends Component
    // 3. 移除战争咆哮相关代码（已在Boss基类中）
    // 4. 修改数值（已在属性中设置）
    // 5. 重写战争咆哮方法（已实现）
    // 6. 添加战争践踏技能（已实现）
    // 7. 在update方法中添加战争践踏逻辑（已添加框架）
}
