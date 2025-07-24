# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hexo blog publishing tool called "Articles Publisher" that converts traditional CLI publishing workflows into a modern web interface. It allows users to publish Markdown articles from sources like Obsidian to Hexo blogs with automated image processing, Git operations, and deployment.

## Project Structure

```
├── src/
│   ├── core/           # Core publishing logic
│   │   └── magic-publish.js - Main publishing engine
│   ├── server/         # Web server components
│   │   └── server.js - Express web server with REST API
│   └── utils/          # Utility modules
│       ├── logger.js - Scientific logging system
│       ├── config.js - Configuration management
│       └── image-processor.js - Image processing utilities
├── public/             # Static web assets
│   └── index.html - Web interface
├── scripts/            # Shell scripts and tools
│   ├── publish.sh - CLI publishing wrapper
│   ├── setup.sh - Interactive setup script
│   └── test-git.sh - Git testing utilities
├── config/             # Configuration templates
│   ├── config.example.json - Configuration template
│   └── hexo-config-example.yml - Hexo configuration example
├── docs/               # Documentation
└── logs/               # Log files (gitignored)
```

## Architecture

### Core Components

- **`src/core/magic-publish.js`**: Main publishing engine with modular utilities
- **`src/server/server.js`**: Express web server with REST API endpoints
- **`src/utils/logger.js`**: Centralized logging system with session tracking
- **`src/utils/config.js`**: Configuration management and validation
- **`src/utils/image-processor.js`**: Image download, compression, and processing
- **`public/index.html`**: Three-column responsive web interface
- **`scripts/publish.sh`**: CLI wrapper for command-line publishing

### Key Classes

- **`MagicPublisher`**: Core publishing orchestrator using modular utilities
- **`Logger`**: Session-based logging with categorized messages
- **`ConfigManager`**: Configuration loading, validation, and updates
- **`ImageProcessor`**: Image handling with Sharp compression
- **`HexoPublisherServer`**: Express server with file upload handling
- **`CustomMagicPublisher`**: Web-adapted publisher for server integration

## Common Commands

### Development and Running

```bash
# Install dependencies
npm install
# or
npm run setup

# Start web server (recommended)
npm run server
# or
npm run dev
# or 
npm start

# CLI publishing
npm run publish
# or
./scripts/publish.sh
# or
node src/core/magic-publish.js "path/to/article.md"

# Setup initial configuration
./scripts/setup.sh
```

### Web Interface

- Access at `http://localhost:3000`
- Upload markdown files via drag-drop or file picker
- Upload cover images and preview in real-time
- Configure blog and image directories through the web interface

## Configuration

### Required Configuration File: `config.json`

Based on `config.example.json`, must include:

```json
{
  "hexo": {
    "postsDir": "/absolute/path/to/hexo/source/_posts",
    "imagesDir": "/absolute/path/to/hexo/source/images", 
    "gitRepo": "/absolute/path/to/hexo",
    "baseUrl": "https://yourblog.com"
  },
  "git": {
    "autoCommit": true,
    "autoPush": true,
    "branch": "main",
    "commitPrefix": "📝 发布文章:"
  },
  "deploy": {
    "autoHexoDeploy": true,
    "cleanBeforeGenerate": true
  },
  "download": {
    "compressImages": true,
    "concurrency": 3,
    "maxRetries": 3,
    "timeout": 30000,
    "compression": {
      "maxWidth": 2400,
      "maxHeight": 2400,
      "jpegQuality": 95
    }
  }
}
```

### Environment Requirements

- Node.js 16.0+ (recommended 18.0+)
- Git configured with push permissions
- Hexo blog already set up and configured
- Sharp library for image processing (auto-installed)

## Publishing Workflow

### Web Interface Flow
1. Configure blog/image directories
2. Upload markdown file (drag-drop supported)
3. Set target filename
4. Preview rendered content with Front Matter toggle
5. Upload optional cover image with preview
6. Execute one-click publish

### CLI Flow
1. Auto-detect recent files from Obsidian vault or specify file
2. Analyze markdown for external image links
3. Download and compress images with Sharp
4. Convert image URLs to local paths
5. Save processed markdown to Hexo posts directory
6. Git commit and push (if enabled)
7. Run Hexo generate and deploy (if enabled)

## Key Features

### Image Processing
- Downloads external images (HTTP/HTTPS URLs)
- Compresses images with Sharp (JPEG quality 95%, PNG level 9)
- Supports WebP conversion with lossless/lossy options
- Generates organized directory structure: `YYYY/MM/DD/filename`
- Safe filename sanitization for cross-platform compatibility

### Git Integration
- Automatic pull before operations to handle conflicts
- Smart conflict resolution with stash/unstash
- Configurable commit messages with prefixes
- Automatic push to remote repository
- Comprehensive error handling with recovery suggestions

### Logging System
- Session-based logging with unique IDs
- Categorized logs: INFO, WARN, ERROR, PROGRESS, FILE, NETWORK, GIT
- Daily log files: `logs/publish-YYYY-MM-DD.log`
- Session-specific logs: `logs/session-[ID].log`

## File Structure

- `magic-publish.js` - Core publishing engine (850 lines)
- `server.js` - Web server with API endpoints (633 lines)
- `index.html` - Three-column responsive web interface
- `config.json` - Configuration file (created from config.example.json)
- `logs/` - Directory for session and daily logs
- `uploads/` - Temporary directory for file uploads (auto-created)

## Testing and Validation

The project uses Hexo's built-in validation. After publishing:
- Check `hexo generate` runs without errors
- Verify `hexo deploy` completes successfully
- Validate Git repository status
- Confirm images are properly compressed and accessible

## Common Issues

1. **Configuration errors**: Ensure all paths in config.json are absolute and directories exist
2. **Git conflicts**: Tool includes automatic conflict resolution, but may require manual intervention
3. **Image processing failures**: Falls back to original images if Sharp compression fails
4. **Network timeouts**: Configurable retry mechanism for image downloads
5. **Permission issues**: Ensure write access to Hexo directories and Git repository