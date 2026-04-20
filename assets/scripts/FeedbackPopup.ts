import { _decorator, Component, Node, UITransform, view, Graphics, Color, Label, Button, EditBox, find, UIOpacity, tween, sys, ScrollView, Mask, director } from 'cc';
const { ccclass } = _decorator;

// 引入 GamePopup 用于显示经验获得提示
import { GamePopup } from './GamePopup';

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
    private readonly API_CREATE = '/api/analytics/feedback/create';
    private readonly API_LIST = '/api/analytics/feedback/list';
    private readonly API_VOTE = '/api/analytics/feedback/vote';
    private readonly API_COMMENT = '/api/analytics/feedback/comment';
    private readonly API_COMMENTS = (id: number) => `/api/analytics/feedback/${id}/comments`;

    private playerId: string = '';

    // 经验奖励配置
    private readonly FEEDBACK_SUBMIT_EXP = 2000; // 提交反馈/评论经验
    private readonly FEEDBACK_VOTE_EXP = 200; // 投票经验

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
        const ebBg = ebNode.addComponent(Graphics);
        ebBg.fillColor = new Color(30, 30, 45, 220);
        ebBg.roundRect(-(w - 180) / 2, -45, w - 180, 90, 8);
        ebBg.fill();
        const eb = ebNode.addComponent(EditBox);
        eb.placeholder = '';
        eb.maxLength = 2000;
        eb.inputMode = EditBox.InputMode.ANY;
        eb.returnType = EditBox.KeyboardReturnType.DONE;
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

        (eb as any).textLabel = textLabel;
        (eb as any).placeholderLabel = phLabel;
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
        svTr.setContentSize(w - 40, h - 380);
        svNode.setPosition(0, -20, 0);

        const viewNode = new Node('View');
        viewNode.setParent(svNode);
        const viewTr = viewNode.addComponent(UITransform);
        viewTr.setContentSize(w - 40, h - 380);
        viewNode.addComponent(Mask);
        const viewBg = viewNode.addComponent(Graphics);
        viewBg.fillColor = new Color(0, 0, 0, 0);
        viewBg.rect(-(w - 40) / 2, -(h - 380) / 2, w - 40, h - 380);
        viewBg.fill();

        const contentNode = new Node('Content');
        contentNode.setParent(viewNode);
        const listTr = contentNode.addComponent(UITransform);
        listTr.setContentSize(w - 40, h - 380);
        contentNode.setPosition(0, 0, 0);
        this.listContent = contentNode;

        const sv = svNode.addComponent(ScrollView);
        sv.content = contentNode;
        sv.horizontal = false;
        sv.vertical = true;
        this.scrollView = sv;

        // 玩家 ID
        try {
            this.playerId = sys.localStorage.getItem('player_id') || '';
        } catch (e) {
            this.playerId = '';
        }

        // 底部经验提示文字
        const tipNode = new Node('ExpTip');
        tipNode.setParent(this.content);
        const tipTr = tipNode.addComponent(UITransform);
        tipTr.setContentSize(w, 50);
        tipNode.setPosition(0, -h / 2 + 35, 0);
        const tipLabel = tipNode.addComponent(Label);
        tipLabel.string = '提交反馈信息或者评论增加 2000 经验；表达意见增加 200 经验；';
        tipLabel.fontSize = 16;
        tipLabel.color = new Color(255, 215, 0, 255);
        tipLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        tipLabel.verticalAlign = Label.VerticalAlign.CENTER;
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

    // 获取今日日期字符串
    private getTodayStr(): string {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    }

    // 检查是否已领取提交反馈/评论的每日经验奖励
    private hasClaimedSubmitExpToday(): boolean {
        const today = this.getTodayStr();
        const claimed = sys.localStorage.getItem('feedback_submit_exp_date');
        return claimed === today;
    }

    // 领取提交反馈/评论的每日经验奖励
    private claimSubmitExp(): boolean {
        if (this.hasClaimedSubmitExpToday()) {
            return false;
        }
        const today = this.getTodayStr();
        sys.localStorage.setItem('feedback_submit_exp_date', today);
        return true;
    }

    // 检查是否已领取某条反馈的投票每日经验奖励
    private hasClaimedVoteExpToday(feedbackId: number): boolean {
        const today = this.getTodayStr();
        const claimed = sys.localStorage.getItem(`feedback_vote_exp_${feedbackId}`);
        return claimed === today;
    }

    // 领取某条反馈的投票每日经验奖励
    private claimVoteExp(feedbackId: number): boolean {
        if (this.hasClaimedVoteExpToday(feedbackId)) {
            return false;
        }
        const today = this.getTodayStr();
        sys.localStorage.setItem(`feedback_vote_exp_${feedbackId}`, today);
        return true;
    }

    // 发放经验
    private giveExp(amount: number) {
        const gm = this.findGameManager();
        if (gm && typeof gm.addExperience === 'function') {
            gm.addExperience(amount);
        }
        // 显示经验获得提示（无论是否找到 GameManager 都显示提示）
        GamePopup.showMessage(`获得 ${amount} 点经验值`, true, 1.5);
    }

    // 查找 GameManager
    private findGameManager(): any {
        const scene = director.getScene();
        if (!scene) return null;
        const gmNode = scene.getChildByName('GameManager');
        if (!gmNode) return null;
        return gmNode.getComponent('GameManager');
    }

    private async onSubmitFeedback() {
        if (!this.playerId) return;
        const text = (this.inputBox?.string || '').trim();
        if (!text) return;
        (this.submitBtn as any).interactable = false;
        try {
            await this.postJson(this.API_CREATE, { playerId: this.playerId, content: text });
            this.inputBox.string = '';

            // 发放提交反馈经验奖励（每天首次 2000 经验）
            if (this.claimSubmitExp()) {
                this.giveExp(this.FEEDBACK_SUBMIT_EXP);
            }

            await this.refreshList();
        } catch (e) {
            // ignore
        } finally {
            (this.submitBtn as any).interactable = true;
        }
    }

    private async onSubmitComment() {
        if (!this.playerId || !this.currentFeedbackId) return;
        const text = (this.commentInput?.string || '').trim();
        if (!text) return;
        if (this.commentSubmit) (this.commentSubmit as any).interactable = false;
        try {
            await this.postJson(this.API_COMMENT, { playerId: this.playerId, feedbackId: this.currentFeedbackId, content: text });
            if (this.commentInput) this.commentInput.string = '';

            // 发放提交评论经验奖励（每天首次 2000 经验）
            if (this.claimSubmitExp()) {
                this.giveExp(this.FEEDBACK_SUBMIT_EXP);
            }

            await this.refreshComments();
        } catch (e) {
            // ignore
        } finally {
            if (this.commentSubmit) (this.commentSubmit as any).interactable = true;
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
        const children = [...this.listContent.children];
        for (const c of children) {
            if (c && c.isValid) c.destroy();
        }

        const w = this.listContent.getComponent(UITransform)?.width || 600;
        const viewH = this.scrollView?.view?.getComponent(UITransform)?.height || 400;
        const itemW = w - 20;
        const itemH = 140;
        const gap = 16;

        const contentH = Math.max((itemH + gap) * items.length + 40, viewH);
        this.listContent.getComponent(UITransform)?.setContentSize(w, contentH);
        this.listContent.setPosition(0, (viewH - contentH) / 2, 0);

        let y = contentH / 2 - itemH / 2 - 20;
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

            const agreeBtn = this.createSmallBtn(itemNode, '赞同', -itemW / 2 + 70, -itemH / 2 + 28, new Color(80, 180, 80, 255));
            agreeBtn.node.on(Button.EventType.CLICK, () => this.vote(it.id, 'agree'), this);
            const agreeCnt = this.createSmallLabel(itemNode, `${it.agree_count || 0}`, -itemW / 2 + 130, -itemH / 2 + 28);

            const disBtn = this.createSmallBtn(itemNode, '不赞同', -itemW / 2 + 240, -itemH / 2 + 28, new Color(180, 80, 80, 255));
            disBtn.node.on(Button.EventType.CLICK, () => this.vote(it.id, 'disagree'), this);
            const disCnt = this.createSmallLabel(itemNode, `${it.disagree_count || 0}`, -itemW / 2 + 320, -itemH / 2 + 28);

            itemNode.addComponent(Button);
            itemNode.on(Button.EventType.CLICK, () => this.openComments(it.id), this);

            agreeCnt.string = `${it.agree_count || 0}`;
            disCnt.string = `${it.disagree_count || 0}`;
        }
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

            // 发放投票经验奖励（每条反馈每天首次 200 经验）
            if (this.claimVoteExp(feedbackId)) {
                this.giveExp(this.FEEDBACK_VOTE_EXP);
            }

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
        const ebBg = ebNode.addComponent(Graphics);
        ebBg.fillColor = new Color(30, 30, 45, 220);
        ebBg.roundRect(-(w - 180) / 2, -40, w - 180, 80, 8);
        ebBg.fill();
        const eb = ebNode.addComponent(EditBox);
        eb.placeholder = '写下你的评论...';
        eb.maxLength = 2000;
        eb.inputMode = EditBox.InputMode.ANY;
        eb.returnType = EditBox.KeyboardReturnType.DONE;
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
        contentNode.setPosition(0, 0, 0);

        const sv = svNode.addComponent(ScrollView);
        sv.content = contentNode;
        sv.horizontal = false;
        sv.vertical = true;
        this.commentsScroll = sv;
        this.commentsList = contentNode;

        this.commentsPage = page;
        page.active = false;
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

        const viewH = this.commentsScroll?.view?.getComponent(UITransform)?.height || 400;
        const contentH = Math.max((baseH + gap) * items.length + 40, viewH);
        this.commentsList.getComponent(UITransform)?.setContentSize(w, contentH);
        this.commentsList.setPosition(0, (viewH - contentH) / 2, 0);

        let y = contentH / 2 - baseH / 2 - 20;

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
