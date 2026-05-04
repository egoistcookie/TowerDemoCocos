import { _decorator, Component, Vec3 } from 'cc';

const { ccclass } = _decorator;

/**
 * 从刷怪器：在主刷怪器生成 Orc（配对行，第二关起）或 OrcWarrior（含第一关第二波起）时镜像一只狼（同坐标）。
 * 与 EnemySpawner 挂在同一节点；若缺失，主器会在 start 中自动 addComponent。
 */
@ccclass('EnemySlaveWolfSpawner')
export class EnemySlaveWolfSpawner extends Component {
    private _master: any = null;

    onLoad() {
        this._master = this.node.getComponent('EnemySpawner');
    }

    /**
     * @param addToWaveSpawnTotal Orc+Wolf 配置行时为 true；兽人战士随行狼为 false（关卡未计该狼数量）
     */
    spawnMirrorWolfAt(worldPos: Vec3, addToWaveSpawnTotal: boolean = true) {
        if (this._master && typeof this._master.spawnPairedWolfForSlave === 'function') {
            this._master.spawnPairedWolfForSlave(worldPos, addToWaveSpawnTotal);
        }
    }
}
