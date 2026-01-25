import { _decorator, Component, Node, Graphics, Color } from 'cc';
const { ccclass } = _decorator;

/**
 * 寒气特效更新组件（内部使用）
 */
@ccclass('ColdEffectUpdater')
export class ColdEffectUpdater extends Component {
    private enemy: Node = null!;
    private graphics: Graphics = null!;
    private elapsedTime: number = 0;
    private duration: number = 2.0;
    
    init(enemy: Node, graphics: Graphics, duration: number) {
        this.enemy = enemy;
        this.graphics = graphics;
        this.duration = duration;
        this.elapsedTime = 0;
    }
    
    update(deltaTime: number) {
        if (!this.enemy || !this.enemy.isValid || !this.enemy.active) {
            // 敌人已死亡或无效，销毁特效
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
            return;
        }
        
        // 检查敌人是否存活
        const enemyScript = this.enemy.getComponent('Enemy') as any || 
                           this.enemy.getComponent('OrcWarlord') as any ||
                           this.enemy.getComponent('OrcWarrior') as any ||
                           this.enemy.getComponent('TrollSpearman') as any;
        
        if (!enemyScript || !enemyScript.isAlive || !enemyScript.isAlive()) {
            // 敌人已死亡，销毁特效
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
            return;
        }
        
        // 跟随敌人位置
        const enemyPos = this.enemy.worldPosition;
        this.node.setWorldPosition(enemyPos.x, enemyPos.y, 0);
        
        // 更新计时器
        this.elapsedTime += deltaTime;
        
        // 清除之前的绘制
        this.graphics.clear();
        
        // 根据剩余时间调整透明度
        const remainingTime = this.duration - this.elapsedTime;
        if (remainingTime <= 0) {
            // 时间到了，销毁特效
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
            return;
        }
        
        const alpha = Math.max(0, Math.min(200, (remainingTime / this.duration) * 200));
        
        // 绘制寒气粒子效果（多个小圆圈，随时间减少）
        const particleCount = Math.max(3, Math.floor(8 * (remainingTime / this.duration)));
        for (let i = 0; i < particleCount; i++) {
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;
            const radius = 2 + Math.random() * 6;
            
            this.graphics.fillColor = new Color(173, 216, 230, alpha); // 浅蓝色，随时间变透明
            this.graphics.circle(offsetX, offsetY, radius);
            this.graphics.fill();
        }
    }
}
