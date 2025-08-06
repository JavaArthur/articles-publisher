#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const Logger = require('../utils/logger');
const ConfigManager = require('../utils/config');
const ImageProcessor = require('../utils/image-processor');

class MagicPublisher {
  constructor() {
    this.configManager = new ConfigManager();
    this.config = this.configManager.loadConfig();
    this.logger = new Logger();
    this.imageProcessor = new ImageProcessor(this.config, this.logger);
    
    this.currentFile = process.argv[2];
    
    if (!this.currentFile) {
      this.logger.error('INIT', '❌ 请提供要发布的markdown文件路径');
      console.log('用法: node magic-publish.js "文章.md"');
      process.exit(1);
    }
  }

  async publish() {
    console.log('🎯 开始魔法发布流程...\n');
    
    try {
      // 步骤1: 分析文件
      this.showProgress(1, 6, '📄 分析markdown文件');
      const { content, images } = this.analyzeMarkdown();
      
      if (images.length === 0) {
        console.log('   ℹ️  未发现需要处理的外部图片');
      }
      
      // 步骤2: 下载图片
      this.showProgress(2, 6, '📸 下载图片到本地');
      const downloadedImages = await this.imageProcessor.downloadImages(images);
      
      // 步骤3: 转换路径
      this.showProgress(3, 6, '🔄 转换图片路径');
      const newContent = this.convertImagePaths(content, downloadedImages);
      
      // 步骤4: 保存文件
      this.showProgress(4, 6, '💾 保存到Hexo项目');
      this.saveToHexo(newContent);
      
      // 步骤5: Git提交
      if (this.config.git.autoCommit) {
        this.showProgress(5, 6, '📤 Git提交和推送');
        this.gitCommitAndPush();
      } else {
        this.showProgress(5, 6, '⏭️  跳过Git操作');
      }
      
      // 步骤6: 部署
      if (this.config.deploy.autoHexoDeploy) {
        this.showProgress(6, 6, '🚀 部署到线上');
        this.deployHexo();
      } else {
        this.showProgress(6, 6, '⏭️  跳过自动部署');
      }
      
      console.log('\n🎉 发布完成！');
      this.showResults();
      
    } catch (error) {
      this.logger.error('PUBLISH', `发布失败: ${error.message}`);
      console.error('\n❌ 发布失败:', error.message);
      process.exit(1);
    }
  }

