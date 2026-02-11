#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from math import e
from plistlib import UID
from fastapi import APIRouter
from fastapi import Body, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from typing import Annotated, List, Optional, Dict, Any
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from dataclasses import dataclass
from .core import Core, BrandCore, CalendarCore, ChestCore, GiftCore, JourneyCore, TaskCore, UserCore
import http.server
import inspect
import asyncio

router = APIRouter(prefix="/api", tags=["Common"])

core = Core()

@dataclass
class APIResponse:
    ok: bool
    status_code: int = 200
    message: Optional[str] = None
    data: Optional[Any] = None
    error: Optional[str] = None

class GiftRecordCreate(BaseModel):
    bID: int
    uID: Optional[int] = None
    time_actived: Optional[str] = None

class GiftRecordUpdate(BaseModel):
    uID: Optional[int] = None
    time_actived: Optional[str] = None

class GiftListCreate(BaseModel):
    bID: int
    count: Optional[int] = 1
    uID: Optional[int] = None
    uIDs: Optional[List[int]] = None

class GiftListUpdate(BaseModel):
    uID: Optional[int] = None
    time_actived: Optional[str] = None

# ========== Auth helpers (inlined from auth_utils.py) ==========

# 加载环境变量（固定加载backend目录下的.env）
BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))

# 认证配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ADMIN_EVM_ADDRESSES = {a.strip().lower() for a in os.getenv("ADMIN_EVM_ADDRESSES", "").split(",") if a.strip()}

# OAuth2配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uID: str = payload.get("sub")
        evm_address: str = payload.get("evm")
        if uID is None:
            raise credentials_exception
        token_data = {
            "uID": uID,
            "evm": evm_address,
        }
    except JWTError:
        raise credentials_exception
    return token_data

