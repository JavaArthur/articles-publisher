const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.config = null;
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.validateConfig();
      return this.config;
    } catch (error) {
      throw new Error(`配置文件读取失败: ${error.message}`);
    }
  }

  validateConfig() {
    const required = [
      'hexo.postsDir',
      'hexo.imagesDir',
      'hexo.gitRepo'
    ];
    
    for (const key of required) {
      const value = this.getNestedValue(this.config, key);
      if (!value) {
        throw new Error(`配置项缺失: ${key}`);
      }
    }
    
    // 检查目录是否存在
    if (!fs.existsSync(this.config.hexo.postsDir)) {
      throw new Error(`Hexo posts目录不存在: ${this.config.hexo.postsDir}`);
    }
    
    // 创建images目录（如果不存在）
    if (!fs.existsSync(this.config.hexo.imagesDir)) {
      fs.mkdirSync(this.config.hexo.imagesDir, { recursive: true });
      console.log(`✅ 创建images目录: ${this.config.hexo.imagesDir}`);
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  updateConfig(updates) {
    try {
      // 读取当前配置
      const currentConfig = this.loadConfig();
      
      // 更新配置
      Object.keys(updates).forEach(key => {
        if (key === 'postsDir') {
          currentConfig.hexo.postsDir = updates[key];
        } else if (key === 'imagesDir') {
          currentConfig.hexo.imagesDir = updates[key];
        } else if (key === 'baseUrl') {
          currentConfig.hexo.baseUrl = updates[key];
        }
      });

      // 验证目录路径
      if (updates.postsDir && !path.isAbsolute(updates.postsDir)) {
        throw new Error('博客目录必须是绝对路径');
      }
      if (updates.imagesDir && !path.isAbsolute(updates.imagesDir)) {
        throw new Error('图片目录必须是绝对路径');
      }

      // 尝试创建目录（如果不存在）
      if (updates.postsDir && !fs.existsSync(updates.postsDir)) {
        fs.mkdirSync(updates.postsDir, { recursive: true });
      }
      if (updates.imagesDir && !fs.existsSync(updates.imagesDir)) {
        fs.mkdirSync(updates.imagesDir, { recursive: true });
      }
      
      // 保存配置
      fs.writeFileSync(this.configPath, JSON.stringify(currentConfig, null, 2));
      this.config = currentConfig;
      
      return currentConfig;
    } catch (error) {
      throw new Error(`配置更新失败: ${error.message}`);
    }
  }

  getConfig() {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }
}

module.exports = ConfigManager;