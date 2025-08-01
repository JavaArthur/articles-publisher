# 📚 Articles Publisher - Hexo 博客发布工具

一个现代化的 Hexo 博客文章发布工具，将传统的命令行发布流程转换为直观的 Web 界面，让博客文章发布变得更加简单高效。

## 🎯 项目概述

本项目将原有的 CLI 发布工具升级为功能完整的 Web 应用，提供：
- **🌐 现代化 Web 界面**: 三栏响应式布局，符合发布者工作流程
- **📊 科学日志管理**: 分类日志记录，会话跟踪，进度监控  
- **🖼️ 智能图片处理**: 无损压缩优化，支持多种格式
- **⚙️ 可视化配置**: 博客目录和图片目录可视化编辑
- **🚀 一键发布**: 集成 Git 提交和 Hexo 部署流程

## ✨ 功能特性

### 🌐 Web 界面功能
- **📝 拖拽上传**: 支持拖拽上传 .md 和 .markdown 文件
- **🖼️ 封面处理**: 智能封面图片上传、压缩和预览
- **👁️ 实时预览**: Markdown 实时渲染，支持 Front Matter 隐藏
- **⚙️ 可视化配置**: 博客目录和图片目录在线编辑
- **🎨 三栏布局**: 配置→内容→预览→封面→发布的工作流程

### 🛠️ 核心功能  
- **🚀 一键发布**: Web界面或命令行完成所有操作
- **📸 图片自动化**: 自动下载外部图片并压缩优化
- **🔄 路径转换**: 自动转换图片路径为Hexo格式
- **📤 Git自动化**: 智能Git提交、推送和冲突处理
- **🌍 自动部署**: 自动执行Hexo部署流程
- **📊 科学日志**: 分类日志记录和会话跟踪

### 🎯 高级特性
- **🗜️ 图片压缩**: 无损压缩技术，支持JPEG/PNG/WebP
- **🔒 安全处理**: 智能文件名清理，防止编码问题  
- **⚡ 并发处理**: 多文件并发上传和处理
- **📱 响应式设计**: 适配不同屏幕尺寸

## 🚀 快速开始

### 环境要求
- **Node.js**: 16.0+ (推荐 18.0+)
- **NPM**: 8.0+
- **Git**: 已配置的 Git 环境
- **Hexo**: 已安装和配置的 Hexo 博客

### 1. 安装依赖
```bash
# 安装 Node.js 依赖
npm install

# 安装全局CLI命令（可选，推荐）
npm link

# 或运行自动安装脚本
./setup.sh
```

### 2. 配置设置
编辑 `config.json` 文件（或通过Web界面配置）：

```json
{
  "hexo": {
    "postsDir": "/path/to/hexo/source/_posts",
    "imagesDir": "/path/to/hexo/source/images",
    "gitRepo": "/path/to/hexo",
    "baseUrl": "https://your-blog.com"
  },
  "git": {
    "autoCommit": true,
    "autoPush": true,
    "branch": "main",
    "commitPrefix": "📝 发布文章:"
  },
  "download": {
    "compressImages": true,
    "compression": {
      "maxWidth": 2400,
      "maxHeight": 2400,
      "jpegQuality": 95
    }
  }
}
```

### 3. 启动使用

#### 🌐 Web 界面模式（推荐）
```bash
# 启动 Web 服务器
npm run server
# 或
node server.js

# 访问 http://localhost:3000
```

#### 🖥️ 命令行模式

##### 全局CLI命令（推荐）
```bash
# 安装全局命令（首次使用）
npm link

# 在任意目录使用全局命令发布文章
magic-publish ~/Documents/我的文章.md
magic-publish ./文章.md
magic-publish "/path/to/article.md"

# 查看帮助信息
magic-publish
```

##### 传统脚本方式
```bash
# 自动检测最近编辑的文件
./publish.sh

# 发布指定文件
./publish.sh "article.md"

# 直接使用 Node.js
node magic-publish.js "path/to/article.md"
```

## 🎨 Web 界面使用指南

### 界面布局
```
┌─────────────────────────────────────────────────────────────────┐
│                    🚀 Hexo 发布工具                             │
│               专业的 Markdown 文章发布平台                      │
└─────────────────────────────────────────────────────────────────┘
┌──────────────┬─────────────────────────┬──────────────────────────┐
│  配置和上传   │       内容预览           │     封面和发布控制        │
│              │                         │                          │
│ ⚙️ 配置管理   │ 📝 Markdown预览         │ 🖼️ 文章封面               │
│ 📄 文件上传   │ 👁️ 预览/原文切换       │ 🚀 发布控制               │
│ 📝 文件名设置 │ 📊 实时渲染             │ 📊 进度显示               │
└──────────────┴─────────────────────────┴──────────────────────────┘
```

