
--游戏缓存表
select * from game_sessions  order by created_at desc;
select * from game_sessions where DATE(created_at) = CURDATE() 
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106')
order by created_at desc ;
select * from game_sessions where operations_json like '%trig%'  order by created_at desc
select * from game_sessions where DATE(created_at) = CURDATE() -1
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106')
order by created_at desc ;
select * from game_sessions where player_id='player_1774265446223_9255';
select * from game_sessions where revive_count !=0;
--统计当天有多少玩家、各玩了几局
select player_id,count(*) from game_sessions where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381'
,'player_1772722064044_978','player_1772465771074_4106') group by player_id ;
--统计昨天有多少玩家、各玩了几局
select player_id,count(*) from game_sessions where DATE(created_at) = CURDATE()-1
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335',
,'player_1772722064044_978','player_1772465771074_4106')  group by player_id ;
--统计每天有多少局游戏
select DATE(created_at),count(*) from game_sessions 
 where  player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381'
,'player_1772722064044_978','player_1772465771074_4106') group by DATE(created_at) order by DATE(created_at) desc ;
--选卡明细表
select * from card_selection_events  order by created_at desc ;
--统计每天有多少次抽卡
select session_id,player_id,level,game_time ,selection_mode,cards_json,created_at  from card_selection_events where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335',
'player_1772722064044_978','player_1772465771074_4106') order by created_at desc ;
select session_id,player_id,level,selection_mode,cards_json,created_at from card_selection_events where DATE(created_at) = CURDATE()
 and player_id  in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1775652153130_8335',
'player_1772722064044_978','player_1772465771074_4106') order by created_at desc ;
--统计每天有多少广告抽卡(reroll和get_all只有看完了视频才会触发)
select DATE(created_at),player_id,count(*) from card_selection_events where selection_mode  in ('get_all','reroll') 
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106')
 group by DATE(created_at),player_id order by DATE(created_at) desc ;
--统计每天广告抽卡及玩家的创建时间（创建时间为空则代表该玩家一局游戏都没有完整结束过）
select DATE(a.created_at),a.player_id,ps.created_at ,count(*) from card_selection_events a
left join player_statistics ps on a.player_id =ps.player_id 
where a.selection_mode  in ('get_all','reroll') 
 and a.player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106')
 group by DATE(a.created_at),a.player_id,ps.created_at order by DATE(created_at) desc ;

select * from player_statistics where player_id='player_1774974647317_9849';

--游戏记录主表
select * from game_records where player_id='player_1774265446223_9255';
select * from game_records  order by created_at desc;
select * from game_records where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381','player_1772722064044_978','player_1772465771074_4106')
order by created_at desc;
select * from game_records where defend_time !=0 order by created_at desc;
--玩家信息表
select * from player_statistics where created_at>'20260414' order by created_at desc;
select * from player_statistics where player_id like '%player_1775223388887_5027';
--操作类型统计表
select * from operation_statistics os ;
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

--统计：一个敌人都没击败的玩家： 0个
select * from player_statistics where total_kills =0;


select * from operation_statistics os  where 
 operation_type not in ('build_war_ancient_tree','build_church','build_hunter_hall','build_swordsman_hall');




select * from player_statistics order by created_at desc ;

ALTER TABLE player_statistics 
    MODIFY COLUMN player_avatar MEDIUMTEXT 
    COMMENT '玩家头像（Base64或URL）';






select * from player_feedback pf ;

select * from player_feedback_comments pfc ;

select * from player_feedback_votes pfv ;


select * from visitor_source_records order by created_at desc ;
select * from visitor_source_records where player_id like '%4565%'
select scene,count(*) from visitor_source_records where  player_id not in ('player_1772462826043_800','player_1772466497770_5671','player_1772530937065_3381'
,'player_1775652153130_8335','player_1772722064044_978','player_1772465771074_4106')  group by scene;


select * from player_statistics ps where ps.player_id ='player_1773885661760_9201';;

--查询某角色等级最高的玩家
SELECT
	gr.player_id,JSON_EXTRACT(gr.unit_levels_json, '$.ElfSwordsman'),
    COALESCE(ps.player_name, gr.player_id) AS player_name
 FROM game_records gr
 LEFT JOIN player_statistics ps ON ps.player_id = gr.player_id
 WHERE gr.unit_levels_json IS NOT NULL
   AND JSON_EXTRACT(gr.unit_levels_json, '$.ElfSwordsman') IS NOT NULL
 ORDER BY JSON_EXTRACT(gr.unit_levels_json, '$.ElfSwordsman') DESC
 LIMIT 50












