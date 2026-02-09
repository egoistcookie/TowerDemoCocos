import { _decorator, Component, Node, AudioSource, find, resources, AudioClip, sys, game, Game, director } from 'cc';
import { AudioManager } from './AudioManager';
const { ccclass, property } = _decorator;

@ccclass('SoundManager')
export class SoundManager extends Component {
    // 单例实例
    private static instance: SoundManager | null = null;
    @property(AudioSource)
    bgmAudioSource: AudioSource = null!;
    
    @property(AudioSource)
    effectAudioSource: AudioSource = null!;
    
    private isBgmEnabled: boolean = true;
    private isEffectEnabled: boolean = true;

    // 游戏背景音乐（resources/sounds/backMusic1.mp3）
    private gameBgmClip: AudioClip | null = null;
    private isGameBgmLoading: boolean = false;

    // 主菜单背景音乐（resources/sounds/backMusic.mp3）
    private menuBgmClip: AudioClip | null = null;
    private isMenuBgmLoading: boolean = false;

    // 记录在切到后台前，背景音乐是否处于启用状态，用于恢复
    private wasBgmEnabledBeforeHide: boolean = false;
    
    protected onLoad(): void {
        // 确保全局只有一个 SoundManager 实例
        if (SoundManager.instance && SoundManager.instance !== this) {
            // 场景中已经有一个有效的 SoundManager，销毁多余的这个
            this.node.destroy();
            return;
        }
        SoundManager.instance = this;

        // 将 SoundManager 节点标记为常驻节点，防止在切换 / 重新加载场景时被销毁
        if (!director.isPersistRootNode(this.node)) {
            director.addPersistRootNode(this.node);
            console.info('[SoundManager] onLoad() mark node as persist root');
        }

        // 立即加载音效设置，确保状态在 onLoad() 阶段就正确（避免 start() 执行前被调用时返回默认值）
        this.loadSoundSettings();
        console.info('[SoundManager] onLoad() sound settings loaded, isBgmEnabled =', this.isBgmEnabled, 'isEffectEnabled =', this.isEffectEnabled);

        // 监听游戏切到后台/返回前台事件，自动暂停/恢复背景音乐
        game.on(Game.EVENT_HIDE, this.onGameHide, this);
        game.on(Game.EVENT_SHOW, this.onGameShow, this);

        // 如果在编辑器中给 SoundManager 节点挂了 AudioSource 并勾选了自动播放，这里强制关掉，全部改用 AudioManager 统一管理
        if (this.bgmAudioSource) {
            this.bgmAudioSource.stop();
            // @ts-ignore
            (this.bgmAudioSource as any).playOnAwake = false;
            this.bgmAudioSource.loop = false;
        }
        if (this.effectAudioSource) {
            this.effectAudioSource.stop();
            // @ts-ignore
            (this.effectAudioSource as any).playOnAwake = false;
            this.effectAudioSource.loop = false;
        }
    }
    
    start() {
        console.info('[SoundManager] start() called');
        // 注意：loadSoundSettings() 已在 onLoad() 中调用，这里不再重复调用
        // 但如果需要，可以再次确保状态正确（双重保险）
        // this.loadSoundSettings();
    }
    
    // 加载音效设置
    loadSoundSettings() {
        // 从本地存储加载音效设置（如果没有则使用默认值 true）
        try {
            const bgmStr = sys.localStorage.getItem('TowerDemo_BGM_Enabled');
            const sfxStr = sys.localStorage.getItem('TowerDemo_SFX_Enabled');
            this.isBgmEnabled = bgmStr === null ? true : bgmStr === '1';
            this.isEffectEnabled = sfxStr === null ? true : sfxStr === '1';
            console.info('[SoundManager] loadSoundSettings() from localStorage, isBgmEnabled =', this.isBgmEnabled, 'isEffectEnabled =', this.isEffectEnabled);
        } catch (e) {
            // 回退到默认值
            this.isBgmEnabled = true;
            this.isEffectEnabled = true;
            console.warn('[SoundManager] loadSoundSettings() failed, use default values. error =', e);
        }
    }
    
