# DpccGaming Vue版本

这是DpccGaming游戏平台的Vue 3版本，使用现代化的前端技术栈重构。

## 技术栈

- **Vue 3** - 渐进式JavaScript框架
- **Vite** - 快速的前端构建工具
- **Pinia** - Vue状态管理库
- **Tailwind CSS** - 实用优先的CSS框架
- **Axios** - HTTP客户端
- **Font Awesome** - 图标库

## 项目特点

- ✅ 响应式设计，支持移动端
- ✅ 组件化架构，易于维护
- ✅ 状态管理，数据流清晰
- ✅ 现代化UI，用户体验优秀
- ✅ 全屏游戏模式
- ✅ 实时评论系统
- ✅ 用户认证系统

## 快速开始

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 生产构建

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
src/
├── components/     # Vue组件
├── stores/        # Pinia状态管理
├── utils/         # 工具函数
├── App.vue        # 主应用
├── main.js        # 入口文件
└── style.css      # 样式文件
```

## 启动说明

### 开发环境
```bash
# 启动Vue开发服务器
npm run dev

# 启动后端服务器
npm run server
```

### 生产环境
```bash
# 构建Vue项目
npm run build

# 启动后端服务器
npm start
```

## 部署

详细的部署指南请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 功能说明

### 主要功能
- 游戏展示和播放
- 用户注册和登录
- 游戏评论和评分
- 全屏游戏模式
- 游戏上传（管理员功能）

### 组件说明
- `Navbar` - 顶部导航栏
- `HeroSection` - 首页英雄区域
- `GamesSection` - 游戏展示区域
- `GameModal` - 游戏详情模态框
- `LoginModal` - 登录模态框
- `RegisterModal` - 注册模态框
- `AddGameModal` - 添加游戏模态框
- `FullscreenGame` - 全屏游戏组件
- `Footer` - 页脚

## 开发说明

### 状态管理
使用Pinia进行状态管理，分为三个store：
- `auth` - 用户认证状态
- `game` - 游戏相关状态
- `modal` - 模态框状态

### API调用
所有API调用都通过`utils/api.js`统一处理，包括：
- 自动添加认证头
- 错误处理
- 请求拦截

### 样式
使用Tailwind CSS进行样式管理，保持与原始设计的一致性。

## ⚠️ 重要配置说明

### 部署前必须修改的配置

1. **API服务器地址** (`src/utils/api.js`)
   ```javascript
   // 修改第6行为你的实际服务器地址
   const API_BASE_URL = 'http://你的服务器IP:3000/api'
   ```

2. **Games文件夹结构**
   ```
   games/
   ├── web-mobile-001/    # 游戏ID目录
   │   └── index.html     # 游戏主文件
   └── 其他游戏目录/
   ```

### 其他注意事项

1. 确保后端服务正常运行
2. 检查API地址配置
3. 确保静态资源路径正确
4. 游戏文件需要放在`games/`目录下
5. 详细配置说明请查看 `CONFIG_CHECKLIST.md`

## 更新日志

- v1.0.0 - 初始Vue版本发布
  - 完成HTML到Vue的转换
  - 实现所有原有功能
  - 优化用户体验
  - 添加现代化UI组件
