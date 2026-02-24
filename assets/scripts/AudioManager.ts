import { _decorator, Component, AudioSource, AudioClip, Node, instantiate, Prefab, find, director } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 音频管理器，用于统一管理游戏中的音频播放
 * 使用单例模式，确保全局唯一实例
 * 使用AudioSource组件来播放音频
 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    // 单例实例（仅在场景中创建一次，其余地方只获取）
    private static instance: AudioManager | null = null;
    
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
     * 获取单例实例（只在场景中查找，找不到则打印日志并返回 null）
     */
    public static get Instance(): AudioManager {
        // 如果已有有效实例，直接返回
        if (this.instance && this.instance.node && this.instance.node.isValid) {
            return this.instance;
        }

        // 尝试在当前场景中查找已有的 AudioManager 组件
        const scene = director.getScene();
        if (scene) {
            const stack: Node[] = [...scene.children];
            while (stack.length > 0) {
                const node = stack.pop()!;
                const comp = node.getComponent(AudioManager);
                if (comp && comp.node && comp.node.isValid) {
                   //console.info('[AudioManager] Instance() found existing AudioManager on node', node.name);
                    this.instance = comp;
                    return comp;
                }
                stack.push(...node.children);
            }
        }

        // 再尝试常见路径的节点名称
        const audioManagerNode = find('Canvas/AudioManager') || find('AudioManager');
        if (audioManagerNode) {
            const comp = audioManagerNode.getComponent(AudioManager);
            if (comp && comp.node && comp.node.isValid) {
               //console.info('[AudioManager] Instance() found AudioManager on node', audioManagerNode.name);
                this.instance = comp;
                return comp;
            }
        }

        console.warn('[AudioManager] Instance() no AudioManager found in scene. Please add one under Canvas.');
        return null as any;
    }
    
    protected onLoad(): void {
        // 确保只有一个 AudioManager 实例，销毁多余的
        if (AudioManager.instance && AudioManager.instance !== this) {
            console.warn('[AudioManager] Duplicate AudioManager on node', this.node.name, ', destroying this one');
            this.node.destroy();
            return;
        }
        AudioManager.instance = this;

        // 如果当前节点还没有挂到场景上，则尝试挂到 Canvas 或场景根
        if (!this.node.scene) {
            const scene = director.getScene();
            const root = find('Canvas') || scene;
            if (root) {
                root.addChild(this.node);
            }
        }

        // 将 AudioManager 节点标记为常驻节点，防止在切换 / 重新加载场景时被销毁
        if (!director.isPersistRootNode(this.node)) {
            director.addPersistRootNode(this.node);
           //console.info('[AudioManager] onLoad() mark node as persist root');
        }
        
        // 初始化音频管理器
        this.initAudioManager();
    }
    
    /**
     * 确保背景音乐 AudioSource 已经创建并初始化
     */
    private ensureBgmAudioSource(): void {
        // 如果组件的 node 无效，直接放弃，避免报错
        if (!this.node || !this.node.isValid) {
            console.warn('[AudioManager] ensureBgmAudioSource() aborted because node is invalid');
            return;
        }

        if (!this.bgmAudioSource || !this.bgmAudioSource.node || !this.bgmAudioSource.node.isValid) {
            this.bgmAudioSource = this.node.getComponent(AudioSource) || this.node.addComponent(AudioSource);
        }

        if (!this.bgmAudioSource) {
            console.warn('[AudioManager] ensureBgmAudioSource() failed: bgmAudioSource is still null');
            return;
        }
        // 确保关键属性正确
        this.bgmAudioSource.loop = true;
        this.bgmAudioSource.volume = this.bgmVolume;
    }

    /**
     * 初始化音频管理器
     */
    private initAudioManager(): void {
        // 创建并初始化背景音乐AudioSource组件
        this.ensureBgmAudioSource();
        
        // 初始化音效节点池
        this.initSFXNodes();
    }
    
    /**
     * 初始化音效节点池
     */
    private initSFXNodes(): void {
        for (let i = 0; i < this.MAX_SFX_NODES; i++) {
            const sfxNode = new Node(`SFX_${i}`);
            sfxNode.setParent(this.node);
            // 激活SFX节点，否则AudioSource组件无法正常工作
            sfxNode.active = true;
            const audioSource = sfxNode.addComponent(AudioSource);
            audioSource.loop = false;
            audioSource.volume = this.sfxVolume;
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
        this.ensureBgmAudioSource();
        this.bgmAudioSource.clip = clip;
        this.bgmAudioSource.play();
    }
    
    /**
     * 停止背景音乐
     */
    public stopBGM(): void {
        this.ensureBgmAudioSource();
        if (this.bgmAudioSource) {
            this.bgmAudioSource.stop();
        }
    }
    
    /**
     * 暂停背景音乐
     */
    public pauseBGM(): void {
        this.ensureBgmAudioSource();
        if (this.bgmAudioSource) {
            this.bgmAudioSource.pause();
        }
    }
    
    /**
     * 恢复背景音乐
     */
    public resumeBGM(): void {
        this.ensureBgmAudioSource();
        if (this.bgmAudioSource) {
            this.bgmAudioSource.play();
        }
    }
    
    /**
     * 播放音效
     * @param clip 音频资源
     */
    public playSFX(clip: AudioClip): void {
        if (!clip) {
            return;
        }
        
        
        // 获取可用的音效节点
        const sfxNode = this.getAvailableSFXNode();
        if (!sfxNode) {
            return;
        }
        
        // 播放音效
        const audioSource = sfxNode.getComponent(AudioSource);
        if (audioSource) {
            // 使用playOneShot方法播放一次性音效，这是更可靠的方法
            audioSource.playOneShot(clip, this.sfxVolume);
        } else {
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
        this.ensureBgmAudioSource();
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
