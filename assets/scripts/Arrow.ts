import { _decorator, Component, Node, Vec3, Sprite, tween } from 'cc';
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
            console.error('Arrow: Distance too small, cannot initialize');
            return;
        }
        
        this.travelTime = distance / this.speed;
        if (this.travelTime <= 0) {
            console.error(`Arrow: Invalid travelTime: ${this.travelTime}, distance: ${distance}, speed: ${this.speed}`);
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

        // console.debug(`Arrow: Initialized successfully!`);
        // console.debug(`  Start: (${this.startPos.x.toFixed(2)}, ${this.startPos.y.toFixed(2)})`);
        // console.debug(`  Target: (${this.targetPos.x.toFixed(2)}, ${this.targetPos.y.toFixed(2)})`);
        // console.debug(`  Distance: ${distance.toFixed(2)}`);
        // console.debug(`  Speed: ${this.speed}`);
        // console.debug(`  TravelTime: ${this.travelTime.toFixed(2)}s`);
        // console.debug(`  Node active: ${this.node.active}, isValid: ${this.node.isValid}`);
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

        this.isFlying = false;
        // console.debug(`Arrow: Hit target at position (${this.node.worldPosition.x.toFixed(2)}, ${this.node.worldPosition.y.toFixed(2)})`);

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

        // 更新计时器
        this.elapsedTime += deltaTime;
        
        // 调试：每0.5秒输出一次位置信息
        if (Math.floor(this.elapsedTime * 2) !== Math.floor((this.elapsedTime - deltaTime) * 2)) {
            const currentPos = this.calculateParabolicPosition(Math.min(this.elapsedTime / this.travelTime, 1));
            // console.debug(`Arrow: Flying, elapsed: ${this.elapsedTime.toFixed(2)}s, position: (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}), target: (${this.targetPos.x.toFixed(2)}, ${this.targetPos.y.toFixed(2)})`);
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
        
        // 如果飞行完成，检查是否命中
        if (currentRatio >= 1) {
            this.hitTarget();
            return;
        }
        
        // 如果飞行时间过长（超过预期时间2倍），销毁弓箭（防止卡住）
        if (this.elapsedTime > this.travelTime * 2) {
            console.warn('Arrow: Flight time exceeded, destroying arrow');
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }
    }
}

