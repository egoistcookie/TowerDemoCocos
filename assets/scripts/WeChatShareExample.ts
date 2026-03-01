import { _decorator, Component, Button } from 'cc';
import { WeChatShareManager } from './WeChatShareManager';

const { ccclass, property } = _decorator;

/**
 * 微信转发功能使用示例
 * 
 * 这个组件展示了如何在游戏中使用微信转发功能
 * 可以将此组件挂载到任何节点上，并在编辑器中配置按钮
 */
@ccclass('WeChatShareExample')
export class WeChatShareExample extends Component {
    
    @property(Button)
    shareButton: Button = null!; // 主动分享按钮

    @property(Button)
    shareTimelineButton: Button = null!; // 分享到朋友圈按钮

    private shareManager: WeChatShareManager = null!;

    start() {
        // 获取转发管理器实例
        this.shareManager = WeChatShareManager.getInstance();

        // 绑定按钮事件
        if (this.shareButton) {
            this.shareButton.node.on('click', this.onShareButtonClick, this);
        }

        if (this.shareTimelineButton) {
            this.shareTimelineButton.node.on('click', this.onShareTimelineButtonClick, this);
        }
    }

    /**
     * 主动分享给好友
     */
    private onShareButtonClick() {
        console.log('[WeChatShareExample] 点击了分享按钮');
        
        // 方式1：使用默认分享内容
        // this.shareManager.shareAppMessage();

        // 方式2：自定义分享内容
        this.shareManager.shareAppMessage(
            '快来和我一起玩塔防游戏！', // 标题
            '', // 图片路径（可选，留空使用默认截图）
            'from=friend&inviter=123' // 携带参数（可选）
        );
    }

    /**
     * 分享到朋友圈
     */
    private onShareTimelineButtonClick() {
        console.log('[WeChatShareExample] 点击了分享到朋友圈按钮');
        
        this.shareManager.shareTimeline(
            '塔防游戏 - 守护水晶！', // 标题
            '', // 图片路径（可选）
            'from=timeline' // 携带参数（可选）
        );
    }

    /**
     * 示例：通关后分享
     */
    public shareAfterWin(level: number) {
        this.shareManager.shareAppMessage(
            `我通过了第${level}关！快来挑战吧！`,
            '',
            `level=${level}&from=win`
        );
    }

    /**
     * 示例：获得高分后分享
     */
    public shareHighScore(score: number) {
        this.shareManager.shareAppMessage(
            `我的最高分是${score}分！你能超越我吗？`,
            '',
            `score=${score}&from=highscore`
        );
    }

    /**
     * 示例：邀请好友
     */
    public shareInvite(playerId: string) {
        this.shareManager.shareAppMessage(
            '快来和我一起玩塔防游戏，还有新手奖励哦！',
            '',
            `inviter=${playerId}&from=invite`
        );
    }
}