    // 保存音效设置
    saveSoundSettings() {
        // 将音效设置保存到本地存储，确保重新进入场景后仍然生效
        try {
            sys.localStorage.setItem('TowerDemo_BGM_Enabled', this.isBgmEnabled ? '1' : '0');
            sys.localStorage.setItem('TowerDemo_SFX_Enabled', this.isEffectEnabled ? '1' : '0');
        } catch (e) {
            console.warn('[SoundManager] saveSoundSettings() failed:', e);
        }
    }

    /**
     * 停止本节点上所有本地 AudioSource（防止在编辑器里挂了多余的音乐源，一直循环 backMusic）
     */
    private stopLocalAudioSources() {
        if (this.bgmAudioSource) {
            this.bgmAudioSource.stop();
        }
        if (this.effectAudioSource) {
            this.effectAudioSource.stop();
        }
    }

    /**
     * 游戏切到后台时回调：如果当前背景音乐是开启状态，则先记录状态并暂停
     */
    private onGameHide() {
        console.info('[SoundManager] onGameHide() called');
        this.wasBgmEnabledBeforeHide = this.isBgmEnabled;
        if (this.isBgmEnabled) {
            const audioMgr = AudioManager.Instance;
            audioMgr.pauseBGM();
        }
    }

    /**
     * 游戏回到前台时回调：如果之前开启了背景音乐，则根据当前场景/状态由外部决定是否重新播放
     * 这里仅在 BGM 开关仍为开启时恢复播放
     */
    private onGameShow() {
        console.info('[SoundManager] onGameShow() called, wasBgmEnabledBeforeHide =', this.wasBgmEnabledBeforeHide, 'isBgmEnabled =', this.isBgmEnabled);
        if (this.wasBgmEnabledBeforeHide && this.isBgmEnabled) {
            const audioMgr = AudioManager.Instance;
            audioMgr.resumeBGM();
        }
    }
    
    // 切换背景音乐开关（由设置里的背景音乐开关键调用）
    toggleBgm() {
        console.info('[SoundManager] toggleBgm() called, current isBgmEnabled =', this.isBgmEnabled);
        this.isBgmEnabled = !this.isBgmEnabled;
        this.saveSoundSettings();
        console.info('[SoundManager] toggleBgm() new isBgmEnabled =', this.isBgmEnabled);
        
        // 关闭时立刻停止并静音背景音乐（双保险）
        if (!this.isBgmEnabled) {
            console.info('[SoundManager] BGM turned OFF, calling stopGameBgm()');
            this.stopGameBgm();
            this.stopLocalAudioSources();
            // 将背景音乐音量设为0，防止某些平台上 stop 后残留声音
            const audioMgr = AudioManager.Instance;
            audioMgr.setBGMVolume(0);
        } else {
            // 开启时不主动决定播放哪一首，由调用方根据当前处于首页/战斗阶段决定调用 playMenuBgm 或 playGameBgm
            console.info('[SoundManager] BGM turned ON, waiting for context (menu/game) to decide which track to play');
        }
        
        return this.isBgmEnabled;
    }
    
    // 切换音效开关
    toggleEffect() {
        console.info('[SoundManager] toggleEffect() called, current isEffectEnabled =', this.isEffectEnabled);
        this.isEffectEnabled = !this.isEffectEnabled;
        this.saveSoundSettings();
        console.info('[SoundManager] toggleEffect() new isEffectEnabled =', this.isEffectEnabled);

        // 同步到 AudioManager：使用音量控制所有音效节点
        const audioMgr = AudioManager.Instance;
        if (this.isEffectEnabled) {
            // 恢复默认音效音量（0.8）
            audioMgr.setSFXVolume(0.8);
        } else {
            // 将音效音量设为 0，相当于全局静音，箭矢/敌人/我方单位的音效都不会播放出声音
            audioMgr.setSFXVolume(0.0);
        }
        
        return this.isEffectEnabled;
    }
    
    // 播放音效
    playEffect(audioClip: any) {
        if (this.isEffectEnabled && this.effectAudioSource && audioClip) {
            this.effectAudioSource.playOneShot(audioClip);
        }
    }
    
