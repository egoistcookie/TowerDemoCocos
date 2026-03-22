
--游戏缓存表
select * from game_sessions where DATE(created_at) = CURDATE() 
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','','') order by created_at desc ;
select * from game_sessions where DATE(created_at) = CURDATE() -1
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','','') order by created_at desc ;
--查询当天有多少玩家、各玩了几局
select player_id,count(*) from game_sessions where DATE(created_at) = CURDATE() group by player_id ;
select player_id,count(*) from game_sessions where DATE(created_at) = CURDATE()-1 group by player_id ;
--选卡明细表
select * from card_selection_events where DATE(created_at) = CURDATE()
 and player_id not in ('player_1772462826043_800','player_1772466497770_5671','','') order by created_at desc ;
select * from card_selection_events where DATE(created_at) = CURDATE()-1 order by created_at desc ;
select * from card_selection_events  order by created_at desc ;
select * from card_selection_events where cards_json like BINARY  '%UR%' order by created_at desc ;
select * from card_selection_events where selection_mode  like '%get_all%' order by created_at desc ;

--游戏记录主表
select * from game_records order by created_at desc;
select * from game_records where defend_time !=0 order by created_at desc;
--玩家信息表
select * from player_statistics where created_at>'20260317' order by created_at desc;
select * from player_statistics where player_id like '%player_1774104641493_9000';
--操作类型统计表
select * from operation_statistics os ;
--关卡统计表
select * from level_statistics;
--选卡汇总表
select * from card_selection_summary;

--视图-玩家排行榜
select * from player_leaderboard ps ;
--视图-关卡难度分析
select * from level_difficulty_analysis;
--视图-击杀榜
select * from player_kill_rank pkr ;


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




