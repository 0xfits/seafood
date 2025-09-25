import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from models import Base, User, Task, Gift, TaskList, GiftList, CalendarEvent

# 加载环境变量
load_dotenv()

# 获取数据库URL
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL", "postgresql://user:password@localhost/jinli")

# 创建数据库引擎
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 创建数据库会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 初始化数据库
def init_db():
    # 创建所有表
    print("创建数据库表...")
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
                evm_address="0x1234567890123456789012345678901234567890",
                username="testuser1",
                bio="This is a test user profile"
            )
            
            test_user2 = User(
                evm_address="0xabcdef0123456789abcdef0123456789abcdef01",
                username="testuser2",
                bio="This is another test user"
            )
            
            # 创建管理员用户（从环境变量获取管理员EVM地址）
            admin_evm_address = os.getenv("ADMIN_EVM_ADDRESSES", "").split(",")[0].strip()
            if admin_evm_address:
                admin_user = User(
                    evm_address=admin_evm_address,
                    username="admin",
                    bio="System administrator"
                )
                db.add(admin_user)
            
            # 创建测试任务
            task1 = Task(
                task_name="完成社区问卷调查",
                task_description="参与社区问卷调查，帮助我们改进服务",
                task_type="survey",
                reward_points=100,
                max_participants=100
            )
            
            task2 = Task(
                task_name="分享项目到社交媒体",
                task_description="将我们的项目分享到至少一个社交媒体平台",
                task_type="social_share",
                reward_points=50,
                max_participants=500
            )
            
            task3 = Task(
                task_name="撰写项目反馈",
                task_description="提供详细的项目使用体验和建议",
                task_type="feedback",
                reward_points=200,
                max_participants=50
            )
            
            # 创建测试礼品
            gift1 = Gift(
                gift_name="项目周边T恤",
                gift_description="限量版项目周边T恤",
                gift_points=500,
                gift_image_url="https://example.com/tshirt.jpg",
                stock=20
            )
            
            gift2 = Gift(
                gift_name="数字藏品",
                gift_description="独特的项目数字藏品",
                gift_points=1000,
                gift_image_url="https://example.com/nft.jpg",
                stock=10
            )
            
            gift3 = Gift(
                gift_name="项目贴纸包",
                gift_description="项目主题贴纸包",
                gift_points=200,
                gift_image_url="https://example.com/stickers.jpg",
                stock=50
            )
            
            # 创建日历事件
            event1 = CalendarEvent(
                title="社区线上会议",
                description="每周社区线上会议，讨论项目进展",
                start_time="2023-06-10T10:00:00",
                end_time="2023-06-10T11:30:00",
                location="线上Zoom会议"
            )
            
            event2 = CalendarEvent(
                title="项目更新公告",
                description="重要项目功能更新公告",
                start_time="2023-06-15T14:00:00",
                end_time="2023-06-15T15:00:00",
                location="项目Discord频道"
            )
            
            # 添加所有对象到会话
            db.add_all([
                test_user1, test_user2,
                task1, task2, task3,
                gift1, gift2, gift3,
                event1, event2
            ])
            
            # 提交更改
            db.commit()
            
            print("数据库初始化完成，已插入测试数据。")
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