import os
import sys

# Add the project root to sys.path so we can import from backend
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from backend.apex import app
