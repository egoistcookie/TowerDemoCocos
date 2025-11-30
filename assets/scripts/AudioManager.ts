import { _decorator, Component, AudioSource, AudioClip, Node, instantiate, Prefab, find } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 音频管理器，用于统一管理游戏中的音频播放
 * 使用单例模式，确保全局唯一实例
 * 使用AudioSource组件来播放音频
 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    // 单例实例
    private static instance: AudioManager;
    
    // 背景音乐音量
    @property
    bgmVolume: number = 0.5;
    
    // 音效音量
    @property
    sfxVolume: number = 0.8;
    
    // 背景音乐AudioSource组件
    private bgmAudioSource: AudioSource = null!;
    
    // 音效节点池，用于播放多个音效
    private sfxNodes: Node[] = [];
    
    // 音效节点最大数量
    private readonly MAX_SFX_NODES: number = 10;
    
    /**
     * 获取单例实例
     */
    public static get Instance(): AudioManager {
        if (!this.instance) {
            console.debug('AudioManager: Instance is null, creating new instance');
            // 创建AudioManager节点和组件
            const audioManagerNode = new Node('AudioManager');
            this.instance = audioManagerNode.addComponent(AudioManager);
            // 直接将节点添加到当前场景的根节点
            // 注意：在Cocos Creator 3.x中，需要通过find函数获取场景根节点
            const sceneRoot = find('/');
            if (sceneRoot) {
                sceneRoot.addChild(audioManagerNode);
                // 激活节点，否则AudioSource组件无法正常工作
                audioManagerNode.active = true;
                console.debug('AudioManager: Added to scene root and activated');
            } else {
                console.error('AudioManager: Failed to find scene root');
            }
        }
        return this.instance;
    }
    
    protected onLoad(): void {
        // 确保只有一个实例
        if (AudioManager.instance) {
            this.node.destroy();
            return;
        }
        
        AudioManager.instance = this;
        // 设置为常驻节点，避免场景切换时被销毁
        this.node.scene.addChild(this.node);
        
        // 初始化音频管理器
        this.initAudioManager();
        
        console.debug('AudioManager initialized successfully');
    }
    
    /**
     * 初始化音频管理器
     */
    private initAudioManager(): void {
        // 创建背景音乐AudioSource组件
        this.bgmAudioSource = this.node.getComponent(AudioSource);
        if (!this.bgmAudioSource) {
            this.bgmAudioSource = this.node.addComponent(AudioSource);
        }
        
        // 设置背景音乐属性
        this.bgmAudioSource.loop = true;
        this.bgmAudioSource.volume = this.bgmVolume;
        
        // 初始化音效节点池
        this.initSFXNodes();
    }
    
    /**
     * 初始化音效节点池
     */
    private initSFXNodes(): void {
        console.debug(`AudioManager: Initializing ${this.MAX_SFX_NODES} SFX nodes`);
        for (let i = 0; i < this.MAX_SFX_NODES; i++) {
            const sfxNode = new Node(`SFX_${i}`);
            sfxNode.setParent(this.node);
            // 激活SFX节点，否则AudioSource组件无法正常工作
            sfxNode.active = true;
            const audioSource = sfxNode.addComponent(AudioSource);
            audioSource.loop = false;
            audioSource.volume = this.sfxVolume;
            console.debug(`AudioManager: Created SFX node ${i}, volume: ${audioSource.volume}, active: ${sfxNode.active}`);
            this.sfxNodes.push(sfxNode);
        }
    }
    
    /**
     * 获取一个可用的音效节点
     * @returns 可用的音效节点
     */
    private getAvailableSFXNode(): Node | null {
        // 检查音效节点池是否已初始化
        if (this.sfxNodes.length === 0) {
            console.debug('AudioManager: SFX nodes pool is empty, initializing...');
            this.initSFXNodes();
        }
        
        // 查找未在播放的音效节点
        for (const node of this.sfxNodes) {
            const audioSource = node.getComponent(AudioSource);
            if (audioSource && !audioSource.playing) {
                return node;
            }
        }
        
        // 如果没有可用节点，返回第一个节点（覆盖最早的音效）
        const result = this.sfxNodes[0];
        console.debug(`AudioManager: Returning SFX node: ${result ? result.name : 'null'}`);
        return result;
    }
    
    /**
     * 播放背景音乐
     * @param clip 音频资源
     */
    public playBGM(clip: AudioClip): void {
        if (!clip) {
            return;
        }
        
        // 设置背景音乐并播放
        this.bgmAudioSource.clip = clip;
        this.bgmAudioSource.play();
    }
    
    /**
     * 停止背景音乐
     */
    public stopBGM(): void {
        this.bgmAudioSource.stop();
    }
    
    /**
     * 暂停背景音乐
     */
    public pauseBGM(): void {
        this.bgmAudioSource.pause();
    }
    
    /**
     * 恢复背景音乐
     */
    public resumeBGM(): void {
        this.bgmAudioSource.play();
    }
    
    /**
     * 播放音效
     * @param clip 音频资源
     */
    public playSFX(clip: AudioClip): void {
        if (!clip) {
            console.debug('AudioManager: No audio clip provided for playSFX');
            return;
        }
        
        console.debug(`AudioManager: Playing sound effect, clip: ${clip.name}`);
        
        // 获取可用的音效节点
        const sfxNode = this.getAvailableSFXNode();
        if (!sfxNode) {
            console.debug('AudioManager: No available SFX node');
            return;
        }
        
        // 播放音效
        const audioSource = sfxNode.getComponent(AudioSource);
        if (audioSource) {
            console.debug(`AudioManager: SFX node: ${sfxNode.name}, volume: ${this.sfxVolume}`);
            // 使用playOneShot方法播放一次性音效，这是更可靠的方法
            audioSource.playOneShot(clip, this.sfxVolume);
            console.debug(`AudioManager: Sound effect played successfully with playOneShot`);
        } else {
            console.debug('AudioManager: No AudioSource component found on SFX node');
        }
    }
    
    /**
     * 停止所有音效
     */
    public stopAllSFX(): void {
        for (const node of this.sfxNodes) {
            // 添加null检查，确保节点有效
            if (node && node.isValid) {
                const audioSource = node.getComponent(AudioSource);
                if (audioSource) {
                    audioSource.stop();
                }
            }
        }
    }
    
    /**
     * 设置背景音乐音量
     * @param volume 音量值（0-1）
     */
    public setBGMVolume(volume: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        this.bgmAudioSource.volume = this.bgmVolume;
    }
    
    /**
     * 设置音效音量
     * @param volume 音量值（0-1）
     */
    public setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        
        // 更新所有音效节点的音量
        for (const node of this.sfxNodes) {
            const audioSource = node.getComponent(AudioSource);
            if (audioSource) {
                audioSource.volume = this.sfxVolume;
            }
        }
    }
    
    /**
     * 获取当前背景音乐音量
     * @returns 音量值（0-1）
     */
    public getBGMVolume(): number {
        return this.bgmVolume;
    }
    
    /**
     * 获取当前音效音量
     * @returns 音量值（0-1）
     */
    public getSFXVolume(): number {
        return this.sfxVolume;
    }
    
    protected onDestroy(): void {
        // 清理资源
        if (AudioManager.instance === this) {
            AudioManager.instance = null!;
            
            // 停止所有音频，添加null检查
            if (this.bgmAudioSource) {
                this.bgmAudioSource.stop();
            }
            this.stopAllSFX();
        }
    }
}
