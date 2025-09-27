#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库初始化脚本（SQLite版本）
此脚本专为SQLite数据库优化，完全不需要编译任何组件
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
from datetime import datetime
from .models import Base, User, Task, Gift, TaskList, GiftList, CalendarEvent

# 加载环境变量
load_dotenv()

# 获取数据库URL - 使用SQLite
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "sqlite:///./jinli.db")

# 创建数据库引擎 - SQLite需要特殊配置
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite需要此参数
)

# 创建数据库会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 初始化数据库
def init_db():
    # 创建所有表
    print("创建SQLite数据库表...")
    Base.metadata.create_all(bind=engine)
    
    # 创建会话
    db = SessionLocal()
    
    try:
        # 检查是否已有测试数据
        user_count = db.query(User).count()
        
        if user_count == 0:
            print("插入测试数据...")
            
            # 创建测试用户
            test_user1 = User(
                EVM="0x1234567890123456789012345678901234567890",
                bio="This is a test user profile",
                is_admin=False
            )
            
            test_user2 = User(
                EVM="0xabcdef0123456789abcdef0123456789abcdef01",
                bio="This is another test user",
                is_admin=False
            )
            
            # 创建管理员用户（从环境变量获取管理员EVM地址）
            admin_evm_address = os.getenv("ADMIN_EVM_ADDRESSES", "").split(",")[0].strip()
            if admin_evm_address:
                admin_user = User(
                    EVM=admin_evm_address,
                    bio="System administrator",
                    is_admin=True
                )
                db.add(admin_user)
            else:
                # 如果没有配置管理员地址，创建默认管理员
                admin_user = User(
                    EVM="0x0000000000000000000000000000000000000001",
                    bio="Default system administrator",
                    is_admin=True
                )
                db.add(admin_user)
            
            # 创建测试任务
            task1 = Task(
                title="完成社区问卷调查",
                note="参与社区问卷调查，帮助我们改进服务",
                is_active=True
            )
            
            task2 = Task(
                title="分享项目到社交媒体",
                note="将我们的项目分享到至少一个社交媒体平台",
                is_active=True
            )
            
            task3 = Task(
                title="撰写项目反馈",
                note="提供详细的项目使用体验和建议",
                is_active=True
            )
            
            # 创建测试礼品
            gift1 = Gift(
                gift_name="安全稳定的VPN（梯子）使用权",
                gift_description="安全稳定的VPN（梯子）使用权，价值￥50元/月",
                gift_points=500,
                gift_image_url="https://example.com/vpn.jpg",
                stock=50,
                is_active=True
            )
            
            gift2 = Gift(
                gift_name="英国通讯商 Giffgaff 电话卡",
                gift_description="英国通讯商 Giffgaff 电话卡一张（内含10+5充值券，充值需自理）",
                gift_points=800,
                gift_image_url="https://example.com/giffgaff.jpg",
                stock=30,
                is_active=True
            )
            
            gift3 = Gift(
                gift_name="ChatGPT 全版本使用权",
                gift_description="ChatGPT 全版本使用权，定期添加其它AI的付费版",
                gift_points=1200,
                gift_image_url="https://example.com/chatgpt.jpg",
                stock=20,
                is_active=True
            )
            
            gift4 = Gift(
                gift_name="TradingView 指标",
                gift_description="TradingView 高级指标使用权",
                gift_points=600,
                gift_image_url="https://example.com/tradingview.jpg",
                stock=40,
                is_active=True
            )
            
            gift5 = Gift(
                gift_name="Roogoo 虚拟 U 卡",
                gift_description="Roogoo 虚拟 U 卡一张，可用于多种在线支付场景",
                gift_points=700,
                gift_image_url="https://example.com/roogoo.jpg",
                stock=35,
                is_active=True
            )
            
            # 创建日历事件
            event1 = CalendarEvent(
                title="社区线上会议",
                description="每周社区线上会议，讨论项目进展",
                start_time=datetime.strptime("2023-06-10T10:00:00", "%Y-%m-%dT%H:%M:%S"),
                end_time=datetime.strptime("2023-06-10T11:30:00", "%Y-%m-%dT%H:%M:%S"),
                location="线上Zoom会议"
            )
            
            event2 = CalendarEvent(
                title="项目更新公告",
                description="重要项目功能更新公告",
                start_time=datetime.strptime("2023-06-15T14:00:00", "%Y-%m-%dT%H:%M:%S"),
                end_time=datetime.strptime("2023-06-15T15:00:00", "%Y-%m-%dT%H:%M:%S"),
                location="项目Discord频道"
            )
            
            # 添加所有对象到会话
            db.add_all([
                test_user1, test_user2, admin_user,
                task1, task2, task3,
                gift1, gift2, gift3, gift4, gift5,
                event1, event2
            ])
            
            # 提交更改
            db.commit()
            
            print("SQLite数据库初始化完成，已插入测试数据。")
        else:
            print("数据库已包含数据，跳过初始化。")
            
    except Exception as e:
        print(f"数据库初始化过程中出错: {e}")
        db.rollback()
    finally:
        db.close()

# 主函数
if __name__ == "__main__":
    init_db()