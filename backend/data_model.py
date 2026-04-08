#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据模型（dataclass 版）

说明：
- 该文件从原 model.py 迁移而来，仅包含用于 API 输出的数据类，不包含 ORM 映射；
- from_row 方法负责将 ORM 对象或原生查询结果映射为 dataclass；
- to_dict 方法统一输出字典，时间字段统一映射为 Unix 时间戳（秒）。
"""

from __future__ import annotations
from dataclasses import dataclass, field
from os import name
from typing import Optional, Type, Union
from abc import ABC, abstractmethod
from datetime import datetime


def _to_ts(v) -> int:
    """将各种时间格式转换为 Unix 时间戳（秒）。不合法或缺失则返回 0。"""
    if v is None:
        return 0
    try:
        if isinstance(v, (int, float)):
            # 假设已经是秒级时间戳
            return int(v)
        if isinstance(v, datetime):
            return int(v.timestamp())
        # 字符串：尝试按 ISO 格式解析
        return int(datetime.fromisoformat(str(v)).timestamp())
    except Exception:
        return 0


@dataclass(init=False)
class DataModel(ABC):
    # 不声明字段为 dataclass Field，避免影响子类 __init__ 的参数顺序
    def __init__(self, name: str = ""):
        self.name = name

    # 保留兼容的实例方法（但建议使用 of(name, row)）
    def build_from_row(self, row):
        cls = DataModel._resolve(self.name)
        return cls.from_row(row)

    @staticmethod
    def of(name: str, row: Optional[dict] = None) -> Union[Type["DataModel"], "DataModel"]:
        cls = DataModel._resolve(name)
        return cls.from_row(row) if row is not None else cls

    @staticmethod
    def _resolve(name: str) -> Type["DataModel"]:
        # 支持大小写灵活的名称解析
        nm = str(name).strip()
        mapping = {
            "Asset": Asset,
            "User": User,
            "Brand": Brand,
            "Gift": Gift,
            "Task": Task,
            "Journey": Journey,
            "Chest": Chest,
            "Shard": Shard,
            "ShardTransfer": ShardTransfer,
            "ShardOrder": ShardOrder,
            "ShardTrade": ShardTrade,
        }
        # 直接查找精确大小写
        cls = mapping.get(nm)
        if not cls:
            # 回退：按小写名称匹配
            lower_map = {k.lower(): v for k, v in mapping.items()}
            cls = lower_map.get(nm.lower())
        if not cls:
            msg = f"[DataModel.of] 未知的数据模型名称: '{nm}'"
            print(msg)
            raise ValueError(msg)
        return cls

    @classmethod
    @abstractmethod
    def from_row(cls, row):
        raise NotImplementedError("from_row 必须由子类实现")

    @abstractmethod
    def to_dict(self) -> dict:
        raise NotImplementedError("to_dict 必须由子类实现")

@dataclass
class Asset(DataModel):
    index_id: int
    uID: int
    time_update: int = 0
    points: int = 0
    lucks: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            index_id=row.get("index_id") or row.get("aID") or row.get("id") or 0,
            uID=row["uID"],
            time_update=_to_ts(row.get("time_updated") or row.get("time_update")),
            points=row.get("points") or 0,
            lucks=row.get("lucks") or 0,
        )

    def to_dict(self):
        return {
            "index_id": self.index_id,
            "uID": self.uID,
            "time_update": self.time_update,
            "points": self.points,
            "lucks": self.lucks,
        }


@dataclass
class Brand(DataModel):
    bID: int
    symbol: str
    points: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    time_start: int = 0
    time_end: int = 0
    created_at: int = 0
    updated_at: int = 0
    is_open: bool = True
    gift_limit: int = 0

    @classmethod
    def from_row(cls, row):
        # 兼容历史字段命名：url_image -> image_url；time_created/updated -> created_at/updated_at
        created = row.get("created_at") if row.get("created_at") is not None else row.get("time_created")
        updated = row.get("updated_at") if row.get("updated_at") is not None else row.get("time_updated")
        img = row.get("image_url") if row.get("image_url") is not None else row.get("url_image")
        # is_open 缺省时默认 True，避免因缺少字段被前端过滤掉
        is_open_val = row.get("is_open")
        return cls(
            bID=row["bID"],
            symbol=row.get("symbol") or "",
            points=row.get("points") or 0,
            name=row.get("name") or "",
            description=row.get("description"),
            image_url=img,
            time_start=_to_ts(row.get("time_start")),
            time_end=_to_ts(row.get("time_end")),
            created_at=_to_ts(created),
            updated_at=_to_ts(updated),
            is_open=bool(is_open_val) if is_open_val is not None else True,
            gift_limit=int(row.get("gift_limit") or 0),
        )

    def to_dict(self):
        return {
            "bID": self.bID,
            "symbol": self.symbol,
            "points": self.points,
            "name": self.name,
            "description": self.description,
            "image_url": self.image_url,
            "time_start": self.time_start,
            "time_end": self.time_end,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "is_open": self.is_open,
            "gift_limit": self.gift_limit,
        }


@dataclass
class Gift(DataModel):
    gID: int
    bID: int
    uID: Optional[int] = None
    time_created: int = 0
    time_claimed: int = 0
    time_actived: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            gID=row["gID"],
            bID=row["bID"],
            uID=row.get("uID"),
            time_created=_to_ts(row.get("time_created")),
            time_claimed=_to_ts(row.get("time_claimed")),
            time_actived=_to_ts(row.get("time_actived")),
        )

    def to_dict(self):
        return {
            "gID": self.gID,
            "bID": self.bID,
            "uID": self.uID,
            "time_created": self.time_created,
            "time_claimed": self.time_claimed,
            "time_actived": self.time_actived,
        }


@dataclass
class Shard(DataModel):
    sID: int
    uID: int
    bID: int
    volume: int = 0
    time_created: int = 0
    time_updated: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            sID=row.get("sID") or row.get("gslID") or 0,
            uID=row["uID"],
            bID=row["bID"],
            volume=row.get("volume") or 0,
            time_created=_to_ts(row.get("time_created")),
            time_updated=_to_ts(row.get("time_updated")),
        )

    def to_dict(self):
        return {
            "sID": self.sID,
            "uID": self.uID,
            "bID": self.bID,
            "volume": self.volume,
            "time_created": self.time_created,
            "time_updated": self.time_updated,
        }


@dataclass
class Task(DataModel):
    tID: int
    title: str
    note: Optional[str] = None
    refcode: Optional[str] = None
    linkA: Optional[str] = None
    linkB: Optional[str] = None
    points: int = 0
    type: int = 0
    time_start: int = 0
    time_end: int = 0
    created_at: int = 0
    updated_at: int = 0
    is_open: bool = True

    @classmethod
    def from_row(cls, row):
        return cls(
            tID=row["tID"],
            title=row.get("title") or "",
            note=row.get("note"),
            refcode=row.get("refcode"),
            linkA=row.get("linkA") if row.get("linkA") is not None else row.get("link0"),
            linkB=row.get("linkB"),
            points=row.get("points") or 0,
            type=int(row.get("type") or 0),
            time_start=_to_ts(row.get("time_start")),
            time_end=_to_ts(row.get("time_end")),
            created_at=_to_ts(row.get("created_at")),
            updated_at=_to_ts(row.get("updated_at")),
            is_open=bool(row.get("is_open") or 0),
        )

    def to_dict(self):
        return {
            "tID": self.tID,
            "title": self.title,
            "note": self.note,
            "refcode": self.refcode,
            "linkA": self.linkA,
            "link0": self.linkA,
            "linkB": self.linkB,
            "points": self.points,
            "type": self.type,
            "time_start": self.time_start,
            "time_end": self.time_end,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "is_open": self.is_open,
        }


@dataclass
class Journey(DataModel):
    jID: int
    tID: int
    uID: int
    info_input: Optional[str] = None
    time_created: int = 0
    time_submitted: int = 0
    time_checked: int = 0
    time_claimed: int = 0
    points_claimed: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            jID=row["jID"],
            tID=row["tID"],
            uID=row["uID"],
            info_input=row.get("info_input"),
            time_created=_to_ts(row.get("time_created")),
            time_submitted=_to_ts(row.get("time_submitted")),
            time_checked=_to_ts(row.get("time_checked")),
            time_claimed=_to_ts(row.get("time_claimed")),
            points_claimed=row.get("points_claimed") or 0,
        )

    def to_dict(self):
        return {
            "jID": self.jID,
            "tID": self.tID,
            "uID": self.uID,
            "info_input": self.info_input,
            "time_created": self.time_created,
            "time_submitted": self.time_submitted,
            "time_checked": self.time_checked,
            "time_claimed": self.time_claimed,
            "points_claimed": self.points_claimed,
        }


@dataclass
class Chest(DataModel):
    cID: int
    tirer: int = 0
    vol_points: int = 0
    sID0: Optional[int] = None
    sID1: Optional[int] = None
    time_created: int = 0
    time_bind: int = 0
    time_claimed: int = 0
    uID: Optional[int] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            cID=row["cID"],
            tirer=int(row.get("tirer") or 0),
            vol_points=row.get("vol_points") or 0,
            sID0=row.get("sID0"),
            sID1=row.get("sID1"),
            time_created=_to_ts(row.get("time_created")),
            time_bind=_to_ts(row.get("time_bind")),
            time_claimed=_to_ts(row.get("time_claimed")),
            uID=row.get("uID"),
        )

    def to_dict(self):
        return {
            "cID": self.cID,
            "tirer": self.tirer,
            "vol_points": self.vol_points,
            "sID0": self.sID0,
            "sID1": self.sID1,
            "time_created": self.time_created,
            "time_bind": self.time_bind,
            "time_claimed": self.time_claimed,
            "uID": self.uID,
        }


@dataclass
class ShardTransfer(DataModel):
    txID: int
    bID: int
    from_uID: Optional[int]
    to_uID: Optional[int]
    volume: int
    reason: str = "chest"
    time_created: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            txID=row["txID"],
            bID=row["bID"],
            from_uID=row.get("from_uID"),
            to_uID=row.get("to_uID"),
            volume=row.get("volume") or 0,
            reason=row.get("reason") or "chest",
            time_created=_to_ts(row.get("time_created")),
        )

    def to_dict(self):
        return {
            "txID": self.txID,
            "bID": self.bID,
            "from_uID": self.from_uID,
            "to_uID": self.to_uID,
            "volume": self.volume,
            "reason": self.reason,
            "time_created": self.time_created,
        }


@dataclass
class ShardOrder(DataModel):
    oID: int
    uID: int
    bID: int
    side: str
    price: int
    volume_total: int
    volume_filled: int = 0
    volume_frozen: int = 0
    status: str = "open"
    time_created: int = 0
    time_updated: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            oID=row["oID"],
            uID=row["uID"],
            bID=row["bID"],
            side=row["side"],
            price=row["price"],
            volume_total=row["volume_total"],
            volume_filled=row.get("volume_filled") or 0,
            volume_frozen=row.get("volume_frozen") or 0,
            status=row.get("status") or "open",
            time_created=_to_ts(row.get("time_created")),
            time_updated=_to_ts(row.get("time_updated")),
        )

    def to_dict(self):
        return {
            "oID": self.oID,
            "uID": self.uID,
            "bID": self.bID,
            "side": self.side,
            "price": self.price,
            "volume_total": self.volume_total,
            "volume_filled": self.volume_filled,
            "volume_frozen": self.volume_frozen,
            "status": self.status,
            "time_created": self.time_created,
            "time_updated": self.time_updated,
        }


@dataclass
class ShardTrade(DataModel):
    trID: int
    bID: int
    buy_oID: int
    sell_oID: int
    buyer_uID: int
    seller_uID: int
    price: int
    volume: int
    time_created: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            trID=row["trID"],
            bID=row["bID"],
            buy_oID=row["buy_oID"],
            sell_oID=row["sell_oID"],
            buyer_uID=row["buyer_uID"],
            seller_uID=row["seller_uID"],
            price=row["price"],
            volume=row["volume"],
            time_created=_to_ts(row.get("time_created")),
        )

    def to_dict(self):
        return {
            "trID": self.trID,
            "bID": self.bID,
            "buy_oID": self.buy_oID,
            "sell_oID": self.sell_oID,
            "buyer_uID": self.buyer_uID,
            "seller_uID": self.seller_uID,
            "price": self.price,
            "volume": self.volume,
            "time_created": self.time_created,
        }


@dataclass
class User(DataModel):
    uID: int
    EVM: Optional[str] = None
    time_reg: int = 0
    time_login_last: int = 0
    is_admin: bool = False
    bio: Optional[str] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            uID=row["uID"],
            EVM=row.get("EVM"),
            time_reg=_to_ts(row.get("time_reg")),
            time_login_last=_to_ts(row.get("time_login_last")),
            is_admin=bool(row.get("is_admin") or 0),
            bio=row.get("bio"),
        )

    def to_dict(self):
        return {
            "uID": self.uID,
            "EVM": self.EVM,
            "time_reg": self.time_reg,
            "time_login_last": self.time_login_last,
            "is_admin": self.is_admin,
            "bio": self.bio,
        }
