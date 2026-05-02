
--游戏缓存表 
--260425：372局 92至少1抽 39局到结束（12局老玩家）	25/39
--260424：253局 33至少1抽 9局到结束（5局老玩家） 	1/4成功率
--260423：145局 31至少1抽 10局到结束（0老玩家） 	3/10成功率
--查询非测试游戏记录
select * from game_sessions order by created_at desc;
select * from game_sessions where 
 player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown') 
order by created_at desc;
--查询非测试有抽卡的游戏记录
select * from game_sessions 
 where player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown')
 and id in (select session_id from card_selection_events where game_time !=0 ) 
order by created_at desc ;
--查询非测试完整游戏记录
select * from game_sessions 
 where player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown')
 and result is not null 
order by created_at desc ;
--查询当天的非测试游戏记录
select * from game_sessions where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown') 
order by created_at desc ;
--查询昨日的非测试游戏记录
select * from game_sessions where DATE(created_at) = CURDATE() -1
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown') 
order by created_at desc ;
--查询具体某玩家的游戏记录
select * from game_sessions where player_id='player_1774265446223_9255';
--统计每天有多少局游戏（包括0到12秒的游戏记录）（20260423之后才开始保存进行了0到12秒的游戏记录）
select DATE(created_at),count(*) from game_sessions 
 where  player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown') 
group by DATE(created_at) order by DATE(created_at) desc ;
--统计每天有多少局游戏（至少进行了12秒的、抽了一次卡的游戏）
select DATE(created_at),count(*) from game_sessions 
 where  player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown') 
 and id in (select session_id from card_selection_events where game_time !=0 ) 
group by DATE(created_at) order by DATE(created_at) desc ;
--统计每天有多少局游戏进行到结束
select DATE(created_at),count(*) from game_sessions 
 where  player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown') and result is not null 
group by DATE(created_at) order by DATE(created_at) desc ;
--统计当天有多少玩家、各玩了几局（非测试）
select player_id,count(*) from game_sessions where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') 
 and player_id not in (select player_id from visitor_source_records where channel='unknown') 
group by player_id ;
--统计昨天有多少玩家、各玩了几局（非测试）
select player_id,count(*) from game_sessions where DATE(created_at) = CURDATE()-1
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335','player_1772722064044_978','player_1772465771074_4106')
 and player_id not in (select player_id from visitor_source_records where channel='unknown') 
group by player_id ;

--选卡明细表
select * from card_selection_events  order by created_at desc ;
--查询当天有多少次非测试抽卡
select session_id,player_id,level,game_time ,selection_mode,cards_json,created_at  from card_selection_events where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown')  
order by created_at desc ;
--查询昨天有多少次非测试抽卡
select session_id,player_id,level,game_time ,selection_mode,cards_json,created_at from card_selection_events where DATE(created_at) = CURDATE()-1
 and player_id  in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown')  
order by created_at desc ;
--统计每天有多少非测试广告抽卡(reroll、和get_all和single_video只有看完了视频才会触发)
select DATE(created_at),player_id,count(*) from card_selection_events where selection_mode  in ('get_all','reroll','single_video') 
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown')  
group by DATE(created_at),player_id order by DATE(created_at) desc ;
--统计每天非测试广告抽卡及该玩家的创建时间（创建时间为空，则代表该玩家一局游戏都没有完整结束过）
select DATE(a.created_at),a.player_id,ps.created_at ,count(*) from card_selection_events a left join player_statistics ps on a.player_id =ps.player_id 
where a.selection_mode  in ('get_all','reroll') 
 and a.player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106') and player_id not in (select player_id from visitor_source_records where channel='unknown')  
group by DATE(a.created_at),a.player_id,ps.created_at order by DATE(created_at) desc ;

--游戏记录主表（游戏正常结束了才会记录）
select * from game_records where player_id='player_1774265446223_9255';
select * from game_records order by created_at desc;
select * from game_records where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106')
 and player_id not in (select player_id from visitor_source_records where channel='unknown')  
order by created_at desc;
select * from game_records where defend_time !=0 order by created_at desc;
--玩家信息表
select * from player_statistics where created_at>'20260429' order by created_at desc;
select * from player_statistics where player_id like '%player_1777095847465_6130';
--统计：一个敌人都没击败的玩家： 0个
select * from player_statistics where total_kills =0;
--操作类型统计表
select * from operation_statistics os ;
select * from operation_statistics os where player_id  in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335',
,'player_1772722064044_978','player_1772465771074_4106') order by created_at desc;
--统计：没有建造任何东西的玩家 2个 ： player_1772528465464_6650 和 player_1772530812536_2652
select * from operation_statistics os where player_id not in (
select player_id from operation_statistics os  where 
 operation_type in ('build_war_ancient_tree','build_church','build_hunter_hall','build_swordsman_hall','build_ice_tower','build_thunder_tower')
);
--统计：没有训练任何单位的玩家（纯造塔） 7个
select * from operation_statistics os where player_id not in (
select player_id from operation_statistics os  where 
 operation_type in ('build_war_ancient_tree','build_church','build_hunter_hall','build_swordsman_hall')
);
select * from operation_statistics os  where 
 operation_type not in ('build_war_ancient_tree','build_church','build_hunter_hall','build_swordsman_hall');

--关卡统计表
select * from level_statistics;
--选卡汇总表
select unit_id,rarity,count(*) from card_selection_summary group by unit_id,rarity;

--视图-玩家排行榜
-- player_1772466497770_5671 手机
-- player_1772462826043_800 家里豆包浏览器
-- player_1772722064044_978 家里360浏览器
-- player_1772465771074_4106 家里开发工具
-- player_1772530937065_3381 公司360浏览器
--  公司开发工具
select * from player_leaderboard ps where ps.player_id ='player_1775223388887_5027' ;
--视图-关卡难度分析
select * from level_difficulty_analysis;
--视图-击杀榜
select * from player_kill_rank pkr ;

--玩家反馈信息表
select * from player_feedback pf ;
--玩家评论表
select * from player_feedback_comments pfc ;
--玩家投票表
select * from player_feedback_votes pfv ;

--访客表（非玩家，只是停留在首页就会记录）（统计玩家之来源）
select * from visitor_source_records order by created_at desc ;
select * from visitor_source_records where player_id like '%player_1777171248460_4225%'
select scene,count(*) from visitor_source_records where  player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381'
,'player_1775652153130_8335','player_1772722064044_978','player_1772465771074_4106')  group by scene;


--称号使用逻辑：查询某角色等级最高的玩家
SELECT
	gr.player_id,JSON_EXTRACT(gr.unit_levels_json, '$.ElfSwordsman'),
    COALESCE(ps.player_name, gr.player_id) AS player_name
 FROM game_records gr
 LEFT JOIN player_statistics ps ON ps.player_id = gr.player_id
 WHERE gr.unit_levels_json IS NOT NULL
   AND JSON_EXTRACT(gr.unit_levels_json, '$.ElfSwordsman') IS NOT NULL
 ORDER BY JSON_EXTRACT(gr.unit_levels_json, '$.ElfSwordsman') DESC
 LIMIT 50












