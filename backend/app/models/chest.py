from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Chest(Base):
    __tablename__ = "chests"
    
    cID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    uID = Column(Integer, ForeignKey("users.uID"), nullable=True)
    tirer = Column(Integer, default=0, nullable=False)
    vol_points = Column(Integer, default=0, nullable=False)
    sID0 = Column(Integer, ForeignKey("shards.sID"), nullable=True)
    sID1 = Column(Integer, ForeignKey("shards.sID"), nullable=True)
    time_created = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    time_claimed = Column(DateTime(timezone=True), nullable=True)
    time_bind = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    user = relationship("User", back_populates="chests")
    
    def __repr__(self):
        return f"<Chest(cID={self.cID}, uID={self.uID})>"
