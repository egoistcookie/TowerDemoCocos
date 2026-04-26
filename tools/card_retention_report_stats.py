#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
固定口径统计脚本：抽卡与粘性报告

用法示例：
python tools/card_retention_report_stats.py --start "2026-04-18 00:00:00" --end "2026-04-26 23:59:59"
"""

import argparse
import base64
import collections
import json
import os
import subprocess
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Tuple

import pymysql


DEFAULT_EXCLUDED_PLAYERS = [
    "player_1772462826043_800",
    "player_1772466497770_5671",
    "player_1772530937065_3381",
    "player_1772722064044_978",
    "player_1772465771074_4106",
]

TRACKING_CUTOFF = "2026-04-22 23:29:27"
VERSIONS = [
    ("1.0.72", "2026-04-22 23:29:27"),
    ("1.0.73", "2026-04-24 07:59:02"),
    ("1.0.74", "2026-04-24 23:19:11"),
    ("1.0.75", "2026-04-25 11:32:42"),
    ("1.0.76", "2026-04-25 18:34:25"),
    ("1.0.77", "2026-04-26 11:06:02"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="抽卡与粘性固定口径统计脚本")
    parser.add_argument("--host", default=os.getenv("ANALYTICS_DB_HOST", "www.egoistcookie.top"))
    parser.add_argument("--port", type=int, default=int(os.getenv("ANALYTICS_DB_PORT", "3306")))
    parser.add_argument("--user", default=os.getenv("ANALYTICS_DB_USER", "tower_game_user"))
    parser.add_argument("--password", default=os.getenv("ANALYTICS_DB_PASSWORD", "TowerGame@2026!"))
    parser.add_argument("--database", default=os.getenv("ANALYTICS_DB_NAME", "tower_defense_analytics"))
    parser.add_argument("--start", default="", help="统计开始时间，例如 2026-04-18 00:00:00")
    parser.add_argument("--end", default="", help="统计结束时间，例如 2026-04-26 23:59:59")
    parser.add_argument("--output", default="", help="输出 JSON 文件路径（可选）")
    parser.add_argument("--md-output", default="", help="输出 Markdown 报告路径（可选）")
    parser.add_argument("--fetch-prompt-from-github", action="store_true", help="从 GitHub 仓库读取工程提示词.md")
    parser.add_argument("--github-owner", default="", help="GitHub 仓库 owner")
    parser.add_argument("--github-repo", default="", help="GitHub 仓库 repo")
    parser.add_argument("--github-ref", default="", help="GitHub 分支或提交，默认自动识别远程默认分支")
    parser.add_argument("--github-path", default="工程提示词.md", help="仓库内文件路径，默认 工程提示词.md")
    parser.add_argument("--github-token", default=os.getenv("GITHUB_TOKEN", ""), help="GitHub Token，建议用环境变量 GITHUB_TOKEN")
    parser.add_argument("--github-output", default="", help="拉取后的本地保存路径（可选）")
    return parser.parse_args()


def _pct(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator * 100.0 / denominator, 2)


def _safe_int(row: Dict[str, Any], key: str) -> int:
    return int(row.get(key, 0) or 0)


def _safe_float(row: Dict[str, Any], key: str) -> float:
    return float(row.get(key, 0.0) or 0.0)


def build_markdown_report(stats: Dict[str, Any], report_time_str: str) -> str:
    meta = stats.get("meta", {})
    overall = (stats.get("overall_comparable") or [{}])[0]
    prev_compare = stats.get("previous_report_period_compare", [])
    recent5_daily = stats.get("recent5_daily", [])
    recent5_impact = stats.get("recent5_version_impact", [])
    funnel = (stats.get("post_0422_funnel") or [{}])[0]
    daily_top_ops = stats.get("daily_top_operations", {})
    daily_top_cards = stats.get("daily_top_card_selections", {})

    prev_map = {row.get("period"): row for row in prev_compare}
    prev_row = prev_map.get("prev_report_0410_0418", {})
    curr_row = prev_map.get("current_report", {})

    prev_win = _safe_float(prev_row, "win_rate")
    curr_win = _safe_float(curr_row, "win_rate")

    lines: List[str] = []
    lines.append("# 抽卡与粘性深度分析报告（最近两周）")
    lines.append("")
    lines.append("**报告生成时间：** {}  ".format(report_time_str))
    lines.append("**本期分析区间：** {} ~ {}  ".format(meta.get("start", ""), meta.get("end", "")))
    lines.append("**上一期报告区间（用于对比）：** 2026-04-10 00:00:00 ~ 2026-04-18 23:59:59  ")
    lines.append("**数据源：** `tower_defense_analytics`（`game_sessions`、`card_selection_events`、`visitor_source_records`）")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 一、核心结论")
    lines.append("")
    lines.append("- 与上一份报告相比（统一可比口径：至少一抽 + 正常结束），本期胜率为 `{:.2f}%`，上一期为 `{:.2f}%`，变化 `{:+.2f}pp`。  ".format(curr_win, prev_win, curr_win - prev_win))
    lines.append("- 0422 埋点升级后漏斗显示：会话 `{}`，至少一抽 `{}`（`{:.2f}%`），正常结束 `{}`（`{:.2f}%`）。  ".format(
        _safe_int(funnel, "all_sessions"),
        _safe_int(funnel, "sessions_with_draw"),
        _pct(_safe_int(funnel, "sessions_with_draw"), _safe_int(funnel, "all_sessions")),
        _safe_int(funnel, "sessions_finished"),
        _pct(_safe_int(funnel, "sessions_finished"), _safe_int(funnel, "all_sessions")),
    ))
    lines.append("- 最近 5 天广告抽卡率可用于观察抽卡策略变化，建议结合版本点位继续跟踪。")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 二、与上一份报告对比（可比口径）")
    lines.append("")
    lines.append("> 统一口径：`非测试玩家 + 至少一抽（game_time!=0）+ 正常结束（result is not null）`")
    lines.append("")
    lines.append("| 指标 | 上一份报告区间（0410-0418） | 本期（0418-0426） | 变化 |")
    lines.append("|---|---:|---:|---:|")
    lines.append("| 会话数 | {} | {} | {} |".format(_safe_int(prev_row, "sessions"), _safe_int(curr_row, "sessions"), _safe_int(curr_row, "sessions") - _safe_int(prev_row, "sessions")))
    lines.append("| 胜场 | {} | {} | {} |".format(_safe_int(prev_row, "success_sessions"), _safe_int(curr_row, "success_sessions"), _safe_int(curr_row, "success_sessions") - _safe_int(prev_row, "success_sessions")))
    lines.append("| 胜率 | {:.2f}% | {:.2f}% | {:+.2f}pp |".format(prev_win, curr_win, curr_win - prev_win))
    lines.append("| 平均防御时长 | {:.2f}s | {:.2f}s | {:+.2f}s |".format(_safe_float(prev_row, "avg_defend_time"), _safe_float(curr_row, "avg_defend_time"), _safe_float(curr_row, "avg_defend_time") - _safe_float(prev_row, "avg_defend_time")))
    lines.append("| 平均击杀 | {:.2f} | {:.2f} | {:+.2f} |".format(_safe_float(prev_row, "avg_kill"), _safe_float(curr_row, "avg_kill"), _safe_float(curr_row, "avg_kill") - _safe_float(prev_row, "avg_kill")))
    lines.append("| 平均操作次数 | {:.2f} | {:.2f} | {:+.2f} |".format(_safe_float(prev_row, "avg_ops"), _safe_float(curr_row, "avg_ops"), _safe_float(curr_row, "avg_ops") - _safe_float(prev_row, "avg_ops")))
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 三、最近5天数据对比与版本影响")
    lines.append("")
    lines.append("### 3.1 最近5天广告抽卡走势")
    lines.append("")
    lines.append("| 日期 | 抽卡事件 | 广告抽卡事件 | 广告抽卡率 | single_video |")
    lines.append("|---|---:|---:|---:|---:|")
    for row in recent5_daily:
        lines.append("| {} | {} | {} | {}% | {} |".format(
            row.get("d", ""),
            _safe_int(row, "draw_events"),
            _safe_int(row, "ad_draw_events"),
            _safe_float(row, "ad_rate"),
            _safe_int(row, "single_video_events"),
        ))
    lines.append("")
    lines.append("### 3.2 最近5天版本影响（可比口径）")
    lines.append("")
    lines.append("| 日期 | 版本标签 | 会话数 | 胜率 | 平均防御时长 | 平均击杀 | 平均操作 |")
    lines.append("|---|---|---:|---:|---:|---:|---:|")
    for row in recent5_impact:
        lines.append("| {} | {} | {} | {}% | {}s | {} | {} |".format(
            row.get("d", ""),
            row.get("version_label", ""),
            _safe_int(row, "sessions"),
            _safe_float(row, "win_rate"),
            _safe_float(row, "avg_defend_time"),
            _safe_float(row, "avg_kill"),
            _safe_float(row, "avg_ops"),
        ))
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 四、当日最频繁的10种玩家操作")
    lines.append("")
    for d in sorted(daily_top_ops.keys()):
        lines.append("- {}".format(d))
        for item in daily_top_ops.get(d, []):
            lines.append("  - {}：{}".format(item.get("operation_type", ""), item.get("count", 0)))
    if not daily_top_ops:
        lines.append("- 无可统计操作数据")
    lines.append("")
    lines.append("## 五、当日最频繁的10种选卡")
    lines.append("")
    for d in sorted(daily_top_cards.keys()):
        lines.append("- {}".format(d))
        for item in daily_top_cards.get(d, []):
            lines.append("  - {}：{}".format(item.get("card_key", ""), item.get("count", 0)))
    if not daily_top_cards:
        lines.append("- 无可统计选卡数据")
    lines.append("")
    lines.append("## 六、清晰口径")
    lines.append("")
    lines.append("1. 非测试记录：固定排除测试 player_id，且排除 `visitor_source_records.channel='unknown'`。")
    lines.append("2. 至少一抽：`id in (select session_id from card_selection_events where game_time != 0)`。")
    lines.append("3. 正常结束：`result is not null`。")
    lines.append("4. 广告抽卡：`selection_mode in ('get_all','reroll','single_video')`。")
    lines.append("5. 选卡统计：优先读 `select_buff_card.details` 的 `mode|unitId|rarity|buffType`。")
    lines.append("")
    lines.append("**报告结束**")
    return "\n".join(lines)


def _fmt(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, Decimal):
        return float(v)
    return v


def fetch_all(conn: pymysql.connections.Connection, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [{k: _fmt(v) for k, v in row.items()} for row in rows]


def build_filters() -> Dict[str, str]:
    quoted = ",".join([f"'{p}'" for p in DEFAULT_EXCLUDED_PLAYERS])
    base_session = (
        f"gs.player_id NOT IN ({quoted}) "
        "AND gs.player_id NOT IN (SELECT vsr.player_id FROM visitor_source_records vsr WHERE vsr.channel='unknown')"
    )
    base_s = base_session.replace("gs.", "s.")
    return {"base_session": base_session, "base_s": base_s}


def version_label(ts_str: Any) -> str:
    if isinstance(ts_str, datetime):
        t = ts_str
    else:
        text = str(ts_str)
        if len(text) > 10:
            text = text[:10]
        t = datetime.strptime(text, "%Y-%m-%d")
    selected = "pre-1.0.72"
    for ver, st in VERSIONS:
        if t >= datetime.strptime(st[:10], "%Y-%m-%d"):
            selected = ver
    return selected


def infer_repo_from_git() -> Tuple[str, str]:
    try:
        remote = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except Exception:
        return "", ""
    if not remote:
        return "", ""

    # https://github.com/owner/repo.git
    if "github.com/" in remote:
        tail = remote.split("github.com/", 1)[1]
    # git@github.com:owner/repo.git
    elif "github.com:" in remote:
        tail = remote.split("github.com:", 1)[1]
    else:
        return "", ""
    if tail.endswith(".git"):
        tail = tail[:-4]
    parts = tail.split("/")
    if len(parts) >= 2:
        return parts[0], parts[1]
    return "", ""


def infer_default_ref_from_git() -> str:
    try:
        out = subprocess.check_output(["git", "symbolic-ref", "refs/remotes/origin/HEAD"], text=True).strip()
        # refs/remotes/origin/master -> master
        return out.rsplit("/", 1)[-1]
    except Exception:
        return "main"


def fetch_prompt_from_github(
    owner: str, repo: str, ref: str, file_path: str, token: str, output_path: str
) -> Dict[str, Any]:
    if not owner or not repo:
        inferred_owner, inferred_repo = infer_repo_from_git()
        owner = owner or inferred_owner
        repo = repo or inferred_repo
    if not owner or not repo:
        raise ValueError("未提供 github owner/repo，且无法从 git remote 自动识别")
    if not token:
        raise ValueError("缺少 GitHub Token，请通过 --github-token 或环境变量 GITHUB_TOKEN 提供")
    if not ref:
        ref = infer_default_ref_from_git()

    encoded_path = urllib.parse.quote(file_path)
    encoded_ref = urllib.parse.quote(ref)
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{encoded_path}?ref={encoded_ref}"
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    content_b64 = payload.get("content", "")
    content_text = base64.b64decode(content_b64).decode("utf-8")
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content_text)

    return {
        "owner": owner,
        "repo": repo,
        "path": file_path,
        "ref": ref,
        "sha": payload.get("sha", ""),
        "size": payload.get("size", 0),
        "saved_to": output_path or "",
    }


def main() -> None:
    args = parse_args()
    result: Dict[str, Any] = {}

    if args.fetch_prompt_from_github:
        result["github_prompt_fetch"] = fetch_prompt_from_github(
            owner=args.github_owner,
            repo=args.github_repo,
            ref=args.github_ref,
            file_path=args.github_path,
            token=args.github_token,
            output_path=args.github_output,
        )

    if not args.start or not args.end:
        # 允许只使用 --fetch-prompt-from-github 模式
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return
        raise ValueError("统计模式需要提供 --start 与 --end")

    filters = build_filters()
    conn = pymysql.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    start_dt = datetime.strptime(args.start, "%Y-%m-%d %H:%M:%S")
    end_dt = datetime.strptime(args.end, "%Y-%m-%d %H:%M:%S")
    recent5_start = max(start_dt, end_dt - timedelta(days=4))
    prev7_start = max(start_dt, end_dt - timedelta(days=13))
    prev7_end = end_dt - timedelta(days=7)
    last7_start = end_dt - timedelta(days=6)

    comparable_cond = (
        "gs.id IN (SELECT session_id FROM card_selection_events WHERE game_time != 0) "
        "AND gs.result IS NOT NULL"
    )

    output: Dict[str, Any] = {
        "meta": {
            "start": args.start,
            "end": args.end,
            "tracking_cutoff": TRACKING_CUTOFF,
            "recent5_start": recent5_start.strftime("%Y-%m-%d %H:%M:%S"),
            "prev7_start": prev7_start.strftime("%Y-%m-%d %H:%M:%S"),
            "prev7_end": prev7_end.strftime("%Y-%m-%d %H:%M:%S"),
            "last7_start": last7_start.strftime("%Y-%m-%d %H:%M:%S"),
        }
    }

    output["overall_comparable"] = fetch_all(
        conn,
        f"""
        SELECT COUNT(*) sessions,
               SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END) success_sessions,
               ROUND(SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END)*100.0/COUNT(*),2) win_rate,
               ROUND(AVG(gs.defend_time),2) avg_defend_time,
               ROUND(AVG(gs.kill_count),2) avg_kill,
               ROUND(AVG(gs.operation_count),2) avg_ops
        FROM game_sessions gs
        WHERE {filters["base_session"]}
          AND gs.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
          AND {comparable_cond}
        """,
        (args.start, args.end),
    )

    output["week_compare_comparable"] = fetch_all(
        conn,
        f"""
        SELECT period,
               COUNT(*) sessions,
               SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END) success_sessions,
               ROUND(SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END)*100.0/COUNT(*),2) win_rate,
               ROUND(AVG(gs.defend_time),2) avg_defend_time,
               ROUND(AVG(gs.kill_count),2) avg_kill,
               ROUND(AVG(gs.operation_count),2) avg_ops
        FROM (
          SELECT gs.*,
                 CASE
                   WHEN gs.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000 THEN 'prev7'
                   WHEN gs.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000 THEN 'last7'
                   ELSE 'other'
                 END period
          FROM game_sessions gs
          WHERE {filters["base_session"]}
        ) gs
        WHERE period IN ('prev7','last7')
          AND {comparable_cond}
        GROUP BY period
        ORDER BY period
        """,
        (
            prev7_start.strftime("%Y-%m-%d %H:%M:%S"),
            prev7_end.strftime("%Y-%m-%d %H:%M:%S"),
            last7_start.strftime("%Y-%m-%d %H:%M:%S"),
            args.end,
        ),
    )

    output["previous_report_period_compare"] = fetch_all(
        conn,
        f"""
        SELECT period,
               COUNT(*) sessions,
               SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END) success_sessions,
               ROUND(SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END)*100.0/COUNT(*),2) win_rate,
               ROUND(AVG(gs.defend_time),2) avg_defend_time,
               ROUND(AVG(gs.kill_count),2) avg_kill,
               ROUND(AVG(gs.operation_count),2) avg_ops
        FROM (
          SELECT gs.*,
                 CASE
                   WHEN gs.start_time BETWEEN UNIX_TIMESTAMP('2026-04-10 00:00:00')*1000 AND UNIX_TIMESTAMP('2026-04-18 23:59:59')*1000 THEN 'prev_report_0410_0418'
                   WHEN gs.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000 THEN 'current_report'
                   ELSE 'other'
                 END period
          FROM game_sessions gs
          WHERE {filters["base_session"]}
        ) gs
        WHERE period IN ('prev_report_0410_0418','current_report')
          AND {comparable_cond}
        GROUP BY period
        ORDER BY period
        """,
        (args.start, args.end),
    )

    output["recent5_daily"] = fetch_all(
        conn,
        f"""
        SELECT DATE(FROM_UNIXTIME(c.event_time/1000)) d,
               COUNT(*) draw_events,
               SUM(CASE WHEN c.selection_mode IN ('get_all','reroll','single_video') THEN 1 ELSE 0 END) ad_draw_events,
               ROUND(SUM(CASE WHEN c.selection_mode IN ('get_all','reroll','single_video') THEN 1 ELSE 0 END)*100.0/COUNT(*),2) ad_rate,
               SUM(CASE WHEN c.selection_mode='single_video' THEN 1 ELSE 0 END) single_video_events
        FROM card_selection_events c
        JOIN game_sessions s ON s.id = c.session_id
        WHERE {filters["base_s"]}
          AND c.game_time != 0
          AND c.event_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY d
        ORDER BY d
        """,
        (recent5_start.strftime("%Y-%m-%d %H:%M:%S"), args.end),
    )

    output["recent5_version_impact"] = fetch_all(
        conn,
        f"""
        SELECT DATE(FROM_UNIXTIME(gs.start_time/1000)) d,
               COUNT(*) sessions,
               ROUND(SUM(CASE WHEN gs.result='success' THEN 1 ELSE 0 END)*100.0/COUNT(*),2) win_rate,
               ROUND(AVG(gs.defend_time),2) avg_defend_time,
               ROUND(AVG(gs.kill_count),2) avg_kill,
               ROUND(AVG(gs.operation_count),2) avg_ops
        FROM game_sessions gs
        WHERE {filters["base_session"]}
          AND gs.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
          AND {comparable_cond}
        GROUP BY d
        ORDER BY d
        """,
        (recent5_start.strftime("%Y-%m-%d %H:%M:%S"), args.end),
    )
    for row in output["recent5_version_impact"]:
        row["version_label"] = version_label(row["d"])

    output["post_0422_funnel"] = fetch_all(
        conn,
        f"""
        SELECT COUNT(*) all_sessions,
               SUM(CASE WHEN gs.id IN (SELECT session_id FROM card_selection_events WHERE game_time!=0) THEN 1 ELSE 0 END) sessions_with_draw,
               SUM(CASE WHEN gs.result IS NOT NULL THEN 1 ELSE 0 END) sessions_finished,
               SUM(CASE WHEN gs.id IN (SELECT session_id FROM card_selection_events WHERE game_time!=0) AND gs.result IS NOT NULL THEN 1 ELSE 0 END) draw_and_finished
        FROM game_sessions gs
        WHERE {filters["base_session"]}
          AND gs.start_time >= UNIX_TIMESTAMP(%s)*1000
          AND gs.start_time <= UNIX_TIMESTAMP(%s)*1000
        """,
        (TRACKING_CUTOFF, args.end),
    )

    raw_ops_rows = fetch_all(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(s.start_time/1000)) d,
          s.level,
          s.operations_json
        FROM game_sessions s
        WHERE {filters["base_s"]}
          AND s.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
          AND s.operations_json IS NOT NULL
          AND s.operations_json != ''
        ORDER BY s.start_time ASC
        """,
        (args.start, args.end),
    )

    auto_prefix_cut = {
        "build_stone_wall": 13,
        "build_watchtower": 3,
        "build_war_ancient_tree": 1,
    }

    def _extract_op_type(op: Any) -> str:
        if isinstance(op, dict):
            t = op.get("type")
            return str(t) if t else ""
        if isinstance(op, str):
            return op
        return ""

    def _safe_str(v: Any, fallback: str = "unknown") -> str:
        if v is None:
            return fallback
        s = str(v).strip()
        return s if s else fallback

    def _extract_card_field(op: Dict[str, Any], keys: List[str]) -> Any:
        for k in keys:
            if k in op and op.get(k) is not None:
                return op.get(k)
        nested_candidates = [
            op.get("card"),
            op.get("cardData"),
            op.get("selectedCard"),
            op.get("selected_card"),
            op.get("payload"),
            op.get("data"),
        ]
        for item in nested_candidates:
            if isinstance(item, dict):
                for k in keys:
                    if k in item and item.get(k) is not None:
                        return item.get(k)
        return None

    day_counter_map: Dict[str, collections.Counter] = {}
    day_card_counter_map: Dict[str, collections.Counter] = {}

    for row in raw_ops_rows:
        d = str(row.get("d", ""))
        if d not in day_counter_map:
            day_counter_map[d] = collections.Counter()
        if d not in day_card_counter_map:
            day_card_counter_map[d] = collections.Counter()

        ops_text = row.get("operations_json", "")
        try:
            ops = json.loads(ops_text) if ops_text else []
        except Exception:
            ops = []
        if not isinstance(ops, list):
            continue

        level = int(row.get("level", 0) or 0)
        remove_remaining = auto_prefix_cut.copy() if 1 <= level <= 4 else {}
        still_prefix = bool(remove_remaining)

        for idx, op in enumerate(ops):
            op_type = _extract_op_type(op)
            if op_type:
                if still_prefix and op_type in remove_remaining and remove_remaining[op_type] > 0:
                    remove_remaining[op_type] -= 1
                    if all(v == 0 for v in remove_remaining.values()):
                        still_prefix = False
                else:
                    still_prefix = False
                    day_counter_map[d][op_type] += 1

            if not isinstance(op, dict) or op_type != "select_buff_card":
                continue

            details = op.get("details") if isinstance(op.get("details"), dict) else {}
            next_item = ops[idx + 1] if (idx + 1) < len(ops) else {}
            next_obj = next_item if isinstance(next_item, dict) else {}
            source_obj = details if details else next_obj

            mode = _safe_str(_extract_card_field(source_obj, ["mode", "selection_mode", "selectionMode"]))
            unit_id = _safe_str(_extract_card_field(source_obj, ["unitId", "unit_id", "id"]))
            rarity = _safe_str(_extract_card_field(source_obj, ["rarity"]))
            buff_type = _safe_str(_extract_card_field(source_obj, ["buffType", "buff_type"]))
            card_key = "{}|{}|{}|{}".format(mode, unit_id, rarity, buff_type)
            day_card_counter_map[d][card_key] += 1

    output["daily_top_operations"] = {}
    for d, cnt in day_counter_map.items():
        output["daily_top_operations"][d] = [
            {"operation_type": op_type, "count": int(count)}
            for op_type, count in cnt.most_common(10)
        ]

    output["daily_top_card_selections"] = {}
    for d, cnt in day_card_counter_map.items():
        output["daily_top_card_selections"][d] = [
            {"card_key": card_key, "count": int(count)}
            for card_key, count in cnt.most_common(10)
        ]

    conn.close()
    output.update(result)

    report_time = datetime.now().strftime("%Y-%m-%d %H:%M（UTC+8）")
    md_text = build_markdown_report(output, report_time)

    text = json.dumps(output, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
    md_output = args.md_output
    if not md_output:
        day_tag = datetime.strptime(args.end, "%Y-%m-%d %H:%M:%S").strftime("%Y%m%d")
        md_output = os.path.join("docs", "抽卡与粘性深度分析报告_最近两周_{}.md".format(day_tag))
    with open(md_output, "w", encoding="utf-8") as f:
        f.write(md_text)
    print(text)


if __name__ == "__main__":
    main()
