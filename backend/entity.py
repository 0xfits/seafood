#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据访问层（Entity）

说明：
- 提供基础 Entity 类与针对具体模型的子类（UserEntity、GiftEntity、TaskEntity 等）。
- 统一封装常见的数据读写、提交与回滚逻辑，便于在路由、服务层复用。
- 适配当前项目的新数据库规范（gID/tlID/glID 等）。

使用示例：
    from backend.entity import UserEntity, GiftEntity

    # 使用上下文自动管理会话
    with UserEntity() as users:
        u = users.get_by_evm("0x123...")
        if not u:
            u = users.create(evm="0x123...", bio="new user")

    with GiftEntity() as gifts:
        all_gifts = gifts.list()

"""

from __future__ import annotations

from typing import Optional, List
from datetime import datetime
 
from .foundation import Base, Foundation, UserAsset
from .data_model import Brand, Chest, Gift, Journey, Task, User, Asset
from sqlalchemy.orm import Session
from .foundation import Foundation, SessionLocal
text = Foundation.text
import asyncio
# 说明：为降低耦合，entity 层尽量返回数据库行映射（dict-like），
# 不在此处构造领域模型（dataclass）。领域模型转换放到 data 层统一处理。

class Entity:
    """基础数据访问类：统一管理会话与提交逻辑"""
    name: str = ""


    def __init__(self, db: Optional[object] = None) -> None:
        self._external = db is not None
        self.db = db or SessionLocal()

    # 允许 with 语法
    def __enter__(self) -> "Entity":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc:
                self.db.rollback()
        finally:
            if not self._external:
                self.db.close()

    # 提交并刷新对象
    def _commit_refresh(self, obj):
        self.db.commit()
        try:
            self.db.refresh(obj)
        except Exception:
            # 对于部分原生 SQL 插入的场景，refresh 可能不适用
            pass
        return obj


    def list(self, skip: int = 0, limit: int = 100, filters: Optional[dict] = None):
        # 根据表名动态选择排序字段，避免通用实现因固定 uID 导致查询异常
        tab = (self.name or "").strip()
        order_map = {
            "user": "uID",
            "brand": "bID",
            "gift": "gID",
            "task": "tID",
            "journey": "jID",
            "chest": "cID",
            "shard": "gslID",
        }
        order_col = order_map.get(tab.lower(), "rowid")  # SQLite 兼容回退
        where_clauses = []
        # limit<=0 视为不限制（SQLite 使用 LIMIT -1）
        try:
            limit_val = int(limit)
        except Exception:
            limit_val = 100
        if limit_val <= 0:
            limit_val = -1
        params = {"limit": limit_val, "offset": skip}
        if filters:
            for k, v in filters.items():
                # 简单列名白名单：仅允许字母数字与下划线
                col = "".join(ch for ch in str(k) if ch.isalnum() or ch == "_")
                if col:
                    if v is None:
                        where_clauses.append(f"{col} IS NULL")
                    else:
                        where_clauses.append(f"{col} = :{col}")
                        params[col] = v
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        sql = text(
            f"""
            SELECT * FROM {tab}
            {where_sql}
            ORDER BY {order_col}
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, params)
        return rows


