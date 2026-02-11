from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Brand(Base):
    __tablename__ = "brands"
    
    bID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    url_image = Column(String(500), nullable=True)
    points = Column(Integer, default=10000, nullable=False)
    gift_limit = Column(Integer, default=0, nullable=False)
    time_start = Column(DateTime(timezone=True), nullable=True)
    time_end = Column(DateTime(timezone=True), nullable=True)
    time_created = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    time_updated = Column(DateTime(timezone=True), nullable=True)
    time_actived = Column(DateTime(timezone=True), nullable=True)
    
    # 多语言字段
    name_en = Column(String(255), nullable=True)
    name_hk = Column(String(255), nullable=True)
    name_vn = Column(String(255), nullable=True)
    description_en = Column(Text, nullable=True)
    description_hk = Column(Text, nullable=True)
    description_vn = Column(Text, nullable=True)
    
    def __repr__(self):
        return f"<Brand(bID={self.bID}, symbol={self.symbol})>"
