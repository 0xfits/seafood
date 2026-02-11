from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Journey(Base):
    __tablename__ = "journeys"
    
    jID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tID = Column(Integer, ForeignKey("tasks.tID"), nullable=False)
    uID = Column(Integer, ForeignKey("users.uID"), nullable=False)
    info_input = Column(Text, nullable=True)
    info_lang = Column(String(10), nullable=True)
    time_created = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    time_submitted = Column(DateTime(timezone=True), nullable=True)
    time_checked = Column(DateTime(timezone=True), nullable=True)
    time_claimed = Column(DateTime(timezone=True), nullable=True)
    points_claimed = Column(Integer, default=0, nullable=False)
    
    # 关系
    user = relationship("User", back_populates="journeys")
    task = relationship("Task", back_populates="journeys")
    
    def __repr__(self):
        return f"<Journey(jID={self.jID}, tID={self.tID}, uID={self.uID})>"
