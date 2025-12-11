#!/bin/bash
# Cloudflare Tunnel 快速配置脚本

set -e

echo "=== Cloudflare Tunnel 快速配置 ==="
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 root 权限运行此脚本"
    exit 1
fi

# 步骤 1: 安装 cloudflared
echo "步骤 1: 检查 cloudflared 是否已安装..."
if ! command -v cloudflared &> /dev/null; then
    echo "正在安装 cloudflared..."
    
    # 检测系统类型
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        ARCH=$(dpkg --print-architecture)
        if [ "$ARCH" = "amd64" ]; then
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
            dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
        elif [ "$ARCH" = "arm64" ]; then
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
            dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
        else
            echo "不支持的架构: $ARCH"
            exit 1
        fi
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.rpm -o /tmp/cloudflared.rpm
        rpm -i /tmp/cloudflared.rpm || yum install -y /tmp/cloudflared.rpm
    else
        echo "不支持的系统，请手动安装 cloudflared"
        exit 1
    fi
    
    rm -f /tmp/cloudflared.deb /tmp/cloudflared.rpm
    echo "✓ cloudflared 安装完成"
else
    echo "✓ cloudflared 已安装: $(cloudflared --version)"
fi

echo ""

# 步骤 2: 提示用户登录
echo "步骤 2: 登录 Cloudflare"
echo "请运行以下命令登录（会打开浏览器）："
echo "  cloudflared tunnel login"
echo ""
read -p "是否已完成登录？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "请先运行 'cloudflared tunnel login' 完成登录"
    exit 1
fi

# 步骤 3: 创建 Tunnel
echo ""
echo "步骤 3: 创建 Tunnel"
read -p "请输入隧道名称（默认: rsshub-tunnel）: " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-rsshub-tunnel}

echo "正在创建隧道: $TUNNEL_NAME"
TUNNEL_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP 'Created tunnel \K[^ ]+' || echo "")

if [ -z "$TUNNEL_ID" ]; then
    echo "无法获取 Tunnel ID，请手动创建："
    echo "  cloudflared tunnel create $TUNNEL_NAME"
    read -p "请输入 Tunnel ID: " TUNNEL_ID
fi

echo "✓ Tunnel ID: $TUNNEL_ID"

# 步骤 4: 获取域名
echo ""
echo "步骤 4: 配置域名"
read -p "请输入你的域名（例如: example.com）: " DOMAIN
read -p "请输入子域名（默认: rsshub）: " SUBDOMAIN
SUBDOMAIN=${SUBDOMAIN:-rsshub}
FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"

echo "完整域名: $FULL_DOMAIN"

# 步骤 5: 创建配置文件
echo ""
echo "步骤 5: 创建配置文件"
CONFIG_DIR="$HOME/.cloudflared"
mkdir -p "$CONFIG_DIR"

CONFIG_FILE="$CONFIG_DIR/config.yml"
cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  # RSSHub 服务
  - hostname: $FULL_DOMAIN
    service: http://127.0.0.1:1200
  # 默认规则（必须放在最后）
  - service: http_status:404
EOF

echo "✓ 配置文件已创建: $CONFIG_FILE"
echo ""
echo "配置文件内容："
cat "$CONFIG_FILE"

# 步骤 6: 配置 DNS（提示用户）
echo ""
echo "步骤 6: 配置 DNS 记录"
echo "请在 Cloudflare Dashboard 中添加以下 DNS 记录："
echo "  类型: CNAME"
echo "  名称: $SUBDOMAIN"
echo "  目标: $TUNNEL_ID.cfargotunnel.com"
echo "  代理状态: 已代理（橙色云朵）"
echo ""
read -p "是否已完成 DNS 配置？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "请先完成 DNS 配置，然后重新运行此脚本"
    exit 1
fi

# 步骤 7: 测试 Tunnel
echo ""
echo "步骤 7: 测试 Tunnel 连接"
echo "正在测试连接（10秒后自动停止）..."
timeout 10 cloudflared tunnel --config "$CONFIG_FILE" run || true

# 步骤 8: 配置 systemd 服务
echo ""
echo "步骤 8: 配置 systemd 服务"
CLOUDFLARED_PATH=$(which cloudflared)

SERVICE_FILE="/etc/systemd/system/cloudflared.service"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=$CLOUDFLARED_PATH tunnel --config $CONFIG_FILE run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared

echo "✓ systemd 服务已配置并启动"

# 步骤 9: 检查状态
echo ""
echo "步骤 9: 检查服务状态"
sleep 2
systemctl status cloudflared --no-pager -l

echo ""
echo "=== 配置完成 ==="
echo ""
echo "Tunnel 信息："
echo "  Tunnel ID: $TUNNEL_ID"
echo "  Tunnel 名称: $TUNNEL_NAME"
echo "  域名: $FULL_DOMAIN"
echo "  配置文件: $CONFIG_FILE"
echo ""
echo "测试命令："
echo "  curl -v \"https://$FULL_DOMAIN/twitter/user/UAW\""
echo ""
echo "查看日志："
echo "  sudo journalctl -u cloudflared -f"
echo ""
echo "请更新代码中的 RSSHUB_BASE 为: https://$FULL_DOMAIN"

