# Jinli Club

一个使用 React + FastAPI 构建的社区平台，支持 EVM 钱包登录、任务与奖励系统，以及基础管理功能。

本 README 已更新为当前代码与数据库结构，便于开发与维护。

## 项目文件结构（当前）

```
jinli.club/
├── backend/                     # FastAPI 后端
│   ├── apex.py                  # 程序入口（运行：python3 -m backend.apex）
│   ├── boundary.py              # 统一路由（包含鉴权逻辑）
│   ├── core.py                  # 服务层（数据转换与业务拼装）
│   ├── data.py                  # Repo/DAO 封装（读取 DB，返回模型或字典）
│   ├── data_model.py            # API 输出的 dataclass（无 ORM 映射）
│   ├── database_with_cffi.py    # 数据库初始化（cffi 版本）
│   ├── entity.py                # 轻量 DAO（多数使用原生 SQL，返回 dict 映射）
│   ├── foundation.py            # 会话/Base 等基础设施封装
│   ├── jinli.db                 # SQLite 数据库文件（开发）
│   ├── jinli.db.schemareset.bak # 数据库备份示例
│   ├── requirements.txt         # 后端依赖
│   └── temp_backend.py          # 临时脚本
└── frontend/                    # React 前端
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── locales/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── i18n.js
    │   ├── index.css
    │   ├── styles.css
    │   └── utils.js
    ├── admin.html
    ├── index.html
    ├── nginx.conf
    ├── package.json
    ├── package-lock.json
    └── vite.config.js
```

说明：
- 旧文件 api.py、model.py、model_legacy.py 已清理；鉴权工具已合并到 boundary.py。
- dataclass 定义集中在 data_model.py，用于 API 输出；不再承载 ORM 映射。
- entity.py 尽量使用原生 SQL，返回 dict 映射，减少 ORM 解析问题。

## 后端架构要点
- 路由：backend/apex.py 加载 boundary.py 的统一路由 unified_router。
- 鉴权：boundary.py 内联了 OAuth2/JWT 逻辑（SECRET_KEY、ALGORITHM、ACCESS_TOKEN_EXPIRE_MINUTES）。
- 数据访问：
  - entity.py 提供 UserEntity、BrandEntity、GiftEntity、TaskEntity、JourneyEntity、ChestEntity 等，优先返回 dict。
  - data.py 针对部分场景将 DB 行转换为 data_model.py 的 dataclass，并统一字典输出（含时间戳转换）。
- 数据模型：data_model.py 仅包含 API 输出的数据类（Brand/Gift/Task/Journey/Chest/User 等）。

## 数据库结构（SQLite：backend/jinli.db）

当前表列表：
- user
- asset
- brand
- gift
- journey
- chest
- shard
- task

各表字段（摘自实际 .schema）：

- user
  - uID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - EVM VARCHAR(42) UNIQUE NOT NULL（索引：ix_user_EVM）
  - time_reg DATETIME NOT NULL
  - time_login_last DATETIME NOT NULL
  - is_admin BLOB NOT NULL DEFAULT 0
  - bio TEXT

- asset（用户资产聚合表）
  - aID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - uID INTEGER NOT NULL UNIQUE（FK -> user.uID）
  - time_updated DATETIME NOT NULL
  - points INTEGER NOT NULL DEFAULT 0
  - lucks INTEGER NOT NULL DEFAULT 0
  - gIDs TEXT（礼品记录 ID 列表，历史兼容）
  - sIDs TEXT（碎片/芯片记录 ID 列表，历史兼容）

- brand（品牌）
  - bID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - symbol TEXT UNIQUE NOT NULL
  - name TEXT NOT NULL
  - description TEXT
  - url_image TEXT
  - time_start DATETIME
  - time_end DATETIME
  - time_created DATETIME NOT NULL
  - time_updated DATETIME
  - time_actived DATETIME
  - points INTEGER NOT NULL DEFAULT 10000

- gift（礼品记录）
  - gID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - bID INTEGER NOT NULL（FK -> brand.bID）
  - uID INTEGER（FK -> user.uID，可空）
  - time_created DATETIME NOT NULL
  - time_actived DATETIME（可空）

- journey（任务参与/进度）
  - jID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - tID INTEGER NOT NULL（FK -> task.tID）
  - uID INTEGER NOT NULL（FK -> user.uID）
  - info_input TEXT
  - time_created DATETIME NOT NULL
  - time_checked DATETIME
  - time_claimed DATETIME
  - points_claimed INTEGER NOT NULL DEFAULT 0

- chest（宝箱）
  - cID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - time_created DATETIME NOT NULL
  - tirer INTEGER NOT NULL DEFAULT 0
  - vol_points INTEGER NOT NULL DEFAULT 0（CHECK vol_points >= 0）
  - sID0 INTEGER（FK -> shard.sID）
  - sID_B INTEGER（FK -> shard.sID）
  - time_actived DATETIME DEFAULT 1（历史字段，用作激活/开启状态标记）
  - uID INTEGER（FK -> user.uID）
  - 索引：ix_chest_active(time_actived), ix_chest_uID(uID)

