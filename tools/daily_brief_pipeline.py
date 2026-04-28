#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一键日报脚本：
1) MySQL 获取最近 N 天核心数据
2) GitHub 获取 工程提示词.md 并提取最近 N 天版本记录
3) 发送企业微信机器人简报
"""

import argparse
import base64
import collections
import json
import os
import re
import urllib.parse
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

import pymysql


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="每日数据+版本+企业微信简报")
    parser.add_argument(
        "--config",
        default="tools/daily_brief_config.json",
        help="配置文件路径（JSON）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅输出简报，不实际发送企业微信",
    )
    return parser.parse_args()


def load_config(path: str) -> Dict[str, Any]:
    cfg_path = Path(path)
    if not cfg_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {path}")
    with cfg_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def to_num(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    return v


def fetch_rows(conn: pymysql.connections.Connection, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    out: List[Dict[str, Any]] = []
    for row in rows:
        item: Dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, datetime):
                item[k] = v.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(v, date):
                item[k] = v.strftime("%Y-%m-%d")
            else:
                item[k] = to_num(v)
        out.append(item)
    return out


def build_session_filter(cfg: Dict[str, Any], alias: str = "s") -> str:
    filters = cfg["filters"]
    exclude_ids = filters.get("exclude_player_ids", [])
    conds = []
    if exclude_ids:
        quoted = ",".join([f"'{pid}'" for pid in exclude_ids])
        conds.append(f"{alias}.player_id NOT IN ({quoted})")
    if filters.get("exclude_unknown_channel", True):
        conds.append(
            f"{alias}.player_id NOT IN (SELECT vsr.player_id FROM visitor_source_records vsr WHERE vsr.channel='unknown')"
        )
    if not conds:
        return "1=1"
    return " AND ".join(conds)


def query_daily_metrics(cfg: Dict[str, Any]) -> Dict[str, Any]:
    mysql_cfg = cfg["mysql"]
    days = int(cfg.get("report", {}).get("days", 3))
    end_dt = datetime.now()
    start_dt = datetime(end_dt.year, end_dt.month, end_dt.day) - timedelta(days=days - 1)
    start_str = start_dt.strftime("%Y-%m-%d 00:00:00")
    end_str = end_dt.strftime("%Y-%m-%d %H:%M:%S")

    conn = pymysql.connect(
        host=mysql_cfg["host"],
        port=int(mysql_cfg["port"]),
        user=mysql_cfg["user"],
        password=mysql_cfg["password"],
        database=mysql_cfg["database"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    sf = build_session_filter(cfg, alias="s")
    gf = build_session_filter(cfg, alias="gs")

    daily_sessions = fetch_rows(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(s.start_time/1000)) d,
          COUNT(*) total_sessions,
          SUM(CASE WHEN s.id IN (SELECT session_id FROM card_selection_events WHERE game_time != 0) THEN 1 ELSE 0 END) sessions_with_draw,
          SUM(CASE WHEN s.result IS NOT NULL THEN 1 ELSE 0 END) finished_sessions,
          SUM(CASE WHEN s.result = 'success' THEN 1 ELSE 0 END) success_sessions
        FROM game_sessions s
        WHERE {sf}
          AND s.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY d
        ORDER BY d
        """,
        (start_str, end_str),
    )

    daily_draws = fetch_rows(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(c.event_time/1000)) d,
          COUNT(*) draw_events,
          SUM(CASE WHEN c.selection_mode IN ('get_all','reroll','single_video') THEN 1 ELSE 0 END) ad_draw_events
        FROM card_selection_events c
        JOIN game_sessions gs ON gs.id = c.session_id
        WHERE {gf}
          AND c.game_time != 0
          AND c.event_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY d
        ORDER BY d
        """,
        (start_str, end_str),
    )

    daily_player_compare = fetch_rows(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(s.start_time/1000)) d,
          COUNT(DISTINCT s.player_id) player_count,
          COUNT(DISTINCT CASE WHEN s.id IN (
            SELECT session_id FROM card_selection_events WHERE game_time != 0
          ) THEN s.player_id END) draw_player_count,
          COUNT(DISTINCT CASE WHEN s.id IN (
            SELECT session_id FROM card_selection_events
            WHERE game_time != 0
              AND selection_mode IN ('get_all','reroll','single_video')
          ) THEN s.player_id END) ad_draw_player_count
        FROM game_sessions s
        WHERE {sf}
          AND s.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY d
        ORDER BY d
        """,
        (start_str, end_str),
    )

    ad_mode_detail = fetch_rows(
        conn,
        f"""
        SELECT
          c.selection_mode,
          COUNT(*) trigger_count,
          COUNT(DISTINCT c.player_id) player_count
        FROM card_selection_events c
        JOIN game_sessions gs ON gs.id = c.session_id
        WHERE {gf}
          AND c.game_time != 0
          AND c.selection_mode IN ('get_all','reroll','single_video')
          AND c.event_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY c.selection_mode
        ORDER BY trigger_count DESC
        """,
        (start_str, end_str),
    )

    ad_mode_daily_detail = fetch_rows(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(c.event_time/1000)) d,
          c.selection_mode,
          COUNT(*) trigger_count,
          COUNT(DISTINCT c.player_id) player_count
        FROM card_selection_events c
        JOIN game_sessions gs ON gs.id = c.session_id
        WHERE {gf}
          AND c.game_time != 0
          AND c.selection_mode IN ('get_all','reroll','single_video')
          AND c.event_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY d, c.selection_mode
        ORDER BY d, c.selection_mode
        """,
        (start_str, end_str),
    )

    ad_mode_daily_unique_players = fetch_rows(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(c.event_time/1000)) d,
          COUNT(DISTINCT c.player_id) unique_player_count
        FROM card_selection_events c
        JOIN game_sessions gs ON gs.id = c.session_id
        WHERE {gf}
          AND c.game_time != 0
          AND c.selection_mode IN ('get_all','reroll','single_video')
          AND c.event_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
        GROUP BY d
        ORDER BY d
        """,
        (start_str, end_str),
    )

    raw_ops_rows = fetch_rows(
        conn,
        f"""
        SELECT
          DATE(FROM_UNIXTIME(s.start_time/1000)) d,
          s.level,
          s.operations_json
        FROM game_sessions s
        WHERE {sf}
          AND s.start_time BETWEEN UNIX_TIMESTAMP(%s)*1000 AND UNIX_TIMESTAMP(%s)*1000
          AND s.operations_json IS NOT NULL
          AND s.operations_json != ''
        ORDER BY s.start_time ASC
        """,
        (start_str, end_str),
    )
    conn.close()

    draw_map = {row["d"]: row for row in daily_draws}
    merged: List[Dict[str, Any]] = []
    for srow in daily_sessions:
        d = srow["d"]
        drow = draw_map.get(d, {"draw_events": 0, "ad_draw_events": 0})
        total_draws = int(drow.get("draw_events", 0) or 0)
        ad_draws = int(drow.get("ad_draw_events", 0) or 0)
        ad_rate = (ad_draws * 100.0 / total_draws) if total_draws > 0 else 0.0
        merged.append(
            {
                "d": d,
                "total_sessions": int(srow["total_sessions"]),
                "sessions_with_draw": int(srow["sessions_with_draw"]),
                "finished_sessions": int(srow["finished_sessions"]),
                "success_sessions": int(srow.get("success_sessions", 0) or 0),
                "draw_events": total_draws,
                "ad_draw_events": ad_draws,
                "ad_rate": round(ad_rate, 2),
            }
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

    day_counter_map: Dict[str, collections.Counter] = {}
    for row in raw_ops_rows:
        d = str(row.get("d", ""))
        if d not in day_counter_map:
            day_counter_map[d] = collections.Counter()

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

        for op in ops:
            op_type = _extract_op_type(op)
            if not op_type:
                continue

            if still_prefix and op_type in remove_remaining and remove_remaining[op_type] > 0:
                remove_remaining[op_type] -= 1
                if all(v == 0 for v in remove_remaining.values()):
                    still_prefix = False
                continue
            else:
                still_prefix = False

            day_counter_map[d][op_type] += 1

    daily_top_operations: Dict[str, List[Dict[str, Any]]] = {}
    for d, cnt in day_counter_map.items():
        daily_top_operations[d] = [
            {"operation_type": op_type, "count": int(count)}
            for op_type, count in cnt.most_common(10)
        ]

    # 当日最频繁的10种选卡（仅 select_buff_card）
    def _safe_str(v: Any, fallback: str = "unknown") -> str:
        if v is None:
            return fallback
        s = str(v).strip()
        return s if s else fallback

    def _extract_card_field(op: Dict[str, Any], keys: List[str]) -> Any:
        # 先查顶层
        for k in keys:
            if k in op and op.get(k) is not None:
                return op.get(k)
        # 再查常见嵌套
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

    day_card_counter_map: Dict[str, collections.Counter] = {}
    for row in raw_ops_rows:
        d = str(row.get("d", ""))
        if d not in day_card_counter_map:
            day_card_counter_map[d] = collections.Counter()

        ops_text = row.get("operations_json", "")
        try:
            ops = json.loads(ops_text) if ops_text else []
        except Exception:
            ops = []
        if not isinstance(ops, list):
            continue

        for idx, op in enumerate(ops):
            if not isinstance(op, dict):
                continue
            op_type = _extract_op_type(op)
            if op_type != "select_buff_card":
                continue

            # 关键口径：生产数据字段位于 select_buff_card.details 子节点
            details = op.get("details") if isinstance(op.get("details"), dict) else {}

            # 兼容：若 details 不存在，仍兜底读取后一个 JSON 元素
            next_item: Any = ops[idx + 1] if (idx + 1) < len(ops) else {}
            next_obj = next_item if isinstance(next_item, dict) else {}
            source_obj = details if details else next_obj

            mode = _safe_str(_extract_card_field(source_obj, ["mode", "selection_mode", "selectionMode"]))
            unit_id = _safe_str(_extract_card_field(source_obj, ["unitId", "unit_id", "id"]))
            rarity = _safe_str(_extract_card_field(source_obj, ["rarity"]))
            buff_type = _safe_str(_extract_card_field(source_obj, ["buffType", "buff_type"]))
            card_key = f"{mode}|{unit_id}|{rarity}|{buff_type}"
            day_card_counter_map[d][card_key] += 1

    daily_top_card_selections: Dict[str, List[Dict[str, Any]]] = {}
    for d, cnt in day_card_counter_map.items():
        daily_top_card_selections[d] = [
            {"card_key": card_key, "count": int(count)}
            for card_key, count in cnt.most_common(10)
        ]

    return {
        "start": start_str,
        "end": end_str,
        "days": days,
        "daily": merged,
        "daily_player_compare": daily_player_compare,
        "ad_mode_detail": ad_mode_detail,
        "ad_mode_daily_detail": ad_mode_daily_detail,
        "ad_mode_daily_unique_players": ad_mode_daily_unique_players,
        "daily_top_operations": daily_top_operations,
        "daily_top_card_selections": daily_top_card_selections,
    }


def fetch_github_file(cfg: Dict[str, Any]) -> str:
    def _resolve_local_prompt_path(local_path: str) -> Optional[Path]:
        p = Path(local_path)
        candidates: List[Path] = []
        if p.is_absolute():
            candidates.append(p)
        else:
            cwd = Path.cwd()
            script_dir = Path(__file__).resolve().parent
            project_root = script_dir.parent
            candidates.extend(
                [
                    cwd / p,
                    script_dir / p,
                    project_root / p,
                    project_root / "工程提示词.md",
                ]
            )

        for c in candidates:
            if c.exists():
                return c
        return None

    gh = cfg.get("github")
    if not isinstance(gh, dict):
        local_path = cfg.get("report", {}).get("local_prompt_path", "工程提示词.md")
        resolved = _resolve_local_prompt_path(local_path)
        if not resolved:
            raise ValueError("github 未配置且本地工程提示词文件不存在")
        return resolved.read_text(encoding="utf-8")
    owner = gh["owner"]
    repo = gh["repo"]
    ref = gh.get("ref", "master")
    path = gh.get("path", "工程提示词.md")
    token = gh.get("token", "").strip()
    if not token:
        local_path = gh.get("local_fallback_path") or cfg.get("report", {}).get("local_prompt_path", "工程提示词.md")
        resolved = _resolve_local_prompt_path(local_path)
        if resolved:
            return resolved.read_text(encoding="utf-8")
        raise ValueError("github.token 为空，且本地回退文件不存在，无法拉取工程提示词")

    url = (
        f"https://api.github.com/repos/{owner}/{repo}/contents/"
        f"{urllib.parse.quote(path)}?ref={urllib.parse.quote(ref)}"
    )
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    content = base64.b64decode(payload["content"]).decode("utf-8")
    return content


def parse_recent_versions(md_text: str, days: int) -> Dict[str, Any]:
    # 匹配：# 【1.0.77 2026-04-26 11:06:02 ...】
    header_re = re.compile(r"^#\s*【([^】]+)】\s*$")
    date_re = re.compile(r"(20\d{2}-\d{2}-\d{2})")

    sections: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    for raw in md_text.splitlines():
        line = raw.strip()
        m = header_re.match(line)
        if m:
            if current:
                sections.append(current)
            title = m.group(1)
            dm = date_re.search(title)
            current = {
                "title": title,
                "date": dm.group(1) if dm else "",
                "items": [],
            }
            continue
        if current and line.startswith("- "):
            current["items"].append(line[2:].strip())
    if current:
        sections.append(current)

    today = datetime.now().date()
    min_day = today - timedelta(days=days - 1)
    recent_sections = []
    for sec in sections:
        if not sec["date"]:
            continue
        try:
            d = datetime.strptime(sec["date"], "%Y-%m-%d").date()
        except ValueError:
            continue
        if d >= min_day:
            recent_sections.append(sec)

    return {
        "days": days,
        "min_day": min_day.strftime("%Y-%m-%d"),
        "versions": recent_sections[:10],
    }


def build_brief_text(metrics: Dict[str, Any], versions: Dict[str, Any]) -> str:
    compact_map = {
        "WarAncientTree": "WATree",
        "WatchTower": "Tower",
        "StoneWall": "Stone",
        "populationIncrease": "pop",
        "goldReward": "gold",
        "attackDamage": "atk",
        "attackSpeed": "aspd",
        "maxHealth": "hp",
        "multiArrow": "mArrow",
        "selfHealingWall": "healWall",
        "build_stone_wall": "b_stone",
        "build_watchtower": "b_tower",
        "build_war_ancient_tree": "b_watree",
        "build_thunder_tower": "b_thunder",
        "build_ice_tower": "b_ice",
        "build_hunter_hall": "b_hunter",
        "build_swordsman_hall": "b_sword",
        "build_church": "b_church",
        "build_mage_tower": "b_mage",
        "train_eagle": "train_eagle",
        "train_eagle_archer": "train_eagleAr",
        "trigger_bear": "bear",
        "select_buff_card": "sel_card",
        "single_video": "video1",
        "get_all": "all",
        "reroll": "reroll",
    }

    def compact_text(text: Any) -> str:
        s = str(text)
        for k, v in compact_map.items():
            s = s.replace(k, v)
        return s

    lines = []
    lines.append("【自动日报】近三天数据对比 + 版本影响")
    lines.append(f"统计区间：{metrics['start']} ~ {metrics['end']}")
    lines.append("")
    lines.append("一、每日核心数据")
    daily = metrics["daily"]
    for row in daily:
        finished = int(row.get("finished_sessions", 0))
        success = int(row.get("success_sessions", 0))
        win_rate = (success * 100.0 / finished) if finished > 0 else 0.0
        lines.append(
            f"- {row['d']} | 对局:{row['total_sessions']} | 至少一抽:{row['sessions_with_draw']} | 完整对局:{row['finished_sessions']} | 胜率:{win_rate:.2f}% | "
            f"抽卡:{row['draw_events']} | 广告抽卡:{row['ad_draw_events']} ({row['ad_rate']}%)"
        )

    lines.append("")
    lines.append("二、抽卡玩家对比（近三天）")
    player_rows = metrics.get("daily_player_compare", [])
    if player_rows:
        for row in player_rows:
            player_cnt = int(row.get("player_count", 0))
            draw_player_cnt = int(row.get("draw_player_count", 0))
            ad_draw_player_cnt = int(row.get("ad_draw_player_count", 0))
            ratio = (draw_player_cnt * 100.0 / player_cnt) if player_cnt > 0 else 0.0
            ad_ratio_in_draw = (ad_draw_player_cnt * 100.0 / draw_player_cnt) if draw_player_cnt > 0 else 0.0
            lines.append(
                f"- {row.get('d')}：玩家 {player_cnt}，抽卡 {draw_player_cnt}（{ratio:.2f}%），"
                f"广告抽卡 {ad_draw_player_cnt}（{ad_ratio_in_draw:.2f}%）"
            )
    else:
        lines.append("- 近三天无玩家数据")

    lines.append("")
    lines.append("三、广告抽卡详情（近三天）")
    mode_name_map = {
        "get_all": "all（全拿）",
        "reroll": "reroll（重抽）",
        "single_video": "video1（单卡视频）",
    }
    ad_mode_detail = metrics.get("ad_mode_detail", [])
    # 仅保留按天展开每种广告触发人数和次数（不展示三天总汇）
    mode_order = ["reroll", "get_all", "single_video"]
    daily_mode_map: Dict[str, Dict[str, Dict[str, int]]] = {}
    for row in metrics.get("ad_mode_daily_detail", []):
        d = str(row.get("d", ""))
        mode = str(row.get("selection_mode", ""))
        if d not in daily_mode_map:
            daily_mode_map[d] = {}
        daily_mode_map[d][mode] = {
            "player_count": int(row.get("player_count", 0)),
            "trigger_count": int(row.get("trigger_count", 0)),
        }

    unique_map = {
        str(row.get("d", "")): int(row.get("unique_player_count", 0))
        for row in metrics.get("ad_mode_daily_unique_players", [])
    }

    if daily_mode_map:
        for d in sorted(daily_mode_map.keys()):
            unique_players = unique_map.get(d, 0)
            lines.append(f"- {d}（去重玩家：{unique_players}）")
            for mode in mode_order:
                stat = daily_mode_map[d].get(mode, {"player_count": 0, "trigger_count": 0})
                display = mode_name_map.get(mode, mode)
                lines.append(
                    f"  · {display}：玩家{stat['player_count']} 触发{stat['trigger_count']}"
                )
    else:
        lines.append("- 近三天无广告抽卡触发记录")

    lines.append("")
    lines.append("四、当日最频繁的10种玩家操作（近三天）")
    top_ops_map = metrics.get("daily_top_operations", {})
    if top_ops_map:
        for d in sorted(top_ops_map.keys()):
            lines.append(f"- {d}")
            items = top_ops_map.get(d, [])
            if not items:
                lines.append("  · 无有效操作数据")
                continue
            for it in items:
                lines.append(f"  · {compact_text(it['operation_type'])}：{it['count']}")
    else:
        lines.append("- 近三天无可统计操作数据")

    lines.append("")
    lines.append("五、当日最频繁的10种选卡（近三天）")
    top_cards_map = metrics.get("daily_top_card_selections", {})
    if top_cards_map:
        for d in sorted(top_cards_map.keys()):
            lines.append(f"- {d}")
            items = top_cards_map.get(d, [])
            if not items:
                lines.append("  · 无有效选卡数据")
                continue
            for it in items:
                lines.append(f"  · {compact_text(it['card_key'])}：{it['count']}")
    else:
        lines.append("- 近三天无可统计选卡数据")

    lines.append("")
    lines.append("六、工程提示词近三天版本记录（GitHub）")
    if versions["versions"]:
        for sec in versions["versions"]:
            lines.append(f"- [{sec['date']}] {compact_text(sec['title'])}")
            for item in sec["items"][:4]:
                short_item = item.strip()
                if len(short_item) > 27:
                    short_item = short_item[:27] + "..."
                else:
                    short_item = short_item + "..."
                lines.append(f"  · {compact_text(short_item)}")
    else:
        lines.append("- 未解析到最近三天版本记录（请检查工程提示词.md格式）")

    return "\n".join(lines)


def _json_preview(data: Any, max_len: int = 8000) -> str:
    text = json.dumps(data, ensure_ascii=False)
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def analyze_with_claude(cfg: Dict[str, Any], metrics: Dict[str, Any], versions: Dict[str, Any], brief: str) -> str:
    ai_cfg = cfg.get("anthropic", {})
    token = (ai_cfg.get("token") or os.getenv("ANTHROPIC_AUTH_TOKEN") or "").strip()
    if not token:
        return ""

    base_url = (ai_cfg.get("base_url") or os.getenv("ANTHROPIC_BASE_URL") or "https://api.anthropic.com").strip()
    model = (ai_cfg.get("model") or os.getenv("ANTHROPIC_MODEL") or "qwen3.5-plus").strip()
    max_tokens = int(ai_cfg.get("max_tokens", 300))
    timeout = int(ai_cfg.get("timeout", 120))
    endpoint_override = (ai_cfg.get("endpoint") or "").strip()

    api_path = "/v1/messages"
    endpoint = endpoint_override or f"{base_url.rstrip('/')}{api_path}"
    if (not endpoint_override) and base_url.rstrip("/").endswith("/v1/messages"):
        endpoint = base_url.rstrip("/")

    system_prompt = (
        "你是游戏数据分析师。请基于给定近三天数据和版本变更，输出精炼中文分析。"
        "要求：1) 先给总体判断；2) 给3-5条关键发现（用事实和数值）；3) 给3条可执行建议。"
        "控制在220字以内，避免空话。"
    )
    user_payload = {
        "time_window": {"start": metrics.get("start"), "end": metrics.get("end"), "days": metrics.get("days")},
        "daily": metrics.get("daily", []),
        "daily_player_compare": metrics.get("daily_player_compare", []),
        "ad_mode_detail": metrics.get("ad_mode_detail", []),
        "ad_mode_daily_unique_players": metrics.get("ad_mode_daily_unique_players", []),
        "recent_versions": [
            {"date": v.get("date"), "title": v.get("title"), "items": (v.get("items") or [])[:3]}
            for v in (versions.get("versions", [])[:3])
        ],
    }

    try:
        def _call_once(content_text: str, call_timeout: int) -> Dict[str, Any]:
            req_payload = {
                "model": model,
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": [{"role": "user", "content": content_text}],
            }
            data = json.dumps(req_payload, ensure_ascii=False).encode("utf-8")
            req = urllib.request.Request(endpoint, data=data, method="POST")
            req.add_header("Content-Type", "application/json")
            req.add_header("Authorization", f"Bearer {token}")
            req.add_header("x-api-key", token)
            req.add_header("anthropic-version", "2023-06-01")
            with urllib.request.urlopen(req, timeout=call_timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))

        prompt_text = "请分析以下日报数据并给出小结与建议：\n" + _json_preview(user_payload, max_len=5000)
        try:
            raw = _call_once(prompt_text, timeout)
        except Exception:
            retry_payload = {
                "time_window": user_payload["time_window"],
                "daily": user_payload["daily"],
                "daily_player_compare": user_payload["daily_player_compare"],
            }
            retry_text = (
                "首次请求超时，请基于精简数据快速给出小结与建议（不超过180字）：\n"
                + _json_preview(retry_payload, max_len=2200)
            )
            raw = _call_once(retry_text, max(45, timeout // 2))

        content = raw.get("content", [])
        parts: List[str] = []
        if isinstance(content, list):
            for it in content:
                if isinstance(it, dict) and it.get("type") == "text":
                    txt = str(it.get("text", "")).strip()
                    if txt:
                        parts.append(txt)
        return "\n".join(parts).strip()
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            err_body = ""
        if len(err_body) > 500:
            err_body = err_body[:500] + "..."
        return f"Claude分析失败：HTTP {e.code} {e.reason} | endpoint={endpoint} | body={err_body}"
    except Exception as e:
        return f"Claude分析失败：{e} | endpoint={endpoint}"


def append_claude_summary(brief: str, claude_summary: str) -> str:
    if not claude_summary:
        return brief
    lines = [brief, "", "七、Claude小结与建议", claude_summary.strip()]
    return "\n".join(lines)


def build_claude_summary_text(claude_summary: str) -> str:
    if not claude_summary:
        return "七、Claude小结与建议\n（暂无）"
    return f"七、Claude小结与建议\n{claude_summary.strip()}"


def send_wecom(webhook: str, content: str) -> Dict[str, Any]:
    payload = {"msgtype": "text", "text": {"content": content}}
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(webhook, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)
    days = int(cfg.get("report", {}).get("days", 3))

    metrics = query_daily_metrics(cfg)
    try:
        prompt_md = fetch_github_file(cfg)
    except Exception:
        # 版本记录属于补充信息，读取失败时不影响日报主流程
        prompt_md = ""
    versions = parse_recent_versions(prompt_md, days=days)
    brief_main = build_brief_text(metrics, versions)
    claude_summary = analyze_with_claude(cfg, metrics, versions, brief_main)
    brief_claude = build_claude_summary_text(claude_summary)
    brief = append_claude_summary(brief_main, claude_summary)

    result = {
        "metrics": metrics,
        "versions": versions,
        "brief_main": brief_main,
        "brief_claude": brief_claude,
        "brief": brief,
        "claude_summary": claude_summary,
    }

    if args.dry_run:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    webhook = cfg["wecom"]["webhook"]
    wecom_resp_main = send_wecom(webhook, brief_main)
    wecom_resp_claude = send_wecom(webhook, brief_claude)
    result["wecom_response_main"] = wecom_resp_main
    result["wecom_response_claude"] = wecom_resp_claude
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
