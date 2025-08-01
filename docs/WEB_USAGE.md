# Hexo Publisher Web 界面使用说明

## ✨ 功能特性

这个Web界面为原有的命令行发布工具提供了友好的图形界面，具备以下功能：

1. **📄 Markdown文件上传**: 支持拖拽或点击选择markdown文件
2. **🖼️ 封面图片上传**: 自动压缩并添加到hexo文章的cover字段
3. **👀 实时预览**: 实时预览markdown内容的渲染效果
4. **🚀 一键发布**: 自动执行完整的发布流程
5. **📊 进度显示**: 实时显示发布进度和状态

## 🚀 启动服务

### 方法一：使用npm脚本
```bash
cd hexo-publisher
npm run server
```

### 方法二：直接运行
```bash
cd hexo-publisher
node server.js
```

服务启动后，你会看到类似以下的输出：
```
🚀 Hexo Publisher Server 启动成功!
   📍 访问地址: http://localhost:3000
   📄 Web界面: http://localhost:3000/
   🔗 API地址: http://localhost:3000/api/publish
   ⏹️  停止服务: Ctrl+C
```

## 🌐 使用Web界面

1. **打开浏览器**: 访问 `http://localhost:3000`
2. **选择文件**: 
   - 点击"选择 Markdown 文件"上传你的文章
   - （可选）点击"选择封面图片"上传封面
3. **预览内容**: 右侧会实时显示markdown的渲染效果
4. **发布文章**: 点击"🚀 发布到 Hexo"按钮

## 📋 发布流程

Web界面会自动执行以下步骤：

1. **文件处理**: 接收上传的markdown和封面图片
2. **图片压缩**: 自动压缩封面图片并保存到博客目录
3. **内容更新**: 在markdown的front matter中添加cover字段
4. **执行发布**: 调用原有的MagicPublisher类执行完整发布流程：
   - 分析markdown中的外部图片链接
   - 下载并压缩图片
   - 转换图片路径为本地路径
   - 保存文件到Hexo项目
   - Git提交和推送（如果配置了的话）
   - Hexo部署（如果配置了的话）

## ⚙️ 配置要求

确保你的 `config.json` 配置正确，特别是以下字段：

```json
{
  "hexo": {
    "postsDir": "/path/to/your/hexo/source/_posts",
    "imagesDir": "/path/to/your/hexo/source/images",
    "gitRepo": "/path/to/your/hexo/project"
  },
  "download": {
    "compression": {
      "maxWidth": 2400,
      "maxHeight": 2400,
      "jpegQuality": 95,
      "pngCompressionLevel": 9
    }
  }
}
```

## 🔧 API 接口

### POST /api/publish

上传并发布文章的API接口。

**请求格式**: `multipart/form-data`

**参数**:
- `markdownFile`: Markdown文件（必需）
- `coverImage`: 封面图片（可选）

**响应格式**:
```json
{
  "success": true,
  "articleName": "文章名.md",
  "coverUrl": "/images/2025/07/24/cover_image.jpg",
  "timestamp": "2025-07-24T10:30:00.000Z"
}
```

## 🐛 故障排除

### 1. 服务启动失败
- 检查Node.js版本（需要14+）
- 确保端口3000没有被占用
- 运行 `npm install` 确保依赖安装完整

### 2. 文件上传失败  
- 检查文件大小（限制10MB）
- 确保文件格式正确（.md/.markdown/.jpg/.png等）
- 检查uploads目录权限

### 3. 发布失败
- 检查 `config.json` 配置
- 确保Hexo项目路径正确
- 查看控制台错误信息

### 4. 图片处理失败
- 确保Sharp库正确安装：`npm install sharp`
- 检查图片格式是否支持
- 确保图片目录有写入权限

## 🔒 安全注意事项

- 此工具仅用于本地开发环境
- 不要在生产环境中暴露此服务
- 上传的文件会临时存储在uploads目录，处理完成后自动清理
- 如需在网络中使用，建议添加身份验证

## 🆕 与原有工具的区别

| 功能 | 命令行工具 | Web界面 |
|------|-----------|---------|
| 文件选择 | 命令行参数 | 拖拽/点击上传 |
| 封面处理 | 需要在markdown中手动添加 | 自动处理和添加 |
| 进度显示 | 终端输出 | 可视化进度条 |
| 预览功能 | 无 | 实时markdown预览 |
| 错误处理 | 终端错误信息 | 友好的错误提示 |
| 操作方式 | 命令行 | 图形界面 |

## 🆕 新版本更新 (v2.0)

### ✅ 已修复的问题
1. **文件名编码问题**: 修复了中文文件名导致的乱码问题
2. **图片命名优化**: 使用时间戳和安全的文件名生成策略
3. **界面大幅改进**: 
   - 响应式设计，支持大屏幕显示
   - 添加拖拽上传功能
   - 实时发布进度显示
   - 预览/原文切换功能
   - 现代化的UI设计

### 🎨 界面特性
- **📱 响应式设计**: 支持桌面和移动端
- **🎯 拖拽上传**: 支持文件拖拽到上传区域
- **👁️ 双模式预览**: 渲染预览和原文查看切换
- **📊 实时进度**: 详细的发布进度和状态显示
- **🎨 现代UI**: 渐变色彩和流畅动画效果

### 🔧 技术改进
- **文件名安全处理**: 自动清理特殊字符和中文
- **时间戳命名**: 避免文件名冲突
- **错误处理**: 更友好的错误提示
- **进度反馈**: 实时显示处理步骤

## 🎯 下一步

- 可以考虑添加批量上传功能
- 支持更多的图片格式和压缩选项
- 添加文章编辑功能
- 集成文章管理功能
- 添加拼音转换来更好处理中文文件名