### 操作流程
1. **📋 配置管理**: 设置博客和图片目录（可在线编辑）
2. **📄 文件上传**: 拖拽上传 Markdown 文件
3. **📝 文件命名**: 选择使用原文件名或自定义
4. **👁️ 内容预览**: 实时预览渲染效果
5. **🖼️ 封面设置**: 上传并预览文章封面图片
6. **🚀 一键发布**: 执行完整发布流程

## 🌐 API 接口

### 发布文章
```bash
POST /api/publish
Content-Type: multipart/form-data

Fields:
- markdownFile: Markdown 文件
- coverImage: 封面图片（可选）
- targetFilename: 目标文件名
```

### 配置管理
```bash
# 获取配置
GET /api/config

# 更新配置
PUT /api/config
Content-Type: application/json
{
  "postsDir": "/path/to/posts",
  "imagesDir": "/path/to/images"
}
```

### 健康检查
```bash
GET /api/health
```

## 📊 日志系统

### 日志分类
- **INFO**: 一般信息记录
- **WARN**: 警告信息
- **ERROR**: 错误信息
- **PROGRESS**: 进度跟踪
- **FILE**: 文件操作
- **NETWORK**: 网络操作
- **GIT**: Git 操作

### 日志文件
- `logs/publish-YYYY-MM-DD.log`: 每日发布日志
- `logs/server-YYYY-MM-DD.log`: 服务器运行日志
- `logs/session-[SessionID].log`: 会话专用日志

## 📋 系统要求

- **Node.js**: 16.0+ (推荐 18.0+)
- **NPM**: 8.0+
- **Git**: 已配置的 Git 环境
- **Hexo**: 已安装和配置的 Hexo 博客
- **Sharp**: 图片处理库（自动安装）

## 🔧 配置说明

### hexo配置
- `postsDir`: Hexo文章目录
- `imagesDir`: Hexo图片目录  
- `gitRepo`: Hexo项目Git仓库路径
- `baseUrl`: 博客网站地址

### git配置
- `autoCommit`: 是否自动Git提交
- `autoPush`: 是否自动推送到远程
- `commitPrefix`: 提交信息前缀

### deploy配置
- `autoHexoDeploy`: 是否自动执行hexo deploy
- `cleanBeforeGenerate`: 生成前是否清理

### download配置
- `maxRetries`: 下载重试次数
- `concurrency`: 并发下载数量
- `compressImages`: 是否压缩图片

## 🐛 故障排除

### 常见问题

1. **Node.js未安装**
   ```bash
   # 安装Node.js
   # 访问 https://nodejs.org/ 下载安装
   ```

2. **权限问题**
   ```bash
   chmod +x publish.sh
   chmod +x setup.sh
   ```

3. **路径配置错误**
   - 检查config.json中的路径是否正确
   - 确保所有目录都存在

4. **Git操作失败**
   - 检查Git仓库状态
   - 确保有推送权限

### 日志文件
发布过程会生成日志文件 `publish-YYYY-MM-DD.log`，可用于问题诊断。

## 📝 版本历史

### v2.4 - CLI增强版本 ✅
- ✅ 新增全局CLI命令 `magic-publish`，支持在任意目录使用
- ✅ 增强日志系统稳定性，自动创建日志目录
- ✅ 改进错误处理和路径解析机制
- ✅ 支持 `npm link` 全局安装，提升使用便利性

### v2.3 - 界面优化版本 ✅
- ✅ 全新三栏布局设计（400px | flex | 450px）
- ✅ 封面图片预览尺寸优化（300px高度）
- ✅ 符合发布者工作流程的界面设计
- ✅ 响应式设计支持不同屏幕尺寸

### v2.2 - Bug修复版本 ✅
- ✅ 修复封面图片文件名编码问题（中文字符处理）
- ✅ 新增博客目录和图片目录可配置功能
- ✅ 完善配置编辑和验证机制
- ✅ 智能文件名清理算法

