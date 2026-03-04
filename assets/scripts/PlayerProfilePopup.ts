import { _decorator, Component, Node, Label, Button, Sprite, UITransform, Color, Graphics, find, sys, Texture2D, ImageAsset, SpriteFrame, Mask } from 'cc';
// 微信小游戏全局对象声明（避免 TypeScript 报错）
declare const wx: any;
const { ccclass, property } = _decorator;

/**
 * 玩家信息编辑弹窗
 * 支持上传头像和设置玩家名称
 */
@ccclass('PlayerProfilePopup')
export class PlayerProfilePopup extends Component {
    @property(Node)
    popupContainer: Node = null!; // 弹窗容器
    
    @property(Label)
    nameInputLabel: Label = null!; // 名称输入框显示Label
    
    @property(Sprite)
    avatarSprite: Sprite = null!; // 头像显示
    
    @property(Button)
    uploadAvatarButton: Button = null!; // 上传头像按钮
    
    @property(Button)
    saveButton: Button = null!; // 保存按钮
    
    @property(Button)
    cancelButton: Button = null!; // 取消按钮
    
    private playerId: string = '';
    private currentName: string = '';
    private currentAvatar: string = ''; // Base64 或 URL
    private onSaveCallback: ((name: string, avatar: string) => void) | null = null;
    private onCancelCallback: (() => void) | null = null;
    
    // 服务器配置
    private readonly SERVER_URL = 'https://www.egoistcookie.top/api/analytics';
    
    onLoad() {
        // 在组件加载时绑定事件，确保按钮能响应点击
        // 延迟绑定，确保所有组件都已初始化
        setTimeout(() => {
            this.bindEvents();
        }, 100);
    }
    
    /**
     * 显示弹窗
     */
    public show(playerId: string, currentName: string = '', currentAvatar: string = '', 
                onSave?: (name: string, avatar: string) => void, 
                onCancel?: () => void) {
        this.playerId = playerId;
        this.currentName = currentName;
        this.currentAvatar = currentAvatar;
        this.onSaveCallback = onSave || null;
        this.onCancelCallback = onCancel || null;
        
        // 更新显示
        if (this.nameInputLabel) {
            this.nameInputLabel.string = this.currentName || '请输入玩家名称';
            this.nameInputLabel.color = this.currentName ? new Color(255, 255, 255, 255) : new Color(150, 150, 150, 255);
        }
        
        this.updateAvatarDisplay();
        
        // 显示弹窗
        this.node.active = true;
        
        // 确保弹窗显示在最上层
        this.node.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        
        // 确保容器在遮罩之上（如果容器存在）
        if (this.popupContainer) {
            this.popupContainer.active = true;
            // 确保容器在遮罩之后（遮罩的 siblingIndex 是 0，容器应该是 1 或更高）
            const maskNode = this.node.getChildByName('Mask');
            if (maskNode) {
                this.popupContainer.setSiblingIndex(maskNode.getSiblingIndex() + 1);
            }
        }
        
        // 绑定事件（确保每次显示时都重新绑定）
        this.bindEvents();
    }
    
    /**
     * 隐藏弹窗
     */
    public hide() {
        if (this.popupContainer) {
            this.popupContainer.active = false;
        }
        this.node.active = false;
    }
    
    /**
     * 绑定事件
     */
    private bindEvents() {
        if (this.uploadAvatarButton && this.uploadAvatarButton.node) {
            this.uploadAvatarButton.node.off(Button.EventType.CLICK, this.onUploadAvatarClick, this);
            this.uploadAvatarButton.node.on(Button.EventType.CLICK, this.onUploadAvatarClick, this);
            console.log('[PlayerProfilePopup] 上传头像按钮事件已绑定');
        } else {
            console.warn('[PlayerProfilePopup] 上传头像按钮不存在');
        }
        
        if (this.saveButton && this.saveButton.node) {
            this.saveButton.node.off(Button.EventType.CLICK, this.onSaveClick, this);
            this.saveButton.node.on(Button.EventType.CLICK, this.onSaveClick, this);
            console.log('[PlayerProfilePopup] 保存按钮事件已绑定');
        } else {
            console.warn('[PlayerProfilePopup] 保存按钮不存在');
        }
        
        if (this.cancelButton && this.cancelButton.node) {
            this.cancelButton.node.off(Button.EventType.CLICK, this.onCancelClick, this);
            this.cancelButton.node.on(Button.EventType.CLICK, this.onCancelClick, this);
            console.log('[PlayerProfilePopup] 取消按钮事件已绑定');
        } else {
            console.warn('[PlayerProfilePopup] 取消按钮不存在');
        }
    }
    
