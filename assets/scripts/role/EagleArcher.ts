import { _decorator, Vec3, find } from 'cc';
import { Arrower } from './Arrower';
import { PlayerDataManager } from '../PlayerDataManager';
import { GamePopup } from '../GamePopup';
const { ccclass, property } = _decorator;

/**
 * 角鹰射手 - 转职单位
 * 由弓箭手使用角鹰缰绳转职而来
 * 特点：
 * - 飞行单位
 * - 继承穿透箭技能
 * - 攻击力、攻速、移速 +20%
 * - 攻击范围 +60
 * - 生命值为弓箭手的 2 倍
 */
@ccclass('EagleArcher')
export class EagleArcher extends Arrower {
    // 飞行单位标志
    @property({ visible: false })
    isFlying: boolean = true;

    // 重写属性：攻击力 +20% (10 * 1.2 = 12)
    @property({ override: true })
    attackDamage: number = 12;

    // 重写属性：攻击速度 +20% (1.0 / 1.2 ≈ 0.833)
    @property({ override: true })
    attackInterval: number = 0.833;

    // 重写属性：移动速度 +20% (100 * 1.2 = 120)
    @property({ override: true })
    moveSpeed: number = 120;

    // 重写属性：攻击范围 +60 (200 + 60 = 260)
    @property({ override: true })
    attackRange: number = 260;

    // 重写属性：生命值为弓箭手的 2 倍 (50 * 2 = 100)
    @property({ override: true })
    maxHealth: number = 100;

    // 单位名称
    @property({ override: true })
    unitName: string = "角鹰射手";

    // 单位描述
    @property({ override: true })
    unitDescription: string = "由弓箭手转职而成的飞行单位，拥有更强的攻击力、攻速和移动速度。";

    // 狙击技能：优先攻击目标类型
    // 使用 @property 使其可以被序列化保存，这样角鹰射手死亡复活后仍能保留设置
    @property
    public priorityTargetType: string | null = null;

    // 全局保存的狙击目标设置（用于新生产的角鹰射手）
    private static _globalPriorityTargetType: string | null = null;

    /**
     * 重写 getPriorityTargetType，返回狙击技能设定的优先目标类型
     */
    protected getPriorityTargetType(): string | null {
        return this.priorityTargetType;
    }

    /**
     * 设置优先攻击目标类型（由 GameManager 调用）
     */
    public setPriorityTargetType(type: string | null): void {
        this.priorityTargetType = type;
        // 同时更新全局设置，这样新生产的角鹰射手也会使用相同的设置
        EagleArcher._globalPriorityTargetType = type;
        console.log(`[EagleArcher] setPriorityTargetType: ${type || '无'}`);
    }

    /**
     * 重写 onEnable，在对象从对象池取出时恢复狙击目标设置
     */
    override onEnable() {
        super.onEnable();
        // 优先使用全局设置（如果当前没有设置）
        if (!this.priorityTargetType && EagleArcher._globalPriorityTargetType) {
            this.priorityTargetType = EagleArcher._globalPriorityTargetType;
            console.log(`[EagleArcher] onEnable: 从全局恢复狙击目标 ${this.priorityTargetType}`);
        }
        console.log(`[EagleArcher] onEnable: priorityTargetType=${this.priorityTargetType || '无'}`);
    }

    /**
     * 重写 resetRoleState，保留狙击目标设置
     */
    protected override resetRoleState(): void {
        // 保存狙击目标设置
        const savedPriorityTargetType = this.priorityTargetType;
        console.log(`[EagleArcher] resetRoleState: 保存狙击目标 ${savedPriorityTargetType || '无'}`);

        // 调用父类重置方法
        super.resetRoleState();

        // 恢复狙击目标设置
        this.priorityTargetType = savedPriorityTargetType;
        console.log(`[EagleArcher] resetRoleState: 恢复狙击目标 ${this.priorityTargetType || '无'}`);
    }

