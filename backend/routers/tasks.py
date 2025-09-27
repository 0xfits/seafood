from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Annotated, List
from pydantic import BaseModel

# 从主模块导入依赖
from ..database import get_db
from ..models import Task, TaskList, User
from ..auth_utils import get_current_user, get_current_admin

# 创建路由器
router = APIRouter(
    prefix="/api/tasks",
    tags=["Tasks"],
    responses={404: {"description": "Not found"}},
)

# 定义任务响应模型
class TaskResponse(BaseModel):
    task_id: int
    task_name: str
    task_description: str
    task_type: str
    reward_points: int
    max_participants: int
    created_at: str
    updated_at: str
    participants_count: int

    class Config:
        from_attributes = True

# 定义任务列表项响应模型
class TaskListItemResponse(BaseModel):
    tlistID: int
    uID: int
    task_id: int
    status: str
    submission_info: str
    created_at: str
    updated_at: str
    task: TaskResponse

    class Config:
        from_attributes = True

# 获取所有任务
@router.get("/all", response_model=List[TaskResponse])
async def get_all_tasks(
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 100
):
    """获取所有可用任务列表"""
    tasks = db.query(Task).offset(skip).limit(limit).all()
    
    # 计算每个任务的参与者数量
    result = []
    for task in tasks:
        participants_count = db.query(TaskList).filter(TaskList.task_id == task.task_id).count()
        
        # 创建任务响应对象
        task_response = TaskResponse(
            task_id=task.task_id,
            task_name=task.task_name,
            task_description=task.task_description,
            task_type=task.task_type,
            reward_points=task.reward_points,
            max_participants=task.max_participants,
            created_at=task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=task.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            participants_count=participants_count
        )
        result.append(task_response)
    
    return result

# 获取单个任务详情
@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_detail(
    task_id: int,
    db: Annotated[Session, Depends(get_db)]
):
    """获取单个任务的详细信息"""
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 计算参与者数量
    participants_count = db.query(TaskList).filter(TaskList.task_id == task.task_id).count()
    
    return TaskResponse(
        task_id=task.task_id,
        task_name=task.task_name,
        task_description=task.task_description,
        task_type=task.task_type,
        reward_points=task.reward_points,
        max_participants=task.max_participants,
        created_at=task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        updated_at=task.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
        participants_count=participants_count
    )

# 用户参与任务
@router.post("/join/{task_id}")
async def join_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)]
):
    """用户参与任务"""
    # 检查任务是否存在
    task = db.query(Task).filter(Task.task_id == task_id).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 检查用户是否已参与此任务
    existing_task_list = db.query(TaskList).filter(
        TaskList.uID == int(current_user["uID"]),
        TaskList.task_id == task_id
    ).first()
    
    if existing_task_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already joined this task"
        )
    
    # 检查任务参与者是否已满
    participants_count = db.query(TaskList).filter(TaskList.task_id == task_id).count()
    
    if participants_count >= task.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task participants are full"
        )
    
    # 创建任务列表记录
    new_task_list = TaskList(
        uID=int(current_user["uID"]),
        task_id=task_id,
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_task_list)
    db.commit()
    db.refresh(new_task_list)
    
    return {
        "success": True,
        "message": "Successfully joined the task",
        "tlistID": new_task_list.tlistID
    }

# 用户提交任务信息
@router.post("/submit/{tlistID}")
async def submit_task_info(
    tlistID: int,
    submission_info: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)]
):
    """用户提交任务完成信息"""
    # 检查任务列表记录是否存在
    task_list = db.query(TaskList).filter(TaskList.tlistID == tlistID).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task participation record not found"
        )
    
    # 检查用户是否有权限操作此记录
    if task_list.uID != int(current_user["uID"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to submit this task"
        )
    
    # 检查任务状态是否允许提交
    if task_list.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task status does not allow submission"
        )
    
    # 更新任务列表记录
    task_list.submission_info = submission_info
    task_list.status = "submitted"
    task_list.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task_list)
    
    return {
        "success": True,
        "message": "Task information submitted successfully",
        "tlistID": task_list.tlistID
    }

