import { _decorator, Component, Node as CocosNode, Label, Sprite, Color, Graphics, UITransform } from 'cc';
const { ccclass, property } = _decorator;

// 仅供本文件内部使用的类型（不需要对外导出）
type LevelDifficultyData = {
    level: number;
    total_attempts: number;
    success_count: number;
    fail_count: number;
    pass_rate: number;
    difficulty_label: string;
    difficulty_color: string;
};

/**
 * 关卡通关率标签组件
 * 显示关卡的通关率和难度等级
 */
@ccclass('LevelPassRateLabel')
export class LevelPassRateLabel extends Component {
    @property(Label)
    passRateLabel: Label = null!; // 通关率文本（如：通关率 45.6%）
    
    @property(Label)
    difficultyLabel: Label = null!; // 难度标签（如：地狱）
    
    @property(CocosNode)
    difficultyBg: CocosNode = null!; // 难度标签背景（用于设置颜色）
    
    private currentLevel: number = 1;
    private difficultyData: LevelDifficultyData | null = null;
    
    // 服务器配置
    private readonly SERVER_URL = 'https://www.egoistcookie.top/api/analytics';
    
    /**
     * 更新显示的关卡
     */
    public async updateLevel(level: number) {
        this.currentLevel = level;
        await this.fetchLevelData();
    }
    
    /**
     * 从服务器获取关卡数据
     */
    private async fetchLevelData() {
        try {
            const response = await this.fetchWithTimeout(
                `${this.SERVER_URL}/level/${this.currentLevel}/pass-rate`,
                { timeout: 3000 }
            );
            
            if (response.success && response.data) {
                this.difficultyData = response.data;
                this.updateDisplay();
            } else {
                console.warn(`[LevelPassRateLabel] 获取关卡 ${this.currentLevel} 数据失败`);
                this.showDefaultDisplay();
            }
        } catch (error) {
            console.error(`[LevelPassRateLabel] 请求关卡数据异常:`, error);
            this.showDefaultDisplay();
        }
    }
    
    /**
     * 更新显示内容
     */
    private updateDisplay() {
        if (!this.difficultyData) {
            this.showDefaultDisplay();
            return;
        }
        
        // 如果该关卡还没有任何统计数据，明确展示“暂无数据”
        if (this.difficultyData.total_attempts === 0) {
            if (this.passRateLabel) {
                this.passRateLabel.string = '通关率 --';
                this.passRateLabel.color = new Color(200, 200, 200, 255);
            }
            if (this.difficultyLabel) {
                this.difficultyLabel.string = '暂无数据';
                this.difficultyLabel.color = new Color(200, 200, 200, 255);
            }
            if (this.difficultyBg) {
                this.setDifficultyBgColor(new Color(0, 0, 0, 0));
            }
            return;
        }

        // 更新通关率文本
        if (this.passRateLabel) {
            this.passRateLabel.string = `通关率 ${this.difficultyData.pass_rate.toFixed(1)}%`;
            this.passRateLabel.color = new Color(255, 255, 255, 255);
        }
        
        // 更新难度标签
        if (this.difficultyLabel) {
            this.difficultyLabel.string = this.difficultyData.difficulty_label;
            
            // 根据难度设置文字颜色和样式
            const difficultyColor = this.parseDifficultyColor(this.difficultyData.difficulty_color);
            
            // 地狱级别使用红底白字
            if (this.difficultyData.difficulty_label === '地狱') {
                this.difficultyLabel.color = new Color(255, 255, 255, 255); // 白色文字
                if (this.difficultyBg) {
                    this.setDifficultyBgColor(new Color(139, 0, 0, 255));
                }
            } else if (this.difficultyData.difficulty_label === '炼狱') {
                this.difficultyLabel.color = new Color(255, 255, 255, 255); // 白色文字
                if (this.difficultyBg) {
                    this.setDifficultyBgColor(new Color(220, 20, 60, 255));
                }
            } else if (this.difficultyData.difficulty_label === '噩梦') {
                this.difficultyLabel.color = new Color(255, 255, 255, 255); // 白色文字
                if (this.difficultyBg) {
                    this.setDifficultyBgColor(new Color(255, 69, 0, 255));
                }
            } else {
                // 其他难度使用对应颜色文字，透明背景
                this.difficultyLabel.color = difficultyColor;
                if (this.difficultyBg) {
                    this.setDifficultyBgColor(new Color(0, 0, 0, 0));
                }
            }
        }
        
        console.log(`[LevelPassRateLabel] 关卡 ${this.currentLevel} - ${this.difficultyData.difficulty_label} - 通关率 ${this.difficultyData.pass_rate.toFixed(1)}%`);
    }
    
    /**
     * 显示默认内容（无数据时）
     */
    private showDefaultDisplay() {
        if (this.passRateLabel) {
            this.passRateLabel.string = '通关率 --';
            this.passRateLabel.color = new Color(200, 200, 200, 255);
        }
        
        if (this.difficultyLabel) {
            this.difficultyLabel.string = '未知';
            this.difficultyLabel.color = new Color(153, 153, 153, 255);
        }
        
        if (this.difficultyBg) {
            this.setDifficultyBgColor(new Color(0, 0, 0, 0));
        }
    }

    /**
     * 设置难度徽章背景颜色：
     * - 优先使用 Sprite（如果有 spriteFrame）
     * - 否则使用 Graphics 绘制圆角矩形底色（推荐，避免 spriteFrame 为空导致不可见）
     */
    private setDifficultyBgColor(color: Color) {
        if (!this.difficultyBg || !this.difficultyBg.isValid) return;

        // 1) Sprite：仅当 spriteFrame 存在时才可靠显示
        const bgSprite = this.difficultyBg.getComponent(Sprite);
        if (bgSprite && bgSprite.spriteFrame) {
            bgSprite.color = color;
            return;
        }

        // 2) Graphics：绘制圆角矩形
        const g = this.difficultyBg.getComponent(Graphics) || this.difficultyBg.addComponent(Graphics);
        g.clear();
        if (color.a <= 0) return;

        const t = this.difficultyBg.getComponent(UITransform);
        const w = t ? t.width : 120;
        const h = t ? t.height : 34;
        g.fillColor = color;
        g.roundRect(-w / 2, -h / 2, w, h, Math.min(12, h / 2));
        g.fill();
    }
    
    /**
     * 解析颜色字符串
     */
    private parseDifficultyColor(colorStr: string): Color {
        // 解析 #RRGGBB 格式
        if (colorStr.startsWith('#')) {
            const hex = colorStr.substring(1);
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return new Color(r, g, b, 255);
        }
        return new Color(255, 255, 255, 255);
    }
    
    /**
     * 带超时的 fetch 请求
     */
    private async fetchWithTimeout(url: string, options: { timeout: number }): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = options.timeout;
            
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (error) {
                            reject(new Error('解析响应失败'));
                        }
                    } else {
                        reject(new Error(`请求失败: ${xhr.status}`));
                    }
                }
            };
            
            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.ontimeout = () => reject(new Error('请求超时'));
            
            xhr.open('GET', url, true);
            xhr.send();
        });
    }
    
    /**
     * 显示标签
     */
    public show() {
        this.node.active = true;
    }
    
    /**
     * 隐藏标签
     */
    public hide() {
        this.node.active = false;
    }
    
    /**
     * 获取当前难度数据
     */
    public getDifficultyData(): LevelDifficultyData | null {
        return this.difficultyData;
    }
}