- shard（碎片/芯片记录）
  - sID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - bID INTEGER NOT NULL（FK -> brand.bID）
  - uID INTEGER NOT NULL（FK -> user.uID）
  - time_created DATETIME NOT NULL
  - volume INTEGER NOT NULL DEFAULT 0

- task（任务类型）
  - tID INTEGER PRIMARY KEY AUTOINCREMENT, UNIQUE
  - title TEXT UNIQUE NOT NULL
  - note TEXT
  - refcode TEXT
  - link0 TEXT
  - linkB TEXT
  - time_start DATETIME
  - time_end DATETIME
  - time_created DATETIME
  - time_updated DATETIME
  - is_open BOOL NOT NULL DEFAULT False

提示：
- 项目路由中不存在 symbol 表的使用（如需引入，请在 DB 中创建并同步路由）。
- 历史上部分时间字段可能为非标准字符串；entity/data 层已尽量避免 ORM 自动解析导致的异常。

## 启动与开发

后端启动：
1) 安装依赖
   - cd backend
   - pip install -r requirements.txt
2) 配置环境变量
   - 在 backend 目录下创建 .env（示例）
     - SECRET_KEY=your-secret-key-here
     - ALGORITHM=HS256
     - ACCESS_TOKEN_EXPIRE_MINUTES=30
3) 启动服务
   - 在项目根目录运行：python3 -m backend.apex
   - 服务地址：http://0.0.0.0:8000/

前端启动：
1) cd frontend && npm install
2) npm run dev（默认 http://localhost:3000/ 或 Vite 默认端口）

## 常用数据库操作（SQLite）
- 列出表：sqlite3 backend/jinli.db ".tables"
- 查看表结构：sqlite3 backend/jinli.db ".schema"
- 示例查询：sqlite3 backend/jinli.db -header -column "SELECT * FROM user LIMIT 5;"

## 维护建议
- 路由与数据访问统一在 boundary.py + entity.py；如需新增模块，建议延续“原生 SQL + dict 映射”的方式。
- dataclass（data_model.py）仅用于对外输出，避免与 ORM 混用导致耦合。
- 如需引入统计或批量操作，优先在 entity.py 中新增方法，并在 boundary/core 中拼装返回。


## UI
### 按钮
inactive	非活跃/不可操作状态，禁用的按钮、非推荐的选项或其确认操作。
primary	推荐的选项、主要操作或其确认操作。
proceed	后续的操作或其确认操作。
success	成功状态或其确认操作。
warning 用于警告、危险操作或其确认操作。

btn-inactive 灰色按钮：
btn-primary 黄色按钮：
btn-proceed	蓝色按钮：
btn-success	绿色按钮：
btn-warning 红色按钮：

card-inactive 灰色卡片：
card-primary 黄色卡片：
card-proceed	蓝色卡片：
card-success	绿色卡片：
card-warning 红色卡片：

badge-inactive 灰色徽章：灰色背景，黄色边框，五角星不变
badge-primary 黄色徽章：
badge-proceed	蓝色徽章：
badge-success	绿色徽章：
badge-warning 红色徽章：

badge-gift-inactive 灰色礼品徽章：
badge-gift-primary 黄色礼品徽章：
badge-gift-proceed	蓝色礼品徽章：
badge-gift-success	绿色礼品徽章：
badge-gift-warning 红色礼品徽章：


tag-price-inactive 灰色价格标签：
tag-price-primary 黄色价格标签：
tag-price-proceed	蓝色价格标签：
tag-price-success	绿色价格标签：
tag-price-warning 红色价格标签：

tag-status-inactive 灰色状态标签；
tag-status-primary 黄色状态标签；
tag-status-proceed	蓝色状态标签；
tag-status-success	绿色状态标签；
tag-status-warning 红色状态标签；



subsection_task_tocomplete
subsection_task_toclaim
subsection_task_claimed


计算 gift-status 并显示：
- 逻辑： time_end - now
  - ≤ 1 天： t('giftStatusHours')
  - ≤ 1 周： t('giftStatusDays')
  - ≤ 1 月： t('giftStatusWeeks')
  - 1 月或无 time_end ： t('giftStatusLimited')

计算 task-status 并显示：
- 逻辑： time_end - now
  - ≤ 1 天： 'taskStatusHours')
  - ≤ 1 周： 'taskStatusDays')
  - ≤ 1 月： taskStatusWeeks ：
  - 1 月或无 time_end ： taskStatusLimited')

task-type
task-type-join 的文案是：Join to Earn
task-type-trade 的文案是：Trade to Earn
task-type-vote 的文案是：Vote to Earn
task-type-meetup 的文案是：IRL Meetup to Earn

journey
api/journey/claim/$jID


重要的流程：


chest table -> time(both time_created and time_)
delete: chest -> create --> time_created (最新就是今天) --> time_bind

chest -> claim -> points --> time_claimed
journey -> submit -> check -> claim -> points
points -> claim -> active --> to use