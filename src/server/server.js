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
    this.app.use('/uploads', express.static('uploads')); // 服务上传文件
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
          baseUrl: config.hexo.baseUrl,
          compression: config.download?.compression || {}
        });
      } catch (error) {
        res.status(500).json({ error: '配置读取失败' });
      }
    });

    // API: 获取压缩配置详情
    this.app.get('/api/compression-config', (req, res) => {
      try {
        const config = this.configManager.getConfig();
        const compression = config.download?.compression || {};
        
        res.json({
          convertToWebP: compression.convertToWebP || false,
          webpLossless: compression.webpLossless !== false,
          webpQuality: compression.webpQuality || 90,
          maxWidth: compression.maxWidth || 2400,
          maxHeight: compression.maxHeight || 2400,
          jpegQuality: compression.jpegQuality || 95,
          pngCompressionLevel: compression.pngCompressionLevel || 9
        });
      } catch (error) {
        res.status(500).json({ error: '压缩配置读取失败' });
      }
    });

    // API: 图片压缩测试
    this.app.post('/api/test-compression', this.upload.single('image'), async (req, res) => {
      let tempFiles = [];
      
      try {
        if (!req.file) {
          throw new Error('请提供图片文件');
        }

        const imageFile = req.file;
        tempFiles.push(imageFile.path);

        this.logger.info('TEST', '开始图片压缩测试', {
          originalName: imageFile.originalname,
          size: imageFile.size,
          mimetype: imageFile.mimetype
        });

        // 加载配置
        const config = this.configManager.getConfig();
        const imageProcessor = new ImageProcessor(config, this.logger);
        
        // 生成测试文件路径
        const timestamp = Date.now();
        const ext = path.extname(imageFile.originalname);
        const baseName = path.basename(imageFile.originalname, ext);
        const testFileName = `test_${timestamp}_${imageProcessor.sanitizeFilename(baseName)}`;
        
        // 测试压缩
        const testPath = path.join('uploads', `${testFileName}_compressed${ext}`);
        tempFiles.push(testPath);
        
        const originalSize = fs.statSync(imageFile.path).size;
        
        // 执行压缩
        await this.compressAndSaveImage(imageFile.path, testPath, config);
        
        const compressedSize = fs.statSync(testPath).size;
        const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        
        // 检查是否转换为WebP
        const sharp = require('sharp');
        const metadata = await sharp(testPath).metadata();
        
        res.json({
          success: true,
          originalName: imageFile.originalname,
          originalSize: originalSize,
          compressedSize: compressedSize,
          reduction: reduction,
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          convertedToWebP: metadata.format === 'webp',
          testPath: `/uploads/${path.basename(testPath)}`
        });

        this.logger.info('TEST', '图片压缩测试完成', {
          originalSize: originalSize,
          compressedSize: compressedSize,
          reduction: reduction,
          format: metadata.format
        });

      } catch (error) {
        this.logger.error('TEST', `图片压缩测试失败: ${error.message}`);
        res.status(500).json({
          success: false,
          error: error.message
        });
      } finally {
        // 清理临时文件（延迟清理以便前端可以访问）
        setTimeout(() => {
          this.cleanupTempFiles(tempFiles);
        }, 30000); // 30秒后清理
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

    // API: 获取AI配置
    this.app.get('/api/ai/config', (req, res) => {
      try {
        const config = this.configManager.getConfig();
        const aiConfig = config.ai || {};
        
        res.json({
          success: true,
          config: {
            hasApiKey: !!aiConfig.apiKey,
            defaultModel: aiConfig.defaultModel || 'doubao-1-5-pro-32k-250115',
            systemPrompt: aiConfig.systemPrompt || 'You are a helpful assistant.',
            models: aiConfig.models || [],
            prompts: aiConfig.prompts || {}
          }
        });
      } catch (error) {
        res.status(500).json({ 
          success: false,
          error: 'AI配置读取失败: ' + error.message 
        });
      }
    });

    // API: 更新AI配置
    this.app.put('/api/ai/config', (req, res) => {
      try {
        const { apiKey, defaultModel, prompts } = req.body;
        const config = this.configManager.getConfig();
        
        if (!config.ai) {
          config.ai = {};
        }
        
        if (apiKey !== undefined) config.ai.apiKey = apiKey;
        if (defaultModel !== undefined) config.ai.defaultModel = defaultModel;
        if (prompts !== undefined) config.ai.prompts = { ...config.ai.prompts, ...prompts };
        
        // 保存配置
        const fs = require('fs');
        fs.writeFileSync(this.configManager.configPath, JSON.stringify(config, null, 2));
        
        this.logger.info('CONFIG', 'AI配置已更新');
        
        res.json({
          success: true,
          message: 'AI配置更新成功'
        });
      } catch (error) {
        this.logger.error('CONFIG', `AI配置更新失败: ${error.message}`);
        res.status(500).json({ 
          success: false,
          error: 'AI配置更新失败: ' + error.message 
        });
      }
    });

    // API: AI生成标题
    this.app.post('/api/ai/generate-title', async (req, res) => {
      try {
        const { content } = req.body;
        
        if (!content) {
          return res.status(400).json({
            success: false,
            error: '请提供文章内容'
          });
        }
        
        const config = this.configManager.getConfig();
        const aiConfig = config.ai || {};
        
        if (!aiConfig.apiKey) {
          return res.status(400).json({
            success: false,
            error: '请先配置AI API密钥'
          });
        }
        
        // 调用AI生成标题
        const title = await this.generateAITitle(content, aiConfig);
        
        res.json({
          success: true,
          title: title
        });
        
      } catch (error) {
        this.logger.error('AI', `标题生成失败: ${error.message}`);
        res.status(500).json({
          success: false,
          error: '标题生成失败: ' + error.message
        });
      }
    });

    // API: AI生成前言
    this.app.post('/api/ai/generate-frontmatter', async (req, res) => {
      try {
        const { content } = req.body;
        
        if (!content) {
          return res.status(400).json({
            success: false,
            error: '请提供文章内容'
          });
        }
        
        const config = this.configManager.getConfig();
        const aiConfig = config.ai || {};
        
        if (!aiConfig.apiKey) {
          return res.status(400).json({
            success: false,
            error: '请先配置AI API密钥'
          });
        }
        
        // 调用AI生成前言
        const frontmatter = await this.generateAIFrontmatter(content, aiConfig);
        
        res.json({
          success: true,
          frontmatter: frontmatter
        });
        
      } catch (error) {
        this.logger.error('AI', `前言生成失败: ${error.message}`);
        res.status(500).json({
          success: false,
          error: '前言生成失败: ' + error.message
        });
      }
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
      
      // 如果启用WebP转换，使用.webp扩展名
      const compression = config.download?.compression || {};
      const targetExt = (compression.convertToWebP !== false) ? '.webp' : ext;
      const filename = `${year}/${month}/${day}/cover_${timestamp}_${finalName}${targetExt}`;
      
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
      
      console.log(`   📊 原始图片信息: ${format} ${width}x${height}`);
      
      // 应用尺寸限制和智能调整
      const maxWidth = compression.maxWidth || 2400;
      const maxHeight = compression.maxHeight || 2400;
      
      if (width > maxWidth || height > maxHeight) {
        const resizeOptions = {
          withoutEnlargement: true,
          fit: 'inside'
        };
        
        // 智能调整大小选项
        if (compression.smartResize) {
          resizeOptions.kernel = 'lanczos3';
          resizeOptions.fastShrinkOnLoad = true;
        }
        
        // 保持宽高比
        if (compression.preserveAspectRatio !== false) {
          resizeOptions.fit = 'inside';
        }
        
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, resizeOptions);
        console.log(`   📐 智能调整尺寸: 最大 ${maxWidth}x${maxHeight}`);
      }
      
      // Web优化处理
      if (compression.optimizeForWeb) {
        sharpInstance = sharpInstance.sharpen({
          sigma: 0.5,
          flat: 1.0,
          jagged: 1.5
        });
      }

      // 强制转换为WebP格式（如果配置启用）
      if (compression.convertToWebP !== false) {
        // 修改目标文件路径为.webp扩展名
        const targetDir = path.dirname(targetPath);
        const targetName = path.basename(targetPath, path.extname(targetPath));
        const webpTargetPath = path.join(targetDir, targetName + '.webp');
        
        const webpOptions = {
          effort: 6,
          smartSubsample: true,
          nearLossless: false
        };
        
        // 根据配置决定是否使用无损压缩
        if (compression.webpLossless === true) {
          webpOptions.lossless = true;
          webpOptions.quality = 100;
          console.log(`   🔄 转换为WebP: 无损压缩`);
        } else {
          webpOptions.lossless = false;
          webpOptions.quality = compression.webpQuality || 85;
          // 对于有损压缩，使用更好的压缩算法
          webpOptions.alphaQuality = Math.min(webpOptions.quality + 10, 100);
          console.log(`   🔄 转换为WebP: 有损压缩 (质量: ${webpOptions.quality})`);
        }
        
        sharpInstance = sharpInstance.webp(webpOptions);
        
        await sharpInstance.toFile(webpTargetPath);
        
        // 更新目标路径为WebP文件
        targetPath = webpTargetPath;
      } else {
        // 如果不转换WebP，按原格式压缩
        if (format === 'jpeg' || format === 'jpg') {
          const jpegOptions = {
            quality: compression.jpegQuality || 88,
            progressive: true,
            optimiseScans: true,
            optimiseCoding: true
          };
          
          // Web优化选项
          if (compression.optimizeForWeb) {
            jpegOptions.mozjpeg = true;
            jpegOptions.trellisQuantisation = true;
            jpegOptions.overshootDeringing = true;
          }
          
          sharpInstance = sharpInstance.jpeg(jpegOptions);
        } else if (format === 'png') {
          const pngOptions = {
            compressionLevel: compression.pngCompressionLevel || 8,
            adaptiveFiltering: true
          };
          
          // Web优化选项
          if (compression.optimizeForWeb) {
            pngOptions.palette = true;
            pngOptions.effort = 10;
          }
          
          sharpInstance = sharpInstance.png(pngOptions);
        } else if (format === 'webp') {
          const webpOptions = {
            effort: 6,
            smartSubsample: true
          };
          
          if (compression.webpLossless !== false) {
            webpOptions.lossless = true;
            webpOptions.quality = 100;
          } else {
            webpOptions.lossless = false;
            webpOptions.quality = compression.webpQuality || 85;
            webpOptions.alphaQuality = Math.min(webpOptions.quality + 10, 100);
          }
          
          sharpInstance = sharpInstance.webp(webpOptions);
        }

        await sharpInstance.toFile(targetPath);
      }
      
      // 获取文件大小信息
      const originalSize = fs.statSync(sourcePath).size;
      const compressedSize = fs.statSync(targetPath).size;
      const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      
      console.log(`   🗜️  智能压缩完成: ${(originalSize/1024).toFixed(2)}KB → ${(compressedSize/1024).toFixed(2)}KB (减少${reduction}%)`);
      
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

  // AI生成标题方法
  async generateAITitle(content, aiConfig) {
    const prompt = aiConfig.prompts?.title || '请为以下文章内容生成一个吸引人的标题：\n\n{content}';
    const finalPrompt = prompt.replace('{content}', content.substring(0, 1000)); // 限制内容长度
    
    return await this.callVolcengineAI(finalPrompt, aiConfig);
  }

  // AI生成前言方法
  async generateAIFrontmatter(content, aiConfig) {
    const prompt = aiConfig.prompts?.frontmatter || '请为以下文章生成Hexo博客的front matter，包含title、date、tags、categories等字段，返回YAML格式：\n\n{content}';
    const finalPrompt = prompt.replace('{content}', content.substring(0, 1500)); // 限制内容长度
    
    return await this.callVolcengineAI(finalPrompt, aiConfig);
  }

  // 调用Volcengine AI API
  async callVolcengineAI(prompt, aiConfig) {
    const https = require('https');
    
    const requestData = {
      model: aiConfig.defaultModel || 'doubao-1-5-pro-32k-250115',
      messages: [
        {
          role: 'system',
          content: aiConfig.systemPrompt || 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    };

    const options = {
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: '/api/v3/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              reject(new Error(response.error.message || 'AI API调用失败'));
              return;
            }
            
            if (response.choices && response.choices[0] && response.choices[0].message) {
              resolve(response.choices[0].message.content.trim());
            } else {
              reject(new Error('AI响应格式错误'));
            }
          } catch (error) {
            reject(new Error('AI响应解析失败: ' + error.message));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error('AI API请求失败: ' + error.message));
      });
      
      req.write(JSON.stringify(requestData));
      req.end();
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