    // 获取背景音乐开关状态
    isBgmOn(): boolean {
        return this.isBgmEnabled;
    }
    
    // 获取音效开关状态
    isEffectOn(): boolean {
        return this.isEffectEnabled;
    }

    /**
     * 懒加载主菜单背景音乐资源
     */
    private loadMenuBgm(onLoaded?: () => void) {
        if (this.menuBgmClip) {
            console.info('[SoundManager] loadMenuBgm() clip already loaded');
            if (onLoaded) {
                onLoaded();
            }
            return;
        }

        if (this.isMenuBgmLoading) {
            console.info('[SoundManager] loadMenuBgm() already loading, skip duplicate request');
            return;
        }

        console.info('[SoundManager] loadMenuBgm() start loading resources/sounds/backMusic');
        this.isMenuBgmLoading = true;
        resources.load('sounds/backMusic', AudioClip, (err, clip) => {
            this.isMenuBgmLoading = false;
            if (err || !clip) {
                console.error('[SoundManager] 加载主菜单背景音乐 sounds/backMusic 失败:', err);
                return;
            }
            this.menuBgmClip = clip;
            console.info('[SoundManager] loadMenuBgm() success, clip loaded');
            if (onLoaded) {
                onLoaded();
            }
        });
    }

    /**
     * 在首页时调用：播放并循环主菜单背景音乐（音量 100%）
     */
    playMenuBgm() {
        console.info('[SoundManager] playMenuBgm() called, isBgmEnabled =', this.isBgmEnabled);
        if (!this.isBgmEnabled) {
            console.info('[SoundManager] playMenuBgm() aborted because BGM is disabled');
            return;
        }

        // 确保本节点上不会有多余的 AudioSource 自己在播
        this.stopLocalAudioSources();

        const audioMgr = AudioManager.Instance;
        if (!audioMgr) {
            console.warn('[SoundManager] playMenuBgm() aborted: AudioManager.Instance is null');
            return;
        }
        const doPlay = () => {
            if (!this.menuBgmClip) {
                console.warn('[SoundManager] playMenuBgm() doPlay() called but menuBgmClip is null');
                return;
            }
            console.info('[SoundManager] playMenuBgm() doPlay() play MENU BGM now, volume = 1.0');
            // 先强制停止当前背景音乐，避免任何残留
            audioMgr.stopBGM();
            audioMgr.setBGMVolume(1.0);
            audioMgr.playBGM(this.menuBgmClip);
        };

        if (this.menuBgmClip) {
            console.info('[SoundManager] playMenuBgm() use cached clip');
            doPlay();
        } else {
            console.info('[SoundManager] playMenuBgm() no clip yet, call loadMenuBgm()');
            this.loadMenuBgm(() => {
                if (this.isBgmEnabled) {
                    console.info('[SoundManager] playMenuBgm() load complete & BGM enabled, call doPlay()');
                    doPlay();
                }
            });
        }
    }

    /**
     * 懒加载游戏背景音乐资源
     */
    private loadGameBgm(onLoaded?: () => void) {
        if (this.gameBgmClip) {
            console.info('[SoundManager] loadGameBgm() clip already loaded');
            if (onLoaded) {
                onLoaded();
            }
            return;
        }

        if (this.isGameBgmLoading) {
            // 正在加载中，简单地等待回调
            console.info('[SoundManager] loadGameBgm() already loading, skip duplicate request');
            return;
        }

        console.info('[SoundManager] loadGameBgm() start loading resources/sounds/backMusic1');
        this.isGameBgmLoading = true;
        resources.load('sounds/backMusic1', AudioClip, (err, clip) => {
            this.isGameBgmLoading = false;
            if (err || !clip) {
                console.error('[SoundManager] 加载背景音乐 sounds/backMusic1 失败:', err);
                return;
            }
            this.gameBgmClip = clip;
            console.info('[SoundManager] loadGameBgm() success, clip loaded');
            if (onLoaded) {
                onLoaded();
            }
        });
    }

