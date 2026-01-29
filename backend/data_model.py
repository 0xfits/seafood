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
    glIDs: Optional[str] = None
    gslIDs: Optional[str] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            index_id=row.get("index_id") or row.get("aID") or row.get("id") or 0,
            uID=row["uID"],
            time_update=_to_ts(row.get("time_update")),
            points=row.get("points") or 0,
            glIDs=row.get("glIDs"),
            gslIDs=row.get("gslIDs"),
        )

    def to_dict(self):
        return {
            "index_id": self.index_id,
            "uID": self.uID,
            "time_update": self.time_update,
            "points": self.points,
            "glIDs": self.glIDs,
            "gslIDs": self.gslIDs,
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
    gslID: int
    gID: int
    uID: int
    time_created: int = 0
    volume: int = 0

    @classmethod
    def from_row(cls, row):
        return cls(
            gslID=row.get("gslID") or row.get("sID"),
            gID=row["gID"],
            uID=row["uID"],
            time_created=_to_ts(row.get("time_created")),
            volume=row.get("volume") or 0,
        )

    def to_dict(self):
        return {
            "gslID": self.gslID,
            "gID": self.gID,
            "uID": self.uID,
            "time_created": self.time_created,
            "volume": self.volume,
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
            linkA=row.get("linkA"),
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
    time_created: int = 0
    tirer: Optional[str] = None
    vol_points: int = 0
    sID0: Optional[int] = None
    sID_B: Optional[int] = None
    time_claimed: int = 0
    uID: Optional[int] = None

    @classmethod
    def from_row(cls, row):
        return cls(
            cID=row["cID"],
            time_created=_to_ts(row.get("time_created")),
            tirer=row.get("tirer"),
            vol_points=row.get("vol_points") or 0,
            sID0=row.get("sID0"),
            sID_B=row.get("sID_B"),
            time_claimed=_to_ts(row.get("time_claimed")) if row.get("time_claimed") is not None else _to_ts(row.get("time_actived")),
            uID=row.get("uID"),
        )

    def to_dict(self):
        return {
            "cID": self.cID,
            "time_created": self.time_created,
            "tirer": self.tirer,
            "vol_points": self.vol_points,
            "sID0": self.sID0,
            "sID_B": self.sID_B,
            "time_claimed": self.time_claimed,
            "uID": self.uID,
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
