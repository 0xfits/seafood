from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 品牌
class Brand(BaseModel):
    bID: int
    symbol: str
    name: str
    description: Optional[str] = None
    url_image: Optional[str] = None
    points: int = 10000
    gift_limit: int = 0
    time_start: Optional[datetime] = None
    time_end: Optional[datetime] = None
    time_created: datetime
    time_updated: Optional[datetime] = None
    time_actived: Optional[datetime] = None
    name_en: Optional[str] = None
    name_hk: Optional[str] = None
    name_vn: Optional[str] = None
    description_en: Optional[str] = None
    description_hk: Optional[str] = None
    description_vn: Optional[str] = None
    
    class Config:
        from_attributes = True

# 礼品
class Gift(BaseModel):
    gID: int
    bID: int
    uID: Optional[int] = None
    time_created: datetime
    time_claimed: Optional[datetime] = None
    time_actived: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 领取礼品请求
class GiftClaimRequest(BaseModel):
    gID: int

# 宝箱
class Chest(BaseModel):
    cID: int
    uID: Optional[int] = None
    tirer: int = 0
    vol_points: int = 0
    sID0: Optional[int] = None
    sID1: Optional[int] = None
    time_created: datetime
    time_claimed: Optional[datetime] = None
    time_bind: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 领取宝箱请求
class ChestClaimRequest(BaseModel):
    cID: int
