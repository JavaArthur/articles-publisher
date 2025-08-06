const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

class ConfigManager {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.config = null;
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      // 从环境变量加载敏感信息
      this.loadFromEnvironment();
      
      this.validateConfig();
      return this.config;
    } catch (error) {
      throw new Error(`配置文件读取失败: ${error.message}`);
    }
  }

  loadFromEnvironment() {
    // 初始化 AI 配置（如果不存在）
    if (!this.config.ai) {
      this.config.ai = {};
    }

    // 从环境变量加载 AI 配置
    if (process.env.AI_API_KEY) {
      this.config.ai.apiKey = process.env.AI_API_KEY;
    }
    
    if (process.env.AI_DEFAULT_MODEL) {
      this.config.ai.defaultModel = process.env.AI_DEFAULT_MODEL;
    } else if (!this.config.ai.defaultModel) {
      this.config.ai.defaultModel = 'doubao-seed-1-6-250615';
    }
    
    if (process.env.AI_SYSTEM_PROMPT) {
      this.config.ai.systemPrompt = process.env.AI_SYSTEM_PROMPT;
    } else if (!this.config.ai.systemPrompt) {
      this.config.ai.systemPrompt = 'You are a helpful assistant.';
    }
    
    if (process.env.AI_MODELS) {
      this.config.ai.models = process.env.AI_MODELS.split(',').map(model => model.trim());
    } else if (!this.config.ai.models) {
      this.config.ai.models = ['doubao-seed-1-6-250615', 'doubao-seed-1-6-flash-250715'];
    }
    
    // 保持 prompts 配置不变（从配置文件加载）
    if (!this.config.ai.prompts) {
      this.config.ai.prompts = {
        title: "请为以下文章内容生成一个吸引人的标题，要求简洁明了，不超过30个字符：\n\n{content}",
        frontmatter: "请为我提供的Markdown内容进行生成Hexo博客的页面属性（Front Matter）..."
      };
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