const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const MagicPublisher = require('../core/magic-publish.js');
const Logger = require('../utils/logger');
const ConfigManager = require('../utils/config');
const ImageProcessor = require('../utils/image-processor');

class HexoPublisherServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.logger = new Logger();
    this.configManager = new ConfigManager();
    this.setupMiddleware();
    this.setupMulter();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../public'))); // 服务静态文件
  }

  setupMulter() {
    // 确保uploads目录存在
    this.ensureUploadsDirectory();

    // 设置文件上传的临时存储
    this.upload = multer({
      dest: 'uploads/',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 2 // 最多2个文件（markdown + 封面）
      },
      fileFilter: (req, file, cb) => {
        // 在文件过滤时再次确保目录存在
        this.ensureUploadsDirectory();
        
        if (file.fieldname === 'markdownFile') {
          // 检查markdown文件
          if (file.mimetype === 'text/markdown' || 
              file.originalname.endsWith('.md') || 
              file.originalname.endsWith('.markdown')) {
            cb(null, true);
          } else {
            cb(new Error('请上传 .md 或 .markdown 文件'), false);
          }
        } else if (file.fieldname === 'coverImage') {
          // 检查图片文件
          if (file.mimetype.startsWith('image/')) {
            cb(null, true);
          } else {
            cb(new Error('请上传图片文件'), false);
          }
        } else {
          cb(new Error('未知的文件字段'), false);
        }
      }
    });
  }

  // 确保uploads目录存在的独立方法
  ensureUploadsDirectory() {
    try {
      if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads', { recursive: true });
        this.logger.info('SERVER', '创建uploads目录成功');
      }
    } catch (error) {
      this.logger.error('SERVER', `创建uploads目录失败: ${error.message}`);
      console.error('创建uploads目录失败:', error.message);
    }
  }

  setupRoutes() {
    // 主页
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });

    // API: 发布文章
    this.app.post('/api/publish', this.upload.fields([
      { name: 'markdownFile', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 }
    ]), async (req, res) => {
      try {
        await this.handlePublish(req, res);
      } catch (error) {
        console.error('发布失败:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取配置信息
    this.app.get('/api/config', (req, res) => {
      try {
        const config = this.configManager.getConfig();
        res.json({
          postsDir: config.hexo.postsDir,
          imagesDir: config.hexo.imagesDir,
          baseUrl: config.hexo.baseUrl
        });
      } catch (error) {
        res.status(500).json({ error: '配置读取失败' });
      }
    });

    // API: 更新配置信息
    this.app.put('/api/config', (req, res) => {
      try {
        const updatedConfig = this.configManager.updateConfig(req.body);
        
        this.logger.info('CONFIG', '配置已更新', {
          postsDir: req.body.postsDir,
          imagesDir: req.body.imagesDir
        });

        res.json({
          success: true,
          config: {
            postsDir: updatedConfig.hexo.postsDir,
            imagesDir: updatedConfig.hexo.imagesDir,
            baseUrl: updatedConfig.hexo.baseUrl
          }
        });
      } catch (error) {
        console.error('配置更新失败:', error);
        res.status(500).json({ error: '配置更新失败: ' + error.message });
      }
    });

    // API: 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 错误处理中间件
    this.app.use((error, req, res, next) => {
      console.error('服务器错误:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: '文件大小超过限制（最大10MB）'
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: '文件数量超过限制'
          });
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    });
  }

  async handlePublish(req, res) {
    const files = req.files;
    let tempFiles = []; // 用于清理临时文件

    try {
      // 确保uploads目录存在
      this.ensureUploadsDirectory();
      
      // 检查必需的文件
      if (!files || !files.markdownFile || !files.markdownFile[0]) {
        throw new Error('请提供 Markdown 文件');
      }

      const markdownFile = files.markdownFile[0];
      const coverImageFile = files.coverImage ? files.coverImage[0] : null;
      const targetFilename = req.body.targetFilename || markdownFile.originalname;
      
      tempFiles.push(markdownFile.path);
      if (coverImageFile) {
        tempFiles.push(coverImageFile.path);
      }

      this.logger.info('PUBLISH', '开始处理发布请求', {
        markdown: markdownFile.originalname,
        targetFilename: targetFilename,
        hasCover: !!coverImageFile,
        coverName: coverImageFile ? coverImageFile.originalname : null
      });

      // 读取markdown内容
      let markdownContent = fs.readFileSync(markdownFile.path, 'utf8');
      
      // 处理封面图片（如果有）
      let coverUrl = null;
      if (coverImageFile) {
        coverUrl = await this.processCoverImage(coverImageFile);
        markdownContent = this.addCoverToMarkdown(markdownContent, coverUrl);
      }

      // 创建临时的markdown文件，供MagicPublisher使用
      const timestamp = Date.now();
      const cleanFileName = this.sanitizeFilename(targetFilename);
      const tempMarkdownPath = path.join('uploads', `temp_${timestamp}_${cleanFileName}`);
      fs.writeFileSync(tempMarkdownPath, markdownContent);
      tempFiles.push(tempMarkdownPath);

      // 使用MagicPublisher发布
      const publisher = new CustomMagicPublisher(tempMarkdownPath, targetFilename);
      await publisher.publish();

      // 返回成功结果
      res.json({
        success: true,
        articleName: targetFilename,
        coverUrl: coverUrl,
        timestamp: new Date().toISOString()
      });

      this.logger.info('PUBLISH', '发布成功', {
        articleName: targetFilename,
        coverUrl: coverUrl,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('PUBLISH', `发布失败: ${error.message}`, { error: error.stack });
      throw error;
    } finally {
      // 清理临时文件
      this.cleanupTempFiles(tempFiles);
    }
  }

  async processCoverImage(imageFile) {
    try {
      this.logger.info('IMAGE', '开始处理封面图片', {
        originalName: imageFile.originalname,
        size: imageFile.size
      });
      
      // 加载配置
      const config = this.configManager.getConfig();
      const imageProcessor = new ImageProcessor(config, this.logger);
      
      // 生成目标文件名和路径
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      // 更好的文件名清理
      const ext = path.extname(imageFile.originalname);
      const baseName = path.basename(imageFile.originalname, ext);
      
      // 使用更安全的文件名生成策略
      const timestamp = Date.now();
      const cleanName = imageProcessor.sanitizeFilename(baseName);
      // 如果清理后的名字为空或太短，使用默认名称
      const finalName = cleanName && cleanName.length > 2 ? cleanName : 'cover_image';
      const filename = `${year}/${month}/${day}/cover_${timestamp}_${finalName}${ext}`;
      
      const fullPath = path.join(config.hexo.imagesDir, filename);
      const dir = path.dirname(fullPath);
      
      // 确保目录存在
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 压缩并保存图片
      await this.compressAndSaveImage(imageFile.path, fullPath, config);
      
      const coverUrl = `/images/${filename}`;
      this.logger.fileOperation('COVER_SAVE', coverUrl, 'SUCCESS', {
        filename: filename,
        fullPath: fullPath
      });
      
      return coverUrl;
    } catch (error) {
      console.error('封面处理失败:', error);
      throw new Error(`封面处理失败: ${error.message}`);
    }
  }

  async compressAndSaveImage(sourcePath, targetPath, config) {
    const sharp = require('sharp');
    const compression = config.download?.compression || {};
    
    try {
      let sharpInstance = sharp(sourcePath);
      const metadata = await sharpInstance.metadata();
      const { format, width, height } = metadata;
      
      // 应用尺寸限制
      const maxWidth = compression.maxWidth || 2400;
      const maxHeight = compression.maxHeight || 2400;
      
      if (width > maxWidth || height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, { 
          withoutEnlargement: true,
          fit: 'inside'
        });
      }

      // 根据格式进行压缩
      if (format === 'jpeg' || format === 'jpg') {
        sharpInstance = sharpInstance.jpeg({ 
          quality: compression.jpegQuality || 95,
          progressive: true,
          mozjpeg: true,
          optimiseScans: true,
          optimiseCoding: true
        });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ 
          compressionLevel: compression.pngCompressionLevel || 9,
          adaptiveFiltering: true,
          palette: true
        });
      } else if (format === 'webp') {
        const webpOptions = {
          effort: 6
        };
        
        if (compression.webpLossless !== false) {
          webpOptions.lossless = true;
          webpOptions.quality = 100;
        } else {
          webpOptions.lossless = false;
          webpOptions.quality = compression.webpQuality || 85;
        }
        
        sharpInstance = sharpInstance.webp(webpOptions);
      }

      await sharpInstance.toFile(targetPath);
      
      // 获取文件大小信息
      const originalSize = fs.statSync(sourcePath).size;
      const compressedSize = fs.statSync(targetPath).size;
      const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      console.log(`   🗜️  压缩完成: ${(originalSize/1024).toFixed(2)}KB → ${(compressedSize/1024).toFixed(2)}KB (减少${reduction}%)`);
      
    } catch (error) {
      // 如果压缩失败，直接复制原文件
      console.log('   ⚠️  压缩失败，使用原图');
      fs.copyFileSync(sourcePath, targetPath);
    }
  }

  addCoverToMarkdown(content, coverUrl) {
    // 检查是否已有front matter
    if (content.startsWith('---')) {
      // 找到第二个---的位置
      const secondDashIndex = content.indexOf('---', 3);
      if (secondDashIndex !== -1) {
        const frontMatter = content.substring(4, secondDashIndex);
        const restContent = content.substring(secondDashIndex + 3);
        
        // 检查是否已有cover字段
        if (frontMatter.includes('cover:')) {
          // 替换现有的cover
          const updatedFrontMatter = frontMatter.replace(/cover:.*$/m, `cover: ${coverUrl}`);
          return `---\n${updatedFrontMatter}---${restContent}`;
        } else {
          // 添加cover字段
          return `---\n${frontMatter}cover: ${coverUrl}\n---${restContent}`;
        }
      }
    }
    
    // 如果没有front matter，创建一个
    const title = this.extractTitleFromContent(content);
    const date = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const frontMatter = `---
title: ${title}
date: ${date}
cover: ${coverUrl}
---

`;
    
    return frontMatter + content;
  }

  extractTitleFromContent(content) {
    // 尝试从内容中提取标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    
    // 如果没有找到标题，使用默认标题
    return '未命名文章';
  }

  sanitizeFilename(filename) {
    // 移除或替换不安全的字符
    let cleaned = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // 移除不安全字符
      .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g, '') // 移除所有中文字符
      .replace(/[^\w\-_.]/g, '_') // 只保留字母、数字、下划线、连字符、点
      .replace(/\s+/g, '_') // 空格替换为下划线
      .replace(/_{2,}/g, '_') // 多个下划线合并为一个
      .replace(/^_+|_+$/g, '') // 移除开头和结尾的下划线
      .substring(0, 50); // 限制长度
    
    // 如果清理后为空，返回默认名称
    return cleaned || 'file';
  }

  cleanupTempFiles(files) {
    files.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        console.warn(`清理临时文件失败: ${file}`, error.message);
      }
    });
  }

  start() {
    this.app.listen(this.port, () => {
      this.logger.info('SERVER', `Hexo Publisher Server 启动成功!`, {
        port: this.port,
        webUrl: `http://localhost:${this.port}/`,
        apiUrl: `http://localhost:${this.port}/api/publish`
      });
      console.log(`🚀 Hexo Publisher Server 启动成功!`);
      console.log(`   📍 访问地址: http://localhost:${this.port}`);
      console.log(`   📄 Web界面: http://localhost:${this.port}/`);
      console.log(`   🔗 API地址: http://localhost:${this.port}/api/publish`);
      console.log(`   ⏹️  停止服务: Ctrl+C`);
    });
  }
}

