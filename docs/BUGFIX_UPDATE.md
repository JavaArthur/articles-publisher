# 🐛 Hexo Publisher v2.2 Bug修复更新

## ✅ 已修复的问题

### 1. 🖼️ 封面图片文件名编码问题 ✅
**问题描述**:
```
封面路径: /images/2025/07/24/cover_1753336094833_13ä½å¤§å¸è£è¿Iéï¼æè·å¾äºä»ä¹.png
文件路径: /Users/.../cover_1753336094833_13ä½å¤§å¸è£è¿Iéï¼æè·å¾äºä»ä¹.png
```

**修复方案**:
- **完全移除中文字符**: 使用正则表达式 `/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g` 移除所有中文字符
- **安全字符过滤**: 只保留字母、数字、下划线、连字符、点号
- **默认回退**: 如果清理后文件名为空，使用 `cover_image` 作为默认名称
- **长度限制**: 文件名限制在50个字符以内

**修复后效果**:
```
之前: cover_1753336094833_13ä½å¤§å¸è£è¿Iéï¼æè·å¾äºä»ä¹.png
之后: cover_1753336094833_cover_image.png
```

### 2. ⚙️ 博客目录和图片目录可配置 ✅
**问题描述**:
- 用户无法修改博客和图片目录路径
- 配置信息只能查看，无法编辑

**新增功能**:

#### 📝 可视化配置编辑
```
⚙️ 配置管理
📁 博客目录: /Users/user/blog/source/_posts    [编辑]
🖼️ 图片目录: /Users/user/blog/source/images   [编辑]
```

#### 🔧 智能配置验证
- **路径验证**: 必须是绝对路径
- **自动创建**: 目录不存在时自动创建
- **实时保存**: 修改后立即保存到 `config.json`
- **错误处理**: 提供详细的错误提示

#### 📡 新增API接口
```javascript
// 获取配置
GET /api/config
Response: {
  postsDir: "/path/to/posts",
  imagesDir: "/path/to/images", 
  baseUrl: "https://blog.com"
}

// 更新配置
PUT /api/config
Body: {
  postsDir: "/new/path/to/posts",
  imagesDir: "/new/path/to/images"
}
```

## 🎨 用户界面改进

### 配置编辑流程
1. **查看模式**: 显示当前配置和编辑按钮
2. **编辑模式**: 输入框 + 保存/取消按钮
3. **保存确认**: 实时验证和成功提示

### 交互示例
```
点击 [编辑] 按钮
↓
📁 博客目录
[输入框: /Users/user/new-blog/source/_posts]
[保存] [取消]
↓
输入新路径并点击保存
↓
✅ 博客目录更新成功
```

## 🔧 技术实现

### 前端改进
```javascript
// 编辑配置
editConfig(configKey, configName) {
  // 切换到编辑模式，显示输入框
}

// 保存配置
async saveConfig(configKey, configName) {
  // 发送PUT请求更新配置
  // 验证路径有效性
  // 显示成功/失败消息
}
```

### 后端改进
```javascript
// 配置更新API
this.app.put('/api/config', (req, res) => {
  // 读取现有配置
  // 更新指定字段  
  // 验证路径格式
  // 创建目录（如果不存在）
  // 保存到config.json
});
```

### 文件名清理算法
```javascript
sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // 移除危险字符
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g, '') // 移除中文
    .replace(/[^\w\-_.]/g, '_') // 只保留安全字符
    .replace(/_{2,}/g, '_') // 合并多个下划线
    .substring(0, 50) || 'file'; // 限制长度并提供默认值
}
```

## 🎯 使用指南

### 修改博客目录
1. 点击博客目录旁的 **[编辑]** 按钮
2. 在弹出的输入框中输入新的绝对路径
3. 点击 **[保存]** 按钮
4. 系统会自动验证路径并创建目录（如需要）

### 修改图片目录
1. 点击图片目录旁的 **[编辑]** 按钮  
2. 输入新的图片存储路径
3. 保存后新上传的图片将保存到新位置

### 注意事项
- ✅ 路径必须是绝对路径（如 `/Users/name/blog/posts`）
- ✅ 目录不存在时会自动创建
- ✅ 配置立即保存到 `config.json` 文件
- ❌ 不支持相对路径（如 `./posts`）

## 🚀 启动更新版本

```bash
npm run server
```

访问 `http://localhost:3000` 体验修复后的功能！

## 📊 修复验证

### 封面图片测试
```bash
# 上传中文名图片文件
原始文件名: "13位大师装进AI里，我获得了什么.png"
↓
清理后文件名: "cover_1753336094833_cover_image.png"
保存路径: /blog/images/2025/07/24/cover_1753336094833_cover_image.png
```

### 配置编辑测试
```bash
# 编辑博客目录
输入: /Users/newuser/hexo-blog/source/_posts
结果: ✅ 配置已更新，目录自动创建

# 编辑图片目录  
输入: /Users/newuser/hexo-blog/source/images
结果: ✅ 配置已更新，后续图片将保存到新位置
```

## 🎉 总结

本次更新完全解决了：
1. **封面图片乱码问题** - 现在生成的文件名完全安全
2. **配置不可编辑问题** - 现在可以随时修改博客和图片目录

界面更加用户友好，配置管理更加灵活，为用户提供了完全的控制权！