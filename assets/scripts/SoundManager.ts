import { _decorator, Component, Node, AudioSource, find } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SoundManager')
export class SoundManager extends Component {
    @property(AudioSource)
    bgmAudioSource: AudioSource = null!;
    
    @property(AudioSource)
    effectAudioSource: AudioSource = null!;
    
    private isBgmEnabled: boolean = true;
    private isEffectEnabled: boolean = true;
    
    start() {
        // 初始化音效状态
        this.loadSoundSettings();
        
        // 播放背景音乐
        if (this.isBgmEnabled && this.bgmAudioSource) {
            this.bgmAudioSource.play();
        }
    }
    
    // 加载音效设置
    loadSoundSettings() {
        // 这里可以从本地存储加载音效设置
        // 暂时使用默认值
        this.isBgmEnabled = true;
        this.isEffectEnabled = true;
    }
    
    // 保存音效设置
    saveSoundSettings() {
        // 这里可以将音效设置保存到本地存储
    }
    
    // 切换背景音乐开关
    toggleBgm() {
        this.isBgmEnabled = !this.isBgmEnabled;
        this.saveSoundSettings();
        
        if (this.bgmAudioSource) {
            if (this.isBgmEnabled) {
                this.bgmAudioSource.play();
            } else {
                this.bgmAudioSource.pause();
            }
        }
        
        return this.isBgmEnabled;
    }
    
    // 切换音效开关
    toggleEffect() {
        this.isEffectEnabled = !this.isEffectEnabled;
        this.saveSoundSettings();
        
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
    
    // 静态方法，用于获取SoundManager实例
    static getInstance(): SoundManager | null {
        const soundManagerNode = find('SoundManager');
        if (soundManagerNode) {
            return soundManagerNode.getComponent(SoundManager);
        }
        return null;
    }
}