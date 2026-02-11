#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
服务层（Service）

职责：
- 读取 data（仓库），封装业务规则与响应结构；
- 为 API 层提供统一的响应（success/code/message/data）。

使用示例（在 API 中）：
    from backend.service import Service

    svc = Service()
    result = await svc.get_all_gifts()
    # 返回：{"success": True, "code": 0, "message": "OK", "data": [...]}

"""

from __future__ import annotations

from stat import ST_DEV
from typing import Optional, List
from datetime import datetime, timedelta, time
import os
import random
from sqlalchemy import Boolean

from .data import Data, BrandData, CalendarData, ChestData, GiftData, JourneyData, TaskData, UserData, UserChestStatData
from .data_model import Brand, Chest, Gift, Journey, Task, User
from .foundation import Base
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

# SQLAlchemy ORM 模型类（用于代码中混用的 ORM 查询）
class TaskList(Base):
    """任务清单 ORM 类 - 映射到 journey 表"""
    __tablename__ = 'journey'
    
    jID = Column('jID', Integer, primary_key=True, autoincrement=True)
    tID = Column(Integer, nullable=False)
    uID = Column(Integer, nullable=False)
    info_input = Column(Text)
    time_created = Column(DateTime, nullable=False)
    time_checked = Column(DateTime)
    time_claimed = Column(DateTime)
    points_claimed = Column(Integer, default=0)
    info_lang = Column(String(10))
    time_submitted = Column(DateTime)

class GiftList(Base):
    """礼品清单 ORM 类 - 映射到 gift 表"""
    __tablename__ = 'gift'
    
    glID = Column('gID', Integer, primary_key=True, autoincrement=True)
    bID = Column(Integer, nullable=False)
    uID = Column(Integer)
    time_created = Column(DateTime, nullable=False)
    time_claimed = Column(DateTime)
    time_actived = Column(DateTime)

class TimeUtils:
    @staticmethod
    def get_today_start() -> datetime:
        """获取今天0点的时间"""
        now = datetime.now()
        return datetime(now.year, now.month, now.day)
    
    @staticmethod
    def is_same_day(dt1: datetime, dt2: datetime) -> bool:
        """判断两个时间是否在同一天"""
        return dt1.date() == dt2.date()
    
    @staticmethod
    def get_day_offset(base_time: datetime, target_time: datetime) -> int:
        """计算两个时间相差的天数"""
        return (target_time.date() - base_time.date()).days

    @staticmethod
    def get_today_range() -> tuple[datetime, datetime]:
        """获取今天的时间范围"""
        today = datetime.now().date()
        today_start = datetime.combine(today, time.min)
        today_end = datetime.combine(today, time.max)
        return today_start, today_end
    
    @staticmethod
    def is_today(timestamp: datetime) -> bool:
        """判断时间是否是今天"""
        if not timestamp:
            return False
        return timestamp.date() == datetime.now().date()

class Core:
    user_data = UserData()

    """对外提供业务服务的类，输出统一的响应结构"""

    def __init__(self, data: Optional[Data] = None) -> None:
        self._external = data is not None
        self.data = data or Data()

    # 上下文（可选）
    def __enter__(self) -> "Core":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        # 仅在内部创建的 Data 才负责关闭
        if not self._external:
            try:
                self.data.__exit__(exc_type, exc, tb)
            except Exception:
                pass

    # 统一响应
    def ok(self, data=None, message: str = "OK", code: int = 0):
        return {"success": True, "code": code, "message": message, "data": data}

    def err(self, message: str, code: int = 1):
        return {"success": False, "code": code, "message": message}

    async def get_all(self, tablename: str, skip: int = 0, limit: int = 100, filters: Optional[dict] = None):
        with self.data as d:
            items = d.list_items(table=tablename, skip=skip, limit=limit, filters=filters)
            return self.ok(data=[i.to_dict() for i in items])

    ADMIN_EVM_ADDRESSES = {a.strip().lower() for a in os.getenv("ADMIN_EVM_ADDRESSES", "").split(",") if a.strip()}

    def is_admin(self, uID: int) -> bool:
        with self.data as r:
            u = r.get_user_by_id(uID)
            if not u:
                return False
            evm = (u.EVM or "").lower()
            flag = bool(u.is_admin)
            return flag or (evm and evm in Core.ADMIN_EVM_ADDRESSES)

    async def get_calendar_events(self):
        try:
            with self.data as r:
                events = r.list_calendar_events()
                return self.ok(data=events)
        except Exception as e:
            return self.err(str(e))

    # ========== Brand/Gift（新结构） ==========
    async def get_all_brands(self, skip: int = 0, limit: int = 100):
        """返回品牌列表，并附带库存与领用数量（基于 gift 表统计）。
        时间字段统一输出为 Unix 时间戳（秒），历史异常值统一为 0。
        """
        with self.data as r:
            brands = r.list_brands(skip=skip, limit=limit)
            data = []
            for b in brands:
                stores = r.count_gift_stores_by_brand(b.bID)
                claims = r.count_gift_claims_by_brand(b.bID)
                item = b.to_dict()
                item.update({
                    "stores_count": stores,
                    "claims_count": claims,
                })
                data.append(item)
            return self.ok(data=data)

    async def get_all_gift_records(self, skip: int = 0, limit: int = 200):
        """返回礼品记录列表（gift 表的原始条目）。时间字段为 Unix 时间戳。"""
        with self.data as r:
            gifts = r.list_gifts(skip=skip, limit=limit)
            return self.ok(data=[g.to_dict() for g in gifts])

    # ========== Task（新结构最小实现） ==========
    async def get_all_tasks_new(self, skip: int = 0, limit: int = 100):
        """返回任务类型（task 表）列表，字段以数据库为准（link0/linkB），时间戳为 Unix 秒。"""
        with self.data as r:
            tasks = r.list_tasks(skip=skip, limit=limit)
            return self.ok(data=[t.to_dict() for t in tasks])

    async def create_gift(self,
                          gift_name: str,
                          gift_description: Optional[str] = None,
                          gift_image_url: Optional[str] = None,
                          is_open: bool = True,
                          time_start: Optional[object] = None,
                          time_end: Optional[object] = None):
        with self.data as r:
            ts = self._parse_input_dt(time_start)
            te = self._parse_input_dt(time_end)
            g = r.create_gift(
                gift_name=gift_name,
                gift_description=gift_description,
                gift_image_url=gift_image_url,
                is_open=is_open,
                time_start=ts,
                time_end=te,
            )
            return self.ok(message="Gift created", data=self.gift_to_dict(g))

    async def update_gift(self, gID: int, **fields):
        if "time_start" in fields:
            fields["time_start"] = self._parse_input_dt(fields.get("time_start"))
        if "time_end" in fields:
            fields["time_end"] = self._parse_input_dt(fields.get("time_end"))
        with self.data as r:
            g = r.update_gift(gID, **fields)
            if not g:
                return self.err("Gift not found")
            return self.ok(message="Gift updated", data=self.gift_to_dict(g))

    async def delete_gift(self, gID: int):
        with self.data as r:
            ok = r.delete_gift(gID)
            if not ok:
                return self.err("Gift not found")
            return self.ok(message="Gift deleted")

    async def claim_gift(self, gID: int, uID: int):
        with self.data as r:
            record = r.claim_gift(uID=uID, gID=gID)
            if not record:
                # 不存在礼品或池中无可用库存
                return self.err("Gift not found or no available stock")
            return self.ok(message="Gift claimed successfully", data={"glID": record.glID, "is_active": record.is_active})

    async def get_user_gifts(self, uID: int, status_: Optional[bool] = None):
        with self.data as r:
            q = r.db.query(GiftList).filter(GiftList.uID == uID)
            if status_ is not None:
                q = q.filter(GiftList.is_active == bool(status_))
            records = q.all()
            data = []
            for rec in records:
                g = r.get_gift(rec.gID)
                data.append({
                    "glID": rec.glID,
                    "uID": rec.uID,
                    "gift": self.gift_to_dict(g) if g else None,
                    "time_created": rec.time_created.strftime("%Y-%m-%d %H:%M:%S") if rec.time_created else None,
                    "is_active": rec.is_active,
                })
            return self.ok(data=data)

    # ========== Tasks ==========
    def _format_dt(self, v):
        """Robust datetime formatter used for API output.
        Returns a human-readable string or None.
        - datetime: '%Y-%m-%d %H:%M:%S'
        - int/float: interpret as Unix timestamp (seconds)
        - bytes: decode to str (utf-8) and return as-is
        - str: return as-is
        - None/other: best-effort string or None
        """
        from datetime import datetime as _dt
        if v is None:
            return None
        try:
            if isinstance(v, _dt):
                return v.strftime("%Y-%m-%d %H:%M:%S")
            if isinstance(v, (int, float)):
                # Guard against unrealistic values
                try:
                    return _dt.fromtimestamp(int(v)).strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    return str(v)
            if isinstance(v, (bytes, bytearray)):
                try:
                    return bytes(v).decode("utf-8")
                except Exception:
                    return str(v)
            if isinstance(v, str):
                return v
        except Exception:
            pass
        try:
            return str(v)
        except Exception:
            return None

    def _parse_input_dt(self, v):
        """Parse incoming input into a Python datetime, or None.
        Accepts None, datetime, str (common formats and ISO8601), and int/float (unix seconds).
        """
        from datetime import datetime as _dt
        if v is None:
            return None
        if isinstance(v, _dt):
            return v
        try:
            if isinstance(v, (int, float)):
                return _dt.fromtimestamp(int(v))
            if isinstance(v, str):
                # Normalize trailing Z to +00:00 for Python 3.9
                vv = v.strip()
                if vv.endswith("Z"):
                    vv = vv[:-1] + "+00:00"
                # Try common formats
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S"):
                    try:
                        return _dt.strptime(vv, fmt)
                    except Exception:
                        pass
                # ISO 8601 fallback
                try:
                    return _dt.fromisoformat(vv)
                except Exception:
                    return None
        except Exception:
            return None
        return None

    # ========== Users ==========
    def user_to_dict(self, user: User):
        # 支持 ORM 对象或字典映射（当前用户查询使用 ORM）
        def getv(obj, key):
            try:
                return obj[key] if isinstance(obj, dict) else getattr(obj, key)
            except Exception:
                return None
        return {
            "uID": getv(user, "uID"),
            "EVM": getv(user, "EVM"),
            "bio": getv(user, "bio"),
            "is_admin": bool(getv(user, "is_admin")) if getv(user, "is_admin") is not None else None,
            "time_reg": self._format_dt(getv(user, "time_reg")),
            "time_login_last": self._format_dt(getv(user, "time_login_last")),
        }

    async def get_all_users(self, skip: int = 0, limit: int = 100):
        with self.data as r:
            users = r.users.list(skip=skip, limit=limit)
            data = [self.user_to_dict(u) for u in users]
            return self.ok(data=data)

    async def get_user_detail(self, uID: int):
        with self.data as r:
            u = r.get_user_by_id(uID)
            if not u:
                return self.err("User not found")
            return self.ok(data=self.user_to_dict(u))

    async def update_user(self, uID: int, *, bio: Optional[str] = None, is_admin: Optional[bool] = None):
        with self.data as r:
            u = r.update_user(uID=uID, bio=bio, is_admin=is_admin)
            if not u:
                return self.err("User not found")
            return self.ok(message="User updated", data=self.user_to_dict(u))

    def task_to_dict(self, t: Task, participants_count: Optional[int] = None):
        # 支持 ORM 对象或字典映射
        def getv(obj, key):
            try:
                return obj[key] if isinstance(obj, dict) else getattr(obj, key)
            except Exception:
                return None
        return {
            "tID": getv(t, "tID"),
            "title": getv(t, "title"),
            "note": getv(t, "note"),
            "refcode": getv(t, "refcode"),
            # 统一字段：新表使用 link0
            "link0": getv(t, "link0"),
            "linkB": getv(t, "linkB"),
            "points": getv(t, "points") if getv(t, "points") is not None else 0,
            "is_open": bool(getv(t, "is_open")) if getv(t, "is_open") is not None else None,
            "time_start": self._format_dt(getv(t, "time_start")),
            "time_end": self._format_dt(getv(t, "time_end")),
            # 统一命名：新表使用 time_created/time_updated
            "time_created": self._format_dt(getv(t, "time_created")),
            "time_updated": self._format_dt(getv(t, "time_updated")),
            "participants_count": participants_count if participants_count is not None else None,
        }

    # 旧版 get_all_tasks 已移除，统一使用上方“Task（新结构最小实现）”版本

    async def get_task_detail(self, tID: int):
        with self.data as r:
            t = r.get_task(tID)
            if not t:
                return self.err("Task not found")
            participants = r.count_task_participants(t.tID)
            return self.ok(data=self.task_to_dict(t, participants))

    async def get_user_journeys(self, uID: int, skip: int = 0, limit: int = 100):
        with self.data as r:
            journeys = r.list_journeys_by_user(uID=uID, skip=skip, limit=limit)
            return self.ok(data=[j.to_dict() for j in journeys])

    async def get_task_journeys(self, tID: int, skip: int = 0, limit: int = 100):
        with self.data as r:
            journeys = r.list_journeys_by_task(tID=tID, skip=skip, limit=limit)
            return self.ok(data=[j.to_dict() for j in journeys])

    async def get_journey_detail(self, jID: int):
        with self.data as r:
            j = r.get_journey(jID)
            if not j:
                return self.err("Journey not found")
            return self.ok(data=j.to_dict())



    async def check_journey(self, jID: int):
        with self.data as r:
            j2 = r.mark_journey_checked(jID)
            if not j2:
                return self.err("Journey not found")
            return self.ok(data=j2.to_dict())

    async def claim_journey_admin(self, jID: int, points_claimed: int = 0):
        with self.data as r:
            j = r.get_journey(jID)
            if not j:
                return self.err("Journey not found")
            if int(j.time_checked or 0) <= 0:
                return self.err("Journey not checked yet")
            j2 = r.claim_journey(jID, points_claimed)
            if not j2:
                return self.err("Journey not found")
            return self.ok(data=j2.to_dict())

    async def claim_journey_user(self, jID: int, uid: int):
        with self.data as r:
            j = r.get_journey(jID)
            if not j:
                return self.err("Journey not found")
            if int(j.uID or 0) != int(uid):
                return self.err("Forbidden: not owner")
            if int(j.time_claimed or 0) > 0:
                return self.ok(message="Journey already claimed", data=j.to_dict())
            t = r.get_task(j.tID)
            pts = int(t.points if t else 0)
            j2 = r.claim_journey(jID, points_claimed=pts)
            if not j2:
                return self.err("Journey not found")
            try:
                asset = r.users.upsert_asset(uid, points_delta=pts)
                total_pts = asset.points if asset else None
            except Exception:
                total_pts = None
            data = j2.to_dict()
            data["reward_points"] = pts
            if total_pts is not None:
                data["user_points_total"] = total_pts
            return self.ok(message="Journey claimed", data=data)

    async def create_task(self,
                          title: str,
                          note: Optional[str] = None,
                          refcode: Optional[str] = None,
                          linkA: Optional[str] = None,
                          linkB: Optional[str] = None,
                          is_open: bool = True,
                          time_start: Optional[object] = None,
                          time_end: Optional[object] = None):
        with self.data as r:
            ts = self._parse_input_dt(time_start)
            te = self._parse_input_dt(time_end)
            t = r.create_task(title=title, note=note, refcode=refcode, linkA=linkA, linkB=linkB,
                              is_open=is_open, time_start=ts, time_end=te)
            return self.ok(data=self.task_to_dict(t))

    async def update_task(self, tID: int, **fields):
        # Normalize datetime inputs if present
        if "time_start" in fields:
            fields["time_start"] = self._parse_input_dt(fields.get("time_start"))
        if "time_end" in fields:
            fields["time_end"] = self._parse_input_dt(fields.get("time_end"))
        with self.data as r:
            t = r.update_task(tID, **fields)
            if not t:
                return self.err("Task not found")
            return self.ok(data=self.task_to_dict(t))

    async def delete_task(self, tID: int):
        with self.data as r:
            ok = r.delete_task(tID)
            if not ok:
                return self.err("Task not found")
            return self.ok(message="Task deleted")

    async def join_task(self, tID: int, uID: int):
        with self.data as r:
            record = r.join_task(uID=uID, tID=tID)
            if not record:
                return self.err("Task not found or already joined")
            return self.ok(message="Successfully joined the task", data={"jID": record.jID})

    async def submit_task_info(self, jID: int, uID: int, info_input: str):
        with self.data as r:
            # 首先尝试查找现有的任务参与记录
            rec: Optional[TaskList] = r.db.query(TaskList).filter(TaskList.jID == jID).first()
            
            if not rec:
                # 如果没有找到记录，可能是传递了 tID（任务类型ID）
                # 尝试查找该用户是否已有该任务的参与记录
                rec = r.db.query(TaskList).filter(
                    TaskList.tID == jID,
                    TaskList.uID == uID
                ).first()
                
                if not rec:
                    # 如果仍然没有，需要先创建一条 journey 记录
                    # 获取任务信息以验证任务存在
                    task = r.get_task(jID)
                    if not task:
                        return self.err("Task not found")
                    # 创建新的参与记录
                    from datetime import datetime
                    rec = TaskList(tID=jID, uID=uID, time_created=datetime.utcnow())
                    r.db.add(rec)
                    r.db.commit()
                    r.db.refresh(rec)
            
            # 权限检查：确认记录属于当前用户
            if rec.uID != uID:
                return self.err("You don't have permission to submit this task")
            
            # 更新任务信息
            rec.info_input = info_input
            rec.time_submitted = datetime.utcnow()
            r.db.commit()
            r.db.refresh(rec)
            
            return self.ok(message="Task info submitted", data={"jID": rec.jID})

    async def get_user_tasks(self, uID: int, status_: Optional[str] = None):
        with self.data as r:
            q = r.db.query(TaskList).filter(TaskList.uID == uID)
            if status_:
                # 在新规范中没有 status 字段，保留过滤占位（不生效），可扩展为 is_open / time_checked 等逻辑
                pass
            items = q.all()
            data = []
            for rec in items:
                t = r.get_task(rec.tID)
                data.append({
                    "jID": rec.jID,
                    "uID": rec.uID,
                    "task": self.task_to_dict(t) if t else None,
                    "info_input": rec.info_input,
                    "time_created": rec.time_created.strftime("%Y-%m-%d %H:%M:%S") if rec.time_created else None,
                    "time_checked": rec.time_checked.strftime("%Y-%m-%d %H:%M:%S") if rec.time_checked else None,
                    "time_claimed": rec.time_claimed.strftime("%Y-%m-%d %H:%M:%S") if rec.time_claimed else None,
                    "points_claimed": rec.points_claimed,
                })
            return self.ok(data=data)

    # ========== Stats ==========
    async def get_stats(self):
        with self.data as r:
            users = r.db.query(User).count()
            tasks = r.db.query(Task).count()
            gifts = r.db.query(Gift).count()
            task_lists = r.db.query(TaskList).count()
            gift_lists = r.db.query(GiftList).count()
            return self.ok(data={
                "users": users,
                "tasks": tasks,
                "gifts": gifts,
                "task_lists": task_lists,
                "gift_lists": gift_lists,
                "generated_at": datetime.utcnow().isoformat(),
            })

    # ========== Chests ==========
    def chest_to_dict(self, c: Chest):
        return {
            "cID": c.cID,
            "uID": c.uID,
            "gslID": c.gslID,
            "tirer": c.tirer,
            "vol_points": c.vol_points,
            "is_active": c.is_active,
            "time_created": c.time_created.strftime("%Y-%m-%d %H:%M:%S") if c.time_created else None,
        }

    async def get_user_chests(self, uID: int, is_active: Optional[bool] = None):
        with self.data as r:
            chests = r.list_user_chests(uID=uID, is_active=is_active)
            return self.ok(data=[self.chest_to_dict(c) for c in chests])

    async def get_all_chests(self, is_active: Optional[bool] = None):
        """获取所有宝箱（无需认证），支持按激活状态过滤"""
        with self.data as r:
            chests = r.list_all_chests(is_active=is_active)
            return self.ok(data=[self.chest_to_dict(c) for c in chests])

    async def open_chest(self, cID: int, uID: int):
        with self.data as r:
            chest = r.get_chest(cID)
            if not chest:
                return self.err("Chest not found")
            if chest.uID != uID:
                return self.err("You don't have permission to open this chest")
            # 打开宝箱
            updated = r.open_chest(cID)
            # 发放积分
            asset = r.reward_points_for_chest(uID=uID, cID=cID)
            return self.ok(message="Chest claimed", data={
                "cID": updated.cID,
                "is_active": updated.is_active,
                "reward_points": chest.vol_points,
                "user_points_total": asset.points if asset else None,
            })

    async def add_gift_record(self, bID: int, uID: Optional[int] = None, time_actived: Optional[datetime] = None):
        with self.data as r:
            g = r.create_gift(bID=bID, uID=uID, time_actived=time_actived)
            return self.ok(message="Gift created", data=g.to_dict())

    async def update_gift_record(self, gID: int, uID: Optional[int] = None, time_actived: Optional[datetime] = None):
        with self.data as r:
            g = r.update_gift(gID, uID=uID, time_actived=time_actived)
            if not g:
                return self.err("Gift not found")
            return self.ok(message="Gift updated", data=g.to_dict())

    async def delete_gift_record(self, gID: int):
        with self.data as r:
            ok = r.delete_gift(gID)
            if not ok:
                return self.err("Gift not found")
            return self.ok(message="Gift deleted", data={"gID": gID})

    async def get_gift_detail(self, gID: int):
        with self.data as r:
            g = r.get_gift(gID)
            if not g:
                return self.err("Gift not found")
            return self.ok(data=g.to_dict())

    async def create_gifts_bulk(self, bID: int, count: int, uID: Optional[int], uIDs: Optional[List[int]]):
        with self.data as r:
            created_ids = r.create_gifts_bulk(bID=bID, count=count, uID=uID, uIDs=uIDs)
            return self.ok(message="Gifts created", data={"bID": bID, "created_gIDs": created_ids, "count": len(created_ids)})

    async def get_all_symbols(self):
        with self.data as r:
            items = r.list_symbols()
            data = [{"symbol_id": i["symbol_id"], "gID": i["gID"], "symbol": i["symbol"], "points": i["points"]} for i in items]
            return self.ok(data=data)

    async def get_symbol_detail(self, sid: int):
        with self.data as r:
            s = r.get_symbol(sid)
            if not s:
                return self.err("Symbol not found")
            return self.ok(data={"symbol_id": s["symbol_id"], "gID": s["gID"], "symbol": s["symbol"], "points": s["points"]})

    async def create_journey(self, uID: int, tID: int, info_input: Optional[str] = None):
        with self.data as r:
            j = r.create_journey(uID=uID, tID=tID, info_input=info_input)
            return self.ok(data=j.to_dict())

    async def auth_find_or_create_by_evm(self, evm_norm: str):
        with self.data as r:
            row = r.find_or_create_user_by_evm(evm_norm)
            if not row:
                return self.err("Failed to create user")
            return self.ok(data={"uID": row["uID"], "EVM": row["EVM"], "bio": row.get("bio") or ""})

    async def get_user_by_id_raw(self, uID: int):
        with self.data as r:
            row = r.get_user_by_id_raw(uID)
            if not row:
                return self.err("User not found")
            return self.ok(data=row)

class BrandCore(Core):
    def __init__(self, data: Optional[Data] = None) -> None:
        self.data = BrandData(data)
    
    def brand_to_dict(self, b: Brand):
        item = b.to_dict()
        try:
            with Data(self.data.db) as r:
                stores = r.count_gift_stores_by_brand(b.bID)
                claims = r.count_gift_claims_by_brand(b.bID)
                item.update({
                    "stores_count": stores,
                    "claims_count": claims,
                })
        except Exception:
            pass
        return item

    async def get_all(self, skip: int = 0, limit: int = 100):
        with self.data as r:
            brands = r.list_brands(skip=skip, limit=limit)
            return self.ok(data=[self.brand_to_dict(b) for b in brands])

class CalendarCore(Core):
    def __init__(self, data: Data):
        self.data = CalendarData(data)
    
    async def get(self):
        with self.data as r:
            events = await r.list_async()
            if not events:
                return self.err("Calendar not found")
            return self.ok(data=events)

class ChestCore(Core):
    # 宝箱等级规则 顺序代表连续开宝箱的天数 0-3 分别对应 1-10-100-1000 点 Point 奖励
    TIRER_RULES = [0,1,2,3,1,2,3,1,2,1,2,3,2,3,1,2,3,2,3,2,3,2,3,2,3,2,3,3]
    # 设定当 tirer 是 0 时的各数值的 REFER 参考值
    # 标准差，减少极端值
    STD_DEV = 250
    # 宝箱奖励值参考 1000 点 Point 奖励的宝箱值为 1000
    VALUE_REFER = 1
    # 最低值和最高值的阈值 如果超出这个阈值都视为极端值
    VALUE_REFER_THRESHOLD_MIN = 0.1
    VALUE_REFER_THRESHOLD_MAX = 10
    # 碎片在总奖励值中的占比
    RATE_VALUE_SHARDS = 0.382
    # 极端值出现的概率
    PROBABILITY_EXTREMUM = 0.05
    # 极端值的奖励值占比
    RATE_VALUE_EXTREMUM = 0.618

    user_data = None
    user_data_today = None
    count_continued = 0
    count_claimed = 0
    time_claimed_last = None
    time_updated = None
    tirers_weekly = []
    rewards = []
    is_claimed_today = True

    def __init__(self, data: Data):
        self.data = ChestData(data)
    
    async def get(self, uID: int) -> List[int]:
        """获取未来7天的宝箱等级"""
        if not await self._grab_stat(uID):
            return self.err("Chest stat not found")
        if not self._calc_weekly_tirers():
            return self.err("Chest tirers not found")
        return self.ok(data=self.tirers_weekly)

    async def _grab_stat(self, uID: int) -> bool:
        try:
            with UserChestStatData(uID) as ucs:
                # 判断结果是否存在
                if not ucs:
                    # 如果不存在，创建新记录
                    ucsc = ucs.create(uID)
                    # 新纪录转换为字典格式
                    ucs = ucsc.to_dict()
                self.count_continued = ucs.get("count_continued", 0)
                self.count_claimed = ucs.get("count_claimed", 0)
                self.time_claimed_last = ucs.get("time_claimed_last")
                self.time_updated = ucs.get("time_updated")
                
                # 在 user_data 中判断是否有今天的记录
                if TimeUtils.is_today(self.user_data[-1].get("time_claimed")):
                    self.is_claimed_today = True
                else:
                    self.is_claimed_today = False

                # 把 user_chest_stat 传递到 data 里，在 data 里完成更新或新增记录
                with ChestData(self.data.db) as d:
                    d.update_user_chest_stat(uID, ucs)


                return True
        except Exception:
            return False

    def _calc_weekly_tirers(self) -> bool:
        """获取未来一周的宝箱等级  含今天共7天"""
        try:
            for day_offset in range(7):
                rule_index = self.count_continued + day_offset
                # 超过28天后循环 (0-27是28天，从第29天开始循环最后7天)
                if rule_index >= 28:
                    rule_index = 21 + (rule_index - 21) % 7  # 从第22天开始循环
                self.tirers_weekly.append(self.TIRER_RULES[rule_index])
            return True
        except Exception:
            return False

    async def claim(self, uID: int) -> dict:
        """领取今日宝箱"""
        # 重新获取用户宝箱状态记录，确保数据是最新的
        if not await self._grab_stat(uID):
            return self.err("Chest stat not found")

        # 1. 检查是否已经领取
        if self.is_claimed_today:
            return self.err("Already claimed today")
        
        # 2. 检查未来一周的宝箱等级
        if not self._calc_weekly_tirers():
            return self.err("Chest tirers not found")

        # 3. 生成奖励内容
        self.rewards = self._calc_reward(self.tirers_weekly[0])
        
        # 4. 更新记录
        await self._make_claimed(self.today_chest['cID'], self.rewards)
        # 更新 UserChestStat
        self.count_continued += 1
        self.count_claimed += 1
        self.time_claimed_last = TimeUtils.now()
        self.time_updated = TimeUtils.now()
        with UserChestStatData(uID) as ucs:
            ucs.update(uID, self.count_continued, self.count_claimed, self.time_claimed_last, self.time_updated)
        self.is_claimed_today = True

        return {"success": True, "rewards": self.rewards}

    def _is_claimed_today(self, uID: int) -> bool:
        """检查用户是否已经领取今日宝箱"""
        # 先获得最后一次打开宝箱的记录
        if not self.time_claimed_last or not TimeUtils.is_today(self.time_claimed_last):
            return False
        return True
        
    def _calc_reward(self, tirer: int) -> [float]:
        """根据宝箱等级计算奖励内容"""
        rewards = []
        value_total = self._calc_biased_normal(tirer)
        value_shards = value_total * self.RATE_VALUE_SHARDS
        value_points = value_total - self.RATE_VALUE_SHARDS
        # 确保碎片数量在合理范围内
        # 第一种碎片占比略高
        value_shards_0 = value_shards * random.uniform(0.618, 1.0)
        value_shards_1 = value_shards - value_shards_0
        rewards[0] = value_total
        rewards[1] = int(value_points)
        rewards[2] = int(value_shards_0)
        rewards[3] = int(value_shards_1)
        return rewards

    def _calc_biased_normal(self, tirer: int) -> float:
        """
        生成偏置正态分布
        确保5%概率略低于0.1 但不会太低
        确保5%概率略高于 10 但不会太高
        """
        # 生成正态分布值
        value = random.gauss(self.VALUE_REFER, self.STD_DEV)
        
        # 如果值过低，使用偏置调整
        if value < self.VALUE_REFER_THRESHOLD_MIN:
            # 有较小的概率允许超出阈值，但使用偏置使其不会太低
            if random.random() < self.PROBABILITY_EXTREMUM:
                # 在范围内随机
                value = value * random.uniform(self.RATE_VALUE_EXTREMUM, 1.0)
            else:
                # 其他情况重新生成或调整到安全值
                value = max(self.VALUE_REFER_THRESHOLD_MIN, value)
        elif value > self.VALUE_REFER_THRESHOLD_MAX:
            # 有较小的概率允许超出阈值，但使用偏置使其不会太高
            if random.random() < self.PROBABILITY_EXTREMUM:
                # 在范围内随机
                value = value * random.uniform(1.0, 1/self.RATE_VALUE_EXTREMUM)
            else:
                # 其他情况重新生成或调整到安全值
                value = min(self.VALUE_REFER_THRESHOLD_MAX, value)
        return value
    
    def _make_claimed(self, cID: int, rewards: [float]):
        """更新宝箱记录为已领取"""
        with ChestData() as c:
            c.update_claimed(cID, rewards)
            
class GiftCore(Core):
    def __init__(self, data: Optional[Data] = None) -> None:
        self.data = GiftData(data)

    def to_dict(self, g: Gift, stored_count: int, claimed_count: int):
        return {
            "gID": g.gID,
            "uID": g.uID,
            "gslID": g.gslID,
            "gift_name": g.gift_name,
            "gift_description": g.gift_description,
            "points": g.points,
            "stored_count": stored_count,
            "claimed_count": claimed_count,
            "time_created": g.time_created.strftime("%Y-%m-%d %H:%M:%S") if g.time_created else None,
        }

    async def get(self, gID: int = 0, uID: int = 0):
        with self.data as r:
            if gID:
                g = r.get_gift(gID)
                if not g:
                    return self.err("Gift not found")
                giftlist_data = GiftData()
                stored_count = giftlist_data.count_gift_stores(g.gID)
                claimed_count = giftlist_data.count_gift_claims(g.gID)
                return self.ok(data=self.to_dict(g, stored_count, claimed_count))
            elif uID:
                gifts = r.get_gifts(uID=uID)
                return self.ok(data=[self.to_dict(g, 0, 0) for g in gifts])
            else:
                return self.err("gID or uID is required")

    def claim(self, gID: int=0, uID: int = 0):
        with self.data as r:
            if not gID or not uID:
                return self.err("gID or uID is required")
            g = r.get_gift(gID)
            if not g:
                return self.err("Gift not found")
            # 检查用户是否有足够的积分
            user = r.get_user(uID)
            if not user or user.points < g.points:
                return self.err("Not enough points")
            # 检查礼物是否已被领取
            if r.is_gift_claimed(gID):
                return self.err("Gift already claimed")
            # 领取礼物
            r.claim_gift(gID, uID)
            return self.ok(message="Gift claimed successfully")

    def active(self, gID: int=0, uID: int = 0):
        with self.data as r:
            if not gID or not uID:
                return self.err("gID or uID is required")
            g = r.get_gift(gID)
            if not g:
                return self.err("Gift not found")
            # 检查用户是否有足够的积分
            user = r.get_user(uID)
            if not user or user.points < g.points:
                return self.err("Not enough points")
            # 检查礼物是否已被领取
            if r.is_gift_claimed(gID):
                return self.err("Gift already claimed")
            # 领取礼物
            r.claim_gift(gID, uID)
            return self.ok(message="Gift claimed successfully")

    async def get_detail(self, gID: int):
        with self.data as r:
            g = r.get_gift(gID)
            if not g:
                return self.err("Gift not found")
            giftlist_data = GiftListData()
            stored_count = giftlist_data.count_gift_stores(g.gID)
            claimed_count = giftlist_data.count_gift_claims(g.gID)
            return self.ok(data=self.to_dict(g, stored_count, claimed_count))

    async def list_by_user(self, uID: int, skip: int = 0, limit: int = 100):
        with self.data as r:
            items = r.list_items("gift", skip=skip, limit=limit, filters={"uID": uID})
            return self.ok(data=[i.to_dict() for i in items])

class JourneyCore(Core):
    def __init__(self, data: Data):
        self.data = JourneyData()

    async def get(self, jID: int):
        with self.data as d:
            j = await d.get_journey(jID)
            if not j:
                return self.err("Journey not found")
            return self.ok(data=self.to_dict(j))

    def claim(self, jID: int, uID: int):
        with self.data as d:
            # 加载旅程
            l = d.load(jID)
            # 检查旅程是否存在
            if not l:
                return self.err("Journey not found")
            # 检查用户是否是旅程的所有者
            elif d.uID != uID:
                return self.err("Forbidden: not owner")
            # 检查是否已领取
            elif d.is_claimed:
                return self.err("Journey already claimed")
            c = d.claim(jID)
            if not c:
                return self.err("Journey not found")
            return self.ok(data=self.to_dict(j))

    def submit(self, jID: int, info_input: str):
        with self.data as r:
            j2 = r.update_info(jID, info_input)
            if not j2:
                return self.err("Journey not found")
            return self.ok(data=j2.to_dict())


    def check(self, jID: int, uID: int):
        with self.data as r:
            j = r.get_journey(jID)
            if not j:
                return self.err("Journey not found")
            # 检查用户是否是旅程的所有者
            elif d.uID != uID:
                return self.err("Forbidden: not owner")
            # 检查是否已领取
            elif d.is_claimed:
                return self.err("Journey already claimed")
            return self.ok(data=self.to_dict(j))

    async def list_by_user(self, uID: int, skip: int = 0, limit: int = 100):
        with self.data as r:
            items = r.list_journeys_by_user(uID=uID, skip=skip, limit=limit)
            return self.ok(data=[j.to_dict() for j in items])

class TaskCore(Core):
    def __init__(self, data: Data):
        self.data = TaskData(data)

    async def list_all(self, skip: int = 0, limit: int = 100):
        with self.data as r:
            items = r.list_tasks(skip=skip, limit=limit)
            return self.ok(data=[t.to_dict() for t in items])

class UserCore(Core):
    def __init__(self, data: Data):
        self.data = UserData()

    async def get(self, uID: int = 0):
        with self.data as r:
            if uID:
                u = r.get_user_by_id(uID)
                if not u:
                    return self.err("User not found")
                return self.ok(data=u.to_dict())
            else:
                return self.err("uID is required")

    async def list_all(self, skip: int = 0, limit: int = 100):
        with self.data as r:
            items = r.list_users(skip=skip, limit=limit)
            return self.ok(data=[u.to_dict() for u in items])
