from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# 用户表
class User(Base):
    __tablename__ = "user"

    uID = Column(Integer, primary_key=True, index=True)
    EVM = Column(String(42), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    bio = Column(Text, nullable=True)

    # 关系
    task_lists = relationship("TaskList", back_populates="user")
    gift_lists = relationship("GiftList", back_populates="user")

# 任务表
class Task(Base):
    __tablename__ = "task"

    tID = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)
    refcode = Column(String(50), nullable=True)
    linkA = Column(String(255), nullable=True)
    linkB = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # 关系
    task_lists = relationship("TaskList", back_populates="task")

# 礼品表
class Gift(Base):
    __tablename__ = "gift"

    gift_id = Column(Integer, primary_key=True, index=True)
    gift_name = Column(String(255), nullable=False)
    gift_description = Column(Text, nullable=True)
    gift_points = Column(Integer, nullable=False)
    gift_image_url = Column(String(255), nullable=True)
    stock = Column(Integer, nullable=False)
    time_start = Column(DateTime, nullable=True)
    time_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # 关系
    gift_lists = relationship("GiftList", back_populates="gift")

# 任务清单表
class TaskList(Base):
    __tablename__ = "tasklist"

    tlistID = Column(Integer, primary_key=True, index=True)
    uID = Column(Integer, ForeignKey("user.uID"), nullable=False)
    tID = Column(Integer, ForeignKey("task.tID"), nullable=False)
    time_created = Column(DateTime, default=datetime.utcnow)
    time_actived = Column(DateTime, nullable=True)
    info_input = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending, submitted, verified, rejected, claimed

    # 关系
    user = relationship("User", back_populates="task_lists")
    task = relationship("Task", back_populates="task_lists")
    gift_list = relationship("GiftList", back_populates="task_list", uselist=False)

# 奖励清单表
class GiftList(Base):
    __tablename__ = "giftlist"

    glistID = Column(Integer, primary_key=True, index=True)
    uID = Column(Integer, ForeignKey("user.uID"), nullable=False)
    gift_id = Column(Integer, ForeignKey("gift.gift_id"), nullable=False)
    tlistID = Column(Integer, ForeignKey("tasklist.tlistID"), nullable=False)
    time_created = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="pending")  # pending, claimed, delivered

    # 关系
    user = relationship("User", back_populates="gift_lists")
    gift = relationship("Gift", back_populates="gift_lists")
    task_list = relationship("TaskList", back_populates="gift_list")

# 日历事件表
class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    eventID = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    location = Column(String(255), nullable=True)
    url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)