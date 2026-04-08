#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据仓库（Repo）：聚合 DAO，向 Service 提供统一的数据接口。

本版本最小化实现品牌与礼品列表，以支持 /api/brand/all 与 /api/gift/all。
"""

from __future__ import annotations

from typing import Optional, List
from datetime import datetime
from .foundation import SessionLocal, Foundation
from .entity import (
    Entity,
    BrandEntity,
    CalendarEntity,
    ChestEntity,
    JourneyEntity,
    GiftEntity,
    OrderEntity,
    ShardEntity,
    SymbolEntity,
    TaskEntity,
    UserEntity,
)
from .data_model import (
    DataModel,
    Brand,
    Chest,
    Gift,
    Journey,
    Shard,
    ShardOrder,
    ShardTrade,
    ShardTransfer,
    Task,
    User,
)

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
        self.shards = ShardEntity(self.db)
        self.orders = OrderEntity(self.db)

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

    def create_brand(self, **fields) -> Optional[Brand]:
        row = self.brands.create(**fields)
        return Brand.from_row(row) if row else None

    def update_brand(self, bID: int, **fields) -> Optional[Brand]:
        row = self.brands.update(bID, **fields)
        return Brand.from_row(row) if row else None

    def delete_brand(self, bID: int) -> bool:
        return self.brands.delete(bID)

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

    def create_task(self, **fields) -> Optional[Task]:
        row = self.tasks.create_task(**fields)
        return Task.from_row(row) if row else None

    def update_task(self, tID: int, **fields) -> Optional[Task]:
        row = self.tasks.update_task(tID, **fields)
        return Task.from_row(row) if row else None

    def delete_task(self, tID: int) -> bool:
        return self.tasks.delete_task(tID)

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

    def list_pending_verification_journeys(self, skip: int = 0, limit: int = 100) -> List[Journey]:
        rows = self.journeys.list_pending_verification(skip=skip, limit=limit)
        return [Journey.from_row(r) for r in rows]

    def count_pending_verification_journeys(self) -> int:
        return self.journeys.count_pending_verification()

    def reject_journey_submission(self, jID: int) -> Optional[Journey]:
        row = self.journeys.reject_submission(jID)
        return Journey.from_row(row) if row else None


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

    def find_user_by_evm(self, evm_norm: str) -> Optional[dict]:
        with UserEntity(self.db) as ue:
            return ue.find_by_evm(evm_norm)

    def find_user_by_email(self, email: str) -> Optional[dict]:
        with UserEntity(self.db) as ue:
            return ue.find_by_email(email)

    def create_user_with_email_and_evm(self, email: str, evm_norm: str) -> Optional[dict]:
        with UserEntity(self.db) as ue:
            return ue.create_with_email_and_evm(email, evm_norm)

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


class ShardData(Data):
    def get_holdings(self, uID: int) -> List[Shard]:
        rows = self.shards.get_by_user(uID)
        return [Shard.from_row(r) for r in rows]

    def get_holding(self, uID: int, bID: int) -> Optional[Shard]:
        row = self.shards.get_by_user_and_brand(uID, bID)
        return Shard.from_row(row) if row else None

    def earn(self, uID: int, bID: int, volume: int, reason: str) -> Optional[Shard]:
        """系统发放 shard（宝箱/任务），reason: 'chest' | 'task'"""
        row = self.shards.upsert(uID, bID, volume)
        self.shards.add_transfer(bID, from_uID=None, to_uID=uID, volume=volume, reason=reason)
        return Shard.from_row(row) if row else None

    def redeem(self, uID: int, bID: int, volume: int, system_uID: int) -> Optional[Shard]:
        """用户兑换 gift：扣减持仓，转入系统账户"""
        row = self.shards.upsert(uID, bID, -volume)
        self.shards.add_transfer(bID, from_uID=uID, to_uID=system_uID, volume=volume, reason="redeem")
        return Shard.from_row(row) if row else None

    def list_transfers(self, uID: int, skip: int = 0, limit: int = 100) -> List[ShardTransfer]:
        rows = self.shards.list_transfers(uID, skip=skip, limit=limit)
        return [ShardTransfer.from_row(r) for r in rows]


class OrderData(Data):
    def _ensure_asset(self, uID: int):
        asset = self.users.get_asset(int(uID))
        return asset or self.users.upsert_asset(int(uID), 0)

    def _change_points(self, uID: int, delta: int) -> None:
        self._ensure_asset(uID)
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        sql = Foundation.text(
            """
            UPDATE asset
            SET points = points + :delta, time_updated = :now
            WHERE uID = :uID
            """
        )
        Foundation.exec(self.db, sql, {"delta": int(delta), "now": now, "uID": int(uID)})
        self.db.commit()

    def _refund_order(self, order_row: dict) -> None:
        remaining = int(order_row.get("volume_frozen") or 0)
        if remaining <= 0:
            return
        if order_row.get("side") == "sell":
            self.shards.upsert(int(order_row["uID"]), int(order_row["bID"]), remaining)
            return
        refund = int(order_row.get("price") or 0) * remaining
        if refund > 0:
            self._change_points(int(order_row["uID"]), refund)

    def place_order(self, uID: int, bID: int, side: str, price: int, volume: int) -> Optional[ShardOrder]:
        side = str(side or "").strip().lower()
        price = int(price)
        volume = int(volume)
        if side not in ("buy", "sell") or price <= 0 or volume <= 0:
            return None

        if side == "sell":
            holding = self.shards.get_by_user_and_brand(int(uID), int(bID))
            if not holding or int(holding.get("volume") or 0) < volume:
                return None
            self.shards.upsert(int(uID), int(bID), -volume)
        else:
            asset = self._ensure_asset(int(uID))
            reserve = price * volume
            if int(asset.points or 0) < reserve:
                return None
            self._change_points(int(uID), -reserve)

        row = self.orders.create_order(int(uID), int(bID), side, price, volume)
        if not row:
            if side == "sell":
                self.shards.upsert(int(uID), int(bID), volume)
            else:
                self._change_points(int(uID), price * volume)
            return None

        self._match(int(bID))
        return self.get_order(int(row["oID"]))

    def _match(self, bID: int) -> None:
        buy_orders = self.orders.get_open_orders(int(bID), "buy", price_limit=None)
        for buy_o in buy_orders:
            remaining_buy = int(buy_o.get("volume_total") or 0) - int(buy_o.get("volume_filled") or 0)
            if remaining_buy <= 0:
                continue

            sell_orders = self.orders.get_open_orders(int(bID), "sell", price_limit=int(buy_o["price"]))
            for sell_o in sell_orders:
                if remaining_buy <= 0:
                    break

                remaining_sell = int(sell_o.get("volume_total") or 0) - int(sell_o.get("volume_filled") or 0)
                if remaining_sell <= 0:
                    continue

                trade_vol = min(remaining_buy, remaining_sell)
                trade_price = int(sell_o["price"])

                self.orders.update_order_fill(int(buy_o["oID"]), trade_vol)
                self.orders.update_order_fill(int(sell_o["oID"]), trade_vol)

                self.shards.upsert(int(buy_o["uID"]), int(bID), trade_vol)

                cost = trade_price * trade_vol
                self._change_points(int(sell_o["uID"]), cost)
                buy_limit_price = int(buy_o["price"])
                if buy_limit_price > trade_price:
                    self._change_points(int(buy_o["uID"]), (buy_limit_price - trade_price) * trade_vol)

                self.shards.add_transfer(
                    int(bID),
                    from_uID=int(sell_o["uID"]),
                    to_uID=int(buy_o["uID"]),
                    volume=trade_vol,
                    reason="transfer",
                )
                self.orders.create_trade(
                    int(bID),
                    int(buy_o["oID"]),
                    int(sell_o["oID"]),
                    int(buy_o["uID"]),
                    int(sell_o["uID"]),
                    trade_price,
                    trade_vol,
                )

                remaining_buy -= trade_vol
        self.db.commit()

    def cancel_order(self, oID: int, uID: int) -> bool:
        order_row = self.orders.get_order(int(oID))
        if not order_row or int(order_row.get("uID") or 0) != int(uID):
            return False
        if order_row.get("status") not in ("open", "partial"):
            return False
        if not self.orders.cancel_order(int(oID), int(uID)):
            return False
        self._refund_order(order_row)
        return True

    def cancel_all(self, uID: int, bID: Optional[int] = None) -> int:
        rows = self.orders.list_orders_by_user(int(uID), skip=0, limit=100000)
        open_orders = [
            row for row in rows
            if row.get("status") in ("open", "partial")
            and (bID is None or int(row.get("bID") or 0) == int(bID))
        ]
        count = self.orders.cancel_all_orders(int(uID), None if bID is None else int(bID))
        for row in open_orders:
            self._refund_order(row)
        return count

    def get_order(self, oID: int) -> Optional[ShardOrder]:
        row = self.orders.get_order(int(oID))
        return ShardOrder.from_row(row) if row else None

    def list_orders(self, uID: int, status: Optional[str] = None, skip: int = 0, limit: int = 50) -> List[ShardOrder]:
        rows = self.orders.list_orders_by_user(int(uID), status=status, skip=skip, limit=limit)
        return [ShardOrder.from_row(r) for r in rows]


class MarketData(Data):
    def get_orderbook(self, bID: int) -> dict:
        rows = self.orders.get_orderbook(int(bID))
        buy = [{"price": int(r["price"]), "volume": int(r["volume"])} for r in rows if r["side"] == "buy"]
        sell = [{"price": int(r["price"]), "volume": int(r["volume"])} for r in rows if r["side"] == "sell"]
        return {"buy": buy, "sell": sell}

    def list_trades(self, bID: int, limit: int = 50) -> List[ShardTrade]:
        rows = self.orders.list_trades(int(bID), int(limit))
        return [ShardTrade.from_row(r) for r in rows]