// 扩展MagicPublisher类以适配服务器环境
class CustomMagicPublisher extends MagicPublisher {
  constructor(filePath, targetFilename = null) {
    // 临时设置process.argv[2]来模拟命令行参数
    const originalArgv = process.argv[2];
    process.argv[2] = filePath;
    
    super();
    
    this.targetFilename = targetFilename;
    
    // 恢复原始参数
    if (originalArgv !== undefined) {
      process.argv[2] = originalArgv;
    } else {
      delete process.argv[2];
    }
  }
  
  // 重写保存方法使用目标文件名
  saveToHexo(content) {
    const filename = this.targetFilename || path.basename(this.currentFile);
    const hexoPostPath = path.join(this.config.hexo.postsDir, filename);

    // 确保目标目录存在
    if (!fs.existsSync(this.config.hexo.postsDir)) {
      console.log(`   ⚠️ 创建目标目录: ${this.config.hexo.postsDir}`);
      fs.mkdirSync(this.config.hexo.postsDir, { recursive: true });
    }

    try {
      // 保存文件
      fs.writeFileSync(hexoPostPath, content);
      console.log(`   💾 文件已保存: ${filename}`);
      console.log(`   📂 保存位置: ${hexoPostPath}`);

      // 验证文件是否成功保存
      if (fs.existsSync(hexoPostPath)) {
        const stats = fs.statSync(hexoPostPath);
        console.log(`   ✅ 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
      } else {
        throw new Error('文件保存失败，无法验证文件存在');
      }

      this.logger.info('FILE', `文章已保存到Hexo: ${hexoPostPath}`);
    } catch (error) {
      console.log(`   ❌ 文件保存失败: ${error.message}`);
      console.log(`   🔍 检查目录权限: ${this.config.hexo.postsDir}`);
      this.logger.error('FILE', `文件保存失败: ${error.message}`);
      throw new Error(`无法保存文件到博客目录: ${error.message}`);
    }
  }
  
  // 重写日志方法以适配web环境
  showProgress(current, total, message) {
    const percent = Math.round((current / total) * 100);
    console.log(`[${percent}%] ${message}`);
  }
}

// 启动服务器
if (require.main === module) {
  const server = new HexoPublisherServer();
  server.start();
}

module.exports = HexoPublisherServer;