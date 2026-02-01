import { _decorator, Component, Node, Vec3, find, Graphics, UITransform, Color, Sprite, SpriteFrame } from 'cc';
import { Enemy } from './enemy/Enemy';
import { GameManager } from './GameManager';
import { GameState } from './GameState';
import { UnitManager } from './UnitManager';

const { ccclass, property } = _decorator;

@ccclass('ShamanTotem')
export class ShamanTotem extends Component {
    @property(SpriteFrame)
    totemSpriteFrame: SpriteFrame = null!; // 图腾贴图
    
    private totemPosition: Vec3 = new Vec3();
    private healRadius: number = 200; // 治疗范围200像素
    private healAmount: number = 10; // 每次治疗10点生命
    private healInterval: number = 2.0; // 每2秒治疗一次
    private duration: number = 16.0; // 持续16秒
    private remainingTime: number = 16.0; // 剩余时间
    
    private healTimer: number = 0; // 治疗计时器
    private gameManager: GameManager = null!;
    
    // 进度条相关
    private progressBarNode: Node = null!;
    private progressBarGraphics: Graphics = null!;
    
    /**
     * 初始化图腾
     * @param position 图腾位置
     */
    init(position: Vec3) {
        this.totemPosition = position.clone();
        this.node.setWorldPosition(this.totemPosition);
        this.remainingTime = this.duration;
        this.healTimer = 0;
        
        // 查找GameManager
        const gmNode = find('GameManager') || find('Canvas/GameManager');
        if (gmNode) {
            this.gameManager = gmNode.getComponent(GameManager);
        }
        
        // 设置图腾贴图
        if (this.totemSpriteFrame) {
            const sprite = this.node.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = this.totemSpriteFrame;
            } else {
                const newSprite = this.node.addComponent(Sprite);
                newSprite.spriteFrame = this.totemSpriteFrame;
            }
        }
        
        // 设置UITransform
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
        }
        if (uiTransform) {
            uiTransform.setContentSize(40, 40); // 图腾大小
        }
        
        // 创建进度条
        this.createProgressBar();
    }
    
    /**
     * 创建进度条
     */
    private createProgressBar() {
        // 创建进度条节点，添加到Canvas以确保正确显示
        this.progressBarNode = new Node('ProgressBar');
        
        // 将进度条添加到Canvas，而不是图腾节点，以确保正确显示
        const canvas = find('Canvas');
        if (canvas) {
            this.progressBarNode.setParent(canvas);
        } else {
            // 降级方案：添加到图腾节点
            this.progressBarNode.setParent(this.node);
        }
        
        // 添加UITransform
        const uiTransform = this.progressBarNode.addComponent(UITransform);
        uiTransform.setContentSize(50, 4);
        
        // 添加Graphics组件
        this.progressBarGraphics = this.progressBarNode.addComponent(Graphics);
        this.progressBarNode.active = true;
        
        // 初始更新一次进度条
        this.updateProgressBar();
    }
    
    /**
     * 更新进度条
     */
    private updateProgressBar() {
        if (!this.progressBarNode || !this.progressBarGraphics || !this.progressBarNode.isValid) {
            return;
        }
        
        // 计算进度（剩余时间 / 总时间）
        const progress = Math.max(0, Math.min(1, this.remainingTime / this.duration));
        
        if (progress <= 0) {
            this.progressBarNode.active = false;
            return;
        }
        
        // 确保进度条节点激活
        this.progressBarNode.active = true;
        
        // 更新进度条位置（跟随图腾位置）
        const totemWorldPos = this.node.worldPosition;
        const progressBarPos = totemWorldPos.clone();
        progressBarPos.y += 30; // 在图腾上方30像素
        this.progressBarNode.setWorldPosition(progressBarPos);
        
        const g = this.progressBarGraphics;
        g.clear();
        
        const width = 50;
        const height = 4;
        
        // 绘制背景（灰色边框）
        g.strokeColor = new Color(100, 100, 100, 255);
        g.lineWidth = 1;
        g.rect(-width / 2, -height / 2, width, height);
        g.stroke();
        
        // 绘制进度条填充（绿色，从右到左减少）
        const progressWidth = width * progress;
        if (progressWidth > 0) {
            g.fillColor = new Color(0, 200, 0, 255); // 绿色
            g.rect(-width / 2, -height / 2, progressWidth, height);
            g.fill();
        }
    }
    
    update(deltaTime: number) {
        // 检查游戏状态
        if (this.gameManager && this.gameManager.getGameState() !== GameState.Playing) {
            return;
        }
        
        // 更新剩余时间
        this.remainingTime -= deltaTime;
        
        // 更新进度条
        this.updateProgressBar();
        
        // 如果时间到了，销毁图腾
        if (this.remainingTime <= 0) {
            this.destroyTotem();
            return;
        }
        
        // 更新治疗计时器
        this.healTimer += deltaTime;
        
        // 每2秒治疗一次
        if (this.healTimer >= this.healInterval) {
            this.healTimer = 0;
            this.healNearbyEnemies();
        }
    }
    
    /**
     * 治疗附近的敌人
     */
    private healNearbyEnemies() {
        // 使用UnitManager获取所有敌人（性能优化）
        const unitManager = UnitManager.getInstance();
        let enemies: Node[] = [];
        
        if (unitManager) {
            enemies = unitManager.getEnemies();
        } else {
            // 降级方案：直接查找所有敌人容器
            const enemyContainers = ['Canvas/Enemies', 'Canvas/Orcs', 'Canvas/TrollSpearmans', 'Canvas/OrcWarriors', 'Canvas/OrcWarlords', 'Canvas/OrcShamans'];
            for (const containerName of enemyContainers) {
                const containerNode = find(containerName);
                if (containerNode) {
                    enemies.push(...(containerNode.children || []));
                }
            }
        }
        
        const totemPos = this.node.worldPosition;
        
        for (const enemyNode of enemies) {
            if (!enemyNode || !enemyNode.isValid || !enemyNode.active) {
                continue;
            }
            
            // 计算距离
            const enemyPos = enemyNode.worldPosition;
            const distance = Vec3.distance(totemPos, enemyPos);
            
            // 如果在治疗范围内
            if (distance <= this.healRadius) {
                // 获取Enemy组件（可能是Enemy或其子类）
                let enemyScript = enemyNode.getComponent(Enemy) as any;
                if (!enemyScript) {
                    // 尝试获取子类组件
                    enemyScript = enemyNode.getComponent('OrcShaman') as any ||
                                  enemyNode.getComponent('OrcWarlord') as any ||
                                  enemyNode.getComponent('OrcWarrior') as any ||
                                  enemyNode.getComponent('TrollSpearman') as any;
                }
                
                if (enemyScript && enemyScript.heal && typeof enemyScript.heal === 'function') {
                    // 治疗敌人
                    enemyScript.heal(this.healAmount);
                }
            }
        }
    }
    
    /**
     * 销毁图腾
     */
    private destroyTotem() {
        if (this.progressBarNode && this.progressBarNode.isValid) {
            this.progressBarNode.destroy();
        }
        
        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }
    
    onDestroy() {
        if (this.progressBarNode && this.progressBarNode.isValid) {
            this.progressBarNode.destroy();
        }
    }
}
