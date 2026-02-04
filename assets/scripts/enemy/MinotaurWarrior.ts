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

import { _decorator, Node, Vec3, Sprite, find, Prefab, SpriteFrame, UITransform, AudioClip, tween, Label, Color, instantiate, view } from 'cc';
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

    onEnable() {
        // 清理所有插在身上的武器（箭矢、长矛等）
        this.clearAttachedWeapons();
        
        // 从对象池获取时，重新初始化状态
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.attackComplete = false;
        this.warcryTimer = 0;
        this.recentDamage = 0;
        this.damageTime = 0;
        this.lastStaggerTime = -1; // 重置僵直时间
        this.isPlayingWarcryAnimation = false;
        this.warcryBuffedEnemies.clear();
        this.warcryBuffEndTime.clear();
        this.wasPlayingAttackBeforeWarcry = false;
        // 战争践踏相关初始化
        this.stompTimer = 0;
        this.isPlayingStompAnimation = false;
        this.wasPlayingAttackBeforeStomp = false;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.currentTarget = null!;
        
        // 重置动画
        this.currentAnimationFrameIndex = 0;
        this.animationTimer = 0;
        
        // 初始化动画相关属性（如果还没有初始化）
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        if (!this.uiTransform) {
            this.uiTransform = this.node.getComponent(UITransform);
        }
        
        if (this.sprite) {
            if (!this.defaultSpriteFrame) {
                this.defaultSpriteFrame = this.sprite.spriteFrame;
            }
            this.sprite.spriteFrame = this.defaultSpriteFrame;
            // 设置Sprite的sizeMode为CUSTOM，以便适配UITransform大小
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        
        // 保存默认缩放比例
        if (!this.defaultScale) {
            this.defaultScale = this.node.scale.clone();
        }
        
        // 重置节点状态
        if (this.node) {
            this.node.setScale(this.defaultScale);
            this.node.angle = 0;
            if (this.sprite) {
                const color = this.sprite.color.clone();
                color.a = 255;
                this.sprite.color = color;
            }
        }
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 查找单位管理器（性能优化）
        this.unitManager = UnitManager.getInstance();
        
        // 如果targetCrystal没有设置，尝试查找
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            let crystalNode = find('Crystal');
            if (!crystalNode && this.node.scene) {
                const findInScene = (node: Node, name: string): Node | null => {
                    if (node.name === name) {
                        return node;
                    }
                    for (const child of node.children) {
                        const found = findInScene(child, name);
                        if (found) return found;
                    }
                    return null;
                };
                crystalNode = findInScene(this.node.scene, 'Crystal');
            }
            if (crystalNode) {
                this.targetCrystal = crystalNode;
            }
        }
        
        // 重新创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        } else {
            // 如果血条已存在，更新血条状态
            if (this.healthBar) {
                this.healthBar.setMaxHealth(this.maxHealth);
                this.healthBar.setHealth(this.currentHealth);
            }
        }
        
        // 初始播放待机动画
        this.playIdleAnimation();
    }

    start() {
        // start 方法只在首次创建时调用，onEnable 会在每次从对象池获取时调用
        // 如果 onEnable 已经初始化了，这里就不需要重复初始化
        if (!this.defaultScale) {
            this.defaultScale = this.node.scale.clone();
        }
        
        if (!this.sprite) {
            this.sprite = this.node.getComponent(Sprite);
        }
        if (!this.uiTransform) {
            this.uiTransform = this.node.getComponent(UITransform);
        }
        
        if (this.sprite && !this.defaultSpriteFrame) {
            this.defaultSpriteFrame = this.sprite.spriteFrame;
            this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        
        // 查找游戏管理器
        this.findGameManager();
        
        // 如果targetCrystal没有设置，尝试查找
        if (!this.targetCrystal) {
            let crystalNode = find('Crystal');
            if (!crystalNode && this.node.scene) {
                const findInScene = (node: Node, name: string): Node | null => {
                    if (node.name === name) {
                        return node;
                    }
                    for (const child of node.children) {
                        const found = findInScene(child, name);
                        if (found) return found;
                    }
                    return null;
                };
                crystalNode = findInScene(this.node.scene, 'Crystal');
            }
            if (crystalNode) {
                this.targetCrystal = crystalNode;
            }
        }
        
        // 创建血条（如果不存在）
        if (!this.healthBarNode || !this.healthBarNode.isValid) {
            this.createHealthBar();
        }
        
        // 初始播放待机动画
        this.playIdleAnimation();
    }

    createHealthBar() {
        // 创建血条节点
        this.healthBarNode = new Node('HealthBar');
        this.healthBarNode.setParent(this.node);
        this.healthBarNode.setPosition(0, 40, 0); // 在敌人上方
        
        // 添加HealthBar组件
        this.healthBar = this.healthBarNode.addComponent(HealthBar);
        if (this.healthBar) {
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }
    }

    findGameManager() {
        // 方法1: 通过节点名称查找
        let gmNode = find('GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
            if (this.gameManager) {
                return;
            }
        }
        
        // 方法2: 从场景根节点递归查找GameManager组件
        const scene = this.node.scene;
        if (scene) {
            const findInScene = (node: Node, componentType: any): any => {
                const comp = node.getComponent(componentType);
                if (comp) return comp;
                for (const child of node.children) {
                    const found = findInScene(child, componentType);
                    if (found) return found;
                }
                return null;
            };
            this.gameManager = findInScene(scene, GameManager);
            if (this.gameManager) {
                return;
            }
        }
    }

    update(deltaTime: number) {
        // 如果被销毁，只更新动画，不执行其他逻辑
        if (this.isDestroyed) {
            this.updateAnimation(deltaTime);
            return;
        }

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.findGameManager();
        }
        
        // 检查游戏状态，只在Playing状态下运行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已结束或暂停，停止所有行动
                this.stopMoving();
                this.currentTarget = null!;
                return;
            }
        }

        // 更新攻击计时器（如果正在播放攻击动画或战争咆哮动画或战争践踏动画，不累积，等待动画完成）
        if (!this.isPlayingAttackAnimation && !this.isPlayingWarcryAnimation && !this.isPlayingStompAnimation) {
            this.attackTimer += deltaTime;
        }
        
        // 更新战争咆哮冷却计时器（如果正在播放战争咆哮动画，不累积）
        if (!this.isPlayingWarcryAnimation) {
            this.warcryTimer += deltaTime;
        }
        
        // 检查是否可以释放战争咆哮
        if (this.warcryTimer >= this.warcryCooldown && !this.isHit && !this.isPlayingWarcryAnimation && !this.isPlayingStompAnimation) {
            this.playWarcryAnimation();
        }
        
        // 更新战争咆哮buff状态
        super.updateWarcryBuffs(deltaTime);
        
        // 更新战争践踏冷却计时器（如果不在播放战争践踏动画）
        if (!this.isPlayingStompAnimation) {
            this.stompTimer += deltaTime;
        }
        
        // 检查是否可以释放战争践踏
        if (this.stompTimer >= this.stompCooldown && 
            !this.isHit && 
            !this.isPlayingStompAnimation && 
            !this.isPlayingWarcryAnimation && 
            !this.isPlayingAttackAnimation) {
            this.playStompAnimation();
        }
        
        // 更新战争践踏动画
        if (this.isPlayingStompAnimation) {
            this.updateStompAnimation();
        }
        
        // 重置最近1秒外的伤害
        if (this.damageTime > 0 && this.attackTimer - this.damageTime > 1.0) {
            this.recentDamage = 0;
        }

        // 查找目标（优先防御塔，然后水晶）
        // 如果正在播放攻击动画，不查找新目标，保持当前目标不变（除非当前目标已无效）
        if (!this.isPlayingAttackAnimation && !this.isPlayingStompAnimation) {
            this.findTarget();
        } else {
            // 正在攻击动画中，只检查当前目标是否仍然有效
            if (this.currentTarget && (!this.currentTarget.isValid || !this.currentTarget.active)) {
                // 当前目标已无效，清除目标
                this.currentTarget = null!;
            } else if (this.currentTarget) {
                // 检查当前目标是否仍然存活
                const towerScript = this.currentTarget.getComponent('Arrower') as any;
                const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
                const hallScript = this.currentTarget.getComponent('HunterHall') as any;
                const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
                const crystalScript = this.currentTarget.getComponent('Crystal') as any;
                const hunterScript = this.currentTarget.getComponent('Hunter') as any;
                const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
                const priestScript = this.currentTarget.getComponent('Priest') as any;
                const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
                const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
                const iceTowerScript = this.currentTarget.getComponent('IceTower') as any;
                const thunderTowerScript = this.currentTarget.getComponent('ThunderTower') as any;
                const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;
                
                if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                    // 当前目标已被摧毁，清除目标
                    this.currentTarget = null!;
                }
            }
        }

        if (this.currentTarget) {
            const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
            
            // 如果正在播放攻击动画或战争践踏动画，不进行距离检查和移动，让动画完成
            if (this.isPlayingAttackAnimation || this.isPlayingStompAnimation) {
                // 攻击动画或战争践踏动画播放中，停止移动
                this.stopMoving();
            } else if (distance <= this.attackRange) {
                // 在攻击范围内，停止移动并攻击
                if (!this.isPlayingAttackAnimation) {
                    this.stopMoving();
                }
                if (this.attackTimer >= this.attackInterval && !this.isHit && !this.isPlayingWarcryAnimation && !this.isPlayingAttackAnimation && !this.isPlayingStompAnimation) {
                    // 先重置attackTimer，避免重复触发
                    this.attackTimer = 0;
                    // 然后调用attack()
                    this.attack();
                }
            } else {
                // 不在攻击范围内，只有在没有被攻击时才继续移动
                if (!this.isHit && !this.isPlayingWarcryAnimation && !this.isPlayingStompAnimation) {
                    this.moveTowardsTarget(deltaTime);
                }
            }
        } else {
            // 没有目标，只有在没有被攻击时才向水晶移动
            // 如果正在播放攻击动画或战争践踏动画，不移动，让动画完成
            if (this.isPlayingAttackAnimation || this.isPlayingStompAnimation) {
                this.stopMoving();
            } else if (this.targetCrystal && this.targetCrystal.isValid && !this.isHit && !this.isPlayingWarcryAnimation && !this.isPlayingStompAnimation) {
                this.moveTowardsCrystal(deltaTime);
            }
        }
        
        // 更新动画
        this.updateAnimation(deltaTime);
    }

    // 播放战争咆哮动画（重写Boss基类方法，使用增强版属性）
    playWarcryAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        // 如果正在播放战争咆哮动画，不重复播放
        if (this.isPlayingWarcryAnimation) {
            return;
        }

        // 如果正在播放攻击动画，保存状态，战争咆哮完成后重新开始攻击
        this.wasPlayingAttackBeforeWarcry = this.isPlayingAttackAnimation;
        
        this.stopAllAnimations();
        this.isPlayingWarcryAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        // 重置战争咆哮冷却计时器
        this.warcryTimer = 0;
        
        // 如果没有战争咆哮动画帧，直接释放效果
        if (this.warcryAnimationFrames.length === 0) {
            this.releaseWarcry();
            this.isPlayingWarcryAnimation = false;
            // 如果之前正在攻击，重新开始攻击
            if (this.wasPlayingAttackBeforeWarcry) {
                this.wasPlayingAttackBeforeWarcry = false;
                // 重新触发攻击
                if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
                    this.attack();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    // 更新战争咆哮动画（重写Boss基类方法）
    updateWarcryAnimation() {
        if (this.warcryAnimationFrames.length === 0) {
            this.isPlayingWarcryAnimation = false;
            this.playIdleAnimation();
            return;
        }

        const frameDuration = this.warcryAnimationDuration / this.warcryAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.warcryAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.warcryAnimationFrames[frameIndex];
                
                // 在动画中间点释放战争咆哮效果
                const warcryPoint = Math.floor(this.warcryAnimationFrames.length * 0.5);
                if (frameIndex === warcryPoint) {
                    this.releaseWarcry();
                }
            }
        } else {
            // 战争咆哮动画播放完成
            this.isPlayingWarcryAnimation = false;
            
            // 如果之前正在攻击，重新开始攻击
            if (this.wasPlayingAttackBeforeWarcry) {
                this.wasPlayingAttackBeforeWarcry = false;
                // 重新触发攻击
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
     * 停止所有动画（需要从OrcWarlord.ts复制，但需要添加战争践踏）
     */
    private stopAllAnimations() {
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingWarcryAnimation = false;
        this.isPlayingStompAnimation = false;
        // 不停止死亡动画
        this.isHit = false; // 清除被攻击标志
    }

    /**
     * 播放待机动画（需要从OrcWarlord.ts复制）
     */
    private playIdleAnimation() {
        if (this.isPlayingIdleAnimation || this.isDestroyed) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingIdleAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    /**
     * 攻击方法（需要从OrcWarlord.ts复制）
     */
    private attack() {
        // 如果正在播放攻击动画，不重复触发攻击
        if (this.isPlayingAttackAnimation) {
            return;
        }
        
        if (!this.currentTarget || this.isDestroyed) {
            return;
        }

        // 再次检查目标是否有效
        if (!this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            return;
        }

        // 攻击时朝向目标方向
        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        this.flipDirection(direction);

        // 播放攻击动画
        this.playAttackAnimation();
    }

    // 由于代码量非常大，以下方法需要从OrcWarlord.ts完整复制
    // 由于响应长度限制，这里只添加关键方法框架
    // 完整实现请参考OrcWarlord.ts的对应方法
    
    findTarget() {
        // 从OrcWarlord.ts的findTarget()方法完整复制（472-785行）
        // 索敌范围：200像素
        const detectionRange = 200;
        
        // 优先查找附近的防御塔和战争古树（在攻击范围内）
        // 性能优化：从UnitManager获取建筑物列表，不再使用递归查找
        let towers: Node[] = [];
        let trees: Node[] = [];
        let halls: Node[] = [];
        
        if (this.unitManager) {
            towers = this.unitManager.getTowers();
            trees = this.unitManager.getWarAncientTrees();
            halls = this.unitManager.getBuildings().filter(building => {
                const hallScript = building.getComponent('HunterHall') as any;
                return hallScript && hallScript.isAlive && hallScript.isAlive();
            });
        }

        let nearestTarget: Node = null!;
        let minDistance = Infinity;
        let targetPriority = Infinity;
        
        // 定义优先级：水晶>石墙（阻挡路径时）>树木>角色>建筑物
        const PRIORITY = {
            CRYSTAL: 1,
            STONEWALL: 1.5,
            TREE: 2,
            CHARACTER: 3,
            BUILDING: 4
        };

        // 1. 检查水晶是否在范围内（优先级最高）
        if (this.targetCrystal && this.targetCrystal.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                const distance = Vec3.distance(this.node.worldPosition, this.targetCrystal.worldPosition);
                if (distance <= detectionRange) {
                    nearestTarget = this.targetCrystal;
                    minDistance = distance;
                    targetPriority = PRIORITY.CRYSTAL;
                }
            }
        }

        // 2. 检查路径是否被石墙阻挡（优先级第二）
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall) {
            const distance = Vec3.distance(this.node.worldPosition, blockedStoneWall.worldPosition);
            if (distance <= detectionRange) {
                if (PRIORITY.STONEWALL < targetPriority || 
                    (PRIORITY.STONEWALL === targetPriority && distance < minDistance)) {
                    minDistance = distance;
                    nearestTarget = blockedStoneWall;
                    targetPriority = PRIORITY.STONEWALL;
                }
            }
        }

        // 3. 查找范围内的角色
        // 1) 弓箭手和牧师（都在Towers容器中）
        for (const tower of towers) {
            if (tower && tower.active && tower.isValid) {
                const towerScript = tower.getComponent('Arrower') as any;
                const priestScript = tower.getComponent('Priest') as any;
                const characterScript = towerScript || priestScript;
                if (characterScript && characterScript.isAlive && characterScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tower.worldPosition);
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = tower;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }
        
        // 2) 女猎手
        let hunters: Node[] = [];
        const huntersNode = find('Canvas/Hunters');
        if (huntersNode) {
            hunters = huntersNode.children;
        }
        for (const hunter of hunters) {
            if (hunter && hunter.active && hunter.isValid) {
                const hunterScript = hunter.getComponent('Hunter') as any;
                if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, hunter.worldPosition);
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = hunter;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }

        // 3) 精灵剑士
        let swordsmen: Node[] = [];
        const swordsmenNode = find('Canvas/ElfSwordsmans');
        if (swordsmenNode) {
            swordsmen = swordsmenNode.children;
        }
        for (const swordsman of swordsmen) {
            if (swordsman && swordsman.active && swordsman.isValid) {
                const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, swordsman.worldPosition);
                    if (distance <= detectionRange) {
                        if (PRIORITY.CHARACTER < targetPriority || 
                            (PRIORITY.CHARACTER === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = swordsman;
                            targetPriority = PRIORITY.CHARACTER;
                        }
                    }
                }
            }
        }

        // 4. 查找范围内的建筑物
        // 战争古树
        for (const tree of trees) {
            if (tree && tree.active && tree.isValid) {
                const treeScript = tree.getComponent('WarAncientTree') as any;
                if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, tree.worldPosition);
                    if (distance <= detectionRange) {
                        if (PRIORITY.BUILDING < targetPriority || 
                            (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = tree;
                            targetPriority = PRIORITY.BUILDING;
                        }
                    }
                }
            }
        }
        
        // 猎手大厅
        for (const hall of halls) {
            if (hall && hall.active && hall.isValid) {
                const hallScript = hall.getComponent('HunterHall') as any;
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    const distance = Vec3.distance(this.node.worldPosition, hall.worldPosition);
                    if (distance <= detectionRange) {
                        if (PRIORITY.BUILDING < targetPriority || 
                            (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                            minDistance = distance;
                            nearestTarget = hall;
                            targetPriority = PRIORITY.BUILDING;
                        }
                    }
                }
            }
        }

        // 查找哨塔、冰塔、雷塔
        let watchTowers: Node[] = [];
        if (this.unitManager) {
            watchTowers = this.unitManager.getBuildings().filter(building => {
                const watchTowerScript = building.getComponent('WatchTower') as any;
                return watchTowerScript && watchTowerScript.isAlive && watchTowerScript.isAlive();
            });
        } else {
            const watchTowersNode = find('Canvas/WatchTowers');
            if (watchTowersNode) {
                watchTowers = watchTowersNode.children || [];
            }
        }
        
        for (const watchTower of watchTowers) {
            if (!watchTower || !watchTower.active || !watchTower.isValid) continue;
            const watchTowerScript = watchTower.getComponent('WatchTower') as any;
            if (!watchTowerScript || !watchTowerScript.isAlive || !watchTowerScript.isAlive()) continue;
            const distance = Vec3.distance(this.node.worldPosition, watchTower.worldPosition);
            if (distance <= detectionRange) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                    minDistance = distance;
                    nearestTarget = watchTower;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }

        let iceTowers: Node[] = [];
        if (this.unitManager && this.unitManager.getIceTowers) {
            iceTowers = this.unitManager.getIceTowers();
        } else {
            const iceTowersNode = find('Canvas/IceTowers');
            if (iceTowersNode) {
                iceTowers = iceTowersNode.children || [];
            }
        }
        
        for (const iceTower of iceTowers) {
            if (!iceTower || !iceTower.active || !iceTower.isValid) continue;
            const iceTowerScript = iceTower.getComponent('IceTower') as any;
            if (!iceTowerScript || !iceTowerScript.isAlive || !iceTowerScript.isAlive()) continue;
            const distance = Vec3.distance(this.node.worldPosition, iceTower.worldPosition);
            if (distance <= detectionRange) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                    minDistance = distance;
                    nearestTarget = iceTower;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }

        let thunderTowers: Node[] = [];
        if (this.unitManager && this.unitManager.getThunderTowers) {
            thunderTowers = this.unitManager.getThunderTowers();
        } else {
            const thunderTowersNode = find('Canvas/ThunderTowers');
            if (thunderTowersNode) {
                thunderTowers = thunderTowersNode.children || [];
            }
        }
        
        for (const thunderTower of thunderTowers) {
            if (!thunderTower || !thunderTower.active || !thunderTower.isValid) continue;
            const thunderTowerScript = thunderTower.getComponent('ThunderTower') as any;
            if (!thunderTowerScript || !thunderTowerScript.isAlive || !thunderTowerScript.isAlive()) continue;
            const distance = Vec3.distance(this.node.worldPosition, thunderTower.worldPosition);
            if (distance <= detectionRange) {
                if (PRIORITY.BUILDING < targetPriority || 
                    (PRIORITY.BUILDING === targetPriority && distance < minDistance)) {
                    minDistance = distance;
                    nearestTarget = thunderTower;
                    targetPriority = PRIORITY.BUILDING;
                }
            }
        }

        // 如果找到目标，设置为当前目标
        if (this.isPlayingAttackAnimation && this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const towerScript = this.currentTarget.getComponent('Arrower') as any;
            const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
            const hallScript = this.currentTarget.getComponent('HunterHall') as any;
            const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
            const crystalScript = this.currentTarget.getComponent('Crystal') as any;
            const hunterScript = this.currentTarget.getComponent('Hunter') as any;
            const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
            const priestScript = this.currentTarget.getComponent('Priest') as any;
            const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
            const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
            const iceTowerScript = this.currentTarget.getComponent('IceTower') as any;
            const thunderTowerScript = this.currentTarget.getComponent('ThunderTower') as any;
            const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;
            
            if (targetScript && targetScript.isAlive && targetScript.isAlive()) {
                return;
            }
        }
        
        const oldTarget = this.currentTarget;
        if (nearestTarget) {
            this.currentTarget = nearestTarget;
        } else {
            if (this.targetCrystal && this.targetCrystal.isValid) {
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
    }

    moveTowardsTarget(deltaTime: number) {
        if (!this.currentTarget) {
            return;
        }

        const direction = new Vec3();
        Vec3.subtract(direction, this.currentTarget.worldPosition, this.node.worldPosition);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            
            // 应用敌人避让逻辑
            const finalDirection = this.calculateEnemyAvoidanceDirection(this.node.worldPosition, direction, deltaTime);
            
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, this.node.worldPosition, finalDirection, this.moveSpeed * deltaTime);
            
            // 检查移动路径上是否有石墙阻挡（如果目标不是石墙）
            const targetScript = this.currentTarget.getComponent('StoneWall') as any;
            if (!targetScript) {
                if (this.checkCollisionWithStoneWall(newPos)) {
                    const detourPos = this.calculateDetourPosition(direction, deltaTime);
                    if (detourPos) {
                        const clampedPos = this.clampPositionToScreen(detourPos);
                        this.node.setWorldPosition(clampedPos);
                        const detourDirection = new Vec3();
                        Vec3.subtract(detourDirection, detourPos, this.node.worldPosition);
                        this.flipDirection(detourDirection);
                        this.playWalkAnimation();
                        return;
                    } else {
                        const nearestWall = this.findNearestStoneWall();
                        if (nearestWall) {
                            this.currentTarget = nearestWall;
                            return;
                        } else {
                            return;
                        }
                    }
                }
            }
            
            // 限制位置在屏幕范围内
            const clampedPos = this.clampPositionToScreen(newPos);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(finalDirection);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    moveTowardsCrystal(deltaTime: number) {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return;
        }

        // 在移动前检查路径上是否有战争古树或防御塔或石墙
        this.checkForTargetsOnPath();

        // 如果检测到目标（包括石墙），停止朝水晶移动，让update()方法处理目标
        if (this.currentTarget) {
            return;
        }

        const crystalWorldPos = this.targetCrystal.worldPosition;
        const enemyWorldPos = this.node.worldPosition;
        
        const direction = new Vec3();
        Vec3.subtract(direction, crystalWorldPos, enemyWorldPos);
        const distance = direction.length();
        
        if (distance > 0.1) {
            direction.normalize();
            
            // 应用敌人避让逻辑
            const finalDirection = this.calculateEnemyAvoidanceDirection(enemyWorldPos, direction, deltaTime);
            
            const moveDistance = this.moveSpeed * deltaTime;
            const newPos = new Vec3();
            Vec3.scaleAndAdd(newPos, enemyWorldPos, finalDirection, moveDistance);
            
            // 检查移动路径上是否有石墙阻挡
            if (this.checkCollisionWithStoneWall(newPos)) {
                const detourPos = this.calculateDetourPosition(direction, deltaTime);
                if (detourPos) {
                    const clampedPos = this.clampPositionToScreen(detourPos);
                    this.node.setWorldPosition(clampedPos);
                    const detourDirection = new Vec3();
                    Vec3.subtract(detourDirection, detourPos, this.node.worldPosition);
                    this.flipDirection(detourDirection);
                    this.playWalkAnimation();
                    return;
                } else {
                    return;
                }
            }
            
            // 限制位置在屏幕范围内
            const clampedPos = this.clampPositionToScreen(newPos);
            this.node.setWorldPosition(clampedPos);
            
            // 根据移动方向翻转
            this.flipDirection(finalDirection);
            
            // 播放行走动画
            this.playWalkAnimation();
        }
    }

    // 以下方法需要从OrcWarlord.ts完整复制实现
    // 由于代码量非常大，这里只添加方法框架，完整实现请从OrcWarlord.ts复制对应方法
    
    private clearAttachedWeapons() {
        // 从OrcWarlord.ts的clearAttachedWeapons()方法完整复制（2298-2334行）
        const childrenToRemove: Node[] = [];
        if (this.node) {
            const children = this.node.children || [];
            for (const child of children) {
                if (child && child.isValid) {
                    const arrowScript = child.getComponent('Arrow') as any;
                    const arrow2Script = child.getComponent('Arrow2') as any;
                    const boomerangScript = child.getComponent('Boomerang') as any;
                    const spearScript = child.getComponent('Spear') as any;
                    const childName = child.name.toLowerCase();
                    
                    if (childName !== 'healthbar' && childName !== 'health bar') {
                        if (arrowScript || arrow2Script || boomerangScript || spearScript || 
                            childName.includes('arrow') || childName.includes('spear') || 
                            childName.includes('boomerang') || childName.includes('长矛') || 
                            childName.includes('箭矢') || childName.includes('回旋镖')) {
                            childrenToRemove.push(child);
                        }
                    }
                }
            }
        }
        
        for (const child of childrenToRemove) {
            if (child && child.isValid) {
                child.destroy();
            }
        }
    }

    stopMoving() {
        if (!this.isPlayingAttackAnimation && !this.isPlayingHitAnimation && !this.isPlayingDeathAnimation) {
            this.playIdleAnimation();
        }
    }

    updateAnimation(deltaTime: number) {
        if (!this.sprite) {
            return;
        }

        this.animationTimer += deltaTime;

        if (this.isPlayingIdleAnimation) {
            this.updateIdleAnimation();
        } else if (this.isPlayingWalkAnimation) {
            this.updateWalkAnimation();
        } else if (this.isPlayingAttackAnimation) {
            this.updateAttackAnimation();
        } else if (this.isPlayingHitAnimation) {
            this.updateHitAnimation();
        } else if (this.isPlayingDeathAnimation) {
            this.updateDeathAnimation();
        } else if (this.isPlayingWarcryAnimation) {
            this.updateWarcryAnimation();
        } else if (this.isPlayingStompAnimation) {
            this.updateStompAnimation();
        }
    }

    private updateIdleAnimation() {
        if (this.idleAnimationFrames.length === 0) {
            this.isPlayingIdleAnimation = false;
            return;
        }

        const frameDuration = this.idleAnimationDuration / this.idleAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.idleAnimationFrames.length;

        if (frameIndex !== this.currentAnimationFrameIndex) {
            this.currentAnimationFrameIndex = frameIndex;
            this.sprite.spriteFrame = this.idleAnimationFrames[frameIndex];
        }
    }

    private updateWalkAnimation() {
        if (this.walkAnimationFrames.length === 0) {
            this.isPlayingWalkAnimation = false;
            return;
        }

        const frameDuration = this.walkAnimationDuration / this.walkAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration) % this.walkAnimationFrames.length;

        if (frameIndex !== this.currentAnimationFrameIndex) {
            this.currentAnimationFrameIndex = frameIndex;
            this.sprite.spriteFrame = this.walkAnimationFrames[frameIndex];
        }
    }

    private updateAttackAnimation() {
        // 从OrcWarlord.ts的updateAttackAnimation()方法完整复制（1510-1594行）
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.currentTarget = null!;
            this.playIdleAnimation();
            return;
        }
        
        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        const priestScript = this.currentTarget.getComponent('Priest') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
        const iceTowerScript = this.currentTarget.getComponent('IceTower') as any;
        const thunderTowerScript = this.currentTarget.getComponent('ThunderTower') as any;
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;
        
        if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            this.currentTarget = null!;
            this.playIdleAnimation();
            return;
        }
        
        if (this.attackAnimationFrames.length === 0) {
            this.isPlayingAttackAnimation = false;
            this.playIdleAnimation();
            return;
        }

        const frameDuration = this.attackAnimationDuration / this.attackAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.attackAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.attackAnimationFrames[frameIndex];
                
                const attackPoint = Math.floor(this.attackAnimationFrames.length * 0.5);
                if (frameIndex === attackPoint && !this.attackComplete) {
                    this.dealDamage();
                    this.attackComplete = true;
                    
                    if (!this.isPlayingAttackAnimation) {
                        return;
                    }
                }
            }
            
            if (frameIndex % 5 === 0) {
                if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    this.currentTarget = null!;
                    this.playIdleAnimation();
                    return;
                }
            }
        } else {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
            
            if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
                this.currentTarget = null!;
                this.attackTimer = 0;
            }
            
            this.playIdleAnimation();
        }
    }

    private updateHitAnimation() {
        if (this.hitAnimationFrames.length === 0) {
            this.isPlayingHitAnimation = false;
            this.resumeMovement();
            return;
        }

        const frameDuration = this.hitAnimationDuration / this.hitAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.hitAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.hitAnimationFrames[frameIndex];
            }
        } else {
            this.isPlayingHitAnimation = false;
            this.resumeMovement();
        }
    }

    private updateDeathAnimation() {
        if (this.deathAnimationFrames.length === 0) {
            this.isPlayingDeathAnimation = false;
            return;
        }

        const frameDuration = this.deathAnimationDuration / this.deathAnimationFrames.length;
        const frameIndex = Math.floor(this.animationTimer / frameDuration);

        if (frameIndex < this.deathAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.deathAnimationFrames[frameIndex];
            }
        } else {
            this.isPlayingDeathAnimation = false;
            if (this.deathAnimationFrames.length > 0) {
                this.sprite.spriteFrame = this.deathAnimationFrames[this.deathAnimationFrames.length - 1];
            }
        }
    }

    private playWalkAnimation() {
        if (this.isPlayingWalkAnimation || this.isDestroyed) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingWalkAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    private playAttackAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        if (this.isPlayingAttackAnimation) {
            return;
        }

        const wasPlayingAttack = this.isPlayingAttackAnimation;
        this.stopAllAnimations();
        
        if (wasPlayingAttack) {
            this.isPlayingAttackAnimation = true;
            return;
        }
        
        this.isPlayingAttackAnimation = true;
        this.attackComplete = false;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
        
        if (this.attackSound) {
            AudioManager.Instance.playSFX(this.attackSound);
        }
    }

    private playHitAnimation() {
        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingHitAnimation = true;
        this.isHit = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    private playDeathAnimation() {
        if (this.isPlayingDeathAnimation) {
            return;
        }

        this.stopAllAnimations();
        this.isPlayingDeathAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;
    }

    private dealDamage() {
        // 从OrcWarlord.ts的dealDamage()方法完整复制（1825-1878行）
        if (!this.currentTarget || !this.currentTarget.isValid || !this.currentTarget.active) {
            this.currentTarget = null!;
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
                this.playIdleAnimation();
            }
            return;
        }

        const towerScript = this.currentTarget.getComponent('Arrower') as any;
        const warAncientTreeScript = this.currentTarget.getComponent('WarAncientTree') as any;
        const hallScript = this.currentTarget.getComponent('HunterHall') as any;
        const swordsmanHallScript = this.currentTarget.getComponent('SwordsmanHall') as any;
        const crystalScript = this.currentTarget.getComponent('Crystal') as any;
        const hunterScript = this.currentTarget.getComponent('Hunter') as any;
        const elfSwordsmanScript = this.currentTarget.getComponent('ElfSwordsman') as any;
        const priestScript = this.currentTarget.getComponent('Priest') as any;
        const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
        const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
        const iceTowerScript = this.currentTarget.getComponent('IceTower') as any;
        const thunderTowerScript = this.currentTarget.getComponent('ThunderTower') as any;
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;
        
        if (targetScript && targetScript.takeDamage) {
            targetScript.takeDamage(this.attackDamage);
            
            if (targetScript && targetScript.isAlive && !targetScript.isAlive()) {
                this.currentTarget = null!;
                if (this.isPlayingAttackAnimation) {
                    this.isPlayingAttackAnimation = false;
                    this.attackComplete = false;
                    this.playIdleAnimation();
                }
            }
        } else {
            this.currentTarget = null!;
            if (this.isPlayingAttackAnimation) {
                this.isPlayingAttackAnimation = false;
                this.attackComplete = false;
                this.playIdleAnimation();
            }
        }
    }

    takeDamage(damage: number) {
        // 从OrcWarlord.ts的takeDamage()方法完整复制（1910-1992行）
        if (this.isDestroyed) {
            return;
        }

        if (this.isPlayingWarcryAnimation || this.isPlayingStompAnimation) {
            this.currentHealth -= damage;
            if (this.healthBar) {
                this.healthBar.setHealth(this.currentHealth);
            }
            this.showDamageNumber(damage);
            
            if (this.currentHealth <= 0) {
                this.currentHealth = 0;
                this.die();
            }
            return;
        }

        this.showDamageNumber(damage);
        
        if (this.tenacity <= 0) {
            const timeSinceLastStagger = this.lastStaggerTime < 0 ? Infinity : (this.attackTimer - this.lastStaggerTime);
            if (timeSinceLastStagger > 2.0) {
                this.lastStaggerTime = this.attackTimer;
                this.stopMoving();
                this.playHitAnimation();
            }
        } else {
            const threshold = this.maxHealth * Math.min(1, Math.max(0, this.tenacity));
            
            if (this.damageTime > 0 && this.attackTimer - this.damageTime > 1.0) {
                this.recentDamage = 0;
            }
            
            this.recentDamage += damage;
            this.damageTime = this.attackTimer;
            
            const timeSinceLastStagger = this.lastStaggerTime < 0 ? Infinity : (this.attackTimer - this.lastStaggerTime);
            const canStagger = this.recentDamage >= threshold && timeSinceLastStagger > 2.0;
            
            if (canStagger) {
                this.lastStaggerTime = this.attackTimer;
                this.recentDamage = 0;
                this.damageTime = this.attackTimer;
                this.stopMoving();
                this.playHitAnimation();
            }
        }

        this.currentHealth -= damage;

        if (this.healthBar) {
            this.healthBar.setHealth(this.currentHealth);
        }

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    private resumeMovement() {
        this.isHit = false;
        
        if (!this.isDestroyed && !this.isPlayingAttackAnimation && !this.isPlayingDeathAnimation) {
            if (this.currentTarget) {
                const distance = Vec3.distance(this.node.worldPosition, this.currentTarget.worldPosition);
                if (distance > this.attackRange) {
                    this.playWalkAnimation();
                } else {
                    this.playIdleAnimation();
                }
            } else if (this.targetCrystal && this.targetCrystal.isValid) {
                const distance = Vec3.distance(this.node.worldPosition, this.targetCrystal.worldPosition);
                if (distance > this.attackRange) {
                    this.playWalkAnimation();
                } else {
                    this.playIdleAnimation();
                }
            } else {
                this.playIdleAnimation();
            }
        }
    }

    private showDamageNumber(damage: number) {
        // 从OrcWarlord.ts的showDamageNumber()方法完整复制（2023-2079行）
        let damageNode: Node;
        if (this.damageNumberPrefab) {
            damageNode = instantiate(this.damageNumberPrefab);
        } else {
            damageNode = new Node('DamageNumber');
            const label = damageNode.addComponent(Label);
            label.string = `-${Math.floor(damage)}`;
            label.fontSize = 20;
            label.color = Color.WHITE;
        }
        
        const canvas = find('Canvas');
        if (canvas) {
            damageNode.setParent(canvas);
        } else {
            damageNode.setParent(this.node.scene);
        }
        
        damageNode.setWorldPosition(this.node.worldPosition.clone().add3f(0, 40, 0));
        
        const damageScript = damageNode.getComponent(DamageNumber);
        if (damageScript) {
            damageScript.setDamage(damage);
        } else {
            const label = damageNode.getComponent(Label);
            if (label) {
                const startPos = damageNode.position.clone();
                const endPos = startPos.clone();
                endPos.y += 50;
                
                tween(damageNode)
                    .to(1.0, { position: endPos })
                    .parallel(
                        tween().to(1.0, {}, {
                            onUpdate: (target, ratio) => {
                                const color = label.color.clone();
                                color.a = 255 * (1 - ratio);
                                label.color = color;
                            }
                        })
                    )
                    .call(() => {
                        if (damageNode && damageNode.isValid) {
                            damageNode.destroy();
                        }
                    })
                    .start();
            }
        }
    }

    die() {
        // 从OrcWarlord.ts的die()方法完整复制（2232-2296行），但需要调用super.clearAllWarcryBuffs()
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;
        this.stopAllAnimations();
        super.clearAllWarcryBuffs();
        
        if (!this.gameManager) {
            this.findGameManager();
        }
        if (this.gameManager) {
            this.gameManager.addGold(this.goldReward);
            this.gameManager.addExperience(this.expReward);
        }

        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }

        if (this.deathSound) {
            AudioManager.Instance.playSFX(this.deathSound);
        }

        this.playDeathAnimation();

        const returnToPool = () => {
            const enemyPool = EnemyPool.getInstance();
            if (enemyPool && this.node && this.node.isValid) {
                this.resetEnemyState();
                enemyPool.release(this.node, this.prefabName);
            } else {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }
        };
        
        setTimeout(() => {
            returnToPool();
        }, 60000);
    }

    private resetEnemyState() {
        // 从OrcWarlord.ts的resetEnemyState()方法完整复制（2339-2382行）
        this.clearAttachedWeapons();
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;
        this.attackTimer = 0;
        this.attackComplete = false;
        this.warcryTimer = 0;
        this.isPlayingWarcryAnimation = false;
        this.warcryBuffedEnemies.clear();
        this.warcryBuffEndTime.clear();
        this.wasPlayingAttackBeforeWarcry = false;
        this.stompTimer = 0;
        this.isPlayingStompAnimation = false;
        this.wasPlayingAttackBeforeStomp = false;
        this.isHit = false;
        this.isPlayingAttackAnimation = false;
        this.isPlayingHitAnimation = false;
        this.isPlayingDeathAnimation = false;
        this.isPlayingIdleAnimation = false;
        this.isPlayingWalkAnimation = false;
        this.currentTarget = null!;
        
        this.currentAnimationFrameIndex = 0;
        this.animationTimer = 0;
        
        if (this.node) {
            this.node.setScale(this.defaultScale);
            this.node.angle = 0;
            if (this.sprite) {
                const color = this.sprite.color.clone();
                color.a = 255;
                this.sprite.color = color;
            }
        }
        
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }
        this.healthBarNode = null!;
        this.healthBar = null!;
    }

    isAlive(): boolean {
        return !this.isDestroyed && this.currentHealth > 0;
    }

    // 以下辅助方法从OrcWarlord.ts完整复制
    calculateDetourPosition(direction: Vec3, deltaTime: number): Vec3 | null {
        const moveDistance = this.moveSpeed * deltaTime;
        const perpendicular = new Vec3(-direction.y, direction.x, 0);
        const offsetDistances = [30, 50, 80];
        
        for (const offsetDistance of offsetDistances) {
            const leftOffset = new Vec3();
            Vec3.scaleAndAdd(leftOffset, this.node.worldPosition, perpendicular, offsetDistance);
            const leftPos = new Vec3();
            Vec3.scaleAndAdd(leftPos, leftOffset, direction, moveDistance);
            
            if (!this.checkCollisionWithStoneWall(leftPos)) {
                return leftPos;
            }
            
            const rightOffset = new Vec3();
            Vec3.scaleAndAdd(rightOffset, this.node.worldPosition, perpendicular, -offsetDistance);
            const rightPos = new Vec3();
            Vec3.scaleAndAdd(rightPos, rightOffset, direction, moveDistance);
            
            if (!this.checkCollisionWithStoneWall(rightPos)) {
                return rightPos;
            }
        }
        
        return null;
    }

    findNearestStoneWall(): Node | null {
        const findAllStoneWalls = (node: Node): Node[] => {
            const walls: Node[] = [];
            const wallScript = node.getComponent('StoneWall') as any;
            if (wallScript && node.active && node.isValid) {
                walls.push(node);
            }
            for (const child of node.children) {
                walls.push(...findAllStoneWalls(child));
            }
            return walls;
        };

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const allStoneWalls = findAllStoneWalls(scene);
        let nearestWall: Node | null = null;
        let minDistance = Infinity;

        for (const wall of allStoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;
            const wallPos = wall.worldPosition;
            const distance = Vec3.distance(this.node.worldPosition, wallPos);
            if (distance < minDistance) {
                minDistance = distance;
                nearestWall = wall;
            }
        }

        return nearestWall;
    }

    checkCollisionWithStoneWall(position: Vec3): boolean {
        const findAllStoneWalls = (node: Node): Node[] => {
            const walls: Node[] = [];
            const wallScript = node.getComponent('StoneWall') as any;
            if (wallScript && node.active && node.isValid) {
                walls.push(node);
            }
            for (const child of node.children) {
                walls.push(...findAllStoneWalls(child));
            }
            return walls;
        };

        const scene = this.node.scene;
        if (!scene) {
            return false;
        }

        const allStoneWalls = findAllStoneWalls(scene);
        const enemyRadius = 20;

        for (const wall of allStoneWalls) {
            if (!wall || !wall.active || !wall.isValid) continue;
            const wallScript = wall.getComponent('StoneWall') as any;
            if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;
            const wallPos = wall.worldPosition;
            const wallRadius = wallScript.collisionRadius ?? 25;
            const distanceToWall = Vec3.distance(position, wallPos);
            const minDistance = enemyRadius + wallRadius;
            if (distanceToWall < minDistance) {
                return true;
            }
        }

        return false;
    }

    clampPositionToScreen(position: Vec3): Vec3 {
        const designResolution = view.getDesignResolutionSize();
        const collisionRadius = 20;
        const minX = collisionRadius;
        const maxX = designResolution.width - collisionRadius;
        const minY = collisionRadius;
        const maxY = designResolution.height - collisionRadius;
        const clampedPos = new Vec3(position);
        clampedPos.x = Math.max(minX, Math.min(maxX, clampedPos.x));
        clampedPos.y = Math.max(minY, Math.min(maxY, clampedPos.y));
        return clampedPos;
    }

    flipDirection(direction: Vec3) {
        if (direction.x < 0) {
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(-1, 1, 1);
            }
        } else {
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
            if (this.healthBarNode && this.healthBarNode.isValid) {
                this.healthBarNode.setScale(1, 1, 1);
            }
        }
    }

    checkPathBlockedByStoneWall(): Node | null {
        if (!this.targetCrystal || !this.targetCrystal.isValid) {
            return null;
        }

        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };

        let stoneWallsNode = find('StoneWalls');
        if (!stoneWallsNode && this.node.scene) {
            stoneWallsNode = findNodeRecursive(this.node.scene, 'StoneWalls');
        }

        if (!stoneWallsNode) {
            return null;
        }

        const enemyPos = this.node.worldPosition;
        const crystalPos = this.targetCrystal.worldPosition;
        const direction = new Vec3();
        Vec3.subtract(direction, crystalPos, enemyPos);
        const distanceToCrystal = direction.length();
        
        if (distanceToCrystal < 0.1) {
            return null;
        }

        direction.normalize();
        const checkSteps = Math.ceil(distanceToCrystal / 50);
        const stepSize = distanceToCrystal / checkSteps;
        const stoneWalls = stoneWallsNode.children || [];
        const blockingWalls: { wall: Node; distance: number }[] = [];

        for (let i = 0; i <= checkSteps; i++) {
            const checkPos = new Vec3();
            Vec3.scaleAndAdd(checkPos, enemyPos, direction, stepSize * i);

            for (const wall of stoneWalls) {
                if (!wall || !wall.active || !wall.isValid) continue;
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;
                const wallPos = wall.worldPosition;
                const wallRadius = wallScript.collisionRadius || 40;
                const distanceToWall = Vec3.distance(checkPos, wallPos);
                if (distanceToWall < wallRadius + 20) {
                    const distanceFromEnemy = Vec3.distance(enemyPos, wallPos);
                    blockingWalls.push({ wall, distance: distanceFromEnemy });
                }
            }
        }

        if (blockingWalls.length === 0) {
            return null;
        }

        blockingWalls.sort((a, b) => a.distance - b.distance);
        const nearestWall = blockingWalls[0].wall;
        const perpendicular = new Vec3(-direction.y, direction.x, 0);
        const offsetDistance = 80;
        const leftOffset = new Vec3();
        Vec3.scaleAndAdd(leftOffset, enemyPos, perpendicular, offsetDistance);
        const leftPathClear = this.checkPathClear(leftOffset, crystalPos, stoneWalls);
        const rightOffset = new Vec3();
        Vec3.scaleAndAdd(rightOffset, enemyPos, perpendicular, -offsetDistance);
        const rightPathClear = this.checkPathClear(rightOffset, crystalPos, stoneWalls);

        if (!leftPathClear && !rightPathClear) {
            return nearestWall;
        }

        return null;
    }

    private checkPathClear(startPos: Vec3, endPos: Vec3, stoneWalls: Node[]): boolean {
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        const distance = direction.length();
        
        if (distance < 0.1) {
            return true;
        }

        direction.normalize();
        const checkSteps = Math.ceil(distance / 50);
        const stepSize = distance / checkSteps;

        for (let i = 0; i <= checkSteps; i++) {
            const checkPos = new Vec3();
            Vec3.scaleAndAdd(checkPos, startPos, direction, stepSize * i);

            for (const wall of stoneWalls) {
                if (!wall || !wall.active || !wall.isValid) continue;
                const wallScript = wall.getComponent('StoneWall') as any;
                if (!wallScript || !wallScript.isAlive || !wallScript.isAlive()) continue;
                const wallPos = wall.worldPosition;
                const wallRadius = wallScript.collisionRadius || 40;
                const distanceToWall = Vec3.distance(checkPos, wallPos);
                if (distanceToWall < wallRadius + 20) {
                    return false;
                }
            }
        }

        return true;
    }

    checkForTargetsOnPath() {
        const detectionRange = 200;
        
        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };
        
        const PRIORITY = {
            CRYSTAL: 1,
            STONEWALL: 1.5,
            TREE: 2,
            CHARACTER: 3,
            BUILDING: 4
        };
        
        const allPotentialTargets: Node[] = [];
        const enemyPos = this.node.worldPosition;
        
        if (this.targetCrystal && this.targetCrystal.isValid) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                allPotentialTargets.push(this.targetCrystal);
            }
        }
        
        const blockedStoneWall = this.checkPathBlockedByStoneWall();
        if (blockedStoneWall) {
            allPotentialTargets.push(blockedStoneWall);
        }

        let stoneWallsNode = find('StoneWalls');
        if (!stoneWallsNode && this.node.scene) {
            stoneWallsNode = findNodeRecursive(this.node.scene, 'StoneWalls');
        }
        if (stoneWallsNode) {
            const stoneWalls = stoneWallsNode.children || [];
            for (const wall of stoneWalls) {
                if (wall && wall.active && wall.isValid) {
                    const wallScript = wall.getComponent('StoneWall') as any;
                    if (wallScript && wallScript.isAlive && wallScript.isAlive()) {
                        if (!blockedStoneWall || wall === blockedStoneWall) {
                            allPotentialTargets.push(wall);
                        }
                    }
                }
            }
        }

        const towersNode = find('Canvas/Towers');
        if (towersNode) {
            const towers = towersNode.children || [];
            for (const tower of towers) {
                if (tower && tower.active && tower.isValid) {
                    const towerScript = tower.getComponent('Arrower') as any;
                    if (towerScript && towerScript.isAlive && towerScript.isAlive()) {
                        allPotentialTargets.push(tower);
                    }
                }
            }
        }
        
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        if (huntersNode) {
            const hunters = huntersNode.children || [];
            for (const hunter of hunters) {
                if (hunter && hunter.active && hunter.isValid) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        allPotentialTargets.push(hunter);
                    }
                }
            }
        }
        
        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
            swordsmenNode = findNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        if (swordsmenNode) {
            const swordsmen = swordsmenNode.children || [];
            for (const swordsman of swordsmen) {
                if (swordsman && swordsman.active && swordsman.isValid) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        allPotentialTargets.push(swordsman);
                    }
                }
            }
        }
        
        let warAncientTrees = find('WarAncientTrees');
        if (!warAncientTrees && this.node.scene) {
            warAncientTrees = findNodeRecursive(this.node.scene, 'WarAncientTrees');
        }
        if (warAncientTrees) {
            const trees = warAncientTrees.children || [];
            for (const tree of trees) {
                if (tree && tree.active && tree.isValid) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        allPotentialTargets.push(tree);
                    }
                }
            }
        }
        
        let hallsNode = find('HunterHalls');
        if (!hallsNode && this.node.scene) {
            hallsNode = findNodeRecursive(this.node.scene, 'HunterHalls');
        }
        if (hallsNode) {
            const halls = hallsNode.children || [];
            for (const hall of halls) {
                if (hall && hall.active && hall.isValid) {
                    const hallScript = hall.getComponent('HunterHall') as any;
                    if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                        allPotentialTargets.push(hall);
                    }
                }
            }
        } else if (this.node.scene) {
            const findAllHunterHalls = (node: Node) => {
                const hallScript = node.getComponent('HunterHall') as any;
                if (hallScript && hallScript.isAlive && hallScript.isAlive()) {
                    allPotentialTargets.push(node);
                }
                for (const child of node.children) {
                    findAllHunterHalls(child);
                }
            };
            findAllHunterHalls(this.node.scene);
        }
        
        let bestTarget: Node | null = null;
        let bestPriority = Infinity;
        let bestDistance = Infinity;
        
        for (const target of allPotentialTargets) {
            if (!target || !target.isValid) continue;
            const distance = Vec3.distance(enemyPos, target.worldPosition);
            if (distance > detectionRange) continue;
            
            let targetPriority: number;
            if (target.getComponent('Crystal')) {
                targetPriority = PRIORITY.CRYSTAL;
            } else if (target.getComponent('StoneWall')) {
                targetPriority = PRIORITY.STONEWALL;
            } else if (target.getComponent('Arrower') || target.getComponent('Hunter') || target.getComponent('ElfSwordsman')) {
                targetPriority = PRIORITY.CHARACTER;
            } else if (target.getComponent('WarAncientTree') || target.getComponent('HunterHall')) {
                targetPriority = PRIORITY.BUILDING;
            } else {
                continue;
            }
            
            if (targetPriority < bestPriority || 
                (targetPriority === bestPriority && distance < bestDistance)) {
                bestTarget = target;
                bestPriority = targetPriority;
                bestDistance = distance;
            }
        }
        
        if (bestTarget) {
            this.currentTarget = bestTarget;
        }
    }

    private calculateEnemyAvoidanceDirection(currentPos: Vec3, desiredDirection: Vec3, deltaTime: number): Vec3 {
        const avoidanceForce = new Vec3(0, 0, 0);
        let obstacleCount = 0;
        let maxStrength = 0;
        const detectionRange = this.collisionRadius * 4;

        const findNodeRecursive = (node: Node, name: string): Node | null => {
            if (node.name === name) {
                return node;
            }
            for (const child of node.children) {
                const found = findNodeRecursive(child, name);
                if (found) return found;
            }
            return null;
        };

        const enemyContainers = ['Enemies', 'Orcs', 'TrollSpearmans', 'OrcWarriors', 'OrcWarlords', 'MinotaurWarriors'];
        const allEnemies: Node[] = [];

        for (const containerName of enemyContainers) {
            let containerNode = find(containerName);
            if (!containerNode && this.node.scene) {
                containerNode = findNodeRecursive(this.node.scene, containerName);
            }
            if (containerNode) {
                allEnemies.push(...containerNode.children);
            }
        }

        for (const enemy of allEnemies) {
            if (!enemy || !enemy.isValid || !enemy.active || enemy === this.node) {
                continue;
            }

            const enemyScript = enemy.getComponent('Enemy') as any || 
                               enemy.getComponent('OrcWarlord') as any ||
                               enemy.getComponent('MinotaurWarrior') as any;
            
            if (!enemyScript) {
                continue;
            }

            if (enemyScript.isAlive && !enemyScript.isAlive()) {
                continue;
            }

            const enemyPos = enemy.worldPosition;
            const distance = Vec3.distance(currentPos, enemyPos);
            const otherRadius = enemyScript.collisionRadius || 20;
            const minDistance = this.collisionRadius + otherRadius;

            if (distance < detectionRange && distance > 0.1) {
                const avoidDir = new Vec3();
                Vec3.subtract(avoidDir, currentPos, enemyPos);
                avoidDir.normalize();
                
                let strength = 1 - (distance / detectionRange);
                
                if (distance < minDistance) {
                    strength = 2.0;
                }
                
                Vec3.scaleAndAdd(avoidanceForce, avoidanceForce, avoidDir, strength);
                maxStrength = Math.max(maxStrength, strength);
                obstacleCount++;
            }
        }

        if (obstacleCount > 0 && avoidanceForce.length() > 0.1) {
            avoidanceForce.normalize();
            const avoidanceWeight = maxStrength > 2.0 ? 0.7 : (maxStrength > 1.0 ? 0.5 : 0.3);
            const finalDir = new Vec3();
            Vec3.lerp(finalDir, desiredDirection, avoidanceForce, avoidanceWeight);
            finalDir.normalize();
            return finalDir;
        }

        return desiredDirection;
    }
}
