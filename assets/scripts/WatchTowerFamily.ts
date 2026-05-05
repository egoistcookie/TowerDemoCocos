import { Node } from 'cc';

/** 哨塔 / 炮塔（字符串组件名，避免 Role↔WatchTower 循环依赖） */
export function getWatchTowerFamilyScript(node: Node | null | undefined): any {
    if (!node?.isValid) {
        return null;
    }
    return node.getComponent('CannonTower') || node.getComponent('WatchTower');
}
