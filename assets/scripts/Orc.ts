import { _decorator } from 'cc';
import { Enemy } from './Enemy';

const { ccclass } = _decorator;

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
    attackAnimationName: string = 'orc-attck';
}

