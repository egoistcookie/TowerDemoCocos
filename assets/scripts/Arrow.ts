import { _decorator, Component, Node, Vec3, Sprite, tween, find } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('Arrow')
export class Arrow extends Component {
    @property
    speed: number = 500; // 弓箭飞行速度（像素/秒）

    @property
    arcHeight: number = 50; // 抛物线弧度高度（像素）

    @property
    damage: number = 10; // 伤害值

    private targetNode: Node = null!;
    private startPos: Vec3 = new Vec3();
    private targetPos: Vec3 = new Vec3();
    private travelTime: number = 0;
    private elapsedTime: number = 0;
    private onHitCallback: ((damage: number) => void) | null = null;
    private isFlying: boolean = false;
    private lastPos: Vec3 = new Vec3();
    private gameManager: GameManager | null = null;

    /**
     * 初始化弓箭
     * @param startPos 起始位置
     * @param targetNode 目标节点
     * @param damage 伤害值
     * @param onHit 命中回调函数
     */
    init(startPos: Vec3, targetNode: Node, damage: number, onHit?: (damage: number) => void) {
        this.startPos = startPos.clone();
        this.targetNode = targetNode;
        this.damage = damage;
        this.onHitCallback = onHit || null;

        // 设置初始位置
        this.node.setWorldPosition(this.startPos);

        // 计算目标位置
        if (this.targetNode && this.targetNode.isValid) {
            this.targetPos = this.targetNode.worldPosition.clone();
        } else {
            // 如果目标无效，使用起始位置前方
            this.targetPos = this.startPos.clone();
            this.targetPos.x += 200;
        }

        // 计算飞行时间（基于距离和速度）
        const distance = Vec3.distance(this.startPos, this.targetPos);
        if (distance < 0.1) {
            return;
        }
        
        this.travelTime = distance / this.speed;
        if (this.travelTime <= 0) {
            return;
        }
        
        this.elapsedTime = 0;
        this.isFlying = true;
        this.lastPos = this.startPos.clone();

        // 设置初始旋转角度（指向目标）
        const initialDirection = new Vec3();
        Vec3.subtract(initialDirection, this.targetPos, this.startPos);
        if (initialDirection.length() > 0.1) {
            const angle = Math.atan2(initialDirection.y, initialDirection.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }

    }

    /**
     * 计算抛物线位置
     * @param ratio 进度比例 (0-1)
     */
    calculateParabolicPosition(ratio: number): Vec3 {
        const pos = new Vec3();
        
        // 线性插值计算基础位置
        Vec3.lerp(pos, this.startPos, this.targetPos, ratio);
        
        // 添加抛物线高度（使用二次函数模拟重力效果）
        const arcRatio = 4 * ratio * (1 - ratio); // 0到1再到0的曲线
        pos.y += this.arcHeight * arcRatio;
        
        return pos;
    }


    /**
     * 命中目标
     */
    hitTarget() {
        if (!this.isFlying) {
            return; // 已经命中过了
        }

        // 检查目标是否是已死亡的兽人督军
        if (this.targetNode && this.targetNode.isValid) {
            const orcScript = this.targetNode.getComponent('OrcWarlord') as any;
            if (orcScript) {
                const isAlive = orcScript.isAlive && orcScript.isAlive();
                if (!isAlive) {
                    // 目标是已死亡的兽人督军，插在尸体上
                    const startPos = this.lastPos.clone();
                    const endPos = this.node.worldPosition.clone();
                    this.attachToCorpse(this.targetNode, startPos, endPos);
                    return;
                }
            }
        }

        this.isFlying = false;

        // 调用命中回调
        if (this.onHitCallback) {
            this.onHitCallback(this.damage);
        }

        // 直接销毁弓箭节点，避免scheduleOnce的警告
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.1);
    }

    update(deltaTime: number) {
        if (!this.isFlying) {
            return;
        }

        // 检查游戏状态 - 如果GameManager不存在，尝试重新查找
        if (!this.gameManager) {
            this.gameManager = find('GameManager')?.getComponent(GameManager);
        }
        
        // 检查游戏状态，如果不是Playing状态，停止飞行
        if (this.gameManager) {
            const gameState = this.gameManager.getGameState();
            if (gameState !== GameState.Playing) {
                // 游戏已暂停或结束，停止飞行
                return;
            }
        }

        // 更新计时器
        this.elapsedTime += deltaTime;
        
        // 调试：每0.5秒输出一次位置信息
        if (Math.floor(this.elapsedTime * 2) !== Math.floor((this.elapsedTime - deltaTime) * 2)) {
            const currentPos = this.calculateParabolicPosition(Math.min(this.elapsedTime / this.travelTime, 1));
        }
        
        // 如果目标已失效，提前销毁
        if (this.targetNode && (!this.targetNode.isValid || !this.targetNode.active)) {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
            return;
        }
        
        // 更新目标位置（目标可能在移动）
        if (this.targetNode && this.targetNode.isValid) {
            this.targetPos = this.targetNode.worldPosition.clone();
        }

        // 计算当前进度
        const currentRatio = Math.min(this.elapsedTime / this.travelTime, 1);
        
        // 计算当前在抛物线上的位置
        const currentPos = this.calculateParabolicPosition(currentRatio);
        
        // 检查路径上是否有兽人督军尸体
        if (this.checkForOrcWarlordCorpse(this.lastPos, currentPos)) {
            return;
        }
        
        this.node.setWorldPosition(currentPos);
        
        // 更新旋转角度，使箭头始终指向飞行方向
        const direction = new Vec3();
        Vec3.subtract(direction, currentPos, this.lastPos);
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
        this.lastPos = currentPos.clone();
        
        // 检查是否命中目标
        if (this.targetNode && this.targetNode.isValid) {
            const currentTargetPos = this.targetNode.worldPosition;
            const distance = Vec3.distance(currentPos, currentTargetPos);
            
            // 如果距离足够近，认为命中
            if (distance < 30) {
                this.hitTarget();
                return;
            }
        }
        
        // 如果飞行完成但未命中目标，销毁弓箭
        if (currentRatio >= 1) {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
            return;
        }
        
        // 如果飞行时间过长（超过预期时间2倍），销毁弓箭（防止卡住）
        if (this.elapsedTime > this.travelTime * 2) {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }
    }
    