    /**
     * 重写 createArrow，在攻击狙击目标时伤害翻倍
     */
    protected createArrow() {
        // 调试日志：打印当前狙击目标设置
        console.log(`[EagleArcher.createArrow] START: priorityTargetType=${this.priorityTargetType}, currentTarget=${this.currentTarget ? this.currentTarget.name : 'null'}`);

        // 检查当前目标是否是狙击目标
        const isSnipeTarget = this.isCurrentTargetSnipeTarget();

        console.log(`[EagleArcher.createArrow] isSnipeTarget=${isSnipeTarget}`);

        if (isSnipeTarget) {
            // 临时翻倍攻击力
            const oldDamage = this.attackDamage;
            this.attackDamage = oldDamage * 2;
            console.log(`[EagleArcher.createArrow] 攻击狙击目标，伤害翻倍：${oldDamage} -> ${this.attackDamage}`);
            try {
                console.log('[EagleArcher.createArrow] 调用 super.createArrow()');
                super.createArrow();
            } finally {
                // 恢复原始攻击力
                this.attackDamage = oldDamage;
                console.log(`[EagleArcher.createArrow] 恢复攻击力：${this.attackDamage}`);
            }
        } else {
            console.log('[EagleArcher.createArrow] 调用 super.createArrow() (普通攻击)');
            super.createArrow();
        }

        console.log('[EagleArcher.createArrow] END');
    }

    /**
     * 检查当前目标是否是狙击目标类型
     */
    private isCurrentTargetSnipeTarget(): boolean {
        console.log(`[EagleArcher] isCurrentTargetSnipeTarget: priorityTargetType=${this.priorityTargetType}, currentTarget=${this.currentTarget ? this.currentTarget.name : 'null'}`);

        if (!this.priorityTargetType || !this.currentTarget || !this.currentTarget.isValid) {
            console.log(`[EagleArcher] isCurrentTargetSnipeTarget: 条件不满足，返回 false`);
            return false;
        }
        // 检查当前目标是否具有狙击目标类型的组件
        const enemyScript = this.currentTarget.getComponent<any>(this.priorityTargetType);
        console.log(`[EagleArcher] isCurrentTargetSnipeTarget: enemyScript=${!!enemyScript}`);
        return !!enemyScript;
    }

    start() {
        // 调用父类初始化
        super.start();

        // 确保飞行单位标志正确设置
        this.isFlying = true;

        // 设置渲染层级：与角鹰保持一致，不被石墙和防御塔遮挡
        // 值越大越在上层，设置为 45 确保在石墙（索引 30 左右）之后，UI 之前
        try {
            this.node.setSiblingIndex(45);
        } catch (e) {
            // 忽略错误
        }
    }

