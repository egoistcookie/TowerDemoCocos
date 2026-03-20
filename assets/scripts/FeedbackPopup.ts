import { _decorator, Component, Node, UITransform, view, Graphics, Color, Label, Button, EditBox, find, UIOpacity, tween, sys, ScrollView, Mask, LabelOutline } from 'cc';
const { ccclass } = _decorator;

type VoteType = 'agree' | 'disagree';

interface FeedbackItem {
    id: number;
    player_id: string;
    content: string;
    agree_count: number;
    disagree_count: number;
    created_at: string;
}

interface CommentItem {
    id: number;
    feedback_id: number;
    player_id: string;
    content: string;
    created_at: string;
}

@ccclass('FeedbackPopup')
export class FeedbackPopup extends Component {
    private static instance: FeedbackPopup | null = null;

    private readonly BASE_URL = 'https://www.egoistcookie.top';
    // 走 /api/analytics 前缀：线上通常只放行该路由段（避免 /api/feedback 被网关拦截 403）
    private readonly API_CREATE = '/api/analytics/feedback/create';
    private readonly API_LIST = '/api/analytics/feedback/list';
    private readonly API_VOTE = '/api/analytics/feedback/vote';
    private readonly API_COMMENT = '/api/analytics/feedback/comment';
    private readonly API_COMMENTS = (id: number) => `/api/analytics/feedback/${id}/comments`;

    private playerId: string = '';

    private root: Node = null!;
    private content: Node = null!;
    private inputBox: EditBox = null!;
    private submitBtn: Button = null!;
    private scrollView: ScrollView = null!;
    private listContent: Node = null!;

    // 评论子页
    private commentsPage: Node | null = null;
    private commentsScroll: ScrollView | null = null;
    private commentsList: Node | null = null;
    private commentInput: EditBox | null = null;
    private commentSubmit: Button | null = null;
    private currentFeedbackId: number = 0;

    public static show() {
        const canvas = find('Canvas');
        if (!canvas) return;

        if (FeedbackPopup.instance && FeedbackPopup.instance.node && FeedbackPopup.instance.node.isValid) {
            FeedbackPopup.instance.node.active = true;
            FeedbackPopup.instance.fadeIn();
            FeedbackPopup.instance.refreshList();
            return;
        }

        const node = new Node('FeedbackPopup');
        node.setParent(canvas);
        node.setSiblingIndex(Number.MAX_SAFE_INTEGER);
        const comp = node.addComponent(FeedbackPopup);
        FeedbackPopup.instance = comp;
        comp.buildUI();
        comp.fadeIn();
        comp.refreshList();
    }

    private buildUI() {
        this.root = this.node;
        const vs = view.getVisibleSize();
        const tr = this.root.addComponent(UITransform);
        tr.setContentSize(vs.width, vs.height);
        this.root.setPosition(0, 0, 0);

        // 背景遮罩
        const maskNode = new Node('Mask');
        maskNode.setParent(this.root);
        const maskTr = maskNode.addComponent(UITransform);
        maskTr.setContentSize(vs.width, vs.height);
        const g = maskNode.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 180);
        g.rect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
        g.fill();
        maskNode.on(Node.EventType.TOUCH_START, () => this.hide(), this);

        // 内容容器
        this.content = new Node('Content');
        this.content.setParent(this.root);
        const cTr = this.content.addComponent(UITransform);
        const w = Math.min(700, vs.width * 0.92);
        const h = Math.min(980, vs.height * 0.92);
        cTr.setContentSize(w, h);
        this.content.setPosition(0, 0, 0);

        const bg = this.content.addComponent(Graphics);
        bg.fillColor = new Color(40, 40, 60, 240);
        bg.roundRect(-w / 2, -h / 2, w, h, 12);
        bg.fill();
        bg.strokeColor = new Color(255, 215, 0, 255);
        bg.lineWidth = 2;
        bg.roundRect(-w / 2, -h / 2, w, h, 12);
        bg.stroke();