class UserEntity(Entity):
    """用户相关数据访问（使用原生 SQL，返回字典映射）"""

    def get_by_id(self, uID: int):
        sql = text(
            """
            SELECT uID, EVM, bio, is_admin, time_reg, time_login_last
            FROM user WHERE uID = :uID
            """
        )
        row = Foundation.fetch_one(self.db, sql, {"uID": uID})
        return row

    def get_by_evm(self, evm: str):
        sql = text(
            """
            SELECT uID, EVM, bio, is_admin, time_reg, time_login_last
            FROM user WHERE lower(EVM) = lower(:evm)
            LIMIT 1
            """
        )
        row = Foundation.fetch_one(self.db, sql, {"evm": evm})
        return row

    def list(self, skip: int = 0, limit: int = 100):
        sql = text(
            """
            SELECT uID, EVM, bio, is_admin, time_reg, time_login_last
            FROM user
            ORDER BY uID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"limit": limit, "offset": skip})
        return rows

    def create(self, evm: str, bio: Optional[str] = None, is_admin: bool = False):
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        ins = text(
            """
            INSERT INTO user (EVM, bio, is_admin, time_reg, time_login_last)
            VALUES (:evm, :bio, :is_admin, :time_reg, :time_login_last)
            """
        )
        Foundation.exec(self.db, ins, {
            "evm": evm,
            "bio": bio or "",
            "is_admin": bool(is_admin),
            "time_reg": now_str,
            "time_login_last": now_str,
        })
        self.db.commit()
        sel = text(
            """
            SELECT uID, EVM, bio, is_admin, time_reg, time_login_last
            FROM user WHERE uID = last_insert_rowid()
            """
        )
        row = Foundation.fetch_one(self.db, sel)
        return row

    def update_login_time(self, uID: int):
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        upd = text("UPDATE user SET time_login_last = :ts WHERE uID = :uID")
        Foundation.exec(self.db, upd, {"ts": now_str, "uID": uID})
        self.db.commit()
        return self.get_by_id(uID)

    # 资产相关
    def get_asset(self, uID: int) -> Optional[UserAsset]:
        return self.db.query(UserAsset).filter(UserAsset.uID == uID).first()

    def upsert_asset(self, uID: int, points_delta: int = 0) -> UserAsset:
        asset = self.get_asset(uID)
        if not asset:
            asset = UserAsset(uID=uID, points=0, time_update=datetime.utcnow())
            self.db.add(asset)
        asset.points = (asset.points or 0) + points_delta
        asset.time_update = datetime.utcnow()
        return self._commit_refresh(asset)

    def update_user(self, uID: int, *, bio: Optional[str] = None, is_admin: Optional[bool] = None):
        # 动态更新提供的字段
        set_parts = []
        params = {"uID": uID}

        def add_field(key: str, value):
            if value is None:
                return
            set_parts.append(f"{key} = :{key}")
            params[key] = value

        add_field("bio", bio)
        if is_admin is not None:
            add_field("is_admin", bool(is_admin))

        # 若无字段需要更新，直接返回当前记录
        if not set_parts:
            return self.get_by_id(uID)

        upd_sql = text(f"UPDATE user SET {', '.join(set_parts)} WHERE uID = :uID")
        Foundation.exec(self.db, upd_sql, params)
        self.db.commit()
        return self.get_by_id(uID)

    def get_or_create_pool_user(self) -> int:
        POOL_EVM = "0x0000000000000000000000000000000000000000"
        sel = text("SELECT uID FROM user WHERE EVM = :evm")
        row = Foundation.fetch_one(self.db, sel, {"evm": POOL_EVM})
        if row and row.get("uID"):
            return int(row["uID"])
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        ins = text(
            """
            INSERT INTO user (EVM, time_reg, time_login_last, is_admin, bio)
            VALUES (:evm, :reg, :login, 1, 'System pool user for unassigned gifts')
            """
        )
        Foundation.exec(self.db, ins, {"evm": POOL_EVM, "reg": now, "login": now})
        self.db.commit()
        row2 = Foundation.fetch_one(self.db, sel, {"evm": POOL_EVM})
        return int(row2["uID"]) if row2 and row2.get("uID") else 0

    def find_or_create_by_evm(self, evm_norm: str):
        admins = {a.strip().lower() for a in (Foundation.get_env("ADMIN_EVM_ADDRESSES") or "").split(",") if a.strip()}
        row = self.get_by_evm(evm_norm)
        if not row:
            try:
                row = self.create(evm=evm_norm, bio="", is_admin=(evm_norm in admins))
            except Exception:
                # 回滚后返回 None 表示失败
                self.db.rollback()
                return None
        # 更新最后登录时间
        try:
            self.update_login_time(int(row["uID"]))
        except Exception:
            self.db.rollback()
        # 若需要提升为管理员
        try:
            if evm_norm in admins and not bool(row.get("is_admin")):
                self.update_user(int(row["uID"]), is_admin=True)
                row = self.get_by_evm(evm_norm)
        except Exception:
            self.db.rollback()
        return row

    def find_by_evm(self, evm_norm: str):
        return self.get_by_evm(evm_norm)

    def find_by_email(self, email: str):
        # 注意：当前用户表可能没有email字段，这里先返回None
        # 如果需要支持邮箱，需要修改数据库结构
        return None

    def create_with_email_and_evm(self, email: str, evm_norm: str):
        # 检查是否需要添加email字段到用户表
        # 暂时只使用EVM地址创建用户
        admins = {a.strip().lower() for a in (Foundation.get_env("ADMIN_EVM_ADDRESSES") or "").split(",") if a.strip()}
        try:
            row = self.create(evm=evm_norm, bio="", is_admin=(evm_norm in admins))
            return row
        except Exception:
            self.db.rollback()
            return None

class SymbolEntity(Entity):
    def list(self):
        sql = text("SELECT symbol_id, gID, symbol, points FROM symbol ORDER BY symbol_id")
        return Foundation.fetch_all(self.db, sql)

    def get(self, sid: int):
        sql = text("SELECT symbol_id, gID, symbol, points FROM symbol WHERE symbol_id = :sid")
        return Foundation.fetch_one(self.db, sql, {"sid": sid})


class BrandEntity(Entity):
    """品牌（brand）数据访问：使用原生 SQL 并返回 dataclass"""

    _schema_checked: bool = False

    def _ensure_schema(self):
        """确保 brand 表包含 gift_limit 列（SQLite 动态校验）。"""
        if BrandEntity._schema_checked:
            return
        try:
            info_sql = text("PRAGMA table_info(brand)")
            cols = Foundation.fetch_all(self.db, info_sql)
            names = {c.get("name") for c in cols}
            if "gift_limit" not in names:
                alter_sql = text("ALTER TABLE brand ADD COLUMN gift_limit INTEGER DEFAULT 0")
                Foundation.exec(self.db, alter_sql)
                self.db.commit()
        except Exception:
            # 忽略模式检查错误，以避免影响正常读写
            pass
        finally:
            BrandEntity._schema_checked = True

    def list(self, skip: int = 0, limit: int = 100) -> List[Brand]:
        self._ensure_schema()
        sql = text(
            """
            SELECT bID, symbol, name, description, url_image,
                   time_start, time_end, time_created, time_updated, time_actived,
                   points, gift_limit
            FROM brand
            ORDER BY bID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"limit": limit, "offset": skip})
        return rows

    def get(self, bID: int):
        self._ensure_schema()
        sql = text(
            """
            SELECT bID, symbol, name, description, url_image,
                   time_start, time_end, time_created, time_updated, time_actived,
                   points, gift_limit
            FROM brand WHERE bID = :bID
            """
        )
        row = Foundation.fetch_one(self.db, sql, {"bID": bID})
        return row


