#!/bin/bash

# Git 智能提交脚本
# 用法: ./git_commit.sh [选项] [提交信息]
# 选项: -q, --quiet  静默模式（最小输出）
#       -v, --verbose 详细模式（显示所有步骤）
#       -h, --help    显示帮助

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认模式：简洁
VERBOSE=false
QUIET=false
COMMIT_MESSAGE=""

# 打印消息（根据模式控制输出）
print_msg() {
    local color=$1
    local message=$2
    local force=${3:-false}
    
    if [[ "$QUIET" == "false" ]] || [[ "$force" == "true" ]]; then
        # 将消息输出到标准错误流，以避免被命令替换捕获
        echo -e "${color}${message}${NC}" >&2
    fi
}

# 详细模式专用消息
print_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        print_msg "$1" "$2"
    fi
}

# 显示帮助
show_help() {
    echo "Git 智能提交脚本"
    echo ""
    echo "用法:"
    echo "  $0 [选项] [提交信息]"
    echo ""
    echo "选项:"
    echo "  -q, --quiet     静默模式（最小输出）"
    echo "  -v, --verbose   详细模式（显示所有步骤和进度）"
    echo "  -h, --help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 \"修复图片显示问题\"           # 默认模式"
    echo "  $0 -q \"添加新文章\"             # 静默模式"
    echo "  $0 -v \"更新配置文件\"           # 详细模式"
    echo "  $0                              # 交互式输入"
    echo ""
    exit 0
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                ;;
            -*)
                # 提示信息也应发往 stderr
                echo "未知选项: $1" >&2
                echo "使用 -h 查看帮助" >&2
                exit 1
                ;;
            *)
                # 剩余参数作为提交信息
                COMMIT_MESSAGE="$*"
                break
                ;;
        esac
    done
}

# 检查 Git 仓库
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_msg $RED "❌ 错误: 当前目录不是 Git 仓库" true
        exit 1
    fi
    print_verbose $BLUE "✅ Git 仓库检查通过"
}

# 检查是否有更改
check_changes() {
    if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
        echo "" >&2
        print_msg $YELLOW "🤔 没有检测到任何更改" true
        print_msg $BLUE "💡 看起来你的代码没有修改，无需提交哦~" true
        echo "" >&2
        exit 0
    fi
    
    if [[ "$QUIET" == "false" ]]; then
        print_msg $GREEN "✅ 太棒了！检测到有文件被修改" true
        
        local unstaged_count=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
        local staged_count=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
        local changed_files=$((unstaged_count + staged_count))
        
        if [[ $changed_files -gt 0 ]]; then
            print_msg $BLUE "📁 共有 $changed_files 个文件待提交" true
        fi
    fi
}

# 显示状态（仅详细模式）
show_status() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "" >&2
        print_msg $BLUE "📋 当前 Git 状态:"
        # git status 本身会输出到 stdout，这里保持原样，或者也重定向到 stderr
        git status --short >&2
        echo "" >&2
    fi
}

# 生成默认提交信息
generate_default_message() {
    echo "reload blog"
}

# 获取提交信息 (⭐️ 这里是关键修改 ⭐️)
get_commit_message() {
    # 如果通过参数传入了提交信息，直接将其输出到 stdout 后返回
    if [[ -n "$COMMIT_MESSAGE" ]]; then
        echo "$COMMIT_MESSAGE"
        return
    fi
    
    local default_msg
    default_msg=$(generate_default_message)
    local message=""
    
    # 将所有提示信息重定向到 stderr (>&2)，这样它们会显示在屏幕上
    echo "" >&2
    echo -e "${BLUE}🎯 Git 智能提交助手${NC}" >&2
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" >&2
    echo -e "${YELLOW}📝 请描述你这次做了什么修改：${NC}" >&2
    echo "" >&2
    echo -e "${GREEN}💡 提交信息示例：${NC}" >&2
    echo "   • 修复图片显示问题" >&2
    echo "   • 添加新文章《AI工具推荐》" >&2
    echo "   • 更新网站配置" >&2
    echo "   • 删除无用文件" >&2
    echo "   • 优化页面加载速度" >&2
    echo "" >&2
    echo -e "${BLUE}✨ 好的提交信息让你轻松回顾历史修改！${NC}" >&2
    echo -e "${YELLOW}🔥 提示: 直接回车使用默认信息 [${default_msg}]${NC}" >&2
    echo "" >&2
    
    # -p 选项可以直接将提示符输出到终端（通常是 stderr），比 echo -n 更优雅
    read -r -p "🖊️  请输入提交信息 → " message
    
    # 如果用户直接回车（空输入），使用默认值
    if [[ -z "$message" ]]; then
        message="$default_msg"
        # 换行以保持格式整洁
        echo "" >&2
        echo -e "${GREEN}✅ 使用默认提交信息: $message${NC}" >&2
    fi
    
    # 这一行是函数的“返回值”，必须输出到 stdout，以便 $(...) 捕获
    echo "$message"
}

