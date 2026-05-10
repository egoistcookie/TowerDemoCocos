import { _decorator, Component, Vec3 } from 'cc';

const { ccclass } = _decorator;

/**
 * 从刷怪器：在主刷怪器生成 Orc（配对行，第二关起）或 OrcWarrior（含第一关第二波起）时镜像一只狼（同坐标）；
 * 每累计生成 2 只兽人督军（OrcWarlord）时，在同坐标再镜像一辆投石车（不计入波次配置总数）。
 * 与 EnemySpawner 挂在同一节点；若缺失，主器会在 start 中自动 addComponent。
 */
@ccclass('EnemySlaveWolfSpawner')
export class EnemySlaveWolfSpawner extends Component {
    private _master: any = null;
    /** 主流程每生成一只督军 +1，满 2 则刷一辆投石车并归零 */
    private _warlordCountTowardCatapult: number = 0;

    onLoad() {
        this._master = this.node.getComponent('EnemySpawner');
    }

    /** 新开局或 reset 时清空督军→投石车累计 */
    resetWarlordCatapultAccumulator() {
        this._warlordCountTowardCatapult = 0;
    }

    /** 主刷怪器在成功放置一只兽人督军后调用（波次/传送门裂缝回调与同坐标）。 */
    onOrcWarlordSpawnedFromWave(worldPos: Vec3) {
        this._warlordCountTowardCatapult++;
        if (this._warlordCountTowardCatapult < 2) {
            return;
        }
        this._warlordCountTowardCatapult = 0;
        if (this._master && typeof this._master.spawnPairedCatapultForSlave === 'function') {
            this._master.spawnPairedCatapultForSlave(worldPos);
        }
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
