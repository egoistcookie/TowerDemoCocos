import { Node } from 'cc';
import { UnitType } from './UnitType';

/**
 * 与 Role.getEnemyScript / Arrow2 穿透箭一致的敌人脚本解析顺序。
 * 节点上只挂子类（如 Dragon、Orc）而无名为 Enemy 的组件时，需通过名称列表或 unitType 回退。
 */
const ENEMY_COMPONENT_NAMES: readonly string[] = [
    'OrcWarlord',
    'OrcWarrior',
    'OrcShaman',
    'Orc',
    'Dragon',
    'Enemy',
    'TrollSpearman',
    'Portal',
    'MinotaurWarrior',
    'Boss',
    'Bear',
];

/**
 * 获取节点上的敌对可战斗脚本（伤害、移动、碰撞等）。
 */
export function getEnemyLikeScript(node: Node | null | undefined): any {
    if (!node || !node.isValid) {
        return null;
    }
    for (const name of ENEMY_COMPONENT_NAMES) {
        const c = node.getComponent(name) as any;
        if (c) {
            return c;
        }
    }
    for (const comp of node.components) {
        const t = comp as any;
        if (t && t.unitType === UnitType.ENEMY) {
            return t;
        }
    }
    return null;
}
