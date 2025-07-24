#!/bin/bash

# 初始化安装脚本

echo "🚀 初始化Hexo发布器..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js已安装: $(node --version)"

# 安装依赖
echo "📦 安装依赖包..."
npm install

# 设置执行权限
chmod +x publish.sh

echo "⚙️  配置向导..."

# 读取用户配置
read -p "请输入Hexo博客的posts目录路径: " POSTS_DIR
read -p "请输入Hexo博客的images目录路径: " IMAGES_DIR
read -p "请输入Hexo博客的Git仓库路径: " GIT_REPO
read -p "请输入博客网站URL: " BLOG_URL
read -p "请输入Obsidian知识库路径: " OBSIDIAN_PATH

# 生成配置文件
cat > config.json << EOF
{
  "hexo": {
    "postsDir": "$POSTS_DIR",
    "imagesDir": "$IMAGES_DIR",
    "gitRepo": "$GIT_REPO",
    "baseUrl": "$BLOG_URL"
  },
  "qiniu": {
    "domain": "syi4w5o08.hn-bkt.clouddn.com",
    "protocol": "http"
  },
  "git": {
    "autoCommit": true,
    "autoPush": true,
    "commitPrefix": "📝 Blog:",
    "branch": "main"
  },
  "deploy": {
    "autoHexoDeploy": true,
    "showProgress": true,
    "cleanBeforeGenerate": true
  },
  "download": {
    "maxRetries": 3,
    "concurrency": 3,
    "timeout": 30000,
    "compressImages": true
  },
  "obsidian": {
    "vaultPath": "$OBSIDIAN_PATH",
    "autoDetectRecent": true
  }
}
EOF

echo "✅ 配置文件已生成: config.json"

# 验证配置
echo "🔍 验证配置..."
if node -e "
    const config = require('./config.json');
    const fs = require('fs');
    
    if (!fs.existsSync(config.hexo.postsDir)) {
        console.error('❌ Hexo posts目录不存在');
        process.exit(1);
    }
    
    if (!fs.existsSync(config.obsidian.vaultPath)) {
        console.error('❌ Obsidian目录不存在');
        process.exit(1);
    }
    
    console.log('✅ 配置验证通过');
"; then
    echo "🎉 安装完成！"
    echo ""
    echo "使用方法:"
    echo "  ./publish.sh                    # 自动检测最近文件"
    echo "  ./publish.sh '文章标题.md'      # 发布指定文件"
    echo ""
else
    echo "❌ 配置验证失败，请检查路径是否正确"
    exit 1
fi
