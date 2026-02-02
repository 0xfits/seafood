# 临时后端服务，用于提供基本的API响应
# 注意：这是一个临时解决方案，在有Python环境后应替换为完整的FastAPI后端

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import time

# 模拟数据库数据
mock_gifts = [
    {
        "gift_id": 1,
        "gift_name": "安全稳定的VPN（梯子）使用权",
        "gift_description": "安全稳定的VPN（梯子）使用权，价值￥50元/月",
        "gift_points": 500,
        "gift_image_url": "https://example.com/vpn.jpg",
        "stock": 50,
        "is_active": True
    },
    {
        "gift_id": 2,
        "gift_name": "英国通讯商 Giffgaff 电话卡",
        "gift_description": "英国通讯商 Giffgaff 电话卡一张（内含10+5充值券，充值需自理）",
        "gift_points": 800,
        "gift_image_url": "https://example.com/giffgaff.jpg",
        "stock": 30,
        "is_active": True
    },
    {
        "gift_id": 3,
        "gift_name": "ChatGPT 全版本使用权",
        "gift_description": "ChatGPT 全版本使用权，定期添加其它AI的付费版",
        "gift_points": 1200,
        "gift_image_url": "https://example.com/chatgpt.jpg",
        "stock": 20,
        "is_active": True
    },
    {
        "gift_id": 4,
        "gift_name": "TradingView 指标",
        "gift_description": "TradingView 高级指标使用权",
        "gift_points": 600,
        "gift_image_url": "https://example.com/tradingview.jpg",
        "stock": 40,
        "is_active": True
    },
    {
        "gift_id": 5,
        "gift_name": "Roogoo 虚拟 U 卡",
        "gift_description": "Roogoo 虚拟 U 卡一张，可用于多种在线支付场景",
        "gift_points": 700,
        "gift_image_url": "https://example.com/roogoo.jpg",
        "stock": 35,
        "is_active": True
    }
]

mock_tasks = [
    {
        "tID": 1,
        "title": "完成社区问卷调查",
        "note": "参与社区问卷调查，帮助我们改进服务",
        "refcode": "SURVEY2023",
        "linkA": "https://example.com/survey",
        "is_active": True
    },
    {
        "tID": 2,
        "title": "分享项目到社交媒体",
        "note": "将我们的项目分享到至少一个社交媒体平台",
        "refcode": "SOCIALSHARE",
        "linkA": "https://example.com/share",
        "is_active": True
    },
    {
        "tID": 3,
        "title": "撰写项目反馈",
        "note": "提供详细的项目使用体验和建议",
        "refcode": "FEEDBACK",
        "linkA": "https://example.com/feedback",
        "is_active": True
    }
]

mock_calendar = [
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

# HTTP请求处理器
class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    
    def _set_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_OPTIONS(self):
        self._set_headers(200)
    
    def do_GET(self):
        # 健康检查端点
        if self.path == '/api/health':
            self._set_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
            return
        
        # 礼品列表端点（兼容新旧命名）
        elif self.path == '/api/gifts/all' or self.path == '/api/gift/all':
            self._set_headers()
            self.wfile.write(json.dumps(mock_gifts).encode())
            return
        
        # 任务列表端点
        elif self.path == '/api/tasks/all' or self.path == '/api/task/all':
            self._set_headers()
            self.wfile.write(json.dumps(mock_tasks).encode())
            return
        
        # 日历事件端点
        elif self.path == '/api/calendar/events':
            self._set_headers()
            self.wfile.write(json.dumps(mock_calendar).encode())
            return
        
        # 根端点
        elif self.path == '/':
            self._set_headers()
            self.wfile.write(json.dumps({"message": "Welcome to Jinli Club API"}).encode())
            return
        
        # 未找到的端点
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
            return
    
    def do_POST(self):
        # 登录端点（模拟）
        if self.path == '/api/auth/login':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode()
            data = json.loads(post_data)
            
            # 简单模拟登录验证
            evm_address = data.get('evm_address')
            if evm_address:
                self._set_headers()
                # 生成基于地址的 uID（取地址后16位）
                uID = evm_address[-16:] if len(evm_address) >= 16 else evm_address
                self.wfile.write(json.dumps({
                    "success": True,
                    "uID": uID,
                    "EVM": evm_address,
                    "access_token": "mock-jwt-token-" + uID,
                    "token_type": "bearer"
                }).encode())
                return
            else:
                self._set_headers(401)
                self.wfile.write(json.dumps({"error": "Unauthorized"}).encode())
                return
        
        # 其他POST请求
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
            return

# 启动服务器
def run_server():
    server_address = ('0.0.0.0', 8000)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print(f"启动临时后端服务，监听在 http://{server_address[0]}:{server_address[1]}")
    print("注意：这是一个临时解决方案，在有Python环境后应替换为完整的FastAPI后端")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()