  analyzeMarkdown() {
    if (!fs.existsSync(this.currentFile)) {
      throw new Error(`文件不存在: ${this.currentFile}`);
    }

    const content = fs.readFileSync(this.currentFile, 'utf8');

    const images = [];
    const processedUrls = new Set(); // 避免重复处理同一张图片

    // 1. 提取标准markdown图片语法：![alt](url)
    const standardImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = standardImageRegex.exec(content)) !== null) {
      const imageUrl = match[2];
      if (!processedUrls.has(imageUrl)) {
        processedUrls.add(imageUrl);
        const filename = this.imageProcessor.generateFilename(imageUrl);
        images.push({
          alt: match[1],
          originalUrl: imageUrl,
          filename: filename,
          localPath: `/images/${filename}`,
          type: 'standard'
        });
      }
    }

    // 2. 提取Front Matter中的封面图片
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      
      // 匹配各种封面图片字段
      const coverPatterns = [
        /^cover:\s*(https?:\/\/[^\s]+)/m,
        /^banner:\s*(https?:\/\/[^\s]+)/m,
        /^image:\s*(https?:\/\/[^\s]+)/m,
        /^thumbnail:\s*(https?:\/\/[^\s]+)/m,
        /^featured_image:\s*(https?:\/\/[^\s]+)/m
      ];

      coverPatterns.forEach(pattern => {
        const coverMatch = frontMatter.match(pattern);
        if (coverMatch) {
          const imageUrl = coverMatch[1];
          if (!processedUrls.has(imageUrl)) {
            processedUrls.add(imageUrl);
            const filename = this.imageProcessor.generateFilename(imageUrl);
            images.push({
              alt: 'cover',
              originalUrl: imageUrl,
              filename: filename,
              localPath: `/images/${filename}`,
              type: 'cover'
            });
          }
        }
      });
    }

    // 3. 提取HTML img标签中的图片
    const htmlImageRegex = /<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/g;
    while ((match = htmlImageRegex.exec(content)) !== null) {
      const imageUrl = match[1];
      if (!processedUrls.has(imageUrl)) {
        processedUrls.add(imageUrl);
        const filename = this.imageProcessor.generateFilename(imageUrl);
        images.push({
          alt: 'html-image',
          originalUrl: imageUrl,
          filename: filename,
          localPath: `/images/${filename}`,
          type: 'html'
        });
      }
    }

    console.log(`   找到 ${images.length} 张外部图片需要处理`);
    if (images.length > 0) {
      console.log('   图片详情:');
      images.forEach((img, index) => {
        const domain = new URL(img.originalUrl).hostname;
        const typeLabel = img.type === 'cover' ? '🖼️ 封面' : 
                         img.type === 'html' ? '🏷️ HTML' : '📷 标准';
        console.log(`     ${index + 1}. ${typeLabel} ${domain}`);
      });
    }

    return { content, images };
  }

  convertImagePaths(content, downloadedImages) {
    let newContent = content;

    downloadedImages.forEach(image => {
      if (image.type === 'standard') {
        // 标准markdown图片语法
        const originalPattern = `![${image.alt}](${image.originalUrl})`;
        const localPattern = `![${image.alt}](${image.localPath})`;
        newContent = newContent.replace(originalPattern, localPattern);
      } else if (image.type === 'cover') {
        // Front Matter中的封面图片
        // 匹配各种可能的封面字段格式
        const patterns = [
          new RegExp(`^(cover:\\s*)${this.escapeRegExp(image.originalUrl)}`, 'm'),
          new RegExp(`^(banner:\\s*)${this.escapeRegExp(image.originalUrl)}`, 'm'),
          new RegExp(`^(image:\\s*)${this.escapeRegExp(image.originalUrl)}`, 'm'),
          new RegExp(`^(thumbnail:\\s*)${this.escapeRegExp(image.originalUrl)}`, 'm'),
          new RegExp(`^(featured_image:\\s*)${this.escapeRegExp(image.originalUrl)}`, 'm')
        ];

        patterns.forEach(pattern => {
          newContent = newContent.replace(pattern, `$1${image.localPath}`);
        });
      } else if (image.type === 'html') {
        // HTML img标签
        const imgTagRegex = new RegExp(
          `<img([^>]+)src=["']?${this.escapeRegExp(image.originalUrl)}["']?([^>]*)>`,
          'g'
        );
        newContent = newContent.replace(imgTagRegex, `<img$1src="${image.localPath}"$2>`);
      }
    });

    return newContent;
  }

  // 辅助函数：转义正则表达式特殊字符
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  saveToHexo(content) {
    const filename = path.basename(this.currentFile);
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

  gitCommitAndPush() {
    try {
      const filename = path.basename(this.currentFile, '.md');
      const commitMessage = `${this.config.git.commitPrefix} ${filename}`;

      console.log('   🔄 切换到Git仓库目录...');
      process.chdir(this.config.hexo.gitRepo);

      // 检查Git仓库状态
      console.log('   🔍 检查Git仓库状态...');
      try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        if (status.trim()) {
          console.log('   📋 发现未提交的更改:');
          console.log(status.split('\n').filter(line => line.trim()).map(line => `      ${line}`).join('\n'));
        }
      } catch (statusError) {
        console.log('   ⚠️  无法检查Git状态，继续执行...');
        this.logger.error('GIT', `Git状态检查失败: ${statusError.message}`);
      }

      // 先拉取最新代码
      console.log('   ⬇️  拉取最新代码...');
      try {
        const pullResult = execSync(`git pull origin ${this.config.git.branch}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log('   ✅ 代码拉取完成');
        if (pullResult.trim() && !pullResult.includes('Already up to date')) {
          console.log(`      ${pullResult.trim()}`);
        }
        this.logger.info('GIT', `Git pull完成: ${pullResult.trim()}`);
      } catch (pullError) {
        console.log('   ⚠️  代码拉取失败，尝试继续...');
        console.log(`      错误: ${pullError.message}`);
        this.logger.error('GIT', `Git pull失败: ${pullError.message}`);

        // 如果是因为有本地更改导致的冲突，尝试stash
        if (pullError.message.includes('would be overwritten') || pullError.message.includes('conflict')) {
          console.log('   🔄 检测到冲突，尝试暂存本地更改...');
          try {
            execSync('git stash', { encoding: 'utf8' });
            execSync(`git pull origin ${this.config.git.branch}`, { encoding: 'utf8' });
            execSync('git stash pop', { encoding: 'utf8' });
            console.log('   ✅ 冲突解决完成');
          } catch (stashError) {
            console.log('   ❌ 自动解决冲突失败，请手动处理');
            this.logger.error('GIT', `Git冲突解决失败: ${stashError.message}`);
            throw new Error('Git冲突需要手动解决');
          }
        }
      }

      // 添加文件
      console.log('   ➕ 添加文件到Git...');
      try {
        const addResult = execSync('git add .', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log('   ✅ 文件添加完成');
        this.logger.info('GIT', 'Git add完成');
      } catch (addError) {
        console.log('   ❌ 文件添加失败');
        console.log(`      错误: ${addError.message}`);
        this.logger.error('GIT', `Git add失败: ${addError.message}`);
        throw addError;
      }

      // 检查是否有需要提交的更改
      try {
        const diffResult = execSync('git diff --cached --name-only', { encoding: 'utf8' });
        if (!diffResult.trim()) {
          console.log('   ℹ️  没有需要提交的更改');
          this.logger.info('GIT', '没有需要提交的更改');
          return;
        }
        console.log('   📝 准备提交的文件:');
        diffResult.trim().split('\n').forEach(file => {
          console.log(`      ${file}`);
        });
      } catch (diffError) {
        console.log('   ⚠️  无法检查待提交文件，继续执行...');
      }

      // 提交
      console.log('   💾 提交更改...');
      try {
        const commitResult = execSync(`git commit -m "${commitMessage}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log('   ✅ 提交完成');
        this.logger.info('GIT', `Git commit完成: ${commitMessage}`);
      } catch (commitError) {
        if (commitError.message.includes('nothing to commit')) {
          console.log('   ℹ️  没有需要提交的更改');
          this.logger.info('GIT', '没有需要提交的更改');
          return;
        }
        console.log('   ❌ 提交失败');
        console.log(`      错误: ${commitError.message}`);
        this.logger.error('GIT', `Git commit失败: ${commitError.message}`);
        throw commitError;
      }

      // 推送
      if (this.config.git.autoPush) {
        console.log('   ⬆️  推送到远程仓库...');
        try {
          const pushResult = execSync(`git push origin ${this.config.git.branch}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          console.log('   ✅ 推送完成');
          console.log('   📤 Git提交和推送完成');
          this.logger.info('GIT', `Git push完成: ${pushResult.trim()}`);
        } catch (pushError) {
          console.log('   ❌ 推送失败');
          console.log(`      错误: ${pushError.message}`);
          this.logger.error('GIT', `Git push失败: ${pushError.message}`);

          // 如果是因为远程有新提交导致的推送失败，提示用户
          if (pushError.message.includes('rejected') || pushError.message.includes('non-fast-forward')) {
            console.log('   💡 提示: 远程仓库有新提交，请先拉取最新代码');
            throw new Error('推送被拒绝，远程仓库有新提交');
          }
          throw pushError;
        }
      } else {
        console.log('   📝 Git提交完成（跳过推送）');
      }

      this.logger.info('GIT', `Git操作完成: ${commitMessage}`);
    } catch (error) {
      console.log('   ❌ Git操作失败，请手动处理');
      console.log(`      详细错误: ${error.message}`);
      this.logger.error('GIT', `Git操作失败: ${error.message}`);

      // 提供一些常见问题的解决建议
      console.log('\n   💡 常见解决方案:');
      console.log('      1. 检查网络连接');
      console.log('      2. 确认Git仓库配置正确');
      console.log('      3. 检查是否有权限问题');
      console.log('      4. 手动执行: cd ' + this.config.hexo.gitRepo + ' && git status');

      throw error;
    }
  }

  deployHexo() {
    try {
      console.log('   🔄 切换到Hexo项目目录...');
      process.chdir(this.config.hexo.gitRepo);

      if (this.config.deploy.cleanBeforeGenerate) {
        console.log('   🧹 清理Hexo缓存...');
        try {
          const cleanResult = execSync('hexo clean', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          console.log('   ✅ 缓存清理完成');
          this.logger.info('HEXO', `Hexo clean完成: ${cleanResult.trim()}`);
        } catch (cleanError) {
          console.log('   ⚠️  缓存清理失败，继续执行...');
          console.log(`      错误: ${cleanError.message}`);
          this.logger.error('HEXO', `Hexo clean失败: ${cleanError.message}`);
        }
      }

      console.log('   🔨 生成静态文件...');
      try {
        const generateResult = execSync('hexo generate', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log('   ✅ 静态文件生成完成');
        this.logger.info('HEXO', `Hexo generate完成: ${generateResult.trim()}`);
      } catch (generateError) {
        console.log('   ❌ 静态文件生成失败');
        console.log(`      错误: ${generateError.message}`);
        this.logger.error('HEXO', `Hexo generate失败: ${generateError.message}`);
        throw generateError;
      }

      console.log('   🚀 部署到远程...');
      try {
        const deployResult = execSync('hexo deploy', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log('   ✅ 部署完成');
        console.log('   🚀 Hexo部署完成');
        this.logger.info('HEXO', `Hexo deploy完成: ${deployResult.trim()}`);
      } catch (deployError) {
        console.log('   ❌ 部署失败');
        console.log(`      错误: ${deployError.message}`);
        this.logger.error('HEXO', `Hexo deploy失败: ${deployError.message}`);
        throw deployError;
      }

      this.logger.info('HEXO', 'Hexo部署完成');
    } catch (error) {
      console.log('   ❌ Hexo部署失败，请手动执行');
      console.log(`      详细错误: ${error.message}`);
      this.logger.error('HEXO', `Hexo部署失败: ${error.message}`);

      // 提供手动执行的命令
      console.log('\n   💡 手动执行命令:');
      console.log(`      cd ${this.config.hexo.gitRepo}`);
      if (this.config.deploy.cleanBeforeGenerate) {
        console.log('      hexo clean');
      }
      console.log('      hexo generate');
      console.log('      hexo deploy');

      throw error;
    }
  }

  showProgress(current, total, message) {
    const percent = Math.round((current / total) * 100);
    const filled = Math.round(percent / 2);
    const empty = 50 - filled;
    
    const progressBar = '='.repeat(filled) + '-'.repeat(empty);
    console.log(`[${progressBar}] ${percent}% ${message}`);
    
    // 记录进度到日志
    this.logger.progress(current, total, message, percent);
  }

  showResults() {
    const filename = path.basename(this.currentFile, '.md');
    console.log('\n📊 发布结果:');
    console.log(`   📝 文章: ${filename}`);
    console.log(`   🔗 博客地址: ${this.config.hexo.baseUrl}`);
    console.log(`   📁 本地路径: ${this.config.hexo.postsDir}`);
    console.log('\n✨ 大功告成！可以去检查博客效果了~');
  }
}

// 执行发布
if (require.main === module) {
  new MagicPublisher().publish();
}

module.exports = MagicPublisher;