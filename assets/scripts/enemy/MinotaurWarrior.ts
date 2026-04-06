/**
 * 牛头人领主
 * 继承Boss基类，拥有比兽人督军更高的数值
 * 技能：增强版战争咆哮、战争践踏
 * 
 * 实现说明：
 * 1. 数值比OrcWarlord更高：
 *    - maxHealth: 2000 (OrcWarlord: 100)
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

import { _decorator, Node, Vec3, Sprite, find, Prefab, SpriteFrame, UITransform, AudioClip, Label, instantiate, view } from 'cc';
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
    maxHealth: number = 2000; // 比OrcWarlord的100更高

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
    unitName: string = "牛头人领主";
    
    @property
    unitDescription: string = "牛头人领主，情报有限。";
    
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
    stompRange: number = 170; // 战争践踏范围（像素）
    
    @property
    stompDamageMultiplier: number = 2.0; // 伤害倍率（两倍攻击力）
    
    @property(AudioClip)
    stompSound: AudioClip = null!; // 战争践踏音效
    
    @property(SpriteFrame)
    stompAnimationFrames: SpriteFrame[] = []; // 战争践踏动画帧

    @property
    stompAnimationDuration: number = 1.0; // 战争践踏动画时长

    @property(SpriteFrame)
    stompCrackFrame1: SpriteFrame = null!; // 战争践踏裂缝贴图 1

    @property(SpriteFrame)
    stompCrackFrame2: SpriteFrame = null!; // 战争践踏裂缝贴图 2

    @property(SpriteFrame)
    stompCrackFrame3: SpriteFrame = null!; // 战争践踏裂缝贴图 3

    @property(AudioClip)
    stompCrackSound: AudioClip = null!; // 战争践踏裂缝音效（动画播放到一半时播放）

    // 范围攻击属性（前方扇形攻击）
    @property({
        tooltip: "范围攻击半径（像素）"
    })
    aoeRange: number = 100; // 攻击范围半径

    @property({
        tooltip: "范围攻击角度（度）"
    })
    aoeAngle: number = 90; // 前方扇形角度

    // 私有属性（需要从OrcWarlord复制）
    // 生命值、血条与大部分运行时状态均由 Boss 基类维护，这里不再重复声明这些字段
    
    @property
    goldReward: number = 10; // 比OrcWarlord的5更高
    
    @property
    expReward: number = 20; // 比OrcWarlord的10更高
    
    @property(AudioClip)
    deathSound: AudioClip = null!;
    
    @property(AudioClip)
    attackSound: AudioClip = null!;

    // 动画与伤害相关运行时状态由 Boss 基类维护，这里不再重复声明

    // 战争践踏私有属性
    private stompTimer: number = 0; // 战争践踏冷却计时器
    private isPlayingStompAnimation: boolean = false; // 是否正在播放战争践踏动画
    private stompCrackNode: Node = null!; // 地面裂缝贴图节点
    private isStompCrackActive: boolean = false; // 裂缝是否正在激活状态
    private stompCrackFrames: SpriteFrame[] = []; // 3 张裂缝贴图数组
    private currentCrackFrameIndex: number = 0; // 当前显示的裂缝贴图索引
    private crackFrameDuration: number = 1.0 / 3; // 每张贴图显示时长（践踏时）
    private crackFrameTimer: number = 0; // 裂缝贴图切换计时器

    // 低血量狂暴相关属性
    private hasTriggeredFrenzy: boolean = false; // 是否已触发狂暴
    private isFrenzy: boolean = false; // 是否处于狂暴状态
    private baseAttackDamage: number = 0; // 基础攻击力（狂暴前）
    private baseAttackInterval: number = 0; // 基础攻击间隔（狂暴前）

    // 顶部 Boss 血条相关
    private bossHealthBarNode: Node = null!; // 顶部 Boss 血条节点
    private bossHealthBar: any = null!; // 顶部 Boss 血条组件
    private static bossHealthBarList: MinotaurWarrior[] = []; // 所有存活牛头人列表，用于血条排列
    private static bossHealthBarContainer: Node = null!; // 血条容器节点
    private bossHealthBarIndex: number = -1; // 当前牛头人在血条列表中的索引

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
                              node.getComponent('Mage') as any ||
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
                                      tower.getComponent('Mage') as any ||
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
                // 计算受击方向：从牛头人指向目标
                const hitDir = new Vec3(dx, dy, 0);
                if (hitDir.length() > 0.001) {
                    hitDir.normalize();
                }

                const unitScript = unit.getComponent('Arrower') as any ||
                                  unit.getComponent('Hunter') as any ||
                                  unit.getComponent('ElfSwordsman') as any ||
                                  unit.getComponent('Mage') as any ||
                                  unit.getComponent('Priest') as any ||
                                  unit.getComponent('WatchTower') as any ||
                                  unit.getComponent('IceTower') as any ||
                                  unit.getComponent('ThunderTower') as any ||
                                  unit.getComponent('WarAncientTree') as any ||
                                  unit.getComponent('HunterHall') as any ||
                                  unit.getComponent('MageTower') as any ||
                                  unit.getComponent('Church') as any ||
                                  unit.getComponent('SwordsmanHall') as any ||
                                  unit.getComponent('Crystal') as any ||
                                  unit.getComponent('StoneWall') as any;

                if (unitScript && unitScript.takeDamage && typeof unitScript.takeDamage === 'function') {
                    unitScript.takeDamage(stompDamage, hitDir);
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
        console.log('[MinotaurWarrior] playStompAnimation 被调用，stompTimer=' + this.stompTimer.toFixed(2));

        if (this.isPlayingDeathAnimation || this.isDestroyed) {
            return;
        }

        if (this.isPlayingStompAnimation) {
            return;
        }

        // 如果正在播放攻击动画，先停止攻击
        if (this.isPlayingAttackAnimation) {
            this.isPlayingAttackAnimation = false;
            this.attackComplete = false;
        }

        // 重置攻击计时器，防止践踏期间触发攻击
        this.attackTimer = 0;

        // 停止其他动画
        this.stopAllAnimations();
        this.isPlayingStompAnimation = true;
        this.animationTimer = 0;
        this.currentAnimationFrameIndex = -1;

        // 创建/显示裂缝贴图
        this.showStompCrack();

        // 如果没有战争践踏动画帧，直接释放效果并回到空闲状态
        if (this.stompAnimationFrames.length === 0) {
            console.warn('[MinotaurWarrior] 战争践踏动画帧未配置，直接释放效果');
            this.releaseStomp();
            this.isPlayingStompAnimation = false;
            this.playIdleAnimation();
        } else {
            console.log('[MinotaurWarrior] 开始播放战争践踏动画，帧数:', this.stompAnimationFrames.length);
            // 立即播放第一帧动画，确保视觉反馈及时
            this.sprite.spriteFrame = this.stompAnimationFrames[0];
        }
    }

    /**
     * 显示地面裂缝贴图（固定在原地，不跟随牛头人移动）
     */
    private showStompCrack() {
        // 初始化 3 张裂缝贴图
        this.stompCrackFrames = [this.stompCrackFrame1, this.stompCrackFrame2, this.stompCrackFrame3].filter(f => f != null);
        if (this.stompCrackFrames.length === 0) {
            console.warn('[MinotaurWarrior] 裂缝贴图未设置');
            return;
        }

        // 获取牛头人当前位置（世界坐标）
        const bossPos = this.node.worldPosition;

        // 如果裂缝节点不存在，创建它
        if (!this.stompCrackNode || !this.stompCrackNode.isValid) {
            this.stompCrackNode = new Node('StompCrack');

            // 将裂缝节点添加到 Canvas 下，但在敌人容器之下
            const canvasNode = find('Canvas');
            if (canvasNode) {
                this.stompCrackNode.setParent(canvasNode);

                // 将裂缝放到 Background 之上、其他单位之下
                const backgroundNode = canvasNode.getChildByName('Background');
                if (backgroundNode) {
                    const newIndex = backgroundNode.getSiblingIndex() + 1;
                    this.stompCrackNode.setSiblingIndex(newIndex);
                } else {
                    this.stompCrackNode.setSiblingIndex(3);
                }
            } else {
                const scene = this.node.scene;
                if (scene) {
                    this.stompCrackNode.setParent(scene);
                } else {
                    this.stompCrackNode.setParent(this.node);
                }
            }

            // 设置裂缝节点位置为牛头人当前位置
            this.stompCrackNode.setWorldPosition(bossPos.x, bossPos.y, 0);

            const sprite = this.stompCrackNode.addComponent(Sprite);
            sprite.spriteFrame = this.stompCrackFrames[0]; // 显示第一张
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            const uiTransform = this.stompCrackNode.addComponent(UITransform);
            uiTransform.setContentSize(this.stompRange * 2, this.stompRange * 2);

            // 设置初始透明度
            const color = sprite.color.clone();
            color.a = 0;
            sprite.color = color;

            // 初始化裂缝状态
            this.currentCrackFrameIndex = 0;
            this.crackFrameTimer = 0;
        } else {
            // 重新显示裂缝
            this.stompCrackNode.setWorldPosition(bossPos.x, bossPos.y, 0);

            const sprite = this.stompCrackNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = this.stompCrackFrames[0];
                const color = sprite.color.clone();
                color.a = 0;
                sprite.color = color;
            }
            this.stompCrackNode.active = true;

            // 重置状态
            this.currentCrackFrameIndex = 0;
            this.crackFrameTimer = 0;
        }

        this.isStompCrackActive = true;
    }

    /**
     * 更新裂缝贴图（践踏播放时切换贴图并逐渐清晰）
     * @param deltaTime 帧间隔时间
     */
    private updateStompCrackDuringStomp(deltaTime: number) {
        if (!this.stompCrackNode || !this.stompCrackNode.isValid || this.stompCrackFrames.length === 0) {
            return;
        }

        const sprite = this.stompCrackNode.getComponent(Sprite);
        if (!sprite) return;

        // 累加计时器
        this.crackFrameTimer += deltaTime;

        // 切换贴图（每张图约 1/3 时长）
        const framesPerCrack = Math.max(1, Math.floor(this.stompAnimationFrames.length / 3));
        const targetFrameIndex = Math.floor(this.currentAnimationFrameIndex / framesPerCrack);

        if (targetFrameIndex !== this.currentCrackFrameIndex && targetFrameIndex < this.stompCrackFrames.length) {
            this.currentCrackFrameIndex = targetFrameIndex;
            sprite.spriteFrame = this.stompCrackFrames[this.currentCrackFrameIndex];
            console.log('[MinotaurWarrior] 切换到裂缝贴图', this.currentCrackFrameIndex + 1);
        }

        // 透明度从 0 渐变到最大（200）
        const progress = this.animationTimer / this.stompAnimationDuration;
        const maxAlpha = 200;
        const currentAlpha = Math.min(Math.floor(progress * maxAlpha), maxAlpha);

        const color = sprite.color.clone();
        color.a = currentAlpha;
        sprite.color = color;
    }

    /**
     * 践踏完成后，裂缝倒序播放并逐渐虚化（每张贴图约 3.3 秒，共 10 秒）
     */
    private fadeOutStompCrack() {
        if (!this.stompCrackNode || !this.stompCrackNode.isValid || this.stompCrackFrames.length === 0) {
            return;
        }

        const sprite = this.stompCrackNode.getComponent(Sprite);
        if (!sprite) return;

        // 倒序播放 3 张裂缝贴图，每张约 3.3 秒
        const frameDuration = 10.0 / this.stompCrackFrames.length; // 约 3.3 秒
        let currentFrameIndex = this.stompCrackFrames.length - 1;
        let timer = 0;
        let alpha = 200; // 从最大透明度开始

        // 设置初始贴图（最后一张）
        sprite.spriteFrame = this.stompCrackFrames[currentFrameIndex];

        const updateFunc = (dt: number) => {
            if (!this.stompCrackNode || !this.stompCrackNode.isValid) {
                return;
            }

            timer += dt;
            alpha -= (200 / 10) * dt; // 10 秒内从 200 降到 0

            // 更新透明度
            const color = sprite.color.clone();
            color.a = Math.max(0, Math.floor(alpha));
            sprite.color = color;

            // 切换贴图（倒序）
            if (timer >= frameDuration && currentFrameIndex > 0) {
                timer = 0;
                currentFrameIndex--;
                sprite.spriteFrame = this.stompCrackFrames[currentFrameIndex];
                console.log('[MinotaurWarrior] 裂缝消散 - 切换到贴图', currentFrameIndex + 1);
            }

            // 10 秒后隐藏
            if (alpha <= 0) {
                this.stompCrackNode.active = false;
                this.isStompCrackActive = false;
            }
        };

        // 使用 scheduleUpdate 或 tween 来实现持续更新
        // 这里使用一个简单的计时器循环
        const schedule = () => {
            if (!this.stompCrackNode || !this.stompCrackNode.isValid || alpha <= 0) {
                return;
            }
            updateFunc(0.1); // 每帧约 0.1 秒
            setTimeout(schedule, 100);
        };
        schedule();
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

        // 调试日志：追踪动画更新
        if (this.currentAnimationFrameIndex !== frameIndex) {
            console.log(`[MinotaurWarrior] 战争践踏动画：frame=${frameIndex}, timer=${this.animationTimer.toFixed(2)}, stompPoint=${Math.floor(this.stompAnimationFrames.length * 0.5)}`);
        }

        if (frameIndex < this.stompAnimationFrames.length) {
            if (frameIndex !== this.currentAnimationFrameIndex) {
                this.currentAnimationFrameIndex = frameIndex;
                this.sprite.spriteFrame = this.stompAnimationFrames[frameIndex];

                // 在动画中间点释放战争践踏效果并播放裂缝音效
                const stompPoint = Math.floor(this.stompAnimationFrames.length * 0.5);
                if (frameIndex === stompPoint) {
                    console.log('[MinotaurWarrior] 战争践踏动画到达中间点，释放效果并播放音效');
                    this.releaseStomp();

                    // 播放裂缝音效（只播放一次）
                    if (this.stompCrackSound) {
                        AudioManager.Instance.playSFX(this.stompCrackSound);
                    }
                }
            }

            // 更新裂缝贴图（每帧调用，切换贴图并更新透明度）
            this.updateStompCrackDuringStomp(frameDuration);
        } else {
            // 战争践踏动画播放完成
            this.isPlayingStompAnimation = false;
            // 播放空闲动画，攻击会由 update 循环中的正常逻辑触发
            this.playIdleAnimation();
            // 开始裂缝虚化动画（10 秒后消失）
            this.fadeOutStompCrack();
        }
    }

    onEnable() {
        console.log('[MinotaurWarrior.onEnable] 被调用，node.name=', this.node.name);
        // 清理所有插在身上的武器（箭矢、长矛等）
        this.clearAttachedWeapons();

        // 调用父类方法恢复燃血狂暴改写的属性，避免数值叠加
        this.restoreBloodRageAttributesIfNeeded();

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
        // 重置狂怒状态（继承自 Boss 的属性）
        this.clearBloodRageVisualOnly();
        this.isBloodRageActive = false;
        this.bloodRageBurnTimer = 0;
        this.bloodRageOriginalMaxHealth = 0;
        this.bloodRageOriginalMoveSpeed = 0;
        this.bloodRageOriginalAttackDamage = 0;
        this.bloodRageOriginalAttackInterval = 0;
        this.bloodRagePulsePhase = 0;
        this.bloodRageOriginalColor = null;
        this.bloodRageTier = 0;
        // 战争践踏相关初始化
        this.stompTimer = 0;
        this.isPlayingStompAnimation = false;
        this.isStompCrackActive = false;
        // 隐藏裂缝节点（如果存在）
        if (this.stompCrackNode && this.stompCrackNode.isValid) {
            this.stompCrackNode.active = false;
        }
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

        // 狂暴状态重置
        this.hasTriggeredFrenzy = false;
        this.isFrenzy = false;
        // 保存基础属性
        this.baseAttackDamage = this.attackDamage;
        this.baseAttackInterval = this.attackInterval;
        
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
        if (!this.healthBarNode || !this.healthBarNode.isValid || !this.healthBar) {
            this.createHealthBar();
        } else {
            // 如果血条已存在，更新血条状态
            this.healthBar.setMaxHealth(this.maxHealth);
            this.healthBar.setHealth(this.currentHealth);
        }

        // 创建顶部 Boss 血条
        this.createBossHealthBar();

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
        if (!this.healthBarNode || !this.healthBarNode.isValid || !this.healthBar) {
            this.createHealthBar();
        }

        // 创建顶部 Boss 血条
        this.createBossHealthBar();

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

    /**
     * 创建顶部 Boss 血条（显示在屏幕顶部中央）
     */
    createBossHealthBar() {
        console.log('[MinotaurWarrior.createBossHealthBar] 开始创建，node.name=', this.node.name, 'currentHealth=', this.currentHealth, 'maxHealth=', this.maxHealth);

        // 检查是否已存在
        if (this.bossHealthBarNode && this.bossHealthBarNode.isValid) {
            console.log('[MinotaurWarrior.createBossHealthBar] 血条已存在，直接显示');
            this.bossHealthBarNode.active = true;
            if (this.bossHealthBar) {
                this.bossHealthBar.setMaxHealth(this.maxHealth);
                this.bossHealthBar.setHealth(this.currentHealth);
            }
            return;
        }

        // 查找 Canvas 节点
        const canvas = find('Canvas');
        console.log('[MinotaurWarrior.createBossHealthBar] Canvas 节点:', canvas ? '找到' : '未找到');
        if (!canvas) {
            console.warn('[MinotaurWarrior] 未找到 Canvas 节点，无法创建顶部 Boss 血条');
            return;
        }

        // 创建或获取血条容器节点
        if (!MinotaurWarrior.bossHealthBarContainer || !MinotaurWarrior.bossHealthBarContainer.isValid) {
            console.log('[MinotaurWarrior.createBossHealthBar] 创建血条容器节点');
            MinotaurWarrior.bossHealthBarContainer = new Node('BossHealthBarContainer');
            MinotaurWarrior.bossHealthBarContainer.setParent(canvas);
            // 设置容器位置在屏幕顶部中央
            const uiTransform = canvas.getComponent(UITransform);
            console.log('[MinotaurWarrior.createBossHealthBar] Canvas UITransform:', uiTransform ? `size=${uiTransform.contentSize.width}x${uiTransform.contentSize.height}` : '未找到');
            if (uiTransform) {
                // Cocos Creator 坐标系统：(0,0) 是中心点，向上为正
                // 顶部边缘 Y = contentSize.height / 2
                // 血条容器位置：X=0 (居中), Y=顶部边缘 - 50 像素偏移
                const topY = uiTransform.contentSize.height / 2 - 50;
                MinotaurWarrior.bossHealthBarContainer.setPosition(0, topY, 0);
                console.log('[MinotaurWarrior.createBossHealthBar] 容器位置设置为 (0,', topY, ', 0)');
            } else {
                MinotaurWarrior.bossHealthBarContainer.setPosition(0, 500, 0);
            }

            // 将容器放到 Canvas 的最顶层（最高 siblingIndex）
            const siblingIndex = canvas.children.length - 1;
            MinotaurWarrior.bossHealthBarContainer.setSiblingIndex(siblingIndex);
            console.log('[MinotaurWarrior.createBossHealthBar] 血条容器设置为最顶层，siblingIndex=', siblingIndex);
        } else {
            console.log('[MinotaurWarrior.createBossHealthBar] 血条容器节点已存在');
            // 确保容器在最顶层
            const siblingIndex = canvas.children.length - 1;
            MinotaurWarrior.bossHealthBarContainer.setSiblingIndex(siblingIndex);
        }

        // 创建血条节点
        this.bossHealthBarNode = new Node('BossHealthBar_' + this.node.uuid);
        this.bossHealthBarNode.setParent(MinotaurWarrior.bossHealthBarContainer);
        console.log('[MinotaurWarrior.createBossHealthBar] 创建血条节点，parent=', MinotaurWarrior.bossHealthBarContainer.name);

        // 添加 HealthBar 组件
        this.bossHealthBar = this.bossHealthBarNode.addComponent(HealthBar);
        console.log('[MinotaurWarrior.createBossHealthBar] HealthBar 组件:', this.bossHealthBar ? '添加成功' : '添加失败');
        if (this.bossHealthBar) {
            // 设置 Boss 血条标志（启用美化）
            this.bossHealthBar.isBossBar = true;
            // 设置 Boss 名称
            this.bossHealthBar.bossName = "牛头人领主";
            // 设置更大的血条尺寸
            this.bossHealthBar.barWidth = 300;
            this.bossHealthBar.barHeight = 20;
            this.bossHealthBar.setMaxHealth(this.maxHealth);
            this.bossHealthBar.setHealth(this.currentHealth);
            console.log('[MinotaurWarrior.createBossHealthBar] 血条设置完成，currentHealth=', this.currentHealth, '/', this.maxHealth);

            // 手动调用 start 方法确保 Graphics 组件和名称标签正确初始化
            if (this.bossHealthBar.start) {
                this.bossHealthBar.start();
                console.log('[MinotaurWarrior.createBossHealthBar] 手动调用 HealthBar.start()');
            }

            // 设置 Boss 名称（start 之后调用以确保标签已创建）
            if (this.bossHealthBar.setBossName) {
                this.bossHealthBar.setBossName("牛头人领主");
            }

            // 强制刷新一次血条显示
            this.bossHealthBar.updateBar();
            console.log('[MinotaurWarrior.createBossHealthBar] 强制刷新血条显示');
        }

        // 确保血条节点激活
        this.bossHealthBarNode.active = true;
        console.log('[MinotaurWarrior.createBossHealthBar] 血条节点激活状态:', this.bossHealthBarNode.active);

        // 添加到列表并更新血条位置
        this.bossHealthBarIndex = MinotaurWarrior.bossHealthBarList.length;
        MinotaurWarrior.bossHealthBarList.push(this);
        MinotaurWarrior.updateBossHealthBarPositions();

        console.log('[MinotaurWarrior.createBossHealthBar] 顶部 Boss 血条创建完成，当前血条数量:', MinotaurWarrior.bossHealthBarList.length);
    }

    /**
     * 更新所有 Boss 血条的位置（垂直排列）
     */
    private static updateBossHealthBarPositions() {
        const verticalSpacing = 20; // 血条之间的垂直间距
        const startY = 0;

        console.log('[MinotaurWarrior.updateBossHealthBarPositions] 开始更新血条位置，血条数量=', MinotaurWarrior.bossHealthBarList.length);
        for (let i = 0; i < MinotaurWarrior.bossHealthBarList.length; i++) {
            const warrior = MinotaurWarrior.bossHealthBarList[i];
            if (warrior && warrior.bossHealthBarNode && warrior.bossHealthBarNode.isValid) {
                // 从上到下排列，y 坐标递减
                warrior.bossHealthBarNode.setPosition(0, startY - i * verticalSpacing, 0);
                console.log('[MinotaurWarrior.updateBossHealthBarPositions] 血条', i, '位置设置为 (0,', startY - i * verticalSpacing, ', 0)');
            } else {
                console.warn('[MinotaurWarrior.updateBossHealthBarPositions] 血条', i, '无效');
            }
        }
    }

    /**
     * 从血条列表中移除当前牛头人
     */
    private static removeBossHealthBar(warrior: MinotaurWarrior) {
        console.log('[MinotaurWarrior.removeBossHealthBar] 开始移除，当前列表数量=', MinotaurWarrior.bossHealthBarList.length);
        const index = MinotaurWarrior.bossHealthBarList.indexOf(warrior);
        if (index >= 0) {
            console.log('[MinotaurWarrior.removeBossHealthBar] 找到牛头人，索引=', index);
            MinotaurWarrior.bossHealthBarList.splice(index, 1);
            // 重新排列剩余血条
            MinotaurWarrior.updateBossHealthBarPositions();
        } else {
            console.warn('[MinotaurWarrior.removeBossHealthBar] 未在列表中找到牛头人');
        }

        // 如果所有牛头人都已死亡，销毁容器节点
        if (MinotaurWarrior.bossHealthBarList.length === 0 &&
            MinotaurWarrior.bossHealthBarContainer &&
            MinotaurWarrior.bossHealthBarContainer.isValid) {
            console.log('[MinotaurWarrior.removeBossHealthBar] 所有牛头人死亡，销毁容器节点');
            MinotaurWarrior.bossHealthBarContainer.destroy();
            MinotaurWarrior.bossHealthBarContainer = null!;
        }
    }

    /**
     * 更新顶部 Boss 血条
     */
    updateBossHealthBar() {
        if (this.bossHealthBar && this.bossHealthBarNode && this.bossHealthBarNode.isValid) {
            this.bossHealthBar.setHealth(this.currentHealth);
            console.log('[MinotaurWarrior.updateBossHealthBar] 更新血条，currentHealth=', this.currentHealth, '/', this.maxHealth);
        } else {
            console.warn('[MinotaurWarrior.updateBossHealthBar] 血条无效，bossHealthBar=', !!this.bossHealthBar, 'bossHealthBarNode=', this.bossHealthBarNode?.isValid);
        }
    }

    /**
     * 隐藏顶部 Boss 血条
     */
    hideBossHealthBar() {
        console.log('[MinotaurWarrior.hideBossHealthBar] 开始隐藏');
        // 从列表中移除并更新血条位置
        MinotaurWarrior.removeBossHealthBar(this);

        // 销毁血条节点
        if (this.bossHealthBarNode && this.bossHealthBarNode.isValid) {
            this.bossHealthBarNode.destroy();
        }
        this.bossHealthBarNode = null!;
        this.bossHealthBar = null!;
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
                const mageScript = this.currentTarget.getComponent('Mage') as any;
                const stoneWallScript = this.currentTarget.getComponent('StoneWall') as any;
                const watchTowerScript = this.currentTarget.getComponent('WatchTower') as any;
                const iceTowerScript = this.currentTarget.getComponent('IceTower') as any;
                const thunderTowerScript = this.currentTarget.getComponent('ThunderTower') as any;
                const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || priestScript || mageScript || crystalScript || hunterScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;

                // 检查目标是否存活（直接检查血量和 destroyed 状态，因为 isAlive 是 protected）
                if (targetScript && (targetScript.isDestroyed || targetScript.currentHealth <= 0)) {
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

    // 停止所有动画逻辑复用 Boss 基类的 stopAllAnimations，外加战争践踏状态控制

    // 攻击方法逻辑与 Boss 基类一致，直接继承 Boss.attack()

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
                const mageScript = tower.getComponent('Mage') as any;
                const characterScript = towerScript || priestScript || mageScript;
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

    // 插在身上的武器清理逻辑复用 Boss 基类的 protected clearAttachedWeapons

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

        if (this.isPlayingStompAnimation) {
            this.updateStompAnimation();
        } else if (this.isPlayingIdleAnimation) {
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
        }
    }

    // 动画更新逻辑（待机、行走等）直接继承 Boss 基类的实现

    // 行走动画更新逻辑同样复用 Boss 基类的 updateWalkAnimation

    protected updateAttackAnimation() {
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
                    // 在攻击命中点播放攻击音效
                    if (this.attackSound) {
                        AudioManager.Instance.playSFX(this.attackSound);
                    }

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

    protected updateHitAnimation() {
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

    protected updateDeathAnimation() {
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

    // 行走动画播放逻辑复用 Boss 基类的 playWalkAnimation

    playAttackAnimation() {
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
    }

    // 受击与死亡动画播放逻辑复用 Boss 基类的 playHitAnimation / playDeathAnimation

    dealDamage() {
        // 牛头人领主范围攻击：对前方扇形区域内的所有我方单位造成伤害
        const bossPos = this.node.worldPosition.clone();

        // 使用当前目标的方向作为扇形中心方向（如果没有目标，使用贴图朝向）
        let bossAngleRad = 0;
        if (this.currentTarget && this.currentTarget.isValid && this.currentTarget.active) {
            const targetPos = this.currentTarget.worldPosition;
            const dx = targetPos.x - bossPos.x;
            const dy = targetPos.y - bossPos.y;
            bossAngleRad = Math.atan2(dy, dx);
        } else {
            // 没有目标，使用贴图朝向
            const isFacingRight = this.node.scale.x > 0;
            bossAngleRad = isFacingRight ? 0 : Math.PI;
        }

        // 查找所有可能的目标
        const potentialTargets: Node[] = [];

        // 从 UnitManager 获取所有我方单位
        if (this.unitManager) {
            // 获取所有防御塔（弓箭手、法师、牧师）
            const towers = this.unitManager.getTowers();
            for (const tower of towers) {
                if (tower && tower.isValid && tower.active) {
                    const script = tower.getComponent('Arrower') as any ||
                                  tower.getComponent('Mage') as any ||
                                  tower.getComponent('Priest') as any;
                    if (script && script.isAlive && script.isAlive()) {
                        potentialTargets.push(tower);
                    }
                }
            }

            // 获取女猎手
            const hunters = this.unitManager.getHunters();
            for (const hunter of hunters) {
                if (hunter && hunter.isValid && hunter.active) {
                    const hunterScript = hunter.getComponent('Hunter') as any;
                    if (hunterScript && hunterScript.isAlive && hunterScript.isAlive()) {
                        potentialTargets.push(hunter);
                    }
                }
            }

            // 获取精灵剑士
            const elfSwordsmans = this.unitManager.getElfSwordsmans();
            for (const swordsman of elfSwordsmans) {
                if (swordsman && swordsman.isValid && swordsman.active) {
                    const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                    if (swordsmanScript && swordsmanScript.isAlive && swordsmanScript.isAlive()) {
                        potentialTargets.push(swordsman);
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
                        potentialTargets.push(building);
                    }
                }
            }

            // 获取石墙
            const stoneWalls = this.unitManager.getStoneWalls();
            for (const wall of stoneWalls) {
                if (wall && wall.isValid && wall.active) {
                    const wallScript = wall.getComponent('StoneWall') as any;
                    if (wallScript && wallScript.isAlive && wallScript.isAlive()) {
                        potentialTargets.push(wall);
                    }
                }
            }
        }

        // 也检查水晶
        if (this.targetCrystal && this.targetCrystal.isValid && this.targetCrystal.active) {
            const crystalScript = this.targetCrystal.getComponent('Crystal') as any;
            if (crystalScript && crystalScript.isAlive && crystalScript.isAlive()) {
                potentialTargets.push(this.targetCrystal);
            }
        }

        // 筛选在扇形范围内的目标
        const rangeSq = this.aoeRange * this.aoeRange;
        const halfAngleRad = (this.aoeAngle / 2) * Math.PI / 180; // 半角弧度

        for (const target of potentialTargets) {
            if (!target || !target.isValid || !target.active) {
                continue;
            }

            const targetPos = target.worldPosition;
            const dx = targetPos.x - bossPos.x;
            const dy = targetPos.y - bossPos.y;
            const distanceSq = dx * dx + dy * dy;
            const distance = Math.sqrt(distanceSq);

            // 检查距离
            if (distanceSq > rangeSq) {
                continue;
            }

            // 检查角度（前方扇形）
            if (distance < 1) {
                // 距离太近，默认在范围内
                this.dealDamageToTarget(target, bossPos);
                continue;
            }

            // 计算目标方向与牛头人朝向的夹角
            const targetAngle = Math.atan2(dy, dx); // 目标方向弧度
            const bossAngle = bossAngleRad; // 牛头人朝向弧度（使用目标方向或贴图朝向）

            // 计算角度差（归一化到 -PI 到 PI）
            let angleDiff = targetAngle - bossAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            // 检查是否在扇形角度内
            if (Math.abs(angleDiff) <= halfAngleRad) {
                this.dealDamageToTarget(target, bossPos);
            }
        }
    }

    /**
     * 对单个目标造成伤害
     */
    private dealDamageToTarget(target: Node, bossPos: Vec3) {
        const towerScript = target.getComponent('Arrower') as any;
        const warAncientTreeScript = target.getComponent('WarAncientTree') as any;
        const hallScript = target.getComponent('HunterHall') as any || target.getComponent('MageTower') as any;
        const swordsmanHallScript = target.getComponent('SwordsmanHall') as any;
        const churchScript = target.getComponent('Church') as any;
        const crystalScript = target.getComponent('Crystal') as any;
        const hunterScript = target.getComponent('Hunter') as any;
        const mageScript = target.getComponent('Mage') as any;
        const elfSwordsmanScript = target.getComponent('ElfSwordsman') as any;
        const priestScript = target.getComponent('Priest') as any;
        const stoneWallScript = target.getComponent('StoneWall') as any;
        const watchTowerScript = target.getComponent('WatchTower') as any;
        const iceTowerScript = target.getComponent('IceTower') as any;
        const thunderTowerScript = target.getComponent('ThunderTower') as any;
        const targetScript = towerScript || warAncientTreeScript || hallScript || swordsmanHallScript || churchScript || priestScript || crystalScript || hunterScript || mageScript || elfSwordsmanScript || stoneWallScript || watchTowerScript || iceTowerScript || thunderTowerScript;

        if (targetScript && targetScript.takeDamage && typeof targetScript.takeDamage === 'function') {
            // 计算受击方向：从牛头人指向目标
            const hitDir = new Vec3();
            const targetPos = target.worldPosition;
            Vec3.subtract(hitDir, targetPos, bossPos);
            if (hitDir.length() > 0.001) {
                hitDir.normalize();
            }
            targetScript.takeDamage(this.attackDamage, hitDir);
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
            // 更新顶部 Boss 血条
            this.updateBossHealthBar();
            this.showDamageNumber(damage);

            // 检查是否触发狂暴
            this.checkAndTriggerFrenzy();

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

        // 更新顶部 Boss 血条
        this.updateBossHealthBar();

        // 检查是否触发狂暴
        this.checkAndTriggerFrenzy();

        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    /**
     * 检查并触发低血量狂暴
     * 当血量低于 50% 时，触发全场兽人狂暴模式
     */
    private checkAndTriggerFrenzy() {
        if (this.hasTriggeredFrenzy || this.isDestroyed) {
            return;
        }

        const healthPercent = this.currentHealth / this.maxHealth;
        if (healthPercent <= 0.5) {
            this.triggerFrenzy();
        }
    }

    /**
     * 触发狂暴模式
     * 显示"兽人永不为奴"提示，并触发全场兽人狂怒状态
     */
    private triggerFrenzy() {
        this.hasTriggeredFrenzy = true;
        this.isFrenzy = true;

        // 查找 EnemySpawner 并触发全场兽人狂怒
        const enemySpawnerNode = find('Canvas/EnemySpawner') || find('EnemySpawner');
        const spawner = enemySpawnerNode ? (enemySpawnerNode.getComponent('EnemySpawner') as any) : null;
        if (spawner && typeof spawner['triggerOrcBloodRage'] === 'function') {
            try {
                spawner['triggerOrcBloodRage'](1);
                console.log('[MinotaurWarrior] 已触发全场兽人狂怒状态');
            } catch (e) {
                console.warn('[MinotaurWarrior] 触发全场狂怒失败', e);
            }
        } else {
            // 备用方案：直接调用 GameManager 显示提示
            if (this.gameManager) {
                this.gameManager.showOrcBloodRageIntro(undefined, 1);
            }
        }

        console.log('[MinotaurWarrior] 触发狂暴模式！血量低于 50%，全场兽人进入狂怒状态');
    }

    // 恢复移动逻辑复用 Boss 基类的 resumeMovement

    // 伤害数字显示逻辑复用 Boss 基类的 showDamageNumber

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

        // 隐藏顶部 Boss 血条
        this.hideBossHealthBar();

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

    protected resetEnemyState() {
        // 先调用父类的重置逻辑
        super.resetEnemyState();
        // 再重置 MinotaurWarrior 自己新增的状态（如战争践踏、狂暴）
        this.stompTimer = 0;
        this.isPlayingStompAnimation = false;
        this.isStompCrackActive = false;
        // 隐藏并清理裂缝节点
        if (this.stompCrackNode && this.stompCrackNode.isValid) {
            this.stompCrackNode.destroy();
        }
        this.stompCrackNode = null!;
        if (this.healthBarNode && this.healthBarNode.isValid) {
            this.healthBarNode.destroy();
        }
        this.healthBarNode = null!;
        this.healthBar = null!;
        // 重置狂暴状态
        this.hasTriggeredFrenzy = false;
        this.isFrenzy = false;
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

    // 路径畅通检测逻辑复用自 Boss 基类的 protected checkPathClear(startPos, endPos, stoneWalls)

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

    protected calculateEnemyAvoidanceDirection(currentPos: Vec3, desiredDirection: Vec3, deltaTime: number): Vec3 {
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
