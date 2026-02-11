from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Gift(Base):
    __tablename__ = "gifts"
    
    gID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    bID = Column(Integer, ForeignKey("brands.bID"), nullable=False)
    uID = Column(Integer, ForeignKey("users.uID"), nullable=True)
    time_created = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    time_claimed = Column(DateTime(timezone=True), nullable=True)
    time_actived = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    user = relationship("User", back_populates="gifts")
    brand = relationship("Brand")
    
    def __repr__(self):
        return f"<Gift(gID={self.gID}, bID={self.bID})>"
