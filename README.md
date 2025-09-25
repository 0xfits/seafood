# Jinli Club

一个基于React和FastAPI的多语言社区平台，支持OKX钱包登录、任务系统、奖励系统和日历功能。

## 项目结构

```
jinli.club/
├── backend/           # FastAPI后端
│   ├── main.py        # 主入口文件
│   ├── models.py      # 数据库模型
│   ├── requirements.txt # Python依赖
│   └── .env.example   # 环境变量示例
├── frontend/          # React前端
│   ├── src/           # 源代码
│   │   ├── components/ # React组件
│   │   ├── pages/      # 页面组件
│   │   ├── locales/    # 多语言文件
│   │   ├── App.jsx     # 主应用组件
│   │   ├── main.jsx    # React入口文件
│   │   ├── i18n.js     # 国际化配置
│   │   └── index.css   # 全局样式
│   ├── package.json   # 前端依赖
│   ├── vite.config.js # Vite配置
│   └── index.html     # HTML入口
├── .gitignore         # Git忽略规则
├── LICENSE            # 许可证
└── README.md          # 项目说明
```

## 技术栈

### 前端
- React 18
- Vite
- React Router
- i18next (国际化)
- Tailwind CSS (样式)
- FullCalendar (日历功能)
- Web3.js (EVM钱包集成)
- React Hot Toast (通知)

### 后端
- FastAPI
- SQLAlchemy (ORM)
- PostgreSQL (数据库)
- JWT (认证)
- Uvicorn (ASGI服务器)

## 快速开始

### 前端

1. 安装依赖
```bash
cd frontend
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

前端服务器将在 http://localhost:3000 启动

### 后端

1. 安装依赖
```bash
cd backend
pip install -r requirements.txt
```

2. 创建环境变量文件
```bash
cp .env.example .env
# 编辑.env文件，配置数据库连接和其他环境变量
```

3. 启动开发服务器
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端服务器将在 http://localhost:8000 启动

## 主要功能

1. **多语言支持**：中文、英文、粤语、越南语
2. **OKX钱包登录**：基于EVM地址和签名验证
3. **任务系统**：用户可以查看、完成和提交任务
4. **奖励系统**：完成任务后可以选择和领取奖励
5. **日历功能**：显示社区活动和事件
6. **管理员后台**：验证用户提交的任务

## 页面结构

- **首页**：显示日历、奖励和任务概览
- **奖励页**：显示所有可用奖励
- **任务页**：显示用户的任务清单和状态
- **个人资料页**：显示用户信息和任务统计
- **管理员后台**：管理和验证用户提交的任务

## 部署

前端可以部署到Vercel，后端可以部署到任何支持FastAPI的平台。

## 开发说明

1. 请确保Node.js和Python已安装
2. 前端使用Vite开发服务器，后端使用Uvicorn开发服务器
3. 前端通过代理（vite.config.js中的proxy配置）连接到后端API
4. 数据库模型定义在models.py中
5. API端点定义在main.py中

## 注意事项

1. 本项目使用模拟数据进行演示，实际部署时需要配置真实的数据库
2. 环境变量中包含敏感信息，请确保在生产环境中正确保护
3. 管理员功能需要配置正确的EVM地址
