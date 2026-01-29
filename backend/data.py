#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据仓库（Repo）：聚合 DAO，向 Service 提供统一的数据接口。

本版本最小化实现品牌与礼品列表，以支持 /api/brand/all 与 /api/gift/all。
"""

from __future__ import annotations

from typing import Optional, List
from datetime import datetime
from .foundation import SessionLocal
from .entity import Entity, BrandEntity, CalendarEntity, ChestEntity, JourneyEntity, GiftEntity, TaskEntity, UserEntity
from .data_model import DataModel, Brand, Chest, Gift, Journey, Task, User

class Data:
    def __init__(self, db: Optional[object] = None) -> None:
        self._external = db is not None
        self.db = db or SessionLocal()
        self.users = UserEntity(self.db)
        self.brands = BrandEntity(self.db)
        self.gifts = GiftEntity(self.db)
        self.tasks = TaskEntity(self.db)
        self.journeys = JourneyEntity(self.db)
        self.chests = ChestEntity(self.db)

    def __enter__(self) -> "Data":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc:
                self.db.rollback()
        finally:
            if not self._external:
                self.db.close()

    def list_items(self, table: str, skip: int = 0, limit: int = 100, filters: Optional[dict] = None) -> List[DataModel]:
        try:
            e = Entity()
            e.name = table
            rows = e.list(skip=skip, limit=limit, filters=filters)
            print(f"列出 {table} {skip} {limit} {len(rows)} 条")
            return [DataModel.of(table, r) for r in rows]
        except Exception as e:
            print(e)
            return []

    # Symbols
    def list_symbols(self) -> list:
        with SymbolEntity(self.db) as se:
            return se.list()

    def get_symbol(self, sid: int) -> Optional[dict]:
        with SymbolEntity(self.db) as se:
            return se.get(sid)

    # Calendar
    def list_calendar_events(self) -> list:
        cal = CalendarEntity()
        return cal.list()

    # Users
    def list_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        rows = self.users.list(skip=skip, limit=limit)
        return [User.from_row(r) for r in rows]

    def get_user_by_id(self, uID: int) -> Optional[User]:
        row = self.users.get_by_id(uID)
        return User.from_row(row) if row else None

    def get_user_by_id_raw(self, uID: int) -> Optional[dict]:
        return self.users.get_by_id(int(uID))

    def update_user(self, uID: int, *, bio: Optional[str] = None, is_admin: Optional[bool] = None) -> Optional[User]:
        row = self.users.update_user(uID=uID, bio=bio, is_admin=is_admin)
        return User.from_row(row) if row else None

    def find_or_create_user_by_evm(self, evm_norm: str) -> Optional[dict]:
        return self.users.find_or_create_by_evm(evm_norm)

    # Brand
    def list_brands(self, skip: int = 0, limit: int = 100) -> List[Brand]:
        rows = self.brands.list(skip=skip, limit=limit)
        return [Brand.from_row(r) for r in rows]

    def get_brand(self, bID: int) -> Optional[Brand]:
        row = self.brands.get(bID)
        return Brand.from_row(row) if row else None

    # Gift
    def list_gifts(self, skip: int = 0, limit: int = 200) -> List[Gift]:
        rows = self.gifts.list(skip=skip, limit=limit)
        return [Gift.from_row(r) for r in rows]

    def count_gift_stores_by_brand(self, bID: int) -> int:
        return self.gifts.count_stores_by_brand(bID)

    def count_gift_claims_by_brand(self, bID: int) -> int:
        return self.gifts.count_claims_by_brand(bID)

    def get_gift(self, gID: int) -> Optional[Gift]:
        row = self.gifts.get(gID)
        return Gift.from_row(row) if row else None

    def create_gift(self, bID: int, uID: Optional[int] = None, time_actived: Optional[datetime] = None) -> Gift:
        row = self.gifts.create(bID=bID, uID=uID, time_actived=time_actived)
        return Gift.from_row(row)

    def update_gift(self, gID: int, *, uID: Optional[int] = None, time_actived: Optional[datetime] = None) -> Optional[Gift]:
        row = self.gifts.update(gID, uID=uID, time_actived=time_actived)
        return Gift.from_row(row) if row else None

    def delete_gift(self, gID: int) -> bool:
        return self.gifts.delete(gID)

    def get_or_create_pool_user(self) -> int:
        return self.users.get_or_create_pool_user()

    def create_gifts_bulk(self, bID: int, count: int, uID: Optional[int], uIDs: Optional[List[int]]) -> List[int]:
        created_ids: List[int] = []
        def _create_one(_uid: int):
            g = self.create_gift(bID=bID, uID=int(_uid))
            created_ids.append(int(g.gID))
        if uIDs:
            for uid_ in uIDs:
                _create_one(uid_)
        elif uID is not None:
            for _ in range(count):
                _create_one(uID)
        else:
            pool_uid = self.get_or_create_pool_user()
            for _ in range(count):
                _create_one(pool_uid)
        return created_ids

    # Task
    def list_tasks(self, skip: int = 0, limit: int = 100) -> List[Task]:
        rows = self.tasks.list(skip=skip, limit=limit)
        return [Task.from_row(r) for r in rows]

    def get_task(self, tID: int) -> Optional[Task]:
        row = self.tasks.get(tID)
        return Task.from_row(row) if row else None

    def count_task_participants(self, tID: int) -> int:
        return self.tasks.count_participants(tID)

    # Journey
    def list_journeys_by_user(self, uID: int, skip: int = 0, limit: int = 100) -> List[Journey]:
        rows = self.journeys.list_by_user(uID=uID, skip=skip, limit=limit)
        return [Journey.from_row(r) for r in rows]

    def list_journeys_by_task(self, tID: int, skip: int = 0, limit: int = 100) -> List[Journey]:
        rows = self.journeys.list_by_task(tID=tID, skip=skip, limit=limit)
        return [Journey.from_row(r) for r in rows]

    def get_journey(self, jID: int) -> Optional[Journey]:
        row = self.journeys.get(jID)
        return Journey.from_row(row) if row else None

    def create_journey(self, uID: int, tID: int, info_input: Optional[str] = None) -> Journey:
        row = self.journeys.create(uID=uID, tID=tID, info_input=info_input)
        return Journey.from_row(row)

    def mark_journey_checked(self, jID: int) -> Optional[Journey]:
        row = self.journeys.mark_checked(jID)
        return Journey.from_row(row) if row else None

    def claim_journey(self, jID: int, points_claimed: int = 0) -> Optional[Journey]:
        row = self.journeys.claim(jID, points_claimed)
        return Journey.from_row(row) if row else None



    def list_all_journeys(self, skip: int = 0, limit: int = 100) -> List[Journey]:
        rows = self.journeys.list_all(skip=skip, limit=limit)
        return [Journey.from_row(r) for r in rows]


class BrandData(Data):
    def list(self, skip: int = 0, limit: int = 100) -> List[Brand]:
        rows = self.brands.list(skip=skip, limit=limit)
        return [Brand.from_row(r) for r in rows]

    def get(self, bID: int) -> Optional[Brand]:
        row = self.brands.get(bID)
        return Brand.from_row(row) if row else None

class CalendarData(Data):
    def list(self) -> List[dict]:
        cal = CalendarEntity()
        return cal.list()

    async def list_async(self) -> List[dict]:
        cal = CalendarEntity()
        return await cal.list_async()

class ChestData(Data):
    def get_tirer_passed(self, uID: int) -> List[int]:
        rows = self.chests.list_by_user(uID, is_active=False)
        return [Chest.from_row(r).tirer for r in rows]

    def get_tirer_future(self, uID: int) -> List[int]:
        rows = self.chests.list_by_user(uID, is_active=True)
        return [Chest.from_row(r).tirer for r in rows]

class GiftData(Data):
    def count_stores_by_brand(self, bID: int) -> int:
        return self.gifts.count_stores_by_brand(bID)

    def count_claims_by_brand(self, bID: int) -> int:
        return self.gifts.count_claims_by_brand(bID)

class JourneyData(Data):
    def load(self, jID: int) -> Optional[Journey]:
        row = self.journeys.get(jID)
        return Journey.from_row(row) if row else None

    def claim(self, jID: int) -> Optional[Journey]:
        row = self.journeys.claim(jID)
        return Journey.from_row(row) if row else None

    def list_calendar_events(self) -> list:
        cal = CalendarEntity()
        return cal.list()

    def list_symbols(self) -> list:
        with SymbolEntity(self.db) as se:
            return se.list()

    def get_symbol(self, sid: int) -> Optional[dict]:
        with SymbolEntity(self.db) as se:
            return se.get(sid)

    def find_or_create_user_by_evm(self, evm_norm: str) -> Optional[dict]:
        with UserEntity(self.db) as ue:
            return ue.find_or_create_by_evm(evm_norm)

    def get_user_by_id_raw(self, uID: int) -> Optional[dict]:
        with UserEntity(self.db) as ue:
            return ue.get_by_id(int(uID))

    def update_info(self, jID: int, info_input: str) -> Optional[Journey]:
        row = self.journeys.update_info_input(jID, info_input)
        return Journey.from_row(row) if row else None

class TaskData(Data):
    def list(self, skip: int = 0, limit: int = 100) -> List[Task]:
        rows = self.tasks.list(skip=skip, limit=limit)
        return [Task.from_row(r) for r in rows]

    def get(self, tID: int) -> Optional[Task]:
        row = self.tasks.get(tID)
        return Task.from_row(row) if row else None

class UserData(Data):
    pass

class UserChestStatData(Data):
    def get(self, uID: int) -> Optional[dict]:
        with UserChestStatEntity(self.db) as ucs:
            return ucs.get(uID)