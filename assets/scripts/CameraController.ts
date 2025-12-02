import { _decorator, Component, Node, Camera, EventTouch, Vec3, input, Input, Vec2, Touch, Sprite, Label, Button, Layout, ScrollView, UITransform } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 相机控制器
 * 实现相机的上下滚动功能，使游戏画面可以随着鼠标移动而展开下面的内容
 */
@ccclass('CameraController')
export class CameraController extends Component {
    @property(Camera)
    camera: Camera = null!;
    
    @property
    scrollSpeed: number = 5; // 滚动速度
    
    @property
    minY: number = -1000; // 相机最低位置
    
    @property
    maxY: number = 0; // 相机最高位置
    
    @property
    worldHeight: number = 2668; // 世界高度，根据设计分辨率设置
    
    @property
    mouseSensitivity: number = 0.5; // 鼠标灵敏度
    
    private startTouchPos: Vec2 = new Vec2();
    private isScrolling: boolean = false;
    private lastCameraY: number = 0;
    
    start() {
        if (!this.camera) {
            this.camera = this.node.getComponent(Camera);
        }
        
        if (!this.camera) {
            console.error('CameraController: Camera component not found!');
            return;
        }
        
        // 保存初始相机位置
        this.lastCameraY = this.node.position.y;
        
        // 设置相机初始位置
        this.node.position = new Vec3(0, 0, this.node.position.z);
        
        // 监听触摸事件
        this.setupTouchEvents();
    }
    
    setupTouchEvents() {
        // 监听触摸开始事件
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        
        // 监听触摸移动事件
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        
        // 监听触摸结束事件
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        
        // 监听触摸取消事件
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        
        // 监听鼠标滚轮事件
        input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }
    
    onTouchStart(event: EventTouch) {
        // 检查点击的是否是UI元素
        const targetNode = event.target as Node;
        if (this.isUIElement(targetNode)) {
            // 如果是UI元素，不启用滚动
            this.isScrolling = false;
            return;
        }
        
        this.isScrolling = true;
        this.startTouchPos = event.getLocation();
    }
    
    onTouchMove(event: EventTouch) {
        if (!this.isScrolling) return;
        
        const currentPos = event.getLocation();
        const delta = currentPos.clone().subtract(this.startTouchPos);
        
        // 根据触摸移动距离调整相机位置，优化长按住拖动体验
        this.adjustCameraPosition(delta.y * this.scrollSpeed * this.mouseSensitivity);
        
        // 更新起始位置，确保平滑拖动
        this.startTouchPos = currentPos;
    }
    
    onTouchEnd(event: EventTouch) {
        this.isScrolling = false;
    }
    
    onMouseWheel(event: any) {
        // 根据鼠标滚轮滚动距离调整相机位置
        const deltaY = event.getScrollY ? event.getScrollY() : event.wheelY;
        this.adjustCameraPosition(-deltaY * this.scrollSpeed * this.mouseSensitivity);
    }
    
    adjustCameraPosition(deltaY: number) {
        // 计算新的相机位置
        let newY = this.node.position.y + deltaY;
        
        // 限制相机位置在minY和maxY之间
        newY = Math.max(this.minY, Math.min(this.maxY, newY));
        
        // 更新相机位置
        this.node.position = new Vec3(this.node.position.x, newY, this.node.position.z);
    }
    
    /**
     * 设置世界高度
     * @param height 世界高度
     */
    setWorldHeight(height: number) {
        this.worldHeight = height;
        // 根据世界高度自动调整minY
        // 使用相机的视口高度或默认值来计算
        const cameraHeight = 1334; // 默认相机高度，与设计分辨率匹配
        this.minY = -height + cameraHeight;
    }
    
    /**
     * 检查节点是否是UI元素
     * @param node 要检查的节点
     * @returns 是否是UI元素
     */
    isUIElement(node: Node | null): boolean {
        if (!node) return false;
        
        // 检查节点名称是否包含UI相关关键字
        const nodeName = node.name.toLowerCase();
        if (nodeName.includes('ui') || nodeName.includes('panel') || nodeName.includes('button') || 
            nodeName.includes('label') || nodeName.includes('menu') || nodeName.includes('popup') ||
            nodeName.includes('healthbar') || nodeName.includes('timer') || nodeName.includes('gold')) {
            return true;
        }
        
        // 检查节点是否有UI组件
        const hasUIComponents = node.getComponent(Sprite) || node.getComponent(Label) || 
                               node.getComponent(Button) || node.getComponent(Layout) || 
                               node.getComponent(ScrollView) || node.getComponent(UITransform);
        if (hasUIComponents) return true;
        
        // 检查父节点
        if (node.parent) {
            return this.isUIElement(node.parent);
        }
        
        return false;
    }
    
    onDestroy() {
        // 移除事件监听
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
    }
}