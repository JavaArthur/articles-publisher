const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ImageProcessor {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  generateFilename(imageUrl) {
    try {
      // 从URL提取原始文件名
      const urlPath = new URL(imageUrl).pathname;
      let originalName = path.basename(urlPath);

      // 如果没有文件扩展名，尝试从URL参数或默认为.jpg
      if (!path.extname(originalName)) {
        const url = new URL(imageUrl);
        // 检查是否有format参数
        const format = url.searchParams.get('format') || 'jpg';
        originalName = originalName || 'image';
        originalName = `${originalName}.${format}`;
      }

      // 生成带时间戳的文件名，避免冲突
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      // 清理文件名，移除特殊字符
      const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

      return `${year}/${month}/${day}/${cleanName}`;
    } catch (error) {
      // 如果URL解析失败，生成一个默认文件名
      const timestamp = Date.now();
      return `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/image_${timestamp}.jpg`;
    }
  }

  async downloadImages(images) {
    if (images.length === 0) return [];
    
    const downloaded = [];
    const concurrency = this.config.download.concurrency;
    
    // 分批并发下载
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);
      const batchPromises = batch.map(image => this.downloadSingleImage(image));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          downloaded.push(result.value);
          console.log(`   ✅ 下载完成 (${downloaded.length}/${images.length}): ${result.value.filename}`);
        } else {
          console.log(`   ❌ 下载失败: ${batch[index].filename} - ${result.reason.message}`);
        }
      });
    }
    
    return downloaded;
  }

  async downloadSingleImage(image) {
    let localFullPath = path.join(this.config.hexo.imagesDir, image.filename);
    const localDir = path.dirname(localFullPath);
    
    // 确保目录存在
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    
    // 检查文件是否已存在
    if (fs.existsSync(localFullPath)) {
      return image;
    }
    
    // 下载文件
    await this.downloadFileWithRetry(image.originalUrl, localFullPath);
    
    // 压缩图片（如果启用）
    if (this.config.download.compressImages) {
      const compressedPath = await this.compressImage(localFullPath);
      
      // 如果压缩后文件路径发生变化（格式转换），更新image对象
      if (compressedPath && compressedPath !== localFullPath) {
        const relativePath = path.relative(this.config.hexo.imagesDir, compressedPath);
        image.filename = relativePath;
        image.localPath = `/images/${relativePath}`;
      }
    }
    
    return image;
  }

  async downloadFileWithRetry(url, localPath) {
    const maxRetries = this.config.download.maxRetries;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.downloadFile(url, localPath);
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.sleep(1000 * (i + 1)); // 递增延迟
      }
    }
  }

  downloadFile(url, localPath) {
    return new Promise((resolve, reject) => {
      // 确保目标目录存在
      const dirPath = path.dirname(localPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const file = fs.createWriteStream(localPath);
      const timeout = this.config.download.timeout;

      // 根据URL协议选择正确的模块
      const isHttps = url.startsWith('https:');
      const httpModule = isHttps ? https : http;

      // 设置请求选项，包含常用的请求头
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
          'Referer': url
        }
      };

      const request = httpModule.request(options, (response) => {
        // 处理重定向
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.destroy();
          fs.unlink(localPath, () => {});
          this.downloadFile(response.headers.location, localPath).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.destroy();
          fs.unlink(localPath, () => {});
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // 检查Content-Type
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.startsWith('image/')) {
          this.logger.warn('NETWORK', `可疑的Content-Type: ${contentType} for URL: ${url}`);
        }

        let responseStream = response;
        
        // 处理gzip压缩
        if (response.headers['content-encoding'] === 'gzip') {
          const zlib = require('zlib');
          responseStream = response.pipe(zlib.createGunzip());
        }

        responseStream.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            // 检查文件大小，如果太小可能是错误页面
            const stats = fs.statSync(localPath);
            if (stats.size < 100) {
              fs.unlink(localPath, () => {});
              reject(new Error(`下载的文件太小 (${stats.size} bytes)，可能是错误页面`));
              return;
            }
            
            this.logger.info('NETWORK', `成功下载图片: ${url} (${stats.size} bytes)`);
            resolve();
          });
        });

        file.on('error', (error) => {
          fs.unlink(localPath, () => {}); // 删除部分下载的文件
          reject(error);
        });
      });

      request.setTimeout(timeout, () => {
        request.destroy();
        file.destroy();
        fs.unlink(localPath, () => {});
        reject(new Error('下载超时'));
      });

      request.on('error', (error) => {
        file.destroy();
        fs.unlink(localPath, () => {});
        reject(error);
      });

      request.end();
    });
  }

  async compressImage(imagePath) {
    try {
      const sharp = require('sharp');
      const tempPath = imagePath + '.temp';
      const originalStats = fs.statSync(imagePath);
      
      // 获取图片元数据
      const metadata = await sharp(imagePath).metadata();
      const { format, width, height } = metadata;
      
      let sharpInstance = sharp(imagePath);
      
      // 获取压缩配置
      const compression = this.config.download.compression || {};
      
      // 检查是否需要转换为WebP
      if (compression.convertToWebP && format !== 'webp') {
        console.log(`   🔄 转换为WebP: ${path.basename(imagePath)} (${format} → webp)`);
        
        // 智能选择WebP压缩模式
        const webpOptions = {
          effort: 6,             // 最高压缩努力程度
          smartSubsample: true   // 智能子采样
        };
        
        // 根据图片类型和大小智能选择压缩模式
        const isLargeImage = originalStats.size > 500 * 1024; // 大于500KB
        const isPNG = format === 'png';
        
        if (isPNG && !isLargeImage && compression.webpLossless !== false) {
          // 小PNG图片使用无损压缩保持质量
          webpOptions.lossless = true;
          webpOptions.quality = 100;
          console.log(`   🎯 使用无损WebP压缩 (PNG源文件)`);
        } else {
          // 大图片或JPEG使用有损压缩获得更好的压缩比
          webpOptions.lossless = false;
          webpOptions.quality = compression.webpQuality || 90;
          console.log(`   🎯 使用有损WebP压缩 (质量: ${webpOptions.quality})`);
        }
        
        sharpInstance = sharpInstance.webp(webpOptions);
        
        // 应用尺寸限制
        const maxWidth = compression.maxWidth || 2400;
        const maxHeight = compression.maxHeight || 2400;
        if (width > maxWidth || height > maxHeight) {
          console.log(`   📏 调整尺寸: ${width}x${height} → 最大${maxWidth}x${maxHeight}`);
          sharpInstance = sharpInstance.resize(maxWidth, maxHeight, { 
            withoutEnlargement: true,
            fit: 'inside',
            kernel: sharp.kernel.lanczos3  // 使用高质量缩放算法
          });
        }
        
        // 生成新的WebP文件路径
        const parsedPath = path.parse(imagePath);
        const newPath = path.join(parsedPath.dir, parsedPath.name + '.webp');
        
        try {
          await sharpInstance.toFile(newPath);
          
          // 检查压缩效果
          const newStats = fs.statSync(newPath);
          const compressionRatio = ((originalStats.size - newStats.size) / originalStats.size * 100).toFixed(1);
          const sizeBefore = (originalStats.size / 1024).toFixed(2);
          const sizeAfter = (newStats.size / 1024).toFixed(2);
          
          // 只有在压缩效果显著时才替换原文件
          if (newStats.size < originalStats.size * 0.95) { // 至少减少5%
            fs.unlinkSync(imagePath);
            console.log(`   ✅ WebP转换成功: ${sizeBefore}KB → ${sizeAfter}KB (减少${compressionRatio}%)`);
            return newPath;
          } else {
            // 压缩效果不佳，保留原文件
            fs.unlinkSync(newPath);
            console.log(`   ℹ️  WebP压缩效果不佳，保留原格式: ${sizeBefore}KB`);
            return imagePath;
          }
        } catch (webpError) {
          console.log(`   ⚠️  WebP转换失败，保留原格式: ${webpError.message}`);
          // 清理可能的临时文件
          if (fs.existsSync(newPath)) {
            fs.unlinkSync(newPath);
          }
          return imagePath;
        }
      }
      
      // 保持原格式的优化压缩
      if (format === 'jpeg' || format === 'jpg') {
        // JPEG: 使用高质量但启用优化来减小文件大小
        sharpInstance = sharpInstance.jpeg({ 
          quality: compression.jpegQuality || 95,  // 高质量
          progressive: true,     // 渐进式编码
          mozjpeg: true,        // 使用mozjpeg编码器
          optimiseScans: true,  // 优化扫描
          optimiseCoding: true  // 优化哈夫曼编码
        });
      } else if (format === 'png') {
        // PNG: 使用最高压缩级别的无损压缩
        sharpInstance = sharpInstance.png({ 
          compressionLevel: compression.pngCompressionLevel || 9,  // 最高压缩级别
          adaptiveFiltering: true, // 自适应过滤
          progressive: false,    // PNG不支持渐进式
          palette: true         // 尝试使用调色板
        });
      } else if (format === 'webp') {
        // WebP: 重新优化
        const webpOptions = {
          effort: 6             // 最高压缩努力程度
        };
        
        if (compression.webpLossless !== false) {
          webpOptions.lossless = true;
          webpOptions.quality = 100;
        } else {
          webpOptions.lossless = false;
          webpOptions.quality = compression.webpQuality || 85;
        }
        
        sharpInstance = sharpInstance.webp(webpOptions);
      } else {
        // 其他格式保持不变
        console.log(`   ℹ️  保持原格式: ${path.basename(imagePath)}`);
      }
      
      const maxWidth = compression.maxWidth || 2400;
      const maxHeight = compression.maxHeight || 2400;
      
      // 只有在图片过大时才调整尺寸（保持原始质量）
      if (width > maxWidth || height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, { 
          withoutEnlargement: true,
          fit: 'inside'
        });
      }
      
      await sharpInstance.toFile(tempPath);
      
      // 检查压缩效果
      const tempStats = fs.statSync(tempPath);
      const compressionRatio = ((originalStats.size - tempStats.size) / originalStats.size * 100).toFixed(1);
      
      // 只有在文件变小时才替换
      if (tempStats.size < originalStats.size) {
        fs.renameSync(tempPath, imagePath);
        console.log(`   🗜️  无损压缩完成: ${path.basename(imagePath)} (减少${compressionRatio}%)`);
      } else {
        // 压缩后文件更大，删除临时文件，保持原文件
        fs.unlinkSync(tempPath);
        console.log(`   ℹ️  图片已经是最优大小: ${path.basename(imagePath)}`);
      }
      
      return imagePath;
    } catch (error) {
      // 清理临时文件
      const tempPath = imagePath + '.temp';
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      console.log(`   ⚠️  图片压缩失败，使用原图: ${path.basename(imagePath)} - ${error.message}`);
      return imagePath;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
}

module.exports = ImageProcessor;