    /**
     * 上传头像按钮点击
     */
    private onUploadAvatarClick() {
        console.log('[PlayerProfilePopup] 上传头像按钮被点击');

        // 1. 微信小游戏环境：使用 wx.chooseImage + FileSystemManager 读取为 Base64
        if (sys.platform === sys.Platform.WECHAT_GAME && typeof wx !== 'undefined' && wx.chooseImage) {
            console.log('[PlayerProfilePopup] 使用 wx.chooseImage 选择头像');
            wx.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res: any) => {
                    const filePath = res.tempFilePaths && res.tempFilePaths[0];
                    if (!filePath) {
                        console.warn('[PlayerProfilePopup] wx.chooseImage 未返回有效文件路径');
                        return;
                    }
                    const fs = wx.getFileSystemManager && wx.getFileSystemManager();
                    if (!fs) {
                        console.warn('[PlayerProfilePopup] wx.getFileSystemManager 不可用，无法读取头像文件');
                        return;
                    }
                    fs.readFile({
                        filePath,
                        encoding: 'base64',
                        success: (r: any) => {
                            const base64Data = r.data;
                            if (!base64Data) {
                                console.warn('[PlayerProfilePopup] 读取头像文件为空');
                                return;
                            }
                            // 默认使用 png 前缀，足够在前后端统一解析
                            this.currentAvatar = `data:image/png;base64,${base64Data}`;
                            console.log('[PlayerProfilePopup] 已从微信小游戏读取头像并转换为Base64');
                            this.updateAvatarDisplay();
                        },
                        fail: (err: any) => {
                            console.error('[PlayerProfilePopup] 读取微信头像文件失败:', err);
                        }
                    });
                },
                fail: (err: any) => {
                    const msg = err && (err.errMsg || err.errorMessage)
                        ? (err.errMsg || err.errorMessage)
                        : JSON.stringify(err || {});
                    console.warn('[PlayerProfilePopup] wx.chooseImage 失败或被取消:', msg);
                    // 尝试给玩家一个友好提示（例如隐私声明未配置/未同意）
                    try {
                        if (wx && wx.showToast) {
                            wx.showToast({
                                title: '无法打开相册，请在微信隐私设置中允许使用头像',
                                icon: 'none',
                                duration: 2000
                            });
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            });
            return;
        }

        // 2. 浏览器环境：使用隐藏的 file input
        if (typeof document === 'undefined' || !document.createElement) {
            console.warn('[PlayerProfilePopup] 当前运行环境不支持本地文件选择，头像上传已禁用');
            return;
        }
        
        const input: any = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        
        input.onchange = (e: any) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            
            // 验证文件大小（限制2MB）
            if (file.size > 2 * 1024 * 1024) {
                console.error('[PlayerProfilePopup] 头像文件过大，请选择小于2MB的图片');
                return;
            }
            
            // 读取文件为Base64
            const reader = new FileReader();
            reader.onload = (event: any) => {
                const base64 = event.target.result;
                this.currentAvatar = base64;
                this.updateAvatarDisplay();
            };
            reader.readAsDataURL(file);
        };
        
        document.body.appendChild(input);
        if (typeof input.click === 'function') {
            input.click();
        } else {
            console.warn('[PlayerProfilePopup] input.click 不可用，无法弹出文件选择框');
        }
        document.body.removeChild(input);
    }
    
    /**
     * 更新头像显示
     */
    private updateAvatarDisplay() {
        if (!this.avatarSprite) return;
        
        if (this.currentAvatar) {
            // 如果是Base64，转换为真实图片显示
            if (this.currentAvatar.startsWith('data:image')) {
                this.loadAvatarFromBase64(this.currentAvatar);
            }
        } else {
            // 显示默认头像
            const graphics = this.avatarSprite.node.getComponent(Graphics);
            if (graphics) {
                graphics.clear();
                graphics.fillColor = new Color(150, 150, 150, 255);
                graphics.circle(0, 0, 30);
                graphics.fill();
            }
        }
    }
    
    /**
     * 从Base64字符串加载头像到Sprite（浏览器环境）
     */
    private loadAvatarFromBase64(base64: string) {
        if (!this.avatarSprite) return;
        
        // 仅在浏览器环境下可用
        if (typeof Image === 'undefined') {
            console.warn('[PlayerProfilePopup] 当前环境不支持 Image 对象，无法从Base64加载头像');
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            try {
                const imageAsset = new ImageAsset(img);
                const texture = new Texture2D();
                texture.image = imageAsset;
                
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                
                this.avatarSprite.spriteFrame = spriteFrame;
                
                // 清理占位用的 Graphics（如果有）
                const graphics = this.avatarSprite.node.getComponent(Graphics);
                if (graphics) {
                    graphics.clear();
                }
            } catch (e) {
                console.error('[PlayerProfilePopup] 从Base64创建头像失败:', e);
            }
        };
        img.onerror = (err) => {
            console.error('[PlayerProfilePopup] 加载Base64头像失败:', err);
        };
        img.src = base64;
    }
    
    /**
     * 保存按钮点击
     */
    private async onSaveClick() {
        console.log('[PlayerProfilePopup] 保存按钮被点击');
        // 获取名称（从Label获取）
        let name = '';
        if (this.nameInputLabel) {
            name = this.nameInputLabel.string || '';
            if (name === '请输入玩家名称') {
                name = '';
            }
        }
        
        const finalName = name.trim();
        
        if (!finalName || finalName.trim().length === 0) {
            console.warn('[PlayerProfilePopup] 玩家名称不能为空');
            return;
        }
        
        // 上传到服务器
        try {
            const response = await this.updatePlayerProfile(finalName.trim(), this.currentAvatar);
            
            if (response.success) {
                console.log('[PlayerProfilePopup] 保存成功');
                
                // 调用回调
                if (this.onSaveCallback) {
                    this.onSaveCallback(finalName.trim(), this.currentAvatar);
                }
                
                this.hide();
            } else {
                console.error('[PlayerProfilePopup] 保存失败:', response.message);
            }
        } catch (error) {
            console.error('[PlayerProfilePopup] 保存异常:', error);
        }
    }
    
    /**
     * 取消按钮点击
     */
    private onCancelClick() {
        console.log('[PlayerProfilePopup] 取消按钮被点击');
        if (this.onCancelCallback) {
            this.onCancelCallback();
        }
        this.hide();
    }
    
    /**
     * 更新玩家信息到服务器
     */
    private async updatePlayerProfile(name: string, avatar: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000;
            
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
            
            xhr.open('PUT', `${this.SERVER_URL}/player/${encodeURIComponent(this.playerId)}/profile`, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({
                player_name: name,
                player_avatar: avatar
            }));
        });
    }
}
