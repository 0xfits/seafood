from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Task(Base):
    __tablename__ = "tasks"
    
    tID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), unique=True, nullable=False)
    note = Column(Text, nullable=True)
    refcode = Column(String(100), nullable=True)
    link0 = Column(String(500), nullable=True)
    linkB = Column(String(500), nullable=True)
    points = Column(Integer, default=0, nullable=False)
    type = Column(Integer, default=0, nullable=False)
    is_open = Column(Boolean, default=False, nullable=False)
    time_start = Column(DateTime(timezone=True), nullable=True)
    time_end = Column(DateTime(timezone=True), nullable=True)
    time_created = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    time_updated = Column(DateTime(timezone=True), nullable=True)
    
    # 多语言字段
    title_en = Column(String(255), nullable=True)
    title_hk = Column(String(255), nullable=True)
    title_vn = Column(String(255), nullable=True)
    note_en = Column(Text, nullable=True)
    note_hk = Column(Text, nullable=True)
    note_vn = Column(Text, nullable=True)
    
    # 关系
    journeys = relationship("Journey", back_populates="task")
    
    def __repr__(self):
        return f"<Task(tID={self.tID}, title={self.title})>"