    /**
     * 重写碰撞检测逻辑，飞行单位只与角鹰和角鹰射手碰撞
     */
    override checkCollisionAtPosition(position: Vec3): boolean {
        // 检查与水晶的碰撞（飞行单位仍需避免与水晶重叠）
        const crystal = find('Crystal');
        if (crystal && crystal.isValid && crystal.active) {
            const crystalPos = crystal.worldPosition;
            const dx = position.x - crystalPos.x;
            const dy = position.y - crystalPos.y;
            const distanceSq = dx * dx + dy * dy;
            const crystalRadius = 50;
            const minDistance = this.collisionRadius + crystalRadius;
            const minDistanceSq = minDistance * minDistance;
            if (distanceSq < minDistanceSq) {
                return true;
            }
        }

        // 只检查与其他角鹰的碰撞
        if (this.unitManager) {
            const eagles = this.unitManager.getEagles();
            for (const eagle of eagles) {
                if (eagle && eagle.isValid && eagle.active && eagle !== this.node) {
                    const eaglePos = eagle.worldPosition;
                    const dx = position.x - eaglePos.x;
                    const dy = position.y - eaglePos.y;
                    const distanceSq = dx * dx + dy * dy;

                    const otherEagleScript = eagle.getComponent('Eagle') as any;
                    const otherRadius = otherEagleScript?.collisionRadius ?? this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;

                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }

            // 检查与其他角鹰射手的碰撞
            const eagleArchers = this.unitManager.getEagleArchers();
            for (const eagleArcher of eagleArchers) {
                if (eagleArcher && eagleArcher.isValid && eagleArcher.active && eagleArcher !== this.node) {
                    const eagleArcherPos = eagleArcher.worldPosition;
                    const dx = position.x - eagleArcherPos.x;
                    const dy = position.y - eagleArcherPos.y;
                    const distanceSq = dx * dx + dy * dy;

                    const otherEagleArcherScript = eagleArcher.getComponent('EagleArcher') as any;
                    const otherRadius = otherEagleArcherScript?.collisionRadius ?? this.collisionRadius;
                    const minDistance = (this.collisionRadius + otherRadius) * 1.2;
                    const minDistanceSq = minDistance * minDistance;

                    if (distanceSq < minDistanceSq) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * 重写移动方法，飞行单位可以越过障碍物
     */
    override moveToPosition(targetPos: Vec3, deltaTime: number) {
        if (this.isDestroyed) {
            return;
        }

        const currentPos = this.node.worldPosition;
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const distanceSq = dx * dx + dy * dy;

        // 如果已经到达目标位置，停止移动
        if (distanceSq <= 100) {
            this.stopMoving();
            return;
        }

        // 设置移动状态
        this.isMoving = true;

        // 飞行单位不需要检查地面障碍，但仍需检查与其他角鹰/角鹰射手的碰撞
        const direction = new Vec3();
        Vec3.subtract(direction, targetPos, currentPos);
        direction.normalize();

        const moveDistance = this.moveSpeed * deltaTime;
        const newPos = new Vec3(
            currentPos.x + direction.x * moveDistance,
            currentPos.y + direction.y * moveDistance,
            currentPos.z
        );

        // 检查碰撞并调整位置（只检查与其他角鹰/角鹰射手的碰撞）
        const adjustedPos = this.checkCollisionAndAdjust(currentPos, newPos);

        this.node.setWorldPosition(adjustedPos);

        // 根据移动方向翻转
        if (direction.x < 0) {
            this.node.setScale(-Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        } else {
            this.node.setScale(Math.abs(this.defaultScale.x), this.defaultScale.y, this.defaultScale.z);
        }

        // 血条不需要跟随翻转，调用 refreshOverheadNodesScale 更新血条缩放
        this.refreshOverheadNodesScale();
    }

    /**
     * 打开狙击技能目标选择提示框
     */
    private openSnipeTargetSelection() {
        console.log('[EagleArcher] openSnipeTargetSelection 被调用');
        console.log(`[EagleArcher] 当前 priorityTargetType: ${this.priorityTargetType || '无'}`);
        console.log(`[EagleArcher] 全局 _globalPriorityTargetType: ${EagleArcher._globalPriorityTargetType || '无'}`);

        // 获取本关卡内可能出现的所有单位类型
        const availableEnemyTypes = this.getAvailableEnemyTypes();

        // 显示狙击目标选择提示框
        GamePopup.showSnipeTargetSelection({
            unitIcon: this.cardIcon || this.unitIcon || this.defaultSpriteFrame,
            unitName: this.unitName,
            unitDescription: '指挥官，你来选择优先攻击目标，我都听你的！',
            availableEnemyTypes: availableEnemyTypes,
            currentPriorityType: this.priorityTargetType
        }, (selectedType: string | null) => {
            console.log(`[EagleArcher] 回调被调用，选择的目标：${selectedType || '无'}`);
            this.priorityTargetType = selectedType;
            // 同时更新全局设置
            EagleArcher._globalPriorityTargetType = selectedType;
            console.log(`[EagleArcher] 设置优先攻击目标：${selectedType || '无'}`);
        });
    }

    /**
     * 获取本关卡内可能出现的所有单位类型
     */
    private getAvailableEnemyTypes(): string[] {
        // 固定返回所有可能的敌人类型
        return [
            'Orc',        // 兽人
            'OrcWarrior', // 兽人战士
            'OrcWarlord', // 兽人督军
            'TrollSpearman', // 巨魔投矛手
            'Dragon',     // 飞龙
            'OrcShaman',  // 兽人萨满
            'MinotaurWarrior' // 牛头人领主
        ];
    }

    /**
     * 重写 getUnitTypeDisplayName，显示为飞行单位
     */
    public getUnitTypeDisplayName(): string {
        return '飞行单位';
    }

    /**
     * 重写 destroyTower 方法，死亡时不退还缰绳
     */
    override destroyTower() {
        // 死亡不退还缰绳，缰绳只在通关 4/5 关时增加
        // 调用父类的 destroyTower 方法
        super.destroyTower();
    }

    /**
     * 重写 buildArrowerUnitInfo，返回包含狙击技能的 UnitInfo
     */
    public buildArrowerUnitInfo(): any {
        // 获取父类 UnitInfo
        const unitInfo: any = super.buildArrowerUnitInfo ? super.buildArrowerUnitInfo() : {};

        // 添加狙击技能回调
        unitInfo.onSkill3Click = () => {
            this.openSnipeTargetSelection();
        };

        // 添加优先攻击目标类型
        unitInfo.priorityTargetType = this.priorityTargetType;

        // 重命名
        unitInfo.name = this.unitName;

        return unitInfo;
    }

    /**
     * 构建角鹰射手专用的 UnitInfo（包含狙击技能）
     * @deprecated 已废弃，请使用 buildArrowerUnitInfo()
     */
    public buildEagleArcherUnitInfo(): any {
        return this.buildArrowerUnitInfo();
    }
}
