#!/bin/bash

# 一键发布脚本
# 用法: ./publish.sh [文件名]

set -e  # 遇到错误立即退出

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "🔧 脚本目录: $SCRIPT_DIR"

# 切换到脚本目录，确保相对路径正确
cd "$SCRIPT_DIR"
echo "📁 当前工作目录: $(pwd)"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo "❌ 配置文件不存在，请先创建config.json"
    exit 1
fi

echo "🎯 启动一键发布器..."

# 如果没有提供文件，尝试自动检测
if [ -z "$1" ]; then
    echo "🔍 自动检测最近编辑的文件..."

    # 从配置文件读取Obsidian路径
    OBSIDIAN_PATH=$(node -e "
        const config = require('./config.json');
        console.log(config.obsidian.vaultPath);
    ")

    if [ -d "$OBSIDIAN_PATH" ]; then
        # 查找最近24小时内修改的markdown文件
        RECENT_FILES=($(find "$OBSIDIAN_PATH" -name "*.md" -mtime -1 -type f | head -5))

        if [ ${#RECENT_FILES[@]} -eq 0 ]; then
            echo "❌ 未找到最近编辑的文件"
            echo "用法: ./publish.sh '文章标题.md'"
            exit 1
        elif [ ${#RECENT_FILES[@]} -eq 1 ]; then
            SELECTED_FILE="${RECENT_FILES[0]}"
            echo "📝 检测到文件: $(basename "$SELECTED_FILE")"
            read -p "是否发布此文件? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "❌ 取消发布"
                exit 0
            fi
        else
            echo "📝 检测到多个最近修改的文件:"
            for i in "${!RECENT_FILES[@]}"; do
                echo "   $((i+1)). $(basename "${RECENT_FILES[$i]}")"
            done

            read -p "请选择要发布的文件 (1-${#RECENT_FILES[@]}): " -r
            if [[ $REPLY =~ ^[1-${#RECENT_FILES[@]}]$ ]]; then
                SELECTED_FILE="${RECENT_FILES[$((REPLY-1))]}"
            else
                echo "❌ 无效选择"
                exit 1
            fi
        fi
    else
        echo "❌ Obsidian路径不存在: $OBSIDIAN_PATH"
        echo "请检查config.json中的obsidian.vaultPath配置"
        exit 1
    fi
else
    # 使用提供的文件
    SELECTED_FILE="$1"

    # 如果是相对路径，尝试在Obsidian目录中查找
    if [[ ! "$SELECTED_FILE" = /* ]]; then
        OBSIDIAN_PATH=$(node -e "
            const config = require('./config.json');
            console.log(config.obsidian.vaultPath);
        ")

        FULL_PATH="$OBSIDIAN_PATH/$SELECTED_FILE"
        if [ -f "$FULL_PATH" ]; then
            SELECTED_FILE="$FULL_PATH"
        fi
    fi
fi

# 检查文件是否存在
if [ ! -f "$SELECTED_FILE" ]; then
    echo "❌ 文件不存在: $SELECTED_FILE"
    exit 1
fi

# 检查文件是否可读
if [ ! -r "$SELECTED_FILE" ]; then
    echo "❌ 文件无法读取: $SELECTED_FILE"
    exit 1
fi

# 检查目标目录
HEXO_POSTS_DIR=$(node -e "
    const config = require('./config.json');
    console.log(config.hexo.postsDir);
")

echo "🚀 开始发布: $(basename "$SELECTED_FILE")"
echo "📄 文件路径: $SELECTED_FILE"
echo "📂 博客文章目录: $HEXO_POSTS_DIR"
echo "----------------------------------------"

# 检查目标目录是否存在
if [ ! -d "$HEXO_POSTS_DIR" ]; then
    echo "⚠️ 博客文章目录不存在，将自动创建"
    mkdir -p "$HEXO_POSTS_DIR"
fi

# 检查目标目录是否可写
if [ ! -w "$HEXO_POSTS_DIR" ]; then
    echo "❌ 博客文章目录无法写入: $HEXO_POSTS_DIR"
    echo "请检查目录权限"
    exit 1
fi

# 执行发布
echo "🎯 启动发布器..."
if node "$SCRIPT_DIR/../src/core/magic-publish.js" "$SELECTED_FILE"; then
    echo "----------------------------------------"
    echo "🎉 发布流程完成！"

    # 显示日志文件位置
    LOG_FILE="publish-$(date +%Y-%m-%d).log"
    if [ -f "$LOG_FILE" ]; then
        echo "📋 详细日志: $SCRIPT_DIR/$LOG_FILE"
    fi

    # 显示目标文件
    TARGET_FILE="$HEXO_POSTS_DIR/$(basename "$SELECTED_FILE")"
    if [ -f "$TARGET_FILE" ]; then
        echo "✅ 文件已成功保存到: $TARGET_FILE"
        echo "📊 文件大小: $(du -h "$TARGET_FILE" | cut -f1)"
    else
        echo "⚠️ 警告: 文件可能未成功保存到博客目录"
    fi
else
    echo "----------------------------------------"
    echo "❌ 发布失败！"

    # 显示日志文件位置
    LOG_FILE="publish-$(date +%Y-%m-%d).log"
    if [ -f "$LOG_FILE" ]; then
        echo "📋 错误日志: $SCRIPT_DIR/$LOG_FILE"
        echo "📖 查看最近的错误信息:"
        tail -10 "$LOG_FILE" | sed 's/^/   /'
    fi

    echo ""
    echo "💡 常见问题排查:"
    echo "   1. 检查网络连接"
    echo "   2. 确认Git仓库状态: cd $(node -e "console.log(require('./config.json').hexo.gitRepo)") && git status"
    echo "   3. 检查Hexo配置: cd $(node -e "console.log(require('./config.json').hexo.gitRepo)") && hexo version"
    echo "   4. 检查文件路径: $SELECTED_FILE"
    echo "   5. 检查目标目录: $HEXO_POSTS_DIR"
    echo "   6. 查看完整日志: cat $SCRIPT_DIR/$LOG_FILE"

    exit 1
fi

# 询问是否打开博客
read -p "是否打开博客查看效果? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BLOG_URL=$(node -e "
        const config = require('./config.json');
        console.log(config.hexo.baseUrl);
    ")

    if command -v open &> /dev/null; then
        open "$BLOG_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$BLOG_URL"
    else
        echo "🔗 博客地址: $BLOG_URL"
    fi
fi