### v2.1 - 功能增强版本 ✅
- ✅ Web 界面集成，提供完整的图形化操作
- ✅ 实时 Markdown 预览功能
- ✅ 拖拽上传支持，提升用户体验
- ✅ Front Matter 显示/隐藏控制

### v2.0 - 架构升级版本 ✅
- ✅ Express 服务器架构，提供稳定的Web服务
- ✅ RESTful API 设计，支持程序化调用
- ✅ 现代化前端界面，三栏响应式布局
- ✅ 科学日志管理系统，会话跟踪

### v1.0.0 - 初始版本
- ✅ CLI 发布工具基础功能
- ✅ 支持外部图片自动下载
- ✅ 支持路径自动转换
- ✅ 支持Git自动化操作
- ✅ 支持Hexo自动部署

## 🎯 使用场景

### 适用人群
- **博客作者**: 需要便捷发布 Markdown 文章到 Hexo 博客
- **内容创作者**: 希望有图形界面管理博客发布流程
- **技术写手**: 需要处理大量图片和外部链接的技术文章
- **团队协作**: 多人协作的博客或文档站点

### 典型工作流
1. **内容准备**: 在 Obsidian 或其他编辑器中完成 Markdown 写作
2. **界面上传**: 使用 Web 界面上传文章和封面
3. **预览确认**: 实时预览确认格式和内容正确
4. **一键发布**: 自动处理图片、提交 Git、部署 Hexo
5. **结果验证**: 检查博客站点确认发布成功

## 🌟 项目亮点

### ✨ 现代化设计
- **三栏响应式布局**: 符合发布者工作流程的专业设计
- **拖拽上传体验**: 直观的文件上传交互
- **实时预览渲染**: 即时查看 Markdown 渲染效果
- **封面大图预览**: 300px 高度专业封面展示

### 🛠️ 技术优势
- **科学日志管理**: 分类日志、会话跟踪、进度监控
- **智能图片处理**: 无损压缩、格式优化、路径转换
- **安全文件处理**: 文件名清理、编码问题防护
- **Git 智能集成**: 冲突处理、错误恢复、自动化流程

### 🚀 性能特性
- **并发处理**: 多文件同时上传和处理
- **错误重试**: 网络失败时自动重试机制
- **进度可视**: 详细的处理进度和状态显示
- **配置管理**: 可视化配置编辑和验证

## 🤝 贡献与支持

### 反馈渠道
如果您在使用过程中遇到问题或有改进建议：
1. **查看文档**: 详细阅读本 README 和项目文档
2. **检查日志**: 查看 `logs/` 目录下的日志文件
3. **提交 Issue**: 在 GitHub 上创建问题报告
4. **功能建议**: 欢迎提出新功能需求

### 开发贡献
欢迎贡献代码、报告问题或提出建议！
1. Fork 项目仓库
2. 创建功能分支
3. 提交更改和测试
4. 发起 Pull Request

## 📄 许可证

MIT License - 详情请见 [LICENSE](LICENSE) 文件

## 🎯 使用步骤

### 1️⃣ **运行安装**
```bash
./setup.sh
```

### 2️⃣ **配置路径**
按照提示输入您的实际路径：
- Hexo博客posts目录
- Hexo博客images目录
- Hexo博客Git仓库路径
- 博客网站URL
- Obsidian知识库路径

### 3️⃣ **开始使用**
```bash
# 自动检测并发布
./publish.sh

# 或指定文件发布
./publish.sh "我的文章.md"
```

### 4️⃣ **享受无感发布**
坐等进度条完成，然后去博客查看效果！

## 💡 工作原理

1. **分析文件**: 扫描markdown中的七牛云图片链接
2. **下载图片**: 并发下载图片到Hexo项目的images目录
3. **转换路径**: 将七牛云URL替换为本地路径
4. **保存文件**: 将处理后的markdown保存到Hexo posts目录
5. **Git操作**: 自动提交和推送代码
6. **自动部署**: 执行hexo部署命令

## 🎉 特色功能

- **智能检测**: 自动找到最近编辑的文件
- **并发下载**: 多张图片同时下载，提升速度
- **错误重试**: 网络失败时自动重试
- **图片压缩**: 可选的图片压缩功能
- **进度显示**: 实时显示处理进度
- **日志记录**: 详细的操作日志便于调试

---

**🎉 开始您的博客发布之旅吧！** 

访问 `http://localhost:3000` 体验现代化的 Hexo 博客发布工具！

**让发布变得简单，让创作更加专注！** ✨
