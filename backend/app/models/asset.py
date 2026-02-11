from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Asset(Base):
    __tablename__ = "assets"
    
    aID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    uID = Column(Integer, ForeignKey("users.uID"), unique=True, nullable=False)
    points = Column(Integer, default=0, nullable=False)
    lucks = Column(Integer, default=0, nullable=False)
    time_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    user = relationship("User", back_populates="asset")
    
    def __repr__(self):
        return f"<Asset(aID={self.aID}, uID={self.uID}, points={self.points})>"
