from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    uID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    EVM = Column(String(42), unique=True, index=True, nullable=False)
    bio = Column(Text, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    time_reg = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    time_login_last = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    journeys = relationship("Journey", back_populates="user", cascade="all, delete-orphan")
    asset = relationship("Asset", back_populates="user", uselist=False, cascade="all, delete-orphan")
    gifts = relationship("Gift", back_populates="user")
    chests = relationship("Chest", back_populates="user")
    
    def __repr__(self):
        return f"<User(uID={self.uID}, EVM={self.EVM})>"