    /**
     * 递归查找节点
     * @param node 起始节点
     * @param name 节点名称
     * @returns 找到的节点
     */
    findNodeRecursive(node: Node, name: string): Node | null {
        if (node.name === name) {
            return node;
        }
        for (const child of node.children) {
            const found = this.findNodeRecursive(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    /**
     * 检查路径上是否有兽人督军尸体
     * @param startPos 起始位置
     * @param endPos 结束位置
     * @returns 是否命中尸体
     */
    checkForOrcWarlordCorpse(startPos: Vec3, endPos: Vec3): boolean {
        // 查找Enemies容器，使用直接路径
        const enemiesNode = find('Canvas/Enemies');
        
        if (!enemiesNode) {
            return false;
        }
        
        const enemies = enemiesNode.children || [];
        
        for (const enemy of enemies) {
            if (!enemy || !enemy.isValid) {
                continue;
            }
            
            // 检查是否是兽人督军
            const orcScript = enemy.getComponent('OrcWarlord') as any;
            if (!orcScript) {
                continue;
            }
            
            // 检查是否已经死亡
            const isAlive = orcScript.isAlive && orcScript.isAlive();
            if (!isAlive && enemy.isValid) {
                // 检查整个飞行路径是否与尸体相交
                const corpsePos = enemy.worldPosition;
                const distance = this.getDistanceFromLine(startPos, endPos, corpsePos);
                
                // 如果距离小于30像素，认为命中尸体
                if (distance < 30) {
                    // 命中尸体，插在尸体身上
                    this.attachToCorpse(enemy, startPos, endPos);
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * 将箭矢插在尸体身上
     * @param corpseNode 尸体节点
     * @param startPos 起始位置
     * @param endPos 结束位置
     */
    attachToCorpse(corpseNode: Node, startPos: Vec3, endPos: Vec3): void {
        if (!this.node || !this.node.isValid || !corpseNode || !corpseNode.isValid) {
            return;
        }
        
        // 计算命中点
        const corpsePos = corpseNode.worldPosition;
        const hitPos = this.calculateHitPoint(startPos, endPos, corpsePos);
        
        // 停止飞行状态
        this.isFlying = false;
        
        // 将箭矢设为尸体的子节点
        // 这样当尸体被销毁时，箭矢也会被自动销毁
        this.node.removeFromParent();
        corpseNode.addChild(this.node);
        
        // 设置箭矢位置（转换为局部位置）
        const localPos = corpseNode.worldPosition.clone();
        Vec3.subtract(localPos, hitPos, localPos);
        this.node.setPosition(localPos);
        
        // 调整箭矢旋转，使其指向飞行方向
        const direction = new Vec3();
        Vec3.subtract(direction, endPos, startPos);
        if (direction.length() > 0.1) {
            const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            this.node.setRotationFromEuler(0, 0, angle);
        }
        
        // 命中尸体不触发伤害回调
        // 清除回调，防止后续调用
        this.onHitCallback = null;
    }

    /**
     * 计算命中点
     * @param startPos 起始位置
     * @param endPos 结束位置
     * @param corpsePos 尸体位置
     * @returns 命中点位置
     */
    calculateHitPoint(startPos: Vec3, endPos: Vec3, corpsePos: Vec3): Vec3 {
        // 计算线段方向
        const lineDir = Vec3.subtract(new Vec3(), endPos, startPos);
        const lineLengthSqr = Vec3.lengthSqr(lineDir);
        
        if (lineLengthSqr === 0) {
            return corpsePos.clone();
        }
        
        // 计算投影点
        const t = Math.max(0, Math.min(1, Vec3.dot(Vec3.subtract(new Vec3(), corpsePos, startPos), lineDir) / lineLengthSqr));
        const projection = Vec3.add(new Vec3(), startPos, Vec3.multiplyScalar(new Vec3(), lineDir, t));
        
        return projection;
    }
    
    /**
     * 计算点到线段的最短距离
     * @param lineStart 线段起点
     * @param lineEnd 线段终点
     * @param point 点
     * @returns 最短距离
     */
    getDistanceFromLine(lineStart: Vec3, lineEnd: Vec3, point: Vec3): number {
        const lineDir = Vec3.subtract(new Vec3(), lineEnd, lineStart);
        const lineLengthSqr = Vec3.lengthSqr(lineDir);
        
        if (lineLengthSqr === 0) {
            // 线段长度为0，直接返回点到起点的距离
            return Vec3.distance(point, lineStart);
        }
        
        const t = Math.max(0, Math.min(1, Vec3.dot(Vec3.subtract(new Vec3(), point, lineStart), lineDir) / lineLengthSqr));
        const projection = Vec3.add(new Vec3(), lineStart, Vec3.multiplyScalar(new Vec3(), lineDir, t));
        
        return Vec3.distance(point, projection);
    }
}