# 执行 Git 操作
execute_git_operations() {
    local commit_msg="$1"
    
    if [[ "$QUIET" == "false" ]]; then
        echo "" >&2
        print_msg $BLUE "🎬 开始自动提交流程..." true
        echo "" >&2
    fi
    
    print_verbose $YELLOW "📦 步骤 1/3: 添加所有更改..."
    print_msg $BLUE "📦 正在添加文件..." false
    if git add . >/dev/null 2>&1; then
        print_verbose $GREEN "   ✅ git add 成功"
        print_msg $GREEN "✅ 文件添加完成" false
    else
        print_msg $RED "❌ 文件添加失败" true
        exit 1
    fi
    
    print_verbose $YELLOW "💾 步骤 2/3: 提交更改..."
    print_msg $BLUE "💾 正在提交更改..." false
    if git commit -m "$commit_msg" >/dev/null 2>&1; then
        print_verbose $GREEN "   ✅ git commit 成功"
        print_msg $GREEN "✅ 提交完成: $commit_msg" false
    else
        print_msg $RED "❌ 提交失败" true
        # 最好能显示 git 的错误信息
        # git commit -m "$commit_msg" >&2
        exit 1
    fi
    
    print_verbose $YELLOW "🚀 步骤 3/3: 推送到远程仓库..."
    print_msg $BLUE "🚀 正在推送到远程仓库..." false
    
    if [[ "$VERBOSE" == "true" ]]; then
        git push
    else
        if git push >/dev/null 2>&1; then
            print_msg $GREEN "🚀 推送成功" false
        else
            print_msg $RED "❌ 推送失败，请检查网络连接" true
            exit 1
        fi
    fi
}


# 主函数
main() {
    parse_args "$@"
    
    if [[ "$QUIET" == "false" ]]; then
        echo "" >&2
        print_msg $BLUE "🚀 Git 智能提交助手启动中..." true
        print_msg $BLUE "正在检查你的代码更改..." true
        echo "" >&2
    fi
    
    check_git_repo
    check_changes
    show_status
    
    local commit_msg
    commit_msg=$(get_commit_message)
    
    # 如果用户在交互模式下取消，commit_msg 可能为空 
    if [[ -z "$commit_msg" ]]; then
        print_msg $YELLOW "❌ 未提供提交信息，操作已取消。" true
        exit 0
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo "" >&2
        print_msg $YELLOW "📋 即将执行:"
        echo "   1. git add ." >&2
        echo "   2. git commit -m \"$commit_msg\"" >&2
        echo "   3. git push" >&2
        echo "" >&2
        read -r -p "🤔 确认执行? (y/N): " confirm
        
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            print_msg $YELLOW "❌ 操作已取消" true
            exit 0
        fi
    fi
    
    execute_git_operations "$commit_msg"
    
    echo "" >&2
    print_msg $GREEN "🎉 太棒了！所有操作都完成了！" true
    print_msg $BLUE "✨ 你的代码已经成功推送到远程仓库" true
    print_msg $YELLOW "💡 可以去 GitHub/GitLab 查看你的提交记录哦~" true
    echo "" >&2
}

# 运行主函数
main "$@"