#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ConfigManager = require('../src/utils/config');
const ImageProcessor = require('../src/utils/image-processor');
const Logger = require('../src/utils/logger');

class ImageCompressionTester {
  constructor() {
    this.configManager = new ConfigManager();
    this.config = this.configManager.loadConfig();
    this.logger = new Logger();
    this.imageProcessor = new ImageProcessor(this.config, this.logger);
    
    // 确保启用WebP转换
    if (!this.config.download.compression) {
      this.config.download.compression = {};
    }
    this.config.download.compression.convertToWebP = true;
    this.config.download.compression.webpQuality = 90;
    this.config.download.compression.webpLossless = false;
  }

  async testImageCompression() {
    console.log('🧪 开始测试图片压缩功能...\n');
    
    // 测试用的图片URL（可以替换为实际的图片URL）
    const testImages = [
      {
        url: 'https://picsum.photos/800/600.jpg',
        description: 'JPEG测试图片 (800x600)'
      },
      {
        url: 'https://picsum.photos/1200/800.png',
        description: 'PNG测试图片 (1200x800)'
      }
    ];

    console.log('📋 测试配置:');
    console.log(`   WebP转换: ${this.config.download.compression.convertToWebP ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`   WebP质量: ${this.config.download.compression.webpQuality || 90}`);
    console.log(`   最大尺寸: ${this.config.download.compression.maxWidth || 2400}x${this.config.download.compression.maxHeight || 2400}`);
    console.log('');

    for (let i = 0; i < testImages.length; i++) {
      const testImage = testImages[i];
      console.log(`🖼️  测试 ${i + 1}/${testImages.length}: ${testImage.description}`);
      console.log(`   URL: ${testImage.url}`);
      
      try {
        const filename = this.imageProcessor.generateFilename(testImage.url);
        const image = {
          alt: `test-${i + 1}`,
          originalUrl: testImage.url,
          filename: filename,
          localPath: `/images/${filename}`,
          type: 'test'
        };

        console.log(`   📁 目标文件: ${filename}`);
        
        // 下载并压缩图片
        const result = await this.imageProcessor.downloadSingleImage(image);
        
        if (result) {
          console.log(`   ✅ 测试完成: ${result.filename}`);
          
          // 检查文件是否存在
          const fullPath = path.join(this.config.hexo.imagesDir, result.filename);
          if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            const isWebP = path.extname(fullPath).toLowerCase() === '.webp';
            console.log(`   📊 文件信息: ${(stats.size / 1024).toFixed(2)}KB ${isWebP ? '(WebP格式)' : '(原格式)'}`);
          }
        } else {
          console.log(`   ❌ 测试失败`);
        }
        
      } catch (error) {
        console.log(`   ❌ 测试失败: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('🎉 图片压缩功能测试完成！');
    console.log('\n💡 提示:');
    console.log('   - 检查生成的图片文件是否为WebP格式');
    console.log('   - 对比压缩前后的文件大小');
    console.log('   - 确认图片质量是否满足要求');
  }

  async testMarkdownParsing() {
    console.log('\n📝 测试Markdown解析功能...\n');
    
    // 创建测试Markdown内容
    const testMarkdown = `---
title: 测试文章
cover: https://picsum.photos/1200/600.jpg
banner: https://picsum.photos/800/400.png
---

# 测试文章

这是一个测试文章，包含多种类型的图片引用。

## 标准Markdown图片
![测试图片1](https://picsum.photos/600/400.jpg)

## HTML图片标签
<img src="https://picsum.photos/500/300.png" alt="HTML测试图片" />

## 另一张标准图片
![测试图片2](https://picsum.photos/700/500.jpg)
`;

    // 创建临时测试文件
    const testFile = path.join(__dirname, 'test-article.md');
    fs.writeFileSync(testFile, testMarkdown);
    
    try {
      // 模拟MagicPublisher的analyzeMarkdown方法
      const content = fs.readFileSync(testFile, 'utf8');
      const images = [];
      const processedUrls = new Set();

      // 1. 提取标准markdown图片语法
      const standardImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
      let match;
      while ((match = standardImageRegex.exec(content)) !== null) {
        const imageUrl = match[2];
        if (!processedUrls.has(imageUrl)) {
          processedUrls.add(imageUrl);
          images.push({
            alt: match[1],
            originalUrl: imageUrl,
            type: 'standard'
          });
        }
      }

      // 2. 提取Front Matter中的封面图片
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontMatterMatch) {
        const frontMatter = frontMatterMatch[1];
        const coverPatterns = [
          /^cover:\s*(https?:\/\/[^\s]+)/m,
          /^banner:\s*(https?:\/\/[^\s]+)/m,
          /^image:\s*(https?:\/\/[^\s]+)/m,
        ];

        coverPatterns.forEach(pattern => {
          const coverMatch = frontMatter.match(pattern);
          if (coverMatch) {
            const imageUrl = coverMatch[1];
            if (!processedUrls.has(imageUrl)) {
              processedUrls.add(imageUrl);
              images.push({
                alt: 'cover',
                originalUrl: imageUrl,
                type: 'cover'
              });
            }
          }
        });
      }

      // 3. 提取HTML img标签
      const htmlImageRegex = /<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/g;
      while ((match = htmlImageRegex.exec(content)) !== null) {
        const imageUrl = match[1];
        if (!processedUrls.has(imageUrl)) {
          processedUrls.add(imageUrl);
          images.push({
            alt: 'html-image',
            originalUrl: imageUrl,
            type: 'html'
          });
        }
      }

      console.log(`✅ 成功解析出 ${images.length} 张图片:`);
      images.forEach((img, index) => {
        const typeLabel = img.type === 'cover' ? '🖼️ 封面' : 
                         img.type === 'html' ? '🏷️ HTML' : '📷 标准';
        console.log(`   ${index + 1}. ${typeLabel} ${img.originalUrl}`);
      });

    } finally {
      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  }
}

// 运行测试
async function runTests() {
  const tester = new ImageCompressionTester();
  
  try {
    await tester.testMarkdownParsing();
    await tester.testImageCompression();
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = ImageCompressionTester;