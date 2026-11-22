import os
from pathlib import Path
import sys


def get_data_root():
    if not getattr(sys, "frozen", False):
        return Path(__file__).resolve().parent.parent

    executable_dir = Path(sys.executable).resolve().parent
    portable_data_dir = executable_dir / "dados"
    if portable_data_dir.is_dir() and os.access(portable_data_dir, os.W_OK):
        return executable_dir
    if not portable_data_dir.exists() and os.access(executable_dir, os.W_OK):
        return executable_dir

    if sys.platform == "win32":
        base_dir = os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local"
        return Path(base_dir) / "AcquaTEC"
    elif sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "AcquaTEC"

    data_home = os.environ.get("XDG_DATA_HOME")
    if data_home:
        return Path(data_home) / "AcquaTEC"
    return Path.home() / ".local" / "share" / "AcquaTEC"
