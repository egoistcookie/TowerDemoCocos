import { _decorator } from 'cc';
import { Enemy } from './Enemy';

const { ccclass, property } = _decorator;

@ccclass('Orc')
export class Orc extends Enemy {
    // 重写父类属性，设置 Orc 的默认值
    maxHealth: number = 30;
    moveSpeed: number = 50;
    attackDamage: number = 5;
    attackInterval: number = 2.0;
    attackRange: number = 70;
    unitName: string = "兽人";
    unitDescription: string = "普通的兽人，攻击力和生命值较低，但数量众多。";
    goldReward: number = 2;
    
    @property({ override: true })
    expReward: number = 1; // 消灭普通兽人获得1点经验值
    
    attackAnimationName: string = 'orc-attck';
    
    onLoad() {
        // 在 onLoad 中确保 expReward 被正确设置（防止编辑器覆盖问题）
        // onLoad 在 start 之前执行，确保属性在初始化时就是正确的
        if (this.expReward === 0) {
            this.expReward = 1;
        }
    }
}