def get_current_admin(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    try:
        uid = int(current_user.get("uID"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity",
        )
    if not core.is_admin(uid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return {"uID": str(uid), "evm": current_user.get("evm")}

# 统一入口：所有 /api/* 由 _handle_api_request 处理
@router.api_route("/{full_path:path}", methods=["GET", "POST"], summary="Unified API entry")
async def unified_entry(full_path: str, request: Request, payload: Optional[Dict[str, Any]] = Body(None)):
    try:
        boundary = Boundary()
        qp: Dict[str, List[str]] = {}
        for key in request.query_params.keys():
            qp[key] = request.query_params.getlist(key)
        api_path = f"/api/{full_path}" if full_path else "/api"
        method = request.method.upper()
        auth = request.headers.get("Authorization") or ""
        token = None
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
        actor_uid = None
        evm_address = None
        if token:
            try:
                payload_decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                sub = payload_decoded.get("sub")
                evm_address = payload_decoded.get("evm")
                if sub is not None:
                    try:
                        actor_uid = int(sub)
                    except Exception:
                        # sub 无法转换为整数（可能是旧版 token），尝试用 evm 地址查找用户
                        actor_uid = None
                
                # 如果 actor_uid 为 None 但有 evm 地址，尝试查找用户
                if actor_uid is None and evm_address:
                    try:
                        with Core().data as r:
                            user_row = r.users.get_by_evm(evm_address.lower())
                            if user_row:
                                actor_uid = int(user_row["uID"])
                    except Exception:
                        actor_uid = None
            except Exception:
                actor_uid = None
        payload = payload or {}
        if actor_uid is not None:
            payload["actor_uid"] = actor_uid
        elif method == 'POST' and api_path.startswith('/api/journey/'):
            # 对于 journey 相关的 POST 请求，必须提供有效的用户ID
            return JSONResponse(status_code=401, content={"success": False, "message": "Unauthorized: Please login again"})
        res = await boundary._handle_api_request(api_path, qp, method, payload)
        if res is None:
            return JSONResponse(status_code=404, content={"success": False, "message": "Not found"})
        content = {
            "success": res.ok,
            "message": res.message if res.message else (res.error if res.error else None),
            "data": res.data,
        }
        content = {k: v for k, v in content.items() if v is not None}
        return JSONResponse(status_code=res.status_code, content=content)
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})

# 移除显式的装饰器端点，统一由 unified_entry -> _handle_api_request 分发



class Boundary(http.server.SimpleHTTPRequestHandler):
    core: Core
    brand_core: BrandCore
    chest_core: ChestCore
    gift_core: GiftCore
    journey_core: JourneyCore
    task_core: TaskCore
    user_core: UserCore

    def __init__(self, *args, **kwargs):
        self.core = Core()
        data = self.core.data
        db = data.db
        self.brand_core = BrandCore(db)
        self.calendar_core = CalendarCore(db)
        self.chest_core = ChestCore(db)
        self.gift_core = GiftCore(db)
        self.journey_core = JourneyCore(db)
        self.task_core = TaskCore(db)
        self.user_core = UserCore(db)
        # 仅在作为 http.server 处理器时才调用父类初始化
        if args or kwargs:
            super().__init__(*args, **kwargs)

    async def _handle_api_request(self, path: str, query_params: Dict[str, List[str]], method: str, payload: Dict[str, Any] = None) -> APIResponse:
        try:
            # ====== 通用参数 ======
            # id: 宝箱ID、礼品ID、任务ID等
            id = self._format_int(query_params, 'id') or None
            # uid: 用户ID
            uid = self._format_int(query_params, 'uid') or None
            is_active = self._format_bool(query_params, 'is_active') or False
            skip = self._format_int(query_params, 'skip') or 0
            limit = self._format_int(query_params, 'limit') or 100
            actor_uid = None
            if payload and isinstance(payload, dict):
                au = payload.get('actor_uid')
                try:
                    actor_uid = int(au) if au is not None else None
                except Exception:
                    actor_uid = None
            if method == 'GET':
                if uid is None:
                    uid = actor_uid
            elif method == 'POST':
                uid = actor_uid

            if method == 'GET':
                if path == "/api/info":
                    return self._response({"name": "Jinli Club API", "description": "Unified router", "version": "1.0.0"})
                # Order: Brand Calendar Chest Gift Journey Task User 端口的顺序
                # ====== Brand endpoints ======
                # ====== 品牌相关的路由端点 ======
                if path == "/api/brand/all":
                    return self._response(await self.brand_core.get_all(skip=skip, limit=limit))
                # ====== Calendar endpoints ======
                # ====== 日历相关的路由端点 ======
                if path == "/api/calendar":
                    return self._response(await self.calendar_core.get())
                # ====== Chest endpoints ======
                # ====== 宝箱相关的路由端点 ======
                if path == "/api/chest":
                    return self._response(await self.chest_core.get(uID=uid))
                # Admin authority 管理员权限
                if path == "/api/chest/all":
                    return self._response(await self.chest_core.get_all(uID=uid, is_active=is_active))
                # ====== Gift endpoints ======
                # ====== 礼品相关的路由端点 ======
                # User authority 用户本人权限
                if path == "/api/gift":
                    return self._response(await self.gift_core.list_by_user(uID=uid, skip=skip, limit=limit))
                # Admin authority 管理员权限
                if path == "/api/gift/all":
                    return self._response(await self.gift_core.get_all(uID=uid, skip=skip, limit=limit))
                # ====== Task endpoints ======
                # ====== 任务相关的路由端点 ======
                if path == "/api/task/all":
                    return self._response(await self.task_core.list_all(skip=skip, limit=limit))
                # ====== Journey endpoints ======
                # ====== 行程相关的路由端点 ======
                if path == "/api/journey":
                    return self._response(await self.journey_core.list_by_user(uID=uid, skip=skip, limit=limit))
                # ====== User endpoints ======
                # ====== 用户相关的路由端点 ======
                # User authority 用户本人权限
                if path == "/api/user":
                    if uid is None:
                        return APIResponse(ok=False, status_code=401, error='Unauthorized')
                    return self._response(await self.user_core.get(uID=uid))
                # Admin authority 管理员权限
                if path == "/api/user/all":
                    if actor_uid is None or not core.is_admin(actor_uid):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    return self._response(await self.user_core.list_all(skip=skip, limit=limit))
            elif method == 'POST':
                # ====== Auth endpoints ======
                # ====== 认证相关的路由端点 ======
                if path == "/api/auth/login":
                    evm_address = payload.get('evm_address') if payload else None
                    if evm_address:
                        # 查询或创建用户，获取数据库中的真实 uID
                        result = await self.core.auth_find_or_create_by_evm(evm_address.lower())
                        if result.get('success'):
                            user_data = result.get('data', {})
                            uID = user_data.get('uID')
                            return self._response({
                                "success": True,
                                "uID": uID,
                                "EVM": evm_address,
                                "access_token": create_access_token({"sub": str(uID), "evm": evm_address}),
                                "token_type": "bearer"
                            })
                        else:
                            return APIResponse(ok=False, status_code=500, error='Failed to create or find user')
                    else:
                        return APIResponse(ok=False, status_code=401, error='Unauthorized: evm_address required')
                # ====== Chest endpoints ======
                # ====== 宝箱相关的路由端点 ======
                if path == "/api/chest/claim":
                    return self._response(self.chest_core.claim(cID=id, uID=uid))
                # ====== Gift endpoints ======
                # ====== 礼品相关的路由端点 ======
                if path == "/api/gift/claim":
                    return self._response(self.gift_core.claim(gID=id, uID=uid))
                if path == "/api/gift/active":
                    return self._response(self.gift_core.active(gID=id, uID=uid))
                # Admin authority 管理员权限
                if path == "/api/gift/add":
                    return self._response(self.gift_core.create(gift_name=str(id)))
                if path == "/api/gift/renew":
                    return self._response(self.gift_core.update(gID=id))
                # ====== Journey endpoints ======
                # ====== 行程相关的路由端点 ======
                if path == "/api/journey/submit":
                    return self._response(self.journey_core.submit(jID=id, uID=uid, submission_info=payload.get('submission_info')))
                if path == "/api/journey/claim":
                    return self._response(self.journey_core.claim(jID=id, uID=uid))
                # ====== TaskList endpoints ======
                # ====== 任务清单相关的路由端点 ======
                # 提交任务信息（用户填写完成信息后提交）
                if path.startswith("/api/journey/") and path.endswith("/submit"):
                    # 从路径中提取 jID
                    try:
                        parts = path.split("/")
                        jID = int(parts[3])  # /api/journey/{jID}/submit
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error='Invalid jID')
                    info_input = payload.get('info_input') if payload else None
                    if not info_input:
                        return APIResponse(ok=False, status_code=400, error='info_input is required')
                    return self._response(await self.core.submit_task_info(jID=jID, uID=uid, info_input=info_input))
                # Admin authority 管理员权限
                if path == "/api/journey/check":
                    return self._response(await self.journey_core.check(jID=id, uID=uid))
            # 未匹配到任何已知端点
            return APIResponse(ok=False, status_code=404, error='Not found')
        except Exception as e:
            return APIResponse(ok=False, status_code=500, error=str(e))

    def _response(self, data: Optional[Any] = None) -> APIResponse:
        try:
            if data is None:
                return APIResponse(ok=False, status_code=404, error='Not found')
            if isinstance(data, dict) and 'success' in data:
                ok = bool(data.get('success'))
                msg = data.get('message') or None
                inner = data.get('data')
                return APIResponse(ok=ok, status_code=200, message=msg, data=inner)
            if isinstance(data, (list, tuple)):
                return APIResponse(ok=True, status_code=200, data=list(data))
            return APIResponse(ok=True, status_code=200, data=data)
        except Exception as e:
            return APIResponse(ok=False, status_code=500, error=str(e))

    def _format_int(self, params: Dict[str, List[str]], key: str) -> Optional[int]:
        try:
            vals = params.get(key)
            if not vals:
                return None
            return int(vals[0])
        except Exception:
            return None

    def _format_bool(self, params: Dict[str, List[str]], key: str) -> Optional[bool]:
        try:
            vals = params.get(key)
            if not vals:
                return None
            v = vals[0].strip().lower()
            if v in ('1', 'true', 'yes'):
                return True
            if v in ('0', 'false', 'no'):
                return False
            return None
        except Exception:
            return None
