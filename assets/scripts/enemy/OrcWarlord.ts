import { _decorator, AudioClip, SpriteFrame } from 'cc';
import { Boss } from './Boss';

const { ccclass, property } = _decorator;

@ccclass('OrcWarlord')
export class OrcWarlord extends Boss {
    // ====== OrcWarlord 专属数值与资源配置（通过 override 覆盖 Boss 默认值）======

    @property({ override: true })
    maxHealth: number = 300;

    @property({ override: true })
    moveSpeed: number = 35;

    @property({ override: true })
    attackDamage: number = 30;

    @property({ override: true })
    attackInterval: number = 1.8;

    @property({ override: true })
    attackRange: number = 70;

    @property({ override: true })
    collisionRadius: number = 18;

    @property({ override: true, tooltip: "韧性（0-1）：1秒内遭受此百分比血量损失才会触发僵直。" })
    tenacity: number = 0.3;

    // 单位信息
    @property({ override: true })
    unitName: string = "兽人督军";

    @property({ override: true })
    unitDescription: string = "拥有战争咆哮的强力Boss单位，能强化周围的敌人。";

    @property({ override: true })
    unitIcon: SpriteFrame = null!;

    // 动画帧
    @property({ override: true, type: [SpriteFrame] })
    idleAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    walkAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    attackAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    hitAnimationFrames: SpriteFrame[] = [];

    @property({ override: true, type: [SpriteFrame] })
    deathAnimationFrames: SpriteFrame[] = [];

    // 动画时长
    @property({ override: true })
    idleAnimationDuration: number = 1.0;

    @property({ override: true })
    walkAnimationDuration: number = 0.8;

    @property({ override: true })
    attackAnimationDuration: number = 0.8;

    @property({ override: true })
    hitAnimationDuration: number = 0.3;

    @property({ override: true })
    deathAnimationDuration: number = 1.0;

    // 奖励
    @property({ override: true })
    goldReward: number = 20;

    @property({ override: true })
    expReward: number = 40;

    // 音效
    @property({ override: true, type: AudioClip })
    deathSound: AudioClip = null!;

    @property({ override: true, type: AudioClip })
    attackSound: AudioClip = null!;

    // ====== 战争咆哮配置（覆盖 Boss 默认数值）======

    @property({ override: true })
    warcryCooldown: number = 25; // 咆哮冷却

    @property({ override: true })
    warcryDuration: number = 10; // Buff 持续

    @property({ override: true })
    warcryEffect: number = 0.4;  // 属性提升 40%

    @property({ override: true })
    warcryRange: number = 220;   // 咆哮范围

    @property({ override: true, type: AudioClip })
    warcrySound: AudioClip = null!;

    @property({ override: true, type: [SpriteFrame] })
    warcryAnimationFrames: SpriteFrame[] = [];

    @property({ override: true })
    warcryAnimationDuration: number = 1.0;

    // 对象池中使用的预制体名称
    public prefabName: string = "OrcWarlord";

    // 当前 Boss 实现中，战争咆哮免疫被打断逻辑已经在 Boss.takeDamage 中实现，
    // 这里无需再写额外代码；如果后续需要 OrcWarlord 独有的行为，可以在此添加方法。
}