        // 标题
        const titleNode = new Node('Title');
        titleNode.setParent(this.content);
        const titleTr = titleNode.addComponent(UITransform);
        titleTr.setContentSize(w, 60);
        titleNode.setPosition(0, h / 2 - 40, 0);
        const title = titleNode.addComponent(Label);
        title.string = '玩家反馈';
        title.fontSize = 28;
        title.color = new Color(255, 255, 255, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;

        // 关闭按钮
        const closeNode = new Node('Close');
        closeNode.setParent(this.content);
        const closeTr = closeNode.addComponent(UITransform);
        closeTr.setContentSize(80, 50);
        closeNode.setPosition(w / 2 - 60, h / 2 - 40, 0);
        const closeBg = closeNode.addComponent(Graphics);
        closeBg.fillColor = new Color(180, 80, 80, 255);
        closeBg.roundRect(-40, -20, 80, 40, 8);
        closeBg.fill();
        const closeBtn = closeNode.addComponent(Button);
        const closeLblNode = new Node('Label');
        closeLblNode.setParent(closeNode);
        closeLblNode.addComponent(UITransform).setContentSize(80, 40);
        const closeLbl = closeLblNode.addComponent(Label);
        closeLbl.string = '关闭';
        closeLbl.fontSize = 18;
        closeLbl.color = new Color(255, 255, 255, 255);
        closeLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        closeLbl.verticalAlign = Label.VerticalAlign.CENTER;
        closeBtn.node.on(Button.EventType.CLICK, () => this.hide(), this);

        // 输入框区域
        const inputWrap = new Node('InputWrap');
        inputWrap.setParent(this.content);
        const iwTr = inputWrap.addComponent(UITransform);
        iwTr.setContentSize(w - 40, 120);
        inputWrap.setPosition(0, h / 2 - 140, 0);
        const iwBg = inputWrap.addComponent(Graphics);
        iwBg.fillColor = new Color(60, 60, 80, 220);
        iwBg.roundRect(-(w - 40) / 2, -60, w - 40, 120, 10);
        iwBg.fill();

        // EditBox
        const ebNode = new Node('FeedbackEditBox');
        ebNode.setParent(inputWrap);
        const ebTr = ebNode.addComponent(UITransform);
        ebTr.setContentSize(w - 180, 90);
        ebNode.setPosition(-(w - 40) / 2 + (w - 180) / 2 + 10, 0, 0);
        // 输入框背景
        const ebBg = ebNode.addComponent(Graphics);
        ebBg.fillColor = new Color(30, 30, 45, 220);
        ebBg.roundRect(-(w - 180) / 2, -45, w - 180, 90, 8);
        ebBg.fill();
        const eb = ebNode.addComponent(EditBox);
        eb.placeholder = '';
        eb.maxLength = 2000;
        eb.inputMode = EditBox.InputMode.ANY;
        eb.returnType = EditBox.KeyboardReturnType.DONE;
        // 绑定文字/占位符Label，避免默认字体过大与溢出
        const textNode = new Node('TextLabel');
        textNode.setParent(ebNode);
        textNode.setPosition(0, 0, 0);
        textNode.addComponent(UITransform).setContentSize(w - 200, 86);
        const textLabel = textNode.addComponent(Label);
        textLabel.string = '';
        textLabel.fontSize = 18;
        textLabel.lineHeight = 20;
        textLabel.color = new Color(255, 255, 255, 255);
        textLabel.enableWrapText = true;
        textLabel.overflow = Label.Overflow.CLAMP;
        textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        textLabel.verticalAlign = Label.VerticalAlign.TOP;

        const phNode = new Node('PlaceholderLabel');
        phNode.setParent(ebNode);
        phNode.setPosition(0, 0, 0);
        phNode.addComponent(UITransform).setContentSize(w - 200, 86);
        const phLabel = phNode.addComponent(Label);
        phLabel.string = eb.placeholder || '';
        phLabel.fontSize = 18;
        phLabel.lineHeight = 20;
        phLabel.color = new Color(200, 200, 200, 255);
        phLabel.enableWrapText = true;
        phLabel.overflow = Label.Overflow.CLAMP;
        phLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        phLabel.verticalAlign = Label.VerticalAlign.TOP;

        // 兼容：EditBox 的 textLabel/placeholderLabel 在类型上可能不暴露，用 any 赋值
        (eb as any).textLabel = textLabel;
        (eb as any).placeholderLabel = phLabel;
        // 清空 EditBox 自带 placeholder，避免原生输入层/默认实现再渲染一份“飘在外面”的占位文字
        eb.placeholder = '';
        this.inputBox = eb;

        // 提交按钮
        const submitNode = new Node('Submit');
        submitNode.setParent(inputWrap);
        submitNode.addComponent(UITransform).setContentSize(120, 60);
        submitNode.setPosition((w - 40) / 2 - 70, -25, 0);
        const sbg = submitNode.addComponent(Graphics);
        sbg.fillColor = new Color(80, 160, 255, 255);
        sbg.roundRect(-60, -25, 120, 50, 10);
        sbg.fill();
        const sbtn = submitNode.addComponent(Button);
        const sl = new Node('Label');
        sl.setParent(submitNode);
        sl.addComponent(UITransform).setContentSize(120, 50);
        const slb = sl.addComponent(Label);
        slb.string = '提交';
        slb.fontSize = 20;
        slb.color = new Color(255, 255, 255, 255);
        slb.horizontalAlign = Label.HorizontalAlign.CENTER;
        slb.verticalAlign = Label.VerticalAlign.CENTER;
        this.submitBtn = sbtn;
        sbtn.node.on(Button.EventType.CLICK, () => this.onSubmitFeedback(), this);

        // 列表 ScrollView
        const svNode = new Node('FeedbackScrollView');
        svNode.setParent(this.content);
        const svTr = svNode.addComponent(UITransform);
        svTr.setContentSize(w - 40, h - 300);
        svNode.setPosition(0, -60, 0);

        // view
        const viewNode = new Node('View');
        viewNode.setParent(svNode);
        const viewTr = viewNode.addComponent(UITransform);
        viewTr.setContentSize(w - 40, h - 300);
        viewNode.addComponent(Mask); // 裁剪
        const viewBg = viewNode.addComponent(Graphics);
        viewBg.fillColor = new Color(0, 0, 0, 0);
        viewBg.rect(-(w - 40) / 2, -(h - 300) / 2, w - 40, h - 300);
        viewBg.fill();

        // content
        const contentNode = new Node('Content');
        contentNode.setParent(viewNode);
        const listTr = contentNode.addComponent(UITransform);
        listTr.setContentSize(w - 40, h - 300);
        contentNode.setPosition(0, (h - 300) / 2, 0);
        this.listContent = contentNode;

        const sv = svNode.addComponent(ScrollView);
        sv.content = contentNode;
        // ScrollView.view 在当前引擎版本是只读属性；通过节点层级（ScrollView/View/Content）自动绑定
        sv.horizontal = false;
        sv.vertical = true;
        this.scrollView = sv;

        // 玩家ID
        try {
            this.playerId = sys.localStorage.getItem('player_id') || '';
        } catch (e) {
            this.playerId = '';
        }
    }

