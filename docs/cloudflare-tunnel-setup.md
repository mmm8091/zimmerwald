# Cloudflare Tunnel 配置指南

## 目标
通过 Cloudflare Tunnel 将 RSSHub（运行在 `http://127.0.0.1:1200`）通过 HTTPS 暴露，解决 Cloudflare Workers 访问 HTTP 地址被拦截的问题。

## 前置条件
1. 拥有 Cloudflare 账号
2. 有一个域名（可以免费使用 Cloudflare 提供的域名）
3. 服务器可以访问互联网

## 步骤 1: 安装 cloudflared

在服务器上安装 `cloudflared`：

```bash
# Ubuntu/Debian
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# 或者使用包管理器
sudo apt-get update
sudo apt-get install cloudflared
```

验证安装：
```bash
cloudflared --version
```

## 步骤 2: 登录 Cloudflare

```bash
cloudflared tunnel login
```

这会打开浏览器，选择你的域名并授权。授权后会在 `~/.cloudflared/cert.pem` 生成证书。

## 步骤 3: 创建 Tunnel

```bash
# 创建隧道（名称可以自定义，如 rsshub-tunnel）
cloudflared tunnel create rsshub-tunnel
```

记下输出的 Tunnel ID（类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）。

## 步骤 4: 创建配置文件

创建配置文件 `~/.cloudflared/config.yml`：

```yaml
tunnel: <你的 Tunnel ID>
credentials-file: /root/.cloudflared/<Tunnel ID>.json

ingress:
  # RSSHub 服务
  - hostname: rsshub.yourdomain.com  # 替换为你的域名
    service: http://127.0.0.1:1200
  # 默认规则（必须放在最后）
  - service: http_status:404
```

**重要提示**：
- 将 `rsshub.yourdomain.com` 替换为你的实际域名
- 将 `<你的 Tunnel ID>` 替换为步骤 3 中创建的 Tunnel ID

## 步骤 5: 配置 DNS 记录

在 Cloudflare Dashboard 中添加 DNS 记录：

1. 登录 Cloudflare Dashboard
2. 选择你的域名
3. 进入 DNS 设置
4. 添加 CNAME 记录：
   - 名称：`rsshub`（或你想要的子域名）
   - 目标：`<Tunnel ID>.cfargotunnel.com`
   - 代理状态：已代理（橙色云朵）

## 步骤 6: 运行 Tunnel（测试）

先手动运行测试：

```bash
cloudflared tunnel --config ~/.cloudflared/config.yml run
```

如果看到类似 `Connection established` 的消息，说明配置成功。

按 `Ctrl+C` 停止测试。

## 步骤 7: 配置为系统服务（开机自启）

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/cloudflared.service
```

内容：

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --config /root/.cloudflared/config.yml run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

如果 `cloudflared` 安装在 `/usr/bin/cloudflared`，修改 `ExecStart` 路径。

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

## 步骤 8: 测试 HTTPS 访问

```bash
# 测试 HTTPS 访问
curl -v "https://rsshub.yourdomain.com/twitter/user/UAW" | head -20
```

如果返回 200 和 RSS 内容，说明配置成功。

## 步骤 9: 更新代码中的 RSSHUB_BASE

将 `src/config/rss-sources.ts` 中的 `RSSHUB_BASE` 更新为 HTTPS 地址：

```typescript
const RSSHUB_BASE = 'https://rsshub.yourdomain.com';
```

## 故障排查

### 检查 Tunnel 状态
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

### 查看 Tunnel 列表
```bash
cloudflared tunnel list
```

### 删除 Tunnel（如果需要）
```bash
cloudflared tunnel delete <Tunnel ID>
```

### 检查 DNS 解析
```bash
nslookup rsshub.yourdomain.com
```

## 安全建议

1. **使用子域名**：不要使用主域名，使用子域名（如 `rsshub.yourdomain.com`）
2. **限制访问**：可以在 Cloudflare Dashboard 中设置访问规则，只允许特定 IP 访问
3. **监控使用**：在 Cloudflare Dashboard 中监控 Tunnel 的使用情况

