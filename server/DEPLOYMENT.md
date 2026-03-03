# 游戏埋点系统部署指南

## 一、服务器环境准备

### 1. 安装 MySQL 8.0+
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# CentOS/RHEL
sudo yum install mysql-server

# 启动 MySQL 服务
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 2. 安装 Node.js 16+
```bash
# 使用 nvm 安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 或直接安装
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. 安装 PM2（进程管理器）
```bash
npm install -g pm2
```

## 二、数据库配置

### 1. 登录 MySQL
```bash
mysql -u root -p
```

### 2. 执行数据库初始化脚本
```bash
mysql -u root -p < /path/to/game_analytics.sql
```

### 3. 验证数据库和用户
```sql
-- 查看数据库
SHOW DATABASES;

-- 查看用户
SELECT user, host FROM mysql.user WHERE user = 'tower_game_user';

-- 测试用户权限
mysql -u tower_game_user -p
USE tower_defense_analytics;
SHOW TABLES;
```

### 4. 配置远程访问（如需要）
```sql
-- 修改 MySQL 配置文件
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

-- 注释掉或修改 bind-address
# bind-address = 127.0.0.1
bind-address = 0.0.0.0

-- 重启 MySQL
sudo systemctl restart mysql

-- 配置防火墙
sudo ufw allow 3306/tcp
```

## 三、API 服务部署

### 1. 上传代码到服务器
```bash
# 在服务器上创建目录
mkdir -p /var/www/tower-defense-api
cd /var/www/tower-defense-api

# 上传 server 目录下的文件
# 使用 scp 或 git clone
scp -r ./server/* user@www.egoistcookie.top:/var/www/tower-defense-api/
```

### 2. 安装依赖
```bash
cd /var/www/tower-defense-api
npm install
```

### 3. 配置环境变量（可选）
```bash
# 创建 .env 文件
cat > .env << EOF
DB_HOST=localhost
DB_PORT=3306
DB_USER=tower_game_user
DB_PASSWORD=TowerGame@2026!
DB_NAME=tower_defense_analytics
API_PORT=3000
EOF
```

### 4. 测试运行
```bash
# 直接运行测试
node analytics-api.js

# 或使用 npm
npm start
```

**常见问题：端口被占用**

如果遇到 `Error: listen EADDRINUSE: address already in use :::3000` 错误，说明端口已被占用。

解决方案：

**方案1：查找并停止占用端口的进程**
```bash
# 查找占用 3000 端口的进程
lsof -i :3000
# 或者
netstat -tlnp | grep :3000

# 找到进程 PID 后，停止它
kill -9 <PID>

# 如果是 PM2 进程，使用
pm2 list
pm2 stop <app-name>
pm2 delete <app-name>
```

**方案2：使用其他端口**
```bash
# 方式1：通过环境变量指定端口
PORT=3001 node analytics-api.js

# 方式2：修改 .env 文件
echo "API_PORT=3001" >> .env
node analytics-api.js

# 方式3：直接指定端口启动
PORT=3001 pm2 start analytics-api.js --name tower-analytics
```

**注意：** 如果修改了端口，需要同步修改：
- Nginx 配置中的 `proxy_pass` 端口
- 游戏客户端中的 API 地址端口

### 5. 使用 PM2 启动服务
```bash
# 启动服务
pm2 start analytics-api.js --name tower-analytics

# 查看状态
pm2 status

# 查看日志
pm2 logs tower-analytics

# 设置开机自启
pm2 startup
pm2 save
```

## 四、Nginx 反向代理配置

### 1. 安装 Nginx
```bash
sudo apt install nginx
```

### 2. 配置反向代理
```bash
sudo nano /etc/nginx/sites-available/tower-analytics
```

添加以下配置：
```nginx
server {
    listen 80;
    server_name www.egoistcookie.top;

    # API 接口
    location /api/analytics/ {
        proxy_pass http://localhost:3000/api/analytics/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
    }
}
```

### 3. 启用配置并重启 Nginx
```bash
sudo ln -s /etc/nginx/sites-available/tower-analytics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置 HTTPS（推荐）
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d www.egoistcookie.top

# 自动续期
sudo certbot renew --dry-run
```

## 五、防火墙配置

```bash
# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许 SSH（如果还没开启）
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw enable
sudo ufw status
```

## 六、监控和维护

### 1. 查看 PM2 进程
```bash
pm2 list
pm2 monit
```

### 2. 查看日志
```bash
# PM2 日志
pm2 logs tower-analytics

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MySQL 日志
sudo tail -f /var/log/mysql/error.log
```

### 3. 数据库备份
```bash
# 创建备份脚本
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mysqldump -u tower_game_user -pTowerGame@2026! tower_defense_analytics > $BACKUP_DIR/tower_analytics_$DATE.sql

# 保留最近7天的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x /root/backup-db.sh

# 添加到 crontab（每天凌晨3点备份）
crontab -e
# 添加：0 3 * * * /root/backup-db.sh
```

### 4. 性能监控
```bash
# 安装 htop
sudo apt install htop

# 监控系统资源
htop

# 监控 MySQL 性能
mysql -u root -p -e "SHOW PROCESSLIST;"
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
```

## 七、测试接口

### 1. 健康检查
```bash
curl http://www.egoistcookie.top/api/health
```

### 2. 测试数据上报
```bash
curl -X POST http://www.egoistcookie.top/api/analytics/report \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "test_player_001",
    "level": 1,
    "operations": [
      {"type": "build_watchtower", "timestamp": 1234567890, "gameTime": 10.5}
    ],
    "result": "success",
    "endTime": 1234567890,
    "defendTime": 180,
    "currentWave": 5,
    "finalGold": 50,
    "finalPopulation": 8,
    "killCount": 25
  }'
```

### 3. 查询玩家统计
```bash
curl http://www.egoistcookie.top/api/analytics/player/test_player_001
```

## 八、常见问题

### 1. 连接数据库失败
- 检查 MySQL 服务是否运行：`sudo systemctl status mysql`
- 检查用户名密码是否正确
- 检查防火墙是否允许 3306 端口

### 2. API 无法访问
- 检查 Node.js 服务是否运行：`pm2 status`
- 检查 Nginx 配置是否正确：`sudo nginx -t`
- 查看错误日志：`pm2 logs tower-analytics`

### 3. 跨域问题
- 确保 API 代码中已启用 CORS
- 检查 Nginx 配置中的 proxy_set_header

## 九、安全建议

1. **修改默认密码**：将 `TowerGame@2026!` 改为更强的密码
2. **限制数据库访问**：只允许本地或特定IP访问
3. **启用 HTTPS**：使用 Let's Encrypt 免费证书
4. **定期更新**：保持系统和依赖包最新
5. **监控异常**：设置日志告警机制
6. **限流保护**：使用 Nginx 限制请求频率

## 十、联系方式

如有问题，请联系技术支持。