class GiftEntity(Entity):
    """礼品记录（gift）数据访问：使用原生 SQL 并返回 dataclass"""
    _schema_checked: bool = False

    def _ensure_schema(self):
        """确保 gift 表包含 time_claimed 列（SQLite 动态校验）。"""
        if GiftEntity._schema_checked:
            return
        try:
            info_sql = text("PRAGMA table_info(gift)")
            cols = Foundation.fetch_all(self.db, info_sql)
            names = {c.get("name") for c in cols}
            if "time_claimed" not in names:
                alter_sql = text("ALTER TABLE gift ADD COLUMN time_claimed DATETIME")
                Foundation.exec(self.db, alter_sql)
                self.db.commit()
        except Exception:
            # 忽略模式检查错误，以避免影响正常读写
            pass
        finally:
            GiftEntity._schema_checked = True

    def list(self, skip: int = 0, limit: int = 100) -> List[Gift]:
        self._ensure_schema()
        sql = text(
            """
            SELECT gID, bID, uID, time_created, time_claimed, time_actived
            FROM gift
            ORDER BY gID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"limit": limit, "offset": skip})
        return rows

    def get(self, gID: int):
        self._ensure_schema()
        sql = text(
            """
            SELECT gID, bID, uID, time_created, time_claimed, time_actived
            FROM gift WHERE gID = :gID
            """
        )
        row = Foundation.fetch_one(self.db, sql, {"gID": gID})
        return row

    def create(self, bID: int, uID: Optional[int] = None, time_claimed: Optional[datetime] = None, time_actived: Optional[datetime] = None):
        self._ensure_schema()
        now = datetime.utcnow()
        sql = text(
            """
            INSERT INTO gift (bID, uID, time_created, time_claimed, time_actived)
            VALUES (:bID, :uID, :time_created, :time_claimed, :time_actived)
            RETURNING gID, bID, uID, time_created, time_claimed, time_actived
            """
        )
        row = Foundation.fetch_one(self.db, sql, {
            "bID": bID,
            "uID": uID if uID is not None else 0,
            "time_created": now,
            "time_claimed": time_claimed,
            "time_actived": time_actived,
        })
        self.db.commit()
        return row

    def update(self, gID: int, *, uID: Optional[int] = None, time_claimed: Optional[datetime] = None, time_actived: Optional[datetime] = None):
        self._ensure_schema()
        # 构造动态 UPDATE
        sets = []
        params = {"gID": gID}
        if uID is not None:
            sets.append("uID = :uID")
            params["uID"] = uID
        if time_claimed is not None:
            sets.append("time_claimed = :time_claimed")
            params["time_claimed"] = time_claimed
        if time_actived is not None:
            sets.append("time_actived = :time_actived")
            params["time_actived"] = time_actived
        if not sets:
            # 无更新字段则直接返回当前记录
            return self.get(gID)
        sql = text(f"UPDATE gift SET {', '.join(sets)} WHERE gID = :gID RETURNING gID, bID, uID, time_created, time_claimed, time_actived")
        row = Foundation.fetch_one(self.db, sql, params)
        self.db.commit()
        return row

    def delete(self, gID: int) -> bool:
        sql = text("DELETE FROM gift WHERE gID = :gID")
        res = Foundation.exec(self.db, sql, {"gID": gID})
        self.db.commit()
        return res.rowcount > 0

    def count_stores_by_brand(self, bID: int) -> int:
        # 库存：未分配（uID IS NULL 或 uID=0）
        sql = text("SELECT COUNT(1) AS cnt FROM gift WHERE bID = :bID AND (uID IS NULL OR uID = 0)")
        row = Foundation.fetch_one(self.db, sql, {"bID": bID})
        return int(row["cnt"]) if row and row.get("cnt") is not None else 0

    def count_claims_by_brand(self, bID: int) -> int:
        # 已领取：uID 非空且非 0
        sql = text("SELECT COUNT(1) AS cnt FROM gift WHERE bID = :bID AND (uID IS NOT NULL AND uID <> 0)")
        row = Foundation.fetch_one(self.db, sql, {"bID": bID})
        return int(row["cnt"]) if row and row.get("cnt") is not None else 0


class TaskEntity(Entity):
    """任务类型（task）数据访问：原生 SQL，返回 dataclass Task"""

    _schema_checked: bool = False

    def _ensure_schema(self):
        if TaskEntity._schema_checked:
            return
        try:
            info_sql = text("PRAGMA table_info(task)")
            cols = Foundation.fetch_all(self.db, info_sql)
            names = {c.get("name") for c in cols}
            if "type" not in names:
                alter_sql = text("ALTER TABLE task ADD COLUMN type INTEGER NOT NULL DEFAULT 0")
                Foundation.exec(self.db, alter_sql)
                self.db.commit()
                try:
                    Foundation.exec(self.db, text("UPDATE task SET type = 0 WHERE type IS NULL"))
                    self.db.commit()
                except Exception:
                    self.db.rollback()
        except Exception:
            pass
        finally:
            TaskEntity._schema_checked = True

    def list(self, skip: int = 0, limit: int = 100) -> List[Task]:
        self._ensure_schema()
        sql = text(
            """
            SELECT tID, title, note, refcode, link0, linkB,
                   points, type,
                   time_start, time_end, time_created, time_updated, is_open
            FROM task
            ORDER BY tID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"limit": limit, "offset": skip})
        return rows

    def get(self, tID: int):
        self._ensure_schema()
        sql = text(
            """
            SELECT tID, title, note, refcode, link0, linkB,
                   points, type,
                   time_start, time_end, time_created, time_updated, is_open
            FROM task WHERE tID = :tID
            """
        )
        row = Foundation.fetch_one(self.db, sql, {"tID": tID})
        return row

    def count_participants(self, tID: int) -> int:
        """统计参与人数（基于 task_list 表）。"""
        # 新结构中参与记录表为 journey
        sql = text("SELECT COUNT(1) AS cnt FROM journey WHERE tID = :tID")
        row = Foundation.fetch_one(self.db, sql, {"tID": tID})
        return int(row["cnt"]) if row and row.get("cnt") is not None else 0


