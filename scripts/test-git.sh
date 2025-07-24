#!/bin/bash

# Git操作测试脚本
# 用于测试和调试git相关问题

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Git操作测试脚本"
echo "===================="

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo "❌ 配置文件不存在，请先创建config.json"
    exit 1
fi

# 读取Git仓库路径
GIT_REPO=$(node -e "
    const config = require('./config.json');
    console.log(config.hexo.gitRepo);
")

BRANCH=$(node -e "
    const config = require('./config.json');
    console.log(config.git.branch);
")

echo "📁 Git仓库路径: $GIT_REPO"
echo "🌿 分支: $BRANCH"
echo ""

# 检查目录是否存在
if [ ! -d "$GIT_REPO" ]; then
    echo "❌ Git仓库目录不存在: $GIT_REPO"
    exit 1
fi

# 切换到Git仓库目录
echo "🔄 切换到Git仓库目录..."
cd "$GIT_REPO"
echo "📍 当前目录: $(pwd)"
echo ""

# 检查是否是Git仓库
echo "🔍 检查Git仓库状态..."
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 当前目录不是Git仓库"
    exit 1
fi

echo "✅ 确认是Git仓库"
echo ""

# 显示当前分支
echo "🌿 当前分支信息:"
git branch -v
echo ""

# 显示远程仓库信息
echo "🌐 远程仓库信息:"
git remote -v
echo ""

# 检查工作区状态
echo "📋 工作区状态:"
git status --porcelain
if [ $? -eq 0 ]; then
    echo "✅ Git状态检查正常"
else
    echo "❌ Git状态检查失败"
fi
echo ""

# 测试拉取操作
echo "⬇️  测试拉取操作..."
if git pull origin "$BRANCH" --dry-run 2>/dev/null; then
    echo "✅ 拉取测试成功"
else
    echo "⚠️  拉取测试失败，可能的原因:"
    echo "   1. 网络连接问题"
    echo "   2. 远程仓库不存在"
    echo "   3. 认证问题"
    echo "   4. 分支不存在"
fi
echo ""

# 测试推送权限
echo "⬆️  测试推送权限..."
if git push origin "$BRANCH" --dry-run 2>/dev/null; then
    echo "✅ 推送权限测试成功"
else
    echo "⚠️  推送权限测试失败，可能的原因:"
    echo "   1. 没有推送权限"
    echo "   2. 认证问题"
    echo "   3. 分支保护规则"
fi
echo ""

# 显示最近的提交
echo "📝 最近的提交记录:"
git log --oneline -5
echo ""

# 检查是否有未跟踪的文件
echo "📂 未跟踪的文件:"
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -z "$UNTRACKED" ]; then
    echo "   (无未跟踪文件)"
else
    echo "$UNTRACKED" | sed 's/^/   /'
fi
echo ""

# 检查是否有已修改的文件
echo "✏️  已修改的文件:"
MODIFIED=$(git diff --name-only)
if [ -z "$MODIFIED" ]; then
    echo "   (无已修改文件)"
else
    echo "$MODIFIED" | sed 's/^/   /'
fi
echo ""

# 检查是否有已暂存的文件
echo "📦 已暂存的文件:"
STAGED=$(git diff --cached --name-only)
if [ -z "$STAGED" ]; then
    echo "   (无已暂存文件)"
else
    echo "$STAGED" | sed 's/^/   /'
fi
echo ""

echo "🎯 Git测试完成！"
echo ""
echo "💡 如果发现问题，请检查:"
echo "   1. 网络连接是否正常"
echo "   2. Git认证是否配置正确"
echo "   3. 远程仓库是否存在且有权限"
echo "   4. 分支名称是否正确"
