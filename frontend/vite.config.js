import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // 拦截API请求，返回静态JSON文件
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        
        // 根据请求路径返回对应的静态JSON文件
        let filePath = null
        if (req.url.includes('/gifts/all')) {
          // 返回礼品数据
          filePath = join(__dirname, '../backend/static_api/gifts.json')
        } else if (req.url.includes('/tasks/all')) {
          // 模拟任务数据
          const mockTasks = [
            {
              "tID": 1,
              "title": "完成社区问卷调查",
              "note": "参与社区问卷调查，帮助我们改进服务",
              "refcode": "SURVEY2023",
              "linkA": "https://example.com/survey",
              "is_active": true
            },
            {
              "tID": 2,
              "title": "分享项目到社交媒体",
              "note": "将我们的项目分享到至少一个社交媒体平台",
              "refcode": "SOCIALSHARE",
              "linkA": "https://example.com/share",
              "is_active": true
            },
            {
              "tID": 3,
              "title": "撰写项目反馈",
              "note": "提供详细的项目使用体验和建议",
              "refcode": "FEEDBACK",
              "linkA": "https://example.com/feedback",
              "is_active": true
            }
          ]
          res.end(JSON.stringify({
            success: true,
            data: mockTasks
          }))
          return
        } else if (req.url.includes('/auth/login')) {
          // 模拟登录成功响应
          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => {
              body += chunk.toString()
            })
            req.on('end', () => {
              res.end(JSON.stringify({
                "access_token": "mock-jwt-token",
                "token_type": "bearer"
              }))
            })
            return
          }
        } else if (req.url.includes('/health')) {
          // 健康检查
          res.end(JSON.stringify({"status": "healthy"}))
          return
        } else if (req.url.includes('/tasklist/user/')) {
          // 模拟任务清单数据
          res.end(JSON.stringify({
            success: true,
            data: {
              pendingRewards: [],
              pendingTasks: [],
              completedTasks: []
            }
          }))
          return
        } else if (req.url.includes('/calendar/events')) {
          // 模拟日历事件数据
          const mockCalendar = [
            {
              "eventID": 1,
              "title": "社区线上会议",
              "description": "每周社区线上会议，讨论项目进展",
              "start_time": "2023-06-10T10:00:00",
              "end_time": "2023-06-10T11:30:00",
              "location": "线上Zoom会议",
              "url": "https://example.com/meeting"
            },
            {
              "eventID": 2,
              "title": "项目更新公告",
              "description": "重要项目功能更新公告",
              "start_time": "2023-06-15T14:00:00",
              "end_time": "2023-06-15T15:00:00",
              "location": "项目Discord频道",
              "url": "https://example.com/announcement"
            }
          ]
          res.end(JSON.stringify({
            success: true,
            data: mockCalendar
          }))
          return
        }
        
        // 如果有对应的文件，返回文件内容
        if (filePath && existsSync(filePath)) {
          const data = readFileSync(filePath, 'utf8')
          // 包装成前端期望的格式
          const wrappedData = {
            success: true,
            data: JSON.parse(data)
          }
          res.end(JSON.stringify(wrappedData))
        } else {
          // 否则返回404或默认数据
          res.statusCode = 404
          res.end(JSON.stringify({"error": "Not found"}))
        }
      })
    }
  }
})