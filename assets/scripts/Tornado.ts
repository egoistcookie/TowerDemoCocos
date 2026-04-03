import { _decorator, Component, Node, Vec3, find, Sprite, SpriteFrame, UITransform, resources, UIOpacity } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Tornado：持续性范围伤害与拉扯效果
 * - 持续时长：duration 秒
 * - 每秒伤害：dps
 * - 半径：radius
 * - 拉扯：每帧将范围内敌人微量朝中心点位移（小力度）
 * - 可选帧动画：tornadoFrames（挂在女猎手预制体上）
 */
@ccclass('Tornado')
export class Tornado extends Component {
	@property([SpriteFrame])
	public tornadoFrames: SpriteFrame[] = [];
	@property
	public frameDuration: number = 0.08; // 每帧时长
	@property
	public radius: number = 100;
	@property
	public duration: number = 5.0;
	@property
	public dps: number = 3;
	@property
	public pullPowerPerSecond: number = 30; // 每秒拉扯力度（像素/秒），会按deltaTime换算

	private elapsed: number = 0;
	private frameTimer: number = 0;
	private currentFrame: number = -1;
	private sprite: Sprite | null = null;
	private lastDamageTick: number = 0;
	private gameManager: GameManager | null = null;

	onEnable() {
		this.elapsed = 0;
		this.frameTimer = 0;
		this.currentFrame = -1;
		this.lastDamageTick = 0;
		this.sprite = this.getComponent(Sprite) || this.addComponent(Sprite);
		// 使用资源贴图显示辅助圈（hunterRing.png）
		try {
			let ringNode = this.node.getChildByName('Ring');
			if (!ringNode) {
				ringNode = new Node('Ring');
				ringNode.setParent(this.node);
			}
			const ui = ringNode.getComponent(UITransform) || ringNode.addComponent(UITransform);
			ui.setContentSize(this.radius * 2, this.radius * 2);
			const ringSprite = ringNode.getComponent(Sprite) || ringNode.addComponent(Sprite);
			const ringOpacity = ringNode.getComponent(UIOpacity) || ringNode.addComponent(UIOpacity);
			ringOpacity.opacity = 26; // 10% 透明度（255 * 0.1 ≈ 26）
			this.loadHunterRingSpriteFrame((frame) => {
				if (ringNode && ringNode.isValid && ringSprite && frame) {
					ringSprite.spriteFrame = frame;
				}
			});
		} catch {}
		if (!this.gameManager) {
			this.gameManager = find('GameManager')?.getComponent('GameManager') as any;
		}
	}

	private loadHunterRingSpriteFrame(cb: (frame: SpriteFrame | null) => void) {
		// 优先尝试 SpriteFrame 子资源路径，失败后回退主资源路径
		resources.load('textures/hunterRing/spriteFrame', SpriteFrame, (err, frame) => {
			if (!err && frame) {
				cb(frame);
				return;
			}
			resources.load('textures/hunterRing', SpriteFrame, (err2, frame2) => {
				if (err2 || !frame2) {
					console.warn('[Tornado] 加载 hunterRing 失败:', err2 || err);
					cb(null);
					return;
				}
				cb(frame2);
			});
		});
	}

	update(deltaTime: number) {
		this.elapsed += deltaTime;
		if (this.elapsed >= this.duration) {
			this.node.destroy();
			return;
		}
		// 帧动画
		this.updateAnimation(deltaTime);
		// 拉扯
		this.applyPull(deltaTime);
		// 伤害（每秒一次）
		if (this.elapsed - this.lastDamageTick >= 1.0) {
			this.lastDamageTick = Math.floor(this.elapsed);
			this.applyDamageTick();
		}
	}

	private updateAnimation(dt: number) {
		if (!this.sprite || !this.tornadoFrames || this.tornadoFrames.length === 0) return;
		this.frameTimer += dt;
		if (this.frameTimer >= this.frameDuration) {
			this.frameTimer = 0;
			this.currentFrame = (this.currentFrame + 1) % this.tornadoFrames.length;
			const frame = this.tornadoFrames[this.currentFrame];
			if (frame) {
				this.sprite.spriteFrame = frame;
			}
		}
	}

	private forEachEnemyInRadius(center: Vec3, radius: number, fn: (enemy: Node, enemyScript: any) => void) {
		const enemiesNode = find('Canvas/Enemies');
		if (!enemiesNode) return;
		const r2 = radius * radius;
		for (const enemy of enemiesNode.children) {
			if (!enemy || !enemy.isValid || !enemy.active) continue;
			const enemyScript = enemy.getComponent('Enemy') as any ||
								enemy.getComponent('OrcWarlord') as any ||
								enemy.getComponent('OrcWarrior') as any ||
								enemy.getComponent('TrollSpearman') as any ||
								enemy.getComponent('Boss') as any;
			if (!enemyScript) continue;
			// 判断是否活着（Boss/Enemy都有 isAlive）
			if (enemyScript.isAlive && typeof enemyScript.isAlive === 'function') {
				if (!enemyScript.isAlive()) continue;
			}
			const dx = enemy.worldPosition.x - center.x;
			const dy = enemy.worldPosition.y - center.y;
			const d2 = dx * dx + dy * dy;
			if (d2 <= r2) {
				fn(enemy, enemyScript);
			}
		}
	}

	private applyPull(dt: number) {
		const center = this.node.worldPosition;
		const power = Math.max(0, this.pullPowerPerSecond) * dt;
		if (power <= 0.001) return;
		this.forEachEnemyInRadius(center, this.radius, (enemy) => {
			// 朝中心点的方向
			const dir = new Vec3(center.x - enemy.worldPosition.x, center.y - enemy.worldPosition.y, 0);
			if (dir.length() > 0.001) {
				dir.normalize();
				const newPos = new Vec3();
				Vec3.scaleAndAdd(newPos, enemy.worldPosition, dir, power);
				enemy.setWorldPosition(newPos);
			}
		});
	}

	private applyDamageTick() {
		const center = this.node.worldPosition;
		this.forEachEnemyInRadius(center, this.radius, (_enemy, enemyScript) => {
			try {
				if (enemyScript && typeof enemyScript.takeDamage === 'function') {
					enemyScript.takeDamage(this.dps);
				}
			} catch {}
		});
	}
}

