import { _decorator, SpriteFrame } from 'cc';
import { Enemy } from './Enemy';

const { ccclass, property } = _decorator;

@ccclass('OrcWarrior')
export class OrcWarrior extends Enemy {
    // 重写父类属性，设置 OrcWarrior 的默认值
    maxHealth: number = 50;
    moveSpeed: number = 40;
    attackDamage: number = 8;
    attackInterval: number = 1.5;
    attackRange: number = 60;
    collisionRadius: number = 20; // 碰撞半径（像素）
    unitName: string = "兽人战士";
    unitDescription: string = "强大的兽人战士，拥有较高的攻击力和生命值。";
    goldReward: number = 3;
    idleAnimationDuration: number = 1.0;
    walkAnimationDuration: number = 1.0;
    attackAnimationDuration: number = 0.5;
    hitAnimationDuration: number = 0.3;
    deathAnimationDuration: number = 1.0;
    
    // 动画帧属性（重写父类属性，可以在编辑器中单独配置）
    @property({ type: SpriteFrame, override: true })
    idleAnimationFrames: SpriteFrame[] = [];
    
    @property({ type: SpriteFrame, override: true })
    walkAnimationFrames: SpriteFrame[] = [];
    
    @property({ type: SpriteFrame, override: true })
    attackAnimationFrames: SpriteFrame[] = [];
    
    @property({ type: SpriteFrame, override: true })
    hitAnimationFrames: SpriteFrame[] = [];
    
    @property({ type: SpriteFrame, override: true })
    deathAnimationFrames: SpriteFrame[] = [];
}
