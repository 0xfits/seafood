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
import secrets
from dotenv import load_dotenv
from pydantic import BaseModel
from dataclasses import dataclass
from .core import Core, BrandCore, CalendarCore, ChestCore, GiftCore, JourneyCore, MarketCore, OrderCore, ShardCore, TaskCore, UserCore
import http.server
import inspect
import asyncio

router = APIRouter(prefix="/api", tags=["Common"])

core = Core()

# ====== FastAPI 端点定义 ======

@router.get("/test/web3")
async def test_web3():
    """Test if web3 library is available"""
    try:
        from web3 import Web3
        
        return {
            "success": True,
            "message": "web3 library is available",
            "web3_version": Web3.__version__ if hasattr(Web3, '__version__') else "unknown"
        }
    except ImportError as e:
        return {
            "success": False,
            "error": f"web3 library not available: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error testing web3: {str(e)}"
        }

@router.get("/test/data")
async def test_data():
    """测试Data类方法"""
    try:
        print(f"[TEST] core type: {type(core)}")
        print(f"[TEST] core.data type: {type(core.data)}")
        print(f"[TEST] core.data class: {core.data.__class__}")
        print(f"[TEST] core.data module: {core.data.__class__.__module__}")
        
        # 获取所有方法
        all_methods = [m for m in dir(core.data) if not m.startswith('_')]
        find_methods = [m for m in all_methods if 'find' in m]
        
        print(f"[TEST] all methods: {all_methods}")
        print(f"[TEST] find methods: {find_methods}")
        
        # 检查具体方法
        has_find_user_by_evm = hasattr(core.data, 'find_user_by_evm')
        has_find_or_create_user_by_evm = hasattr(core.data, 'find_or_create_user_by_evm')
        
        print(f"[TEST] has_find_user_by_evm: {has_find_user_by_evm}")
        print(f"[TEST] has_find_or_create_user_by_evm: {has_find_or_create_user_by_evm}")
        
        return {
            "status": "ok",
            "core_type": str(type(core)),
            "data_type": str(type(core.data)),
            "data_class": core.data.__class__.__name__,
            "data_module": core.data.__class__.__module__,
            "all_methods": all_methods,
            "find_methods": find_methods,
            "has_find_user_by_evm": has_find_user_by_evm,
            "has_find_or_create_user_by_evm": has_find_or_create_user_by_evm
        }
            
    except Exception as e:
        print(f"[TEST] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@router.get("/api/user/stats")
async def get_user_stats():
    """获取用户统计信息"""
    try:
        print(f"[API] 获取用户统计信息")
        
        # 直接使用Entity获取用户统计
        from .entity import UserEntity
        
        with UserEntity(core.data.db) as ue:
            # 获取所有用户数量
            users = ue.list()
            user_count = len(users) if users else 0
            
            # 获取管理员数量
            admin_count = sum(1 for user in users if user.get('is_admin'))
            
            # 获取有资产的用户数量
            asset_count = 0
            total_points = 0
            for user in users:
                asset = ue.get_asset(user['uID'])
                if asset:
                    asset_count += 1
                    total_points += asset.points or 0
            
            return APIResponse(ok=True, status_code=200, data={
                "user_count": user_count,
                "admin_count": admin_count,
                "asset_count": asset_count,
                "total_points": total_points,
                "avg_points": total_points / asset_count if asset_count > 0 else 0
            })
                
    except Exception as e:
        print(f"[API] 获取用户统计异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return APIResponse(ok=False, status_code=500, error=f'获取用户统计失败: {str(e)}')

@router.get("/api/user/{uID}/details")
async def get_user_details(uID: int):
    """获取用户详细信息"""
    try:
        print(f"[API] 获取用户详细信息: {uID}")
        
        # 直接使用Entity获取用户信息
        from .entity import UserEntity
        
        with UserEntity(core.data.db) as ue:
            # 获取用户信息
            user = ue.get(uID)
            if not user:
                return APIResponse(ok=False, status_code=404, error='用户不存在')
            
            # 获取用户资产信息
            asset = ue.get_asset(uID)
            
            return APIResponse(ok=True, status_code=200, data={
                "uID": user["uID"],
                "EVM": user["EVM"],
                "bio": user.get("bio", ""),
                "is_admin": user.get("is_admin", False),
                "points": asset.points if asset else 0,
                "time_update": asset.time_update.isoformat() if asset and asset.time_update else None,
                "time_reg": user["time_reg"].isoformat() if user.get("time_reg") else None,
                "time_login_last": user["time_login_last"].isoformat() if user.get("time_login_last") else None
            })
                
    except Exception as e:
        print(f"[API] 获取用户详细信息异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return APIResponse(ok=False, status_code=500, error=f'获取用户详细信息失败: {str(e)}')

@router.get("/api/user/asset/{uID}")
async def get_user_asset(uID: int):
    """获取用户资产（积分）"""
    try:
        print(f"[API] 获取用户资产: uID={uID}")
        
        # 直接使用Entity获取用户资产
        from .entity import UserEntity
        
        with UserEntity(core.data.db) as ue:
            asset = ue.get_asset(uID)
            print(f"[API] 用户资产: {asset}")
            
            if asset:
                return APIResponse(ok=True, status_code=200, data={
                    "uID": asset.uID,
                    "points": asset.points or 0,
                    "time_update": asset.time_update.isoformat() if asset.time_update else None
                })
            else:
                # 如果没有资产记录，创建一个默认的
                new_asset = ue.upsert_asset(uID, 0)
                return APIResponse(ok=True, status_code=200, data={
                    "uID": new_asset.uID,
                    "points": new_asset.points or 0,
                    "time_update": new_asset.time_update.isoformat() if new_asset.time_update else None
                })
                
    except Exception as e:
        print(f"[API] 获取用户资产异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return APIResponse(ok=False, status_code=500, error=f'获取用户资产失败: {str(e)}')

@router.post("/admin/points/adjust")
async def adjust_user_points(request: Request):
    """管理员调整用户积分"""
    try:
        payload = await request.json()
        print(f"[API] 管理员调整积分: {payload}")
        
        uID = payload.get('uID')
        amount = payload.get('amount')
        reason = payload.get('reason')
        operator = payload.get('operator', 'admin')
        
        if not uID or amount is None or not reason:
            return APIResponse(ok=False, status_code=400, error='参数不完整')
        
        # 直接使用Entity调整积分
        from .entity import UserEntity
        
        with UserEntity(core.data.db) as ue:
            # 获取当前资产
            current_asset = ue.get_asset(uID)
            if not current_asset:
                return APIResponse(ok=False, status_code=404, error='用户资产记录不存在')
            
            # 调整积分
            new_asset = ue.upsert_asset(uID, amount)
            print(f"[API] 积分调整结果: {new_asset}")
            
            # 记录调整日志（可以扩展为积分历史表）
            adjustment_record = {
                "uID": uID,
                "amount": amount,
                "reason": reason,
                "operator": operator,
                "timestamp": datetime.utcnow().isoformat(),
                "previous_points": current_asset.points,
                "new_points": new_asset.points
            }
            print(f"[API] 积分调整记录: {adjustment_record}")
            
            return APIResponse(ok=True, status_code=200, data={
                "uID": uID,
                "amount": amount,
                "reason": reason,
                "operator": operator,
                "previous_points": current_asset.points,
                "new_points": new_asset.points,
                "timestamp": adjustment_record["timestamp"]
            })
                
    except Exception as e:
        print(f"[API] 积分调整异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return APIResponse(ok=False, status_code=500, error=f'积分调整失败: {str(e)}')

@router.post("/admin/fix/assets")
async def fix_user_assets():
    """为所有现有用户创建资产记录"""
    try:
        print(f"[API] 修复用户资产记录")
        
        from .entity import UserEntity
        
        with UserEntity(core.data.db) as ue:
            # 获取所有用户
            users = ue.list()
            print(f"[API] 找到 {len(users)} 个用户")
            
            fixed_count = 0
            for user in users:
                asset = ue.get_asset(user['uID'])
                if not asset:
                    # 为没有资产的用户创建默认资产
                    new_asset = ue.upsert_asset(user['uID'], 0)
                    print(f"[API] 为用户 {user['uID']} 创建资产记录")
                    fixed_count += 1
            
            return APIResponse(ok=True, status_code=200, data={
                "total_users": len(users),
                "fixed_assets": fixed_count,
                "message": f"已为 {fixed_count} 个用户创建资产记录"
            })
                
    except Exception as e:
        print(f"[API] 修复用户资产异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return APIResponse(ok=False, status_code=500, error=f'修复用户资产失败: {str(e)}')

@router.post("/auth/register")
async def register_user(request: Request):
    """历史注册端点已弃用，改为首次钱包登录后的资料补全。"""
    return to_json_response(APIResponse(
        ok=False,
        status_code=410,
        error='Registration has moved to wallet sign-in plus profile completion',
    ))

@router.post("/auth/challenge")
async def create_login_challenge(request: Request):
    try:
        payload = await request.json()
        return to_json_response(await start_wallet_auth_challenge(payload.get('evm_address') if payload else None))
    except Exception as e:
        print(f"登录挑战异常: {str(e)}")
        return to_json_response(APIResponse(ok=False, status_code=500, error=f'服务器内部错误: {str(e)}'))

@router.post("/auth/verify")
async def verify_login_signature(request: Request):
    try:
        payload = await request.json()
        return to_json_response(await verify_wallet_auth(payload or {}))
    except Exception as e:
        print(f"签名验证异常: {str(e)}")
        return to_json_response(APIResponse(ok=False, status_code=500, error=f'服务器内部错误: {str(e)}'))

@router.post("/auth/login")
async def login_user(request: Request):
    """兼容入口：统一改为 challenge_token + signature 验证。"""
    try:
        payload = await request.json()
        return to_json_response(await verify_wallet_auth(payload or {}))
    except Exception as e:
        print(f"登录API异常: {str(e)}")
        return to_json_response(APIResponse(ok=False, status_code=500, error=f'服务器内部错误: {str(e)}'))

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
AUTH_CHALLENGE_EXPIRE_SECONDS = int(os.getenv("AUTH_CHALLENGE_EXPIRE_SECONDS", "300"))
ADMIN_EVM_ADDRESSES = {a.strip().lower() for a in os.getenv("ADMIN_EVM_ADDRESSES", "").split(",") if a.strip()}
ACTIVE_AUTH_CHALLENGES: Dict[str, Dict[str, Any]] = {}

# OAuth2配置
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/verify")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def to_json_response(response: "APIResponse"):
    content = {"success": bool(response.ok)}
    if response.message is not None:
        content["message"] = response.message
    if response.data is not None:
        content["data"] = response.data
    if response.error is not None:
        content["error"] = response.error
        content.setdefault("message", response.error)
    return JSONResponse(status_code=response.status_code, content=content)

def build_wallet_sign_message(evm_address: str, nonce: str, issued_at: int, expires_at: int) -> str:
    issued_iso = datetime.utcfromtimestamp(int(issued_at)).strftime("%Y-%m-%d %H:%M:%S UTC")
    expires_iso = datetime.utcfromtimestamp(int(expires_at)).strftime("%Y-%m-%d %H:%M:%S UTC")
    return (
        "Jinli Club Wallet Sign-In\n\n"
        "请签名确认你持有该钱包地址，用于登录 Jinli Club。\n"
        "本次签名不会发起链上交易，也不会消耗 gas。\n\n"
        f"钱包地址: {evm_address.lower()}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_iso}\n"
        f"Expires At: {expires_iso}"
    )

def build_auth_payload(user_data: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(user_data or {})
    token = create_access_token(
        {"sub": str(payload.get("uID")), "evm": payload.get("EVM")},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    payload.update({
        "token": token,
        "access_token": token,
        "token_type": "bearer",
    })
    return payload

def prune_auth_challenges(now_ts: Optional[int] = None):
    current_ts = int(now_ts or datetime.utcnow().timestamp())
    expired_nonces = [
        nonce for nonce, record in ACTIVE_AUTH_CHALLENGES.items()
        if int(record.get("expires_at") or 0) <= current_ts
    ]
    for nonce in expired_nonces:
        ACTIVE_AUTH_CHALLENGES.pop(nonce, None)

async def start_wallet_auth_challenge(evm_address: str) -> "APIResponse":
    evm_norm = str(evm_address or "").strip().lower()
    if not evm_norm:
        return APIResponse(ok=False, status_code=400, error='evm_address required')
    if not evm_norm.startswith("0x") or len(evm_norm) != 42:
        return APIResponse(ok=False, status_code=400, error='Invalid EVM address')

    issued_at = int(datetime.utcnow().timestamp())
    expires_at = issued_at + AUTH_CHALLENGE_EXPIRE_SECONDS
    prune_auth_challenges(issued_at)
    nonce = secrets.token_hex(16)
    ACTIVE_AUTH_CHALLENGES[nonce] = {
        "evm": evm_norm,
        "issued_at": issued_at,
        "expires_at": expires_at,
    }
    challenge_token = create_access_token({
        "typ": "auth_challenge",
        "evm": evm_norm,
        "nonce": nonce,
        "iat": issued_at,
        "expires_at": expires_at,
    }, timedelta(seconds=AUTH_CHALLENGE_EXPIRE_SECONDS))

    return APIResponse(ok=True, status_code=200, data={
        "evm_address": evm_norm,
        "message": build_wallet_sign_message(evm_norm, nonce, issued_at, expires_at),
        "challenge_token": challenge_token,
        "expires_at": expires_at,
    })

async def verify_wallet_auth(payload: Dict[str, Any]) -> "APIResponse":
    evm_norm = str(payload.get("evm_address") or "").strip().lower()
    signature = str(payload.get("signature") or "").strip()
    challenge_token = str(payload.get("challenge_token") or "").strip()

    if not evm_norm or not signature or not challenge_token:
        return APIResponse(ok=False, status_code=400, error='evm_address, signature and challenge_token required')

    try:
        challenge_payload = jwt.decode(challenge_token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return APIResponse(ok=False, status_code=401, error='Challenge expired or invalid')

    if challenge_payload.get("typ") != "auth_challenge":
        return APIResponse(ok=False, status_code=400, error='Invalid challenge token type')

    challenge_address = str(challenge_payload.get("evm") or "").strip().lower()
    nonce = str(challenge_payload.get("nonce") or "").strip()
    issued_at = int(challenge_payload.get("iat") or 0)
    expires_at = int(challenge_payload.get("expires_at") or 0)
    prune_auth_challenges()

    if challenge_address != evm_norm:
        return APIResponse(ok=False, status_code=400, error='Challenge address mismatch')
    if not nonce or not issued_at or not expires_at:
        return APIResponse(ok=False, status_code=400, error='Challenge payload is incomplete')

    challenge_record = ACTIVE_AUTH_CHALLENGES.get(nonce)
    if not challenge_record:
        return APIResponse(ok=False, status_code=401, error='Challenge has been consumed or expired')
    if str(challenge_record.get("evm") or "").strip().lower() != challenge_address:
        ACTIVE_AUTH_CHALLENGES.pop(nonce, None)
        return APIResponse(ok=False, status_code=401, error='Challenge record mismatch')
    if int(challenge_record.get("expires_at") or 0) <= int(datetime.utcnow().timestamp()):
        ACTIVE_AUTH_CHALLENGES.pop(nonce, None)
        return APIResponse(ok=False, status_code=401, error='Challenge has been consumed or expired')

    try:
        from web3 import Web3
    except ImportError:
        return APIResponse(ok=False, status_code=500, error='web3 is required for wallet signature verification')

    try:
        # Use Web3 to verify signature
        message = build_wallet_sign_message(challenge_address, nonce, issued_at, expires_at)
        recovered_address = Web3.to_checksum_address(Web3.eth.account.recover_message(
            text=message,
            signature=signature
        ))
    except Exception as e:
        print(f"[DEBUG] Signature verification error: {str(e)}")
        return APIResponse(ok=False, status_code=401, error='Wallet signature verification failed')

    if str(recovered_address).lower() != challenge_address:
        return APIResponse(ok=False, status_code=401, error='Wallet signature does not match the requested address')

    result = await core.auth_find_or_create_by_evm(challenge_address)
    if not result.get("success"):
        return APIResponse(ok=False, status_code=500, error=result.get("message") or 'Failed to create or find user')

    ACTIVE_AUTH_CHALLENGES.pop(nonce, None)
    return APIResponse(ok=True, status_code=200, data=build_auth_payload(result.get("data") or {}))

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
        print(f"[DEBUG] Authorization header: {auth[:50] if auth else 'None'}...")
        safe_token_display = (token[:50] + '...') if token and len(token) > 50 else token
        print(f"[DEBUG] Token extracted: {safe_token_display}")
        print(f"[DEBUG] Token length: {len(token) if token else 0}")
        if token and len(token) > 10:  # JWT 至少要有一些字符
            try:
                payload_decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                sub = payload_decoded.get("sub")
                evm_address = payload_decoded.get("evm")
                print(f"[DEBUG] Token decoded - sub: {sub}, evm: {evm_address}")
                if sub is not None:
                    try:
                        actor_uid = int(sub)
                        print(f"[DEBUG] Actor UID from sub: {actor_uid}")
                    except Exception as e:
                        print(f"[DEBUG] Cannot convert sub to int: {e}, sub value: {repr(sub)}")
                        # sub 无法转换为整数（可能是旧版 token），尝试用 evm 地址查找用户
                        actor_uid = None
                
                # 如果 actor_uid 为 None 但有 evm 地址，尝试查找用户
                if actor_uid is None and evm_address:
                    try:
                        print(f"[DEBUG] Looking up user by EVM: {evm_address}")
                        with Core().data as r:
                            user_row = r.users.get_by_evm(evm_address.lower())
                            if user_row:
                                actor_uid = int(user_row["uID"])
                                print(f"[DEBUG] Found user, UID: {actor_uid}")
                            else:
                                print(f"[DEBUG] User not found for EVM: {evm_address}")
                    except Exception as e:
                        print(f"[DEBUG] Error looking up user: {e}")
                        actor_uid = None
            except Exception as e:
                print(f"[DEBUG] Token decode error: {e}")
                actor_uid = None
        else:
            print(f"[DEBUG] No token provided")
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
    order_core: OrderCore
    market_core: MarketCore
    shard_core: ShardCore
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
        self.order_core = OrderCore(db)
        self.market_core = MarketCore(db)
        self.shard_core = ShardCore(db)
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
                # ====== Shard endpoints ======
                # ====== 碎片持仓相关的路由端点 ======
                if path == "/api/shard":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error="Unauthorized")
                    return self._response(await self.shard_core.get_holdings(uID=actor_uid))
                if path == "/api/shard/transfer":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error="Unauthorized")
                    return self._response(await self.shard_core.list_transfers(uID=actor_uid, skip=skip, limit=limit))
                # ====== Order/Market endpoints ======
                # ====== 订单与市场相关的路由端点 ======
                if path == "/api/order":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error="Unauthorized")
                    status_values = query_params.get("status") if query_params else None
                    status_filter = status_values[0] if status_values else None
                    return self._response(await self.order_core.list_orders(
                        uID=actor_uid,
                        status=status_filter,
                        skip=skip,
                        limit=limit,
                    ))
                if path.startswith("/api/market/") and path.endswith("/orderbook"):
                    parts = path.split("/")
                    try:
                        bID = int(parts[3])
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error="Invalid bID")
                    return self._response(await self.market_core.get_orderbook(bID=bID))
                if path.startswith("/api/market/") and path.endswith("/trades"):
                    parts = path.split("/")
                    try:
                        bID = int(parts[3])
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error="Invalid bID")
                    return self._response(await self.market_core.list_trades(bID=bID, limit=limit))
                # ====== Task endpoints ======
                # ====== 任务相关的路由端点 ======
                if path == "/api/task/all":
                    return self._response(await self.task_core.list_all(skip=skip, limit=limit))
                if path.startswith("/api/task/") and len(path.split("/")) == 4:
                    try:
                        parts = path.split("/")
                        tID = int(parts[3])  # /api/task/{tID}
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error='Invalid tID')
                    return self._response(await self.core.get_task_detail(tID))
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
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, ["read_users", "manage_users", "manage_points", "manage_permissions", "dashboard_access"]):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    return self._response(await self.user_core.list_all(skip=skip, limit=limit))
                # User statistics
                if path == "/api/user/stats":
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, ["dashboard_access", "review_tasks", "read_users", "manage_users", "manage_points", "manage_permissions", "manage_rewards", "manage_tasks", "manage_settings"]):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    try:
                        print(f"[API] 获取用户统计信息")
                        
                        # 直接使用Entity获取用户统计
                        from .entity import UserEntity
                        
                        with UserEntity(core.data.db) as ue:
                            # 获取所有用户数量
                            users = ue.list()
                            user_count = len(users)
                            
                            # 获取管理员数量
                            admin_count = sum(1 for user in users if user.get("is_admin"))
                            
                            # 获取有资产的用户数量和总积分
                            asset_count = 0
                            total_points = 0
                            for user in users:
                                try:
                                    asset = ue.get_asset(user["uID"])
                                    if asset:
                                        asset_count += 1
                                        total_points += asset.points or 0
                                except Exception as e:
                                    print(f"[API] 获取用户资产失败: {e}")
                            
                            return APIResponse(ok=True, status_code=200, data={
                                "user_count": user_count,
                                "admin_count": admin_count,
                                "asset_count": asset_count,
                                "total_points": total_points,
                                "avg_points": total_points / asset_count if asset_count > 0 else 0
                            })
                                
                    except Exception as e:
                        print(f"[API] 获取用户统计异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'获取用户统计失败: {str(e)}')

                # ====== TaskList / Admin review endpoints ======
                # ====== 任务审核相关路由端点 ======
                if path == "/api/tasklist/pending-verification/count":
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "review_tasks"):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    return self._response(await self.core.count_pending_verification_admin())

                if path == "/api/tasklist/pending-verification":
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "review_tasks"):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    return self._response(await self.core.get_pending_verification_admin(skip=skip, limit=limit))

                if path == "/api/admin/me":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error='Unauthorized')
                    return self._response(await self.core.get_admin_access(actor_uid))

                if path == "/api/admin/settings":
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_settings"):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    return self._response(await self.core.get_admin_settings())

                if path == "/api/admin/permissions":
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_permissions"):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    return self._response(await self.core.get_permission_groups())

                if path.startswith("/api/journey/") and len(path.split("/")) == 4:
                    try:
                        parts = path.split("/")
                        jID = int(parts[3])  # /api/journey/{jID}
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error='Invalid jID')
                    return self._response(await self.core.get_journey_detail(jID))
                
                # User asset
                print(f"[DEBUG] Checking path: {path}")
                if path.startswith("/api/user/asset/") and len(path.split("/")) == 4:
                    try:
                        # 从路径中提取用户ID
                        parts = path.split("/")
                        uID = int(parts[3])  # /api/user/asset/{uID}
                        print(f"[API] 获取用户资产: uID={uID}")
                        
                        # 直接使用Entity获取用户资产
                        from .entity import UserEntity
                        
                        with UserEntity(core.data.db) as ue:
                            asset = ue.get_asset(uID)
                            print(f"[API] 用户资产: {asset}")
                            
                            if asset:
                                return APIResponse(ok=True, status_code=200, data={
                                    "uID": asset.uID,
                                    "points": asset.points,
                                    "time_update": asset.time_update.isoformat() if asset.time_update else None
                                })
                            else:
                                # 如果没有资产记录，创建一个默认的
                                new_asset = ue.upsert_asset(uID, 0)
                                return APIResponse(ok=True, status_code=200, data={
                                    "uID": new_asset.uID,
                                    "points": new_asset.points,
                                    "time_update": new_asset.time_update.isoformat() if new_asset.time_update else None
                                })
                                    
                    except Exception as e:
                        print(f"[API] 获取用户资产异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'获取用户资产失败: {str(e)}')
            elif method == 'POST':
                # ====== Auth endpoints ======
                # ====== 认证相关的路由端点 ======
                if path == "/api/auth/register":
                    return APIResponse(
                        ok=False,
                        status_code=410,
                        error='Registration has moved to wallet sign-in plus profile completion',
                    )

                if path == "/api/auth/challenge":
                    return await start_wallet_auth_challenge(payload.get('evm_address') if payload else None)

                if path == "/api/auth/verify":
                    return await verify_wallet_auth(payload or {})
                        
                if path == "/api/auth/login":
                    return await verify_wallet_auth(payload or {})

                if path == "/api/user/profile":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error='Unauthorized')

                    bio_value = payload.get('bio') if payload else None
                    if bio_value is None:
                        return APIResponse(ok=False, status_code=400, error='bio is required')

                    return self._response(await self.core.update_user(
                        uID=int(actor_uid),
                        bio=str(bio_value).strip(),
                    ))
                
                # Admin points adjustment
                if path == "/api/admin/points/adjust":
                    try:
                        print(f"[API] 管理员调整积分: {payload}")
                        
                        uID = payload.get('uID')
                        amount = payload.get('amount')
                        reason = payload.get('reason')
                        operator = payload.get('operator', 'admin')
                        
                        if not uID or amount is None or not reason:
                            return APIResponse(ok=False, status_code=400, error='参数不完整')
                        
                        # 检查管理员权限
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_points"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        
                        # 直接使用Entity调整积分
                        from .entity import UserEntity
                        
                        with UserEntity(core.data.db) as ue:
                            # 获取当前资产
                            current_asset = ue.get_asset(uID)
                            if not current_asset:
                                return APIResponse(ok=False, status_code=404, error='用户资产记录不存在')
                            
                            # 调整积分
                            new_asset = ue.upsert_asset(uID, amount)
                            print(f"[API] 积分调整结果: {new_asset}")
                            
                            # 记录调整日志（可以扩展为积分历史表）
                            adjustment_record = {
                                "uID": uID,
                                "amount": amount,
                                "reason": reason,
                                "operator": operator,
                                "timestamp": datetime.utcnow().isoformat(),
                                "previous_points": current_asset.points,
                                "new_points": new_asset.points
                            }
                            print(f"[API] 积分调整记录: {adjustment_record}")
                            
                            return APIResponse(ok=True, status_code=200, data={
                                "uID": uID,
                                "amount": amount,
                                "reason": reason,
                                "operator": operator,
                                "previous_points": current_asset.points,
                                "new_points": new_asset.points,
                                "timestamp": adjustment_record["timestamp"]
                            })
                                
                    except Exception as e:
                        print(f"[API] 积分调整异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'积分调整失败: {str(e)}')

                if path == "/api/admin/user/update":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_users"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')

                        uID = payload.get('uID')
                        if uID is None:
                            return APIResponse(ok=False, status_code=400, error='uID is required')

                        is_admin_value = payload.get('is_admin') if 'is_admin' in payload else None
                        bio_value = payload.get('bio') if 'bio' in payload else None
                        if is_admin_value is None and bio_value is None:
                            return APIResponse(ok=False, status_code=400, error='No fields to update')

                        return self._response(await self.core.update_user(
                            uID=int(uID),
                            bio=bio_value,
                            is_admin=is_admin_value,
                        ))
                    except Exception as e:
                        print(f"[API] 更新用户异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'更新用户失败: {str(e)}')

                if path == "/api/admin/settings":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_settings"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        return self._response(await self.core.update_admin_settings(payload or {}))
                    except Exception as e:
                        print(f"[API] 更新系统设置异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'更新系统设置失败: {str(e)}')

                if path == "/api/admin/settings/reset":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_settings"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        return self._response(await self.core.reset_admin_settings())
                    except Exception as e:
                        print(f"[API] 重置系统设置异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'重置系统设置失败: {str(e)}')

                if path == "/api/admin/permissions/save":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_permissions"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        return self._response(await self.core.save_permission_group(payload or {}))
                    except Exception as e:
                        print(f"[API] 保存权限组异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'保存权限组失败: {str(e)}')

                if path == "/api/admin/permissions/delete":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_permissions"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        group_id = payload.get("id") if payload else None
                        if not group_id:
                            return APIResponse(ok=False, status_code=400, error='id is required')
                        return self._response(await self.core.delete_permission_group(str(group_id)))
                    except Exception as e:
                        print(f"[API] 删除权限组异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'删除权限组失败: {str(e)}')

                if path == "/api/admin/task/create":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_tasks"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        return self._response(await self.core.create_task(
                            title=payload.get("title") or "",
                            note=payload.get("note"),
                            refcode=payload.get("refcode"),
                            link0=payload.get("link0"),
                            linkB=payload.get("linkB"),
                            is_open=bool(payload.get("is_open", True)),
                            time_start=payload.get("time_start"),
                            time_end=payload.get("time_end"),
                            points=payload.get("points") or 0,
                            title_en=payload.get("title_en"),
                            title_hk=payload.get("title_hk"),
                            title_vn=payload.get("title_vn"),
                            note_en=payload.get("note_en"),
                            note_hk=payload.get("note_hk"),
                            note_vn=payload.get("note_vn"),
                            type=payload.get("type") or 0,
                        ))
                    except Exception as e:
                        print(f"[API] 创建任务异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'创建任务失败: {str(e)}')

                if path == "/api/admin/task/update":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_tasks"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        tID = payload.get("tID")
                        if tID is None:
                            return APIResponse(ok=False, status_code=400, error='tID is required')
                        fields = dict(payload or {})
                        fields.pop("tID", None)
                        return self._response(await self.core.update_task(int(tID), **fields))
                    except Exception as e:
                        print(f"[API] 更新任务异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'更新任务失败: {str(e)}')

                if path == "/api/admin/task/delete":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_tasks"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        tID = payload.get("tID")
                        if tID is None:
                            return APIResponse(ok=False, status_code=400, error='tID is required')
                        return self._response(await self.core.delete_task(int(tID)))
                    except Exception as e:
                        print(f"[API] 删除任务异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'删除任务失败: {str(e)}')

                if path == "/api/admin/brand/create":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_rewards"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        return self._response(await self.brand_core.create_brand(**(payload or {})))
                    except Exception as e:
                        print(f"[API] 创建奖励品牌异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'创建奖励品牌失败: {str(e)}')

                if path == "/api/admin/brand/update":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_rewards"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        bID = payload.get("bID")
                        if bID is None:
                            return APIResponse(ok=False, status_code=400, error='bID is required')
                        fields = dict(payload or {})
                        fields.pop("bID", None)
                        return self._response(await self.brand_core.update_brand(int(bID), **fields))
                    except Exception as e:
                        print(f"[API] 更新奖励品牌异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'更新奖励品牌失败: {str(e)}')

                if path == "/api/admin/brand/delete":
                    try:
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_rewards"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        bID = payload.get("bID")
                        if bID is None:
                            return APIResponse(ok=False, status_code=400, error='bID is required')
                        return self._response(await self.brand_core.delete_brand(int(bID)))
                    except Exception as e:
                        print(f"[API] 删除奖励品牌异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'删除奖励品牌失败: {str(e)}')
                
                # Admin fix assets
                if path == "/api/admin/fix/assets":
                    try:
                        print(f"[API] 修复用户资产记录")
                        
                        # 检查管理员权限
                        if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_points"):
                            return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                        
                        from .entity import UserEntity
                        
                        with UserEntity(core.data.db) as ue:
                            # 获取所有用户
                            users = ue.list()
                            fixed_count = 0
                            
                            for user in users:
                                try:
                                    # 检查是否已有资产记录
                                    asset = ue.get_asset(user["uID"])
                                    if not asset:
                                        # 创建默认资产记录
                                        ue.upsert_asset(user["uID"], 0)
                                        fixed_count += 1
                                        print(f"[API] 为用户 {user['uID']} 创建资产记录")
                                except Exception as e:
                                    print(f"[API] 修复用户 {user['uID']} 资产失败: {e}")
                            
                            return APIResponse(ok=True, status_code=200, data={
                                "message": f"已为 {fixed_count} 个用户创建资产记录",
                                "fixed_count": fixed_count,
                                "total_users": len(users)
                            })
                                
                    except Exception as e:
                        print(f"[API] 修复用户资产异常: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        return APIResponse(ok=False, status_code=500, error=f'修复用户资产失败: {str(e)}')
                
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
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_rewards"):
                        return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                    return self._response(self.gift_core.create(gift_name=str(id)))
                if path == "/api/gift/renew":
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "manage_rewards"):
                        return APIResponse(ok=False, status_code=403, error='需要管理员权限')
                    return self._response(self.gift_core.update(gID=id))
                # ====== Shard endpoints ======
                # ====== 碎片兑换相关的路由端点 ======
                if path == "/api/shard/redeem":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error='Unauthorized')
                    bID = payload.get('bID') if payload else None
                    if bID is None:
                        return APIResponse(ok=False, status_code=400, error='bID is required')
                    return self._response(await self.shard_core.redeem(uID=actor_uid, bID=int(bID)))
                if path == "/api/order":
                    if actor_uid is None:
                        return APIResponse(ok=False, status_code=401, error='Unauthorized')
                    bID = payload.get("bID") if payload else None
                    side = payload.get("side") if payload else None
                    price = payload.get("price") if payload else None
                    volume = payload.get("volume") if payload else None
                    if None in (bID, side, price, volume):
                        return APIResponse(ok=False, status_code=400, error='bID, side, price, volume are required')
                    return self._response(await self.order_core.place_order(
                        uID=actor_uid,
                        bID=int(bID),
                        side=str(side),
                        price=int(price),
                        volume=int(volume),
                    ))
                # ====== Journey endpoints ======
                # ====== 行程相关的路由端点 ======
                if path == "/api/journey/submit":
                    return self._response(self.journey_core.submit(jID=id, uID=uid, submission_info=payload.get('submission_info')))
                if path == "/api/journey/claim":
                    return self._response(self.journey_core.claim(jID=id, uID=uid))
                if path.startswith("/api/journey/claim/"):
                    try:
                        parts = path.split("/")
                        jID = int(parts[4])  # /api/journey/claim/{jID}
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error='Invalid jID')
                    return self._response(await self.core.claim_journey_user(jID=jID, uid=uid))
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

                if path.startswith("/api/tasklist/") and path.endswith("/verify"):
                    if actor_uid is None or not self.core.has_admin_permission(actor_uid, "review_tasks"):
                        return APIResponse(ok=False, status_code=403, error='Forbidden')
                    try:
                        parts = path.split("/")
                        jID = int(parts[3])  # /api/tasklist/{jID}/verify
                    except (IndexError, ValueError):
                        return APIResponse(ok=False, status_code=400, error='Invalid jID')
                    approved = True if payload is None else bool(payload.get("approved", True))
                    return self._response(await self.core.verify_pending_submission_admin(jID=jID, approved=approved))
            elif method == 'DELETE':
                if actor_uid is None:
                    return APIResponse(ok=False, status_code=401, error='Unauthorized')
                if path == "/api/order":
                    bID_raw = payload.get("bID") if payload else None
                    bID_del = int(bID_raw) if bID_raw is not None else None
                    return self._response(await self.order_core.cancel_all(uID=actor_uid, bID=bID_del))
                if path.startswith("/api/order/"):
                    try:
                        oID = int(path.split("/")[-1])
                    except ValueError:
                        return APIResponse(ok=False, status_code=400, error='Invalid oID')
                    return self._response(await self.order_core.cancel_order(oID=oID, uID=actor_uid))
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