    /**
     * 在开始游戏时调用：播放并循环游戏背景音乐
     * 音量固定为 30%
     */
    playGameBgm() {
        console.info('[SoundManager] playGameBgm() called, isBgmEnabled =', this.isBgmEnabled);
        if (!this.isBgmEnabled) {
            console.info('[SoundManager] playGameBgm() aborted because BGM is disabled');
            return;
        }

        // 确保本节点上不会有多余的 AudioSource 自己在播
        this.stopLocalAudioSources();

        const audioMgr = AudioManager.Instance;
        if (!audioMgr) {
            console.warn('[SoundManager] playGameBgm() aborted: AudioManager.Instance is null');
            return;
        }
        const doPlay = () => {
            if (!this.gameBgmClip) {
                console.warn('[SoundManager] doPlay() called but gameBgmClip is null');
                return;
            }
            // 设置背景音乐音量为 30%
            console.info('[SoundManager] doPlay() play BGM now, volume = 0.3');
            // 先强制停止当前背景音乐，避免菜单 BGM 残留
            audioMgr.stopBGM();
            audioMgr.setBGMVolume(0.3);
            audioMgr.playBGM(this.gameBgmClip);
        };

        if (this.gameBgmClip) {
            console.info('[SoundManager] playGameBgm() use cached clip');
            doPlay();
        } else {
            console.info('[SoundManager] playGameBgm() no clip yet, call loadGameBgm()');
            this.loadGameBgm(() => {
                if (this.isBgmEnabled) {
                    console.info('[SoundManager] playGameBgm() load complete & BGM enabled, call doPlay()');
                    doPlay();
                }
            });
        }
    }

    /**
     * 在退出游戏时调用：停止背景音乐播放
     */
    stopGameBgm() {
        console.info('[SoundManager] stopGameBgm() called');
        const audioMgr = AudioManager.Instance;
        audioMgr.stopBGM();
    }
    
    // 静态方法，用于获取SoundManager实例（优先查找，最后兜底创建一个，保证始终有控制器）
    static getInstance(): SoundManager | null {
        // 优先返回已存在的单例实例
        if (this.instance && this.instance.node && this.instance.node.isValid) {
            return this.instance;
        }

        // 尝试在当前场景中查找已有的 SoundManager 组件
        const scene = director.getScene();
        if (scene) {
            const stack: Node[] = [...scene.children];
            while (stack.length > 0) {
                const node = stack.pop()!;
                const comp = node.getComponent(SoundManager);
                if (comp) {
                    console.info('[SoundManager] getInstance() found existing SoundManager component in scene on node', node.name);
                    this.instance = comp;
                    return comp;
                }
                stack.push(...node.children);
            }
        }

        // 再尝试常见路径的节点名称（Canvas/SoundManager 或根节点下的 SoundManager）
        const soundManagerNode = find('Canvas/SoundManager') || find('SoundManager');
        if (soundManagerNode) {
            const comp = soundManagerNode.getComponent(SoundManager);
            if (comp && comp.node && comp.node.isValid) {
                console.info('[SoundManager] getInstance() found SoundManager on node', soundManagerNode.name);
                this.instance = comp;
                return comp;
            }
        }

        // 如果上述方式都找不到，说明场景中确实不存在 SoundManager
        // 为了保证游戏流程不中断，这里做一次“兜底创建”，并打印明显日志，方便在开发阶段排查
        const scene2 = director.getScene();
        if (scene2) {
            const root = find('Canvas') || scene2;
            if (root) {
                const node = new Node('SoundManager');
                root.addChild(node);
                const comp = node.addComponent(SoundManager);
                // 兜底创建时，立刻从本地存储加载一次设置，确保 isBgmEnabled / isEffectEnabled 状态与开关同步
                comp.loadSoundSettings();
                this.instance = comp;
                console.warn('[SoundManager] getInstance() no existing SoundManager found, created one automatically on node', node.name);
                return comp;
            }
        }

        console.warn('[SoundManager] getInstance() no SoundManager found in scene and cannot create (no valid scene/root).');
        return null;
    }
}