from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .main import Base

# 用户表
class User(Base):
    __tablename__ = "users"

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
    __tablename__ = "tasks"

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

# 奖励表
class Gift(Base):
    __tablename__ = "gifts"

    gID = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)
    time_start = Column(DateTime, nullable=False)
    time_end = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # 关系
    gift_lists = relationship("GiftList", back_populates="gift")

# 任务清单表
class TaskList(Base):
    __tablename__ = "task_lists"

    tlistID = Column(Integer, primary_key=True, index=True)
    uID = Column(Integer, ForeignKey("users.uID"), nullable=False)
    tID = Column(Integer, ForeignKey("tasks.tID"), nullable=False)
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
    __tablename__ = "gift_lists"

    glistID = Column(Integer, primary_key=True, index=True)
    uID = Column(Integer, ForeignKey("users.uID"), nullable=False)
    gID = Column(Integer, ForeignKey("gifts.gID"), nullable=False)
    tlistID = Column(Integer, ForeignKey("task_lists.tlistID"), nullable=False)
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