# 获取用户的所有任务
@router.get("/user", response_model=List[TaskListItemResponse])
async def get_user_tasks(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    status: str = None
):
    """获取当前用户的所有任务参与记录"""
    query = db.query(TaskList).filter(TaskList.uID == int(current_user["uID"]))
    
    # 如果指定了状态，过滤任务
    if status:
        query = query.filter(TaskList.status == status)
    
    task_lists = query.all()
    
    result = []
    for task_list in task_lists:
        # 获取任务详情
        task = db.query(Task).filter(Task.task_id == task_list.task_id).first()
        if not task:
            continue
        
        # 计算参与者数量
        participants_count = db.query(TaskList).filter(TaskList.task_id == task.task_id).count()
        
        # 创建任务响应对象
        task_response = TaskResponse(
            task_id=task.task_id,
            task_name=task.task_name,
            task_description=task.task_description,
            task_type=task.task_type,
            reward_points=task.reward_points,
            max_participants=task.max_participants,
            created_at=task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=task.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            participants_count=participants_count
        )
        
        # 创建任务列表项响应对象
        task_list_item = TaskListItemResponse(
            tlistID=task_list.tlistID,
            uID=task_list.uID,
            task_id=task_list.task_id,
            status=task_list.status,
            submission_info=task_list.submission_info,
            created_at=task_list.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=task_list.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            task=task_response
        )
        
        result.append(task_list_item)
    
    return result

# 管理员验证任务
@router.post("/verify/{tlistID}")
async def verify_task(
    tlistID: int,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员验证用户提交的任务"""
    # 检查任务列表记录是否存在
    task_list = db.query(TaskList).filter(TaskList.tlistID == tlistID).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task participation record not found"
        )
    
    # 检查任务状态是否允许验证
    if task_list.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task status does not allow verification"
        )
    
    # 更新任务列表记录状态为已完成
    task_list.status = "completed"
    task_list.updated_at = datetime.utcnow()
    
    # 更新用户积分
    # 这里应该有实际的积分更新逻辑
    
    db.commit()
    db.refresh(task_list)
    
    return {
        "success": True,
        "message": "Task verified successfully"
    }

# 管理员拒绝任务
@router.post("/reject/{tlistID}")
async def reject_task(
    tlistID: int,
    reason: str,
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)]
):
    """管理员拒绝用户提交的任务"""
    # 检查任务列表记录是否存在
    task_list = db.query(TaskList).filter(TaskList.tlistID == tlistID).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task participation record not found"
        )
    
    # 检查任务状态是否允许拒绝
    if task_list.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task status does not allow rejection"
        )
    
    # 更新任务列表记录状态为已拒绝
    task_list.status = "rejected"
    task_list.updated_at = datetime.utcnow()
    # 可以在数据库中添加拒绝原因字段
    
    db.commit()
    db.refresh(task_list)
    
    return {
        "success": True,
        "message": "Task rejected successfully",
        "reason": reason
    }

# 获取待验证的任务列表（管理员专用）
@router.get("/pending-verification", response_model=List[TaskListItemResponse])
async def get_pending_verification_tasks(
    db: Annotated[Session, Depends(get_db)],
    current_admin: Annotated[dict, Depends(get_current_admin)],
    skip: int = 0,
    limit: int = 100
):
    """获取待验证的任务列表（管理员专用）"""
    task_lists = db.query(TaskList).filter(TaskList.status == "submitted").offset(skip).limit(limit).all()
    
    result = []
    for task_list in task_lists:
        # 获取任务详情
        task = db.query(Task).filter(Task.task_id == task_list.task_id).first()
        if not task:
            continue
        
        # 获取用户信息
        user = db.query(User).filter(User.uID == task_list.uID).first()
        
        # 计算参与者数量
        participants_count = db.query(TaskList).filter(TaskList.task_id == task.task_id).count()
        
        # 创建任务响应对象
        task_response = TaskResponse(
            task_id=task.task_id,
            task_name=task.task_name,
            task_description=task.task_description,
            task_type=task.task_type,
            reward_points=task.reward_points,
            max_participants=task.max_participants,
            created_at=task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=task.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            participants_count=participants_count
        )
        
        # 创建任务列表项响应对象
        task_list_item = TaskListItemResponse(
            tlistID=task_list.tlistID,
            uID=task_list.uID,
            task_id=task_list.task_id,
            status=task_list.status,
            submission_info=task_list.submission_info,
            created_at=task_list.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=task_list.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            task=task_response
        )
        
        result.append(task_list_item)
    
    return result