    private fadeIn() {
        const op = this.root.getComponent(UIOpacity) || this.root.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.2, { opacity: 255 }).start();
    }

    private hide() {
        if (this.node && this.node.isValid) {
            this.node.active = false;
        }
    }

    private async onSubmitFeedback() {
        if (!this.playerId) return;
        const text = (this.inputBox?.string || '').trim();
        if (!text) return;
        (this.submitBtn as any).interactable = false;
        try {
            await this.postJson(this.API_CREATE, { playerId: this.playerId, content: text });
            this.inputBox.string = '';
            await this.refreshList();
        } catch (e) {
            // ignore
        } finally {
            (this.submitBtn as any).interactable = true;
        }
    }

    private async refreshList() {
        try {
            const resp = await this.getJson(this.API_LIST);
            const arr: FeedbackItem[] = resp && resp.data ? resp.data : [];
            this.renderList(arr);
        } catch (e) {
            this.renderList([]);
        }
    }

    private renderList(items: FeedbackItem[]) {
        if (!this.listContent || !this.listContent.isValid) return;
        // 清空
        const children = [...this.listContent.children];
        for (const c of children) {
            if (c && c.isValid) c.destroy();
        }

        const w = this.listContent.getComponent(UITransform)?.width || 600;
        const itemW = w - 20;
        const itemH = 140;
        const gap = 16;

        let y = -20;
        for (const it of items) {
            const itemNode = new Node(`Feedback_${it.id}`);
            itemNode.setParent(this.listContent);
            itemNode.addComponent(UITransform).setContentSize(itemW, itemH);
            itemNode.setPosition(0, y, 0);
            y -= (itemH + gap);

            const bg = itemNode.addComponent(Graphics);
            bg.fillColor = new Color(60, 60, 80, 220);
            bg.roundRect(-itemW / 2, -itemH / 2, itemW, itemH, 10);
            bg.fill();
            bg.strokeColor = new Color(120, 120, 160, 180);
            bg.lineWidth = 2;
            bg.roundRect(-itemW / 2, -itemH / 2, itemW, itemH, 10);
            bg.stroke();

            // 内容
            const textNode = new Node('Text');
            textNode.setParent(itemNode);
            textNode.addComponent(UITransform).setContentSize(itemW - 20, 80);
            textNode.setPosition(0, 20, 0);
            const lb = textNode.addComponent(Label);
            lb.string = it.content;
            lb.fontSize = 18;
            lb.color = new Color(255, 255, 255, 255);
            lb.horizontalAlign = Label.HorizontalAlign.LEFT;
            lb.verticalAlign = Label.VerticalAlign.TOP;
            lb.enableWrapText = true;
            lb.overflow = Label.Overflow.RESIZE_HEIGHT;

            // 赞同按钮
            const agreeBtn = this.createSmallBtn(itemNode, '赞同', -itemW / 2 + 70, -itemH / 2 + 28, new Color(80, 180, 80, 255));
            agreeBtn.node.on(Button.EventType.CLICK, () => this.vote(it.id, 'agree'), this);
            const agreeCnt = this.createSmallLabel(itemNode, `${it.agree_count || 0}`, -itemW / 2 + 130, -itemH / 2 + 28);

            // 不赞同按钮
            const disBtn = this.createSmallBtn(itemNode, '不赞同', -itemW / 2 + 240, -itemH / 2 + 28, new Color(180, 80, 80, 255));
            disBtn.node.on(Button.EventType.CLICK, () => this.vote(it.id, 'disagree'), this);
            const disCnt = this.createSmallLabel(itemNode, `${it.disagree_count || 0}`, -itemW / 2 + 320, -itemH / 2 + 28);

            // 点击整条打开评论页
            itemNode.addComponent(Button);
            itemNode.on(Button.EventType.CLICK, () => this.openComments(it.id), this);

            // 避免计数 label 被销毁未用（占位）
            agreeCnt.string = `${it.agree_count || 0}`;
            disCnt.string = `${it.disagree_count || 0}`;
        }

        // 更新 content 高度
        const totalH = Math.max((itemH + gap) * items.length + 40, this.scrollView.view.getComponent(UITransform)?.height || 400);
        this.listContent.getComponent(UITransform)?.setContentSize(w, totalH);
        this.listContent.setPosition(0, totalH / 2, 0);
    }

    private createSmallBtn(parent: Node, text: string, x: number, y: number, color: Color): Button {
        const n = new Node(`Btn_${text}`);
        n.setParent(parent);
        n.addComponent(UITransform).setContentSize(120, 40);
        n.setPosition(x, y, 0);
        const g = n.addComponent(Graphics);
        g.fillColor = color;
        g.roundRect(-60, -18, 120, 36, 8);
        g.fill();
        const b = n.addComponent(Button);
        const l = new Node('Label');
        l.setParent(n);
        l.addComponent(UITransform).setContentSize(120, 36);
        const lb = l.addComponent(Label);
        lb.string = text;
        lb.fontSize = 16;
        lb.color = new Color(255, 255, 255, 255);
        lb.horizontalAlign = Label.HorizontalAlign.CENTER;
        lb.verticalAlign = Label.VerticalAlign.CENTER;
        return b;
    }

    private createSmallLabel(parent: Node, text: string, x: number, y: number): Label {
        const n = new Node('Count');
        n.setParent(parent);
        n.addComponent(UITransform).setContentSize(60, 40);
        n.setPosition(x, y, 0);
        const lb = n.addComponent(Label);
        lb.string = text;
        lb.fontSize = 16;
        lb.color = new Color(255, 255, 255, 255);
        lb.horizontalAlign = Label.HorizontalAlign.LEFT;
        lb.verticalAlign = Label.VerticalAlign.CENTER;
        return lb;
    }

    private async vote(feedbackId: number, vote: VoteType) {
        if (!this.playerId) return;
        try {
            await this.postJson(this.API_VOTE, { playerId: this.playerId, feedbackId, vote });
            await this.refreshList();
        } catch (e) {
            // ignore
        }
    }

    private openComments(feedbackId: number) {
        this.currentFeedbackId = feedbackId;
        if (!this.commentsPage || !this.commentsPage.isValid) {
            this.buildCommentsPage();
        }
        if (this.commentsPage) {
            this.commentsPage.active = true;
            this.refreshComments();
        }
    }

    private buildCommentsPage() {
        const vs = view.getVisibleSize();
        const w = this.content.getComponent(UITransform)?.width || 700;
        const h = this.content.getComponent(UITransform)?.height || 900;

        const page = new Node('CommentsPage');
        page.setParent(this.content);
        page.addComponent(UITransform).setContentSize(w, h);
        page.setPosition(0, 0, 0);

        const bg = page.addComponent(Graphics);
        bg.fillColor = new Color(30, 30, 45, 250);
        bg.roundRect(-w / 2, -h / 2, w, h, 12);
        bg.fill();

        // 标题
        const titleNode = new Node('CTitle');
        titleNode.setParent(page);
        titleNode.addComponent(UITransform).setContentSize(w, 60);
        titleNode.setPosition(0, h / 2 - 40, 0);
        const title = titleNode.addComponent(Label);
        title.string = '评论区';
        title.fontSize = 26;
        title.color = new Color(255, 255, 255, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;

        // 返回
        const backNode = new Node('Back');
        backNode.setParent(page);
        backNode.addComponent(UITransform).setContentSize(90, 50);
        backNode.setPosition(-w / 2 + 70, h / 2 - 40, 0);
        const backBg = backNode.addComponent(Graphics);
        backBg.fillColor = new Color(100, 100, 120, 255);
        backBg.roundRect(-45, -20, 90, 40, 8);
        backBg.fill();
        const backBtn = backNode.addComponent(Button);
        const backLblNode = new Node('Label');
        backLblNode.setParent(backNode);
        backLblNode.addComponent(UITransform).setContentSize(90, 40);
        const backLbl = backLblNode.addComponent(Label);
        backLbl.string = '返回';
        backLbl.fontSize = 18;
        backLbl.color = new Color(255, 255, 255, 255);
        backLbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        backLbl.verticalAlign = Label.VerticalAlign.CENTER;
        backBtn.node.on(Button.EventType.CLICK, () => {
            if (page && page.isValid) page.active = false;
        }, this);

        // 输入
        const inputWrap = new Node('CInputWrap');
        inputWrap.setParent(page);
        inputWrap.addComponent(UITransform).setContentSize(w - 40, 110);
        inputWrap.setPosition(0, h / 2 - 150, 0);
        const iwBg = inputWrap.addComponent(Graphics);
        iwBg.fillColor = new Color(60, 60, 80, 220);
        iwBg.roundRect(-(w - 40) / 2, -55, w - 40, 110, 10);
        iwBg.fill();

        const ebNode = new Node('CommentEditBox');
        ebNode.setParent(inputWrap);
        ebNode.addComponent(UITransform).setContentSize(w - 180, 80);
        ebNode.setPosition(-(w - 40) / 2 + (w - 180) / 2 + 10, 0, 0);
        // 输入框背景
        const ebBg = ebNode.addComponent(Graphics);
        ebBg.fillColor = new Color(30, 30, 45, 220);
        ebBg.roundRect(-(w - 180) / 2, -40, w - 180, 80, 8);
        ebBg.fill();
        const eb = ebNode.addComponent(EditBox);
        eb.placeholder = '';
        eb.maxLength = 2000;
        eb.inputMode = EditBox.InputMode.ANY;
        eb.returnType = EditBox.KeyboardReturnType.DONE;
        // 绑定文字/占位符Label
        const textNode = new Node('TextLabel');
        textNode.setParent(ebNode);
        textNode.setPosition(0, 0, 0);
        textNode.addComponent(UITransform).setContentSize(w - 200, 76);
        const textLabel = textNode.addComponent(Label);
        textLabel.string = '';
        textLabel.fontSize = 18;
        textLabel.lineHeight = 20;
        textLabel.color = new Color(255, 255, 255, 255);
        textLabel.enableWrapText = true;
        textLabel.overflow = Label.Overflow.CLAMP;
        textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        textLabel.verticalAlign = Label.VerticalAlign.TOP;

        const phNode = new Node('PlaceholderLabel');
        phNode.setParent(ebNode);
        phNode.setPosition(0, 0, 0);
        phNode.addComponent(UITransform).setContentSize(w - 200, 76);
        const phLabel = phNode.addComponent(Label);
        phLabel.string = eb.placeholder || '';
        phLabel.fontSize = 18;
        phLabel.lineHeight = 20;
        phLabel.color = new Color(200, 200, 200, 255);
        phLabel.enableWrapText = true;
        phLabel.overflow = Label.Overflow.CLAMP;
        phLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        phLabel.verticalAlign = Label.VerticalAlign.TOP;

        (eb as any).textLabel = textLabel;
        (eb as any).placeholderLabel = phLabel;
        // 清空 EditBox 自带 placeholder，避免默认占位文字重复渲染
        eb.placeholder = '';
        this.commentInput = eb;

        const submitNode = new Node('CSubmit');
        submitNode.setParent(inputWrap);
        submitNode.addComponent(UITransform).setContentSize(120, 60);
        submitNode.setPosition((w - 40) / 2 - 70, -20, 0);
        const sbg = submitNode.addComponent(Graphics);
        sbg.fillColor = new Color(80, 160, 255, 255);
        sbg.roundRect(-60, -25, 120, 50, 10);
        sbg.fill();
        const btn = submitNode.addComponent(Button);
        const lblNode = new Node('Label');
        lblNode.setParent(submitNode);
        lblNode.addComponent(UITransform).setContentSize(120, 50);
        const lbl = lblNode.addComponent(Label);
        lbl.string = '提交';
        lbl.fontSize = 20;
        lbl.color = new Color(255, 255, 255, 255);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        this.commentSubmit = btn;
        btn.node.on(Button.EventType.CLICK, () => this.onSubmitComment(), this);

        // 评论列表 ScrollView
        const svNode = new Node('CScrollView');
        svNode.setParent(page);
        svNode.addComponent(UITransform).setContentSize(w - 40, h - 300);
        svNode.setPosition(0, -60, 0);

        const viewNode = new Node('View');
        viewNode.setParent(svNode);
        viewNode.addComponent(UITransform).setContentSize(w - 40, h - 300);
        viewNode.addComponent(Mask);
        const viewBg = viewNode.addComponent(Graphics);
        viewBg.fillColor = new Color(0, 0, 0, 0);
        viewBg.rect(-(w - 40) / 2, -(h - 300) / 2, w - 40, h - 300);
        viewBg.fill();

        const contentNode = new Node('Content');
        contentNode.setParent(viewNode);
        contentNode.addComponent(UITransform).setContentSize(w - 40, h - 300);
        contentNode.setPosition(0, (h - 300) / 2, 0);

        const sv = svNode.addComponent(ScrollView);
        sv.content = contentNode;
        // ScrollView.view 在当前引擎版本是只读属性；通过节点层级（ScrollView/View/Content）自动绑定
        sv.horizontal = false;
        sv.vertical = true;
        this.commentsScroll = sv;
        this.commentsList = contentNode;

        this.commentsPage = page;
        page.active = false;
    }

    private async onSubmitComment() {
        if (!this.playerId || !this.currentFeedbackId) return;
        const text = (this.commentInput?.string || '').trim();
        if (!text) return;
        if (this.commentSubmit) (this.commentSubmit as any).interactable = false;
        try {
            await this.postJson(this.API_COMMENT, { playerId: this.playerId, feedbackId: this.currentFeedbackId, content: text });
            if (this.commentInput) this.commentInput.string = '';
            await this.refreshComments();
        } catch (e) {
            // ignore
        } finally {
            if (this.commentSubmit) (this.commentSubmit as any).interactable = true;
        }
    }

    private async refreshComments() {
        if (!this.currentFeedbackId || !this.commentsList) return;
        try {
            const resp = await this.getJson(this.API_COMMENTS(this.currentFeedbackId));
            const arr: CommentItem[] = resp && resp.data ? resp.data : [];
            this.renderComments(arr);
        } catch (e) {
            this.renderComments([]);
        }
    }

    private renderComments(items: CommentItem[]) {
        if (!this.commentsList || !this.commentsList.isValid || !this.commentsScroll) return;
        const children = [...this.commentsList.children];
        for (const c of children) {
            if (c && c.isValid) c.destroy();
        }

        const w = this.commentsList.getComponent(UITransform)?.width || 600;
        const itemW = w - 20;
        const baseH = 90;
        const gap = 12;
        let y = -20;

        for (const it of items) {
            const n = new Node(`C_${it.id}`);
            n.setParent(this.commentsList);
            n.addComponent(UITransform).setContentSize(itemW, baseH);
            n.setPosition(0, y, 0);
            y -= (baseH + gap);

            const bg = n.addComponent(Graphics);
            bg.fillColor = new Color(60, 60, 80, 220);
            bg.roundRect(-itemW / 2, -baseH / 2, itemW, baseH, 10);
            bg.fill();

            const lbNode = new Node('Text');
            lbNode.setParent(n);
            lbNode.addComponent(UITransform).setContentSize(itemW - 20, 70);
            lbNode.setPosition(0, 0, 0);
            const lb = lbNode.addComponent(Label);
            lb.string = it.content;
            lb.fontSize = 18;
            lb.color = new Color(255, 255, 255, 255);
            lb.horizontalAlign = Label.HorizontalAlign.LEFT;
            lb.verticalAlign = Label.VerticalAlign.TOP;
            lb.enableWrapText = true;
            lb.overflow = Label.Overflow.RESIZE_HEIGHT;
        }

        const viewH = this.commentsScroll.view.getComponent(UITransform)?.height || 400;
        const totalH = Math.max((baseH + gap) * items.length + 40, viewH);
        this.commentsList.getComponent(UITransform)?.setContentSize(w, totalH);
        this.commentsList.setPosition(0, totalH / 2, 0);
    }

    private async getJson(path: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000;
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
                        } catch (e) {
                            resolve({});
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                }
            };
            xhr.onerror = () => reject(new Error('network error'));
            xhr.ontimeout = () => reject(new Error('timeout'));
            xhr.open('GET', `${this.BASE_URL}${path}`, true);
            xhr.send();
        });
    }

    private async postJson(path: string, data: any): Promise<any> {
        const jsonData = JSON.stringify(data);
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000;
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
                        } catch (e) {
                            resolve({});
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                }
            };
            xhr.onerror = () => reject(new Error('network error'));
            xhr.ontimeout = () => reject(new Error('timeout'));
            xhr.open('POST', `${this.BASE_URL}${path}`, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(jsonData);
        });
    }
}

