#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent
STATE_FILE = BASE_DIR / "admin_state.json"

DEFAULT_STATE: Dict[str, Any] = {
    "settings": {
        "siteName": "Jinli Club",
        "siteDescription": "Decentralized community rewards platform",
        "maintenance": False,
        "allowRegistration": True,
        "emailNotifications": True,
        "defaultLanguage": "zh",
        "pointsPerTask": 100,
        "maxDailyTasks": 10,
        "rewardCooldown": 24,
    },
    "permission_groups": [
        {
            "id": "reviewers",
            "name": "Task Reviewers",
            "description": "Members who help review submitted task proofs.",
            "permissions": ["review_tasks", "read_users"],
            "user_ids": [],
        },
        {
            "id": "operations",
            "name": "Operations",
            "description": "Members responsible for rewards and settings follow-up.",
            "permissions": ["manage_rewards", "view_dashboard"],
            "user_ids": [],
        },
    ],
}


def _ensure_state_file() -> None:
    if STATE_FILE.exists():
        return
    STATE_FILE.write_text(json.dumps(DEFAULT_STATE, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_admin_state() -> Dict[str, Any]:
    _ensure_state_file()
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        data = deepcopy(DEFAULT_STATE)

    state = deepcopy(DEFAULT_STATE)
    state.update({k: v for k, v in data.items() if k in state})
    if "settings" in data and isinstance(data["settings"], dict):
        state["settings"].update(data["settings"])
    if "permission_groups" in data and isinstance(data["permission_groups"], list):
        state["permission_groups"] = data["permission_groups"]
    return state


def save_admin_state(state: Dict[str, Any]) -> Dict[str, Any]:
    payload = deepcopy(DEFAULT_STATE)
    payload["settings"].update(state.get("settings", {}))
    payload["permission_groups"] = state.get("permission_groups", [])
    STATE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def reset_admin_settings() -> Dict[str, Any]:
    state = load_admin_state()
    state["settings"] = deepcopy(DEFAULT_STATE["settings"])
    return save_admin_state(state)["settings"]


def upsert_permission_group(group: Dict[str, Any]) -> Dict[str, Any]:
    state = load_admin_state()
    groups: List[Dict[str, Any]] = state.get("permission_groups", [])
    incoming_id = str(group.get("id") or "").strip()
    if not incoming_id:
        incoming_id = f"group-{len(groups) + 1}"

    normalized = {
        "id": incoming_id,
        "name": str(group.get("name") or "").strip(),
        "description": str(group.get("description") or "").strip(),
        "permissions": [str(item).strip() for item in group.get("permissions", []) if str(item).strip()],
        "user_ids": sorted({int(item) for item in group.get("user_ids", [])}),
    }

    replaced = False
    next_groups = []
    for existing in groups:
        if str(existing.get("id")) == incoming_id:
            next_groups.append(normalized)
            replaced = True
        else:
            next_groups.append(existing)
    if not replaced:
        next_groups.append(normalized)

    state["permission_groups"] = next_groups
    save_admin_state(state)
    return normalized


def delete_permission_group(group_id: str) -> None:
    state = load_admin_state()
    state["permission_groups"] = [
        group for group in state.get("permission_groups", [])
        if str(group.get("id")) != str(group_id)
    ]
    save_admin_state(state)