class JourneyEntity(Entity):
    """与探索进度相关数据访问"""

    _schema_checked: bool = False

    def _ensure_schema(self):
        if JourneyEntity._schema_checked:
            return
        try:
            info_sql = text("PRAGMA table_info(journey)")
            cols = Foundation.fetch_all(self.db, info_sql)
            names = {c.get("name") for c in cols}
            if "time_submitted" not in names:
                alter_sql = text("ALTER TABLE journey ADD COLUMN time_submitted DATETIME")
                Foundation.exec(self.db, alter_sql)
                self.db.commit()
        except Exception:
            pass
        finally:
            JourneyEntity._schema_checked = True

    def list_journeys(self, skip: int = 0, limit: int = 100) -> List[Journey]:
        # 使用原生 SQL，避免 SQLAlchemy 对 DateTime 列的自动解析，兼容历史非标准数据
        sql = text(
            """
            SELECT ttID AS tID, title, note, refcode, linkA, linkB,
                   time_start, time_end, created_at, updated_at, is_open
            FROM task_type
            ORDER BY tID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = self.db.execute(sql, {"limit": limit, "offset": skip}).mappings().all()
        return rows  # 返回字典映射列表

    def get_task(self, tID: int) -> Optional[Task]:
        sql = text(
            """
            SELECT ttID AS tID, title, note, refcode, linkA, linkB,
                   time_start, time_end, created_at, updated_at, is_open
            FROM task_type WHERE ttID = :tID
            """
        )
        row = self.db.execute(sql, {"tID": tID}).mappings().first()
        return row

    def create_task(
        self,
        title: str,
        note: Optional[str] = None,
        refcode: Optional[str] = None,
        linkA: Optional[str] = None,
        linkB: Optional[str] = None,
        is_open: bool = True,
        time_start: Optional[datetime] = None,
        time_end: Optional[datetime] = None,
    ) -> Task:
        now = datetime.utcnow()
        task = Task(
            title=title,
            note=note,
            refcode=refcode,
            linkA=linkA,
            linkB=linkB,
            is_open=is_open,
            time_start=time_start,
            time_end=time_end,
            created_at=now,
            updated_at=now,
        )
        self.db.add(task)
        return self._commit_refresh(task)

    def update_task(
        self,
        tID: int,
        *,
        title: Optional[str] = None,
        note: Optional[str] = None,
        refcode: Optional[str] = None,
        linkA: Optional[str] = None,
        linkB: Optional[str] = None,
        is_open: Optional[bool] = None,
        time_start: Optional[datetime] = None,
        time_end: Optional[datetime] = None,
    ) -> Optional[Task]:
        # 为了兼容历史上以整数/非标准字符串存储的时间字段，这里改用原生 SQL 更新，避免 ORM 在读取时对
        # DateTime 字段应用字符串处理器（processors.str_to_datetime），从而触发 fromisoformat 的 TypeError。

        # 先检查记录是否存在（使用原生 SQL 映射，避免 ORM 解析）
        exists_sql = text("SELECT ttID FROM task_type WHERE ttID = :tID")
        row = Foundation.fetch_one(self.db, exists_sql, {"tID": tID})
        if not row:
            return None

        # 动态构建 SET 子句，仅更新提供的字段
        set_parts = []
        params = {"tID": tID}

        def add_field(key: str, value):
            if value is None:
                return
            set_parts.append(f"{key} = :{key}")
            # 对时间字段做标准化：若为 datetime 则转为标准字符串，其他类型交给 SQLite 原样存储
            if key in ("time_start", "time_end"):
                if isinstance(value, datetime):
                    params[key] = value.strftime("%Y-%m-%d %H:%M:%S")
                else:
                    params[key] = value
            else:
                params[key] = value

        add_field("title", title)
        add_field("note", note)
        add_field("refcode", refcode)
        add_field("linkA", linkA)
        add_field("linkB", linkB)
        if is_open is not None:
            add_field("is_open", bool(is_open))
        add_field("time_start", time_start)
        add_field("time_end", time_end)

        # 始终更新 updated_at
        params["updated_at"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        set_parts.append("updated_at = :updated_at")

        if set_parts:
            upd_sql = text(f"UPDATE task_type SET {', '.join(set_parts)} WHERE ttID = :tID")
            Foundation.exec(self.db, upd_sql, params)
            self.db.commit()

        # 返回最新记录（使用原生 SQL 映射以避免 ORM 解析器）
        return self.get_task(tID)

    # ===== 新增：基于 journey 表的进度访问 =====
    def list_by_user(self, uID: int, skip: int = 0, limit: int = 100):
        """列出某用户的所有探索进度（journey 表），按 jID 排序。
        返回字典映射列表，时间字段保持数据库原值（由 model 层统一转换）。
        """
        self._ensure_schema()
        sql = text(
            """
            SELECT jID, tID, uID, info_input,
                   time_created, time_submitted, time_checked, time_claimed, points_claimed
            FROM journey
            WHERE uID = :uID
            ORDER BY jID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"uID": uID, "limit": limit, "offset": skip})
        return rows

    def list_by_task(self, tID: int, skip: int = 0, limit: int = 100):
        """列出某任务的所有探索进度（journey 表），按 jID 排序。"""
        self._ensure_schema()
        sql = text(
            """
            SELECT jID, tID, uID, info_input,
                   time_created, time_submitted, time_checked, time_claimed, points_claimed
            FROM journey
            WHERE tID = :tID
            ORDER BY jID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"tID": tID, "limit": limit, "offset": skip})
        return rows

    def get(self, jID: int):
        """获取单条探索进度记录（journey 表）。"""
        self._ensure_schema()
        sql = text(
            """
            SELECT jID, tID, uID, info_input,
                   time_created, time_submitted, time_checked, time_claimed, points_claimed
            FROM journey WHERE jID = :jID
            """
        )
        row = Foundation.fetch_one(self.db, sql, {"jID": jID})
        return row

    def create(self, uID: int, tID: int, info_input: Optional[str] = None):
        """创建一条探索进度记录（用户参与任务）。
        返回创建后的字典映射。
        """
        self._ensure_schema()
        # 若已存在同一用户对同一任务的记录，则直接返回该记录，避免重复参与
        exists_sql = text(
            "SELECT jID FROM journey WHERE uID = :uID AND tID = :tID ORDER BY jID DESC LIMIT 1"
        )
        exists = Foundation.fetch_one(self.db, exists_sql, {"uID": uID, "tID": tID})
        if exists and exists.get("jID"):
            return self.get(int(exists["jID"]))

        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        ins = text(
            """
            INSERT INTO journey (tID, uID, info_input, time_created, points_claimed)
            VALUES (:tID, :uID, :info_input, :time_created, 0)
            """
        )
        Foundation.exec(self.db, ins, {"tID": tID, "uID": uID, "info_input": info_input, "time_created": now_str})
        self.db.commit()
        sel = text(
            """
            SELECT jID, tID, uID, info_input,
                   time_created, time_submitted, time_checked, time_claimed, points_claimed
            FROM journey WHERE jID = last_insert_rowid()
            """
        )
        row = Foundation.fetch_one(self.db, sel)
        return row

    def mark_checked(self, jID: int):
        """标记已审核（设置 time_checked）。"""
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        upd = text("UPDATE journey SET time_checked = :ts WHERE jID = :jID")
        Foundation.exec(self.db, upd, {"ts": now_str, "jID": jID})
        self.db.commit()
        return self.get(jID)

    def claim(self, jID: int, points_claimed: int = 0):
        """领取奖励（设置 points_claimed 与 time_claimed）。"""
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        upd = text(
            "UPDATE journey SET points_claimed = :pts, time_claimed = :ts WHERE jID = :jID"
        )
        Foundation.exec(self.db, upd, {"pts": max(0, int(points_claimed or 0)), "ts": now_str, "jID": jID})
        self.db.commit()
        return self.get(jID)

    def update_info_input(self, jID: int, info_input: str):
        """提交/更新任务信息（仅设置 info_input，不修改审核时间）。"""
        self._ensure_schema()
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        upd = text(
            "UPDATE journey SET info_input = :info, time_submitted = :ts WHERE jID = :jID"
        )
        Foundation.exec(self.db, upd, {"info": info_input, "ts": now_str, "jID": jID})
        self.db.commit()
        return self.get(jID)

    def list_all(self, skip: int = 0, limit: int = 100):
        """列出所有探索进度记录（管理员或调试用）。"""
        sql = text(
            """
            SELECT jID, tID, uID, info_input,
                   time_created, time_checked, time_claimed, points_claimed
            FROM journey
            ORDER BY jID
            LIMIT :limit OFFSET :offset
            """
        )
        rows = Foundation.fetch_all(self.db, sql, {"limit": limit, "offset": skip})
        return rows

    def list_pending_verification(self, skip: int = 0, limit: int = 100):
        """列出等待管理员审核的任务提交。"""
        self._ensure_schema()
        sql = text(
            """
            SELECT jID, tID, uID, info_input,
                   time_created, time_submitted, time_checked, time_claimed, points_claimed
            FROM journey
            WHERE COALESCE(TRIM(info_input), '') <> ''
              AND time_checked IS NULL
              AND time_claimed IS NULL
            ORDER BY COALESCE(time_submitted, time_created) DESC, jID DESC
            LIMIT :limit OFFSET :offset
            """
        )
        return Foundation.fetch_all(self.db, sql, {"limit": limit, "offset": skip})

    def count_pending_verification(self) -> int:
        """统计等待管理员审核的任务提交数量。"""
        self._ensure_schema()
        sql = text(
            """
            SELECT COUNT(1) AS cnt
            FROM journey
            WHERE COALESCE(TRIM(info_input), '') <> ''
              AND time_checked IS NULL
              AND time_claimed IS NULL
            """
        )
        row = Foundation.fetch_one(self.db, sql)
        return int((row or {}).get("cnt") or 0)

    def reject_submission(self, jID: int):
        """退回任务提交，让用户重新填写并再次提交。"""
        self._ensure_schema()
        upd = text(
            """
            UPDATE journey
            SET info_input = NULL,
                time_submitted = NULL
            WHERE jID = :jID
            """
        )
        Foundation.exec(self.db, upd, {"jID": jID})
        self.db.commit()
        return self.get(jID)

    def delete_task(self, tID: int) -> bool:
        # 使用原生 SQL 删除，避免 ORM 在读取含非标准时间格式的记录时抛出解析错误
        del_sql = text("DELETE FROM task_type WHERE ttID = :tID")
        result = Foundation.exec(self.db, del_sql, {"tID": tID})
        self.db.commit()
        return result.rowcount > 0

    # 参与任务（写入 task_list）
    def join_task(self, uID: int, tID: int) -> Optional[TaskList]:
        if not self.get_task(tID):
            return None
        existing = (
            self.db.query(TaskList)
            .filter(TaskList.uID == uID, TaskList.tID == tID)
            .first()
        )
        if existing:
            return existing
        record = TaskList(uID=uID, tID=tID, time_created=datetime.utcnow())
        self.db.add(record)
        return self._commit_refresh(record)

    def submit_task_info(self, jID: int, info_input: str) -> Optional[TaskList]:
        record = self.db.query(TaskList).filter(TaskList.jID == jID).first()
        if not record:
            return None
        record.info_input = info_input
        record.time_submitted = datetime.utcnow()  # 用户提交时间
        # time_checked 保持为 None，等待管理员审核
        return self._commit_refresh(record)


class ChestEntity(Entity):
    """宝箱相关数据访问"""
    _schema_checked: bool = False

    def _ensure_schema(self):
        if ChestEntity._schema_checked:
            return
        try:
            info_sql = text("PRAGMA table_info(chest)")
            cols = Foundation.fetch_all(self.db, info_sql)
            names = {c.get("name") for c in cols}
            if "time_claimed" not in names:
                alter_sql = text("ALTER TABLE chest ADD COLUMN time_claimed DATETIME")
                Foundation.exec(self.db, alter_sql)
                self.db.commit()
                try:
                    if "time_actived" in names:
                        mig_sql = text("UPDATE chest SET time_claimed = time_actived WHERE time_actived IS NOT NULL")
                        Foundation.exec(self.db, mig_sql)
                        self.db.commit()
                except Exception:
                    self.db.rollback()
        except Exception:
            pass
        finally:
            ChestEntity._schema_checked = True
    def get(self, cID: int) -> Optional[dict]:
        self._ensure_schema()
        sql = text(
            """
            SELECT cID, time_created, tirer, vol_points, sID0, sID1, time_actived, uID, time_claimed  
            FROM chest WHERE cID = :cID
            """
        )
        return Foundation.fetch_one(self.db, sql, {"cID": cID})

    def list_by_user(self, uID: int, is_active: Optional[bool] = None):
        self._ensure_schema()
        base = (
        """
        SELECT cID, time_created, tirer, vol_points, sID0, sID1, time_actived, uID, time_claimed  
        FROM chest WHERE uID = :uID
        """
        )
        params = {"uID": uID}
        if is_active is not None:
            base += " AND is_active = :ia"
            params["ia"] = bool(is_active)
        base += " ORDER BY cID"
        sql = text(base)
        return Foundation.fetch_all(self.db, sql, params)


class CalendarEntity:
    """聚合外部日历事件的数据访问实体（非数据库表）。
    负责从 Foundation 提供的三个数据源（混合）抓取并返回统一结构的事件列表。
    """

    # 简易缓存（进程内），避免每次请求都抓取外部源导致卡顿
    _cache_events: list = []
    _cache_ts: float = 0.0
    CACHE_TTL: int = 300  # 秒

    def __init__(self) -> None:
        self.sources = Foundation.get_calendar_sources()

    @staticmethod
    def _fetch_text(url: str) -> str:
        import urllib.request
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="ignore")
        except Exception:
            return ""

    @staticmethod
    async def _fetch_text_async(url: str) -> str:
        # 使用线程将阻塞的 urllib 调用移出事件循环，实现并发抓取
        return await asyncio.to_thread(CalendarEntity._fetch_text, url)

    @staticmethod
    def _unfold_ics_lines(ics: str) -> list:
        # ICS 行折叠：以空格开头的行视为上一行的延续
        lines = ics.splitlines()
        unfolded = []
        for line in lines:
            if line.startswith(" ") and unfolded:
                unfolded[-1] += line[1:]
            else:
                unfolded.append(line)
        return unfolded

    @staticmethod
    def _parse_ics_events(ics_text: str) -> list:
        if not ics_text:
            return []
        lines = CalendarEntity._unfold_ics_lines(ics_text)
        events = []
        current = {}
        in_event = False

        def _parse_dt(val: str) -> str:
            # 处理常见格式：YYYYMMDD 或 YYYYMMDDTHHMMSSZ
            try:
                if val.endswith("Z"):
                    # UTC 格式
                    from datetime import datetime
                    dt = datetime.strptime(val, "%Y%m%dT%H%M%SZ")
                    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                if "T" in val:
                    from datetime import datetime
                    dt = datetime.strptime(val, "%Y%m%dT%H%M%S")
                    return dt.strftime("%Y-%m-%dT%H:%M:%S")
                # 仅日期
                from datetime import datetime
                dt = datetime.strptime(val, "%Y%m%d")
                return dt.strftime("%Y-%m-%dT00:00:00")
            except Exception:
                return val

        for line in lines:
            if line == "BEGIN:VEVENT":
                current = {}
                in_event = True
                continue
            if line == "END:VEVENT":
                if current:
                    events.append(current)
                current = {}
                in_event = False
                continue
            if not in_event:
                continue

            # 提取字段（考虑属性参数如 DTSTART;TZID=...:value）
            if ":" in line:
                key, val = line.split(":", 1)
                key = key.split(";", 1)[0].upper()
                val = val.strip()
                if key == "UID":
                    current["uid"] = val
                elif key == "SUMMARY":
                    current["title"] = val
                elif key == "DESCRIPTION":
                    current["description"] = val
                elif key == "DTSTART":
                    current["start_time"] = _parse_dt(val)
                elif key == "DTEND":
                    current["end_time"] = _parse_dt(val)
                elif key == "LOCATION":
                    current["location"] = val
                elif key == "URL":
                    current["url"] = val

        # 归一化键与ID
        normalized = []
        import hashlib
        for i, ev in enumerate(events, start=1):
            uid = ev.get("uid") or f"anon-{i}"
            event_id = int(hashlib.sha1(uid.encode("utf-8")).hexdigest()[:8], 16)
            normalized.append({
                "eventID": event_id,
                "title": ev.get("title") or "",
                "description": ev.get("description") or "",
                "start_time": ev.get("start_time"),
                "end_time": ev.get("end_time"),
                "location": ev.get("location") or "",
                "url": ev.get("url") or "",
            })
        return normalized

    def list(self) -> list:
        """抓取多个数据源并合并为一个事件列表。"""
        # 同步版本保留（必要时作为后备）
        return asyncio.run(self.list_async())

    async def list_async(self) -> list:
        # 命中缓存直接返回
        now = asyncio.get_running_loop().time()
        if CalendarEntity._cache_events and (now - CalendarEntity._cache_ts) < CalendarEntity.CACHE_TTL:
            return CalendarEntity._cache_events

        # 并发抓取ICS文本
        texts = await asyncio.gather(*[self._fetch_text_async(src) for src in self.sources])

        # 将解析也放到线程，避免阻塞事件循环
        parse_tasks = [asyncio.to_thread(self._parse_ics_events, t) for t in texts]
        parsed_lists = await asyncio.gather(*parse_tasks)

        all_events = []
        for evs in parsed_lists:
            all_events.extend(evs)

        # 去重与排序
        uniq = {e["eventID"]: e for e in all_events}
        def _key(e):
            return e.get("start_time") or ""
        merged = sorted(list(uniq.values()), key=_key)

        # 写入缓存
        CalendarEntity._cache_events = merged
        CalendarEntity._cache_ts = now
        return merged

    def list_all(self, is_active: Optional[bool] = None):
        """列出全部宝箱，可选按激活状态过滤"""
        base = "SELECT cID, uID, time_created, tirer, vol_points, sID, is_active FROM chest"
        params = {}
        if is_active is not None:
            base += " WHERE is_active = :ia"
            params["ia"] = bool(is_active)
        base += " ORDER BY cID"
        sql = text(base)
        return self.db.execute(sql, params).mappings().all()

    def create(self, uID: int, sID: int, tirer: int = 0, vol_points: int = 0) -> dict:
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        ins = text(
            """
            INSERT INTO chest (uID, sID, tirer, vol_points, time_created, is_active)
            VALUES (:uID, :sID, :tirer, :vol_points, :time_created, 1)
            """
        )
        Foundation.exec(self.db, ins, {
            "uID": uID,
            "sID": sID,
            "tirer": int(tirer or 0),
            "vol_points": max(0, int(vol_points or 0)),
            "time_created": now_str,
        })
        self.db.commit()
        return Foundation.fetch_one(self.db, text("SELECT cID, uID, time_created, tirer, vol_points, sID, is_active FROM chest WHERE cID = last_insert_rowid()"))

    def open(self, cID: int) -> Optional[dict]:
        chest = self.get(cID)
        if not chest:
            return None
        if not bool(chest.get("is_active", False)):
            return chest
        upd = text("UPDATE chest SET is_active = 0 WHERE cID = :cID")
        Foundation.exec(self.db, upd, {"cID": cID})
        self.db.commit()
        return self.get(cID)
