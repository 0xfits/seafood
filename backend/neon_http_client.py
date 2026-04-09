#!/usr/bin/env python3
"""
Neon HTTP API Client - Python implementation
Inspired by Neon JavaScript SDK
"""
import os
import json
import requests
from typing import Dict, List, Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NeonHTTPClient:
    """Neon Database HTTP Client"""
    
    def __init__(self, database_url: str):
        """Initialize with Neon database URL"""
        self.database_url = database_url
        self.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    
    def execute_query(self, query: str, params: List[Any] = None) -> List[Dict[str, Any]]:
        """Execute SQL query via HTTP"""
        try:
            payload = {
                'query': query,
                'params': params or []
            }
            
            response = requests.post(
                self.database_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json().get('rows', [])
            else:
                logger.error(f"Query failed: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            logger.error(f"Database query error: {e}")
            return []
    
    def execute_update(self, query: str, params: List[Any] = None) -> bool:
        """Execute SQL update via HTTP"""
        try:
            payload = {
                'query': query,
                'params': params or []
            }
            
            response = requests.post(
                self.database_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Database update error: {e}")
            return False

# Global client instance
_neon_client: Optional[NeonHTTPClient] = None

def get_neon_client() -> Optional[NeonHTTPClient]:
    """Get Neon HTTP client instance"""
    global _neon_client
    
    if _neon_client is None:
        database_url = os.getenv('jinli_POSTGRES_URL') or os.getenv('POSTGRES_URL')
        if database_url:
            _neon_client = NeonHTTPClient(database_url)
            logger.info("Neon HTTP client initialized")
        else:
            logger.warning("No database URL found")
    
    return _neon_client

# Database helper functions
async def execute_query(query: str, params: List[Any] = None) -> List[Dict[str, Any]]:
    """Execute database query"""
    client = get_neon_client()
    if client:
        return client.execute_query(query, params)
    else:
        logger.error("No database client available")
        return []

async def execute_update(query: str, params: List[Any] = None) -> bool:
    """Execute database update"""
    client = get_neon_client()
    if client:
        return client.execute_update(query, params)
    else:
        logger.error("No database client available")
        return False
