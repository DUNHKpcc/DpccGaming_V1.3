#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = PROJECT_ROOT / "py_script" / "blog-image-optimizer.py"


def test_missing_pillow_reports_friendly_error():
    completed = subprocess.run(
        [sys.executable, str(SCRIPT_PATH)],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 1, completed
    assert "Pillow is required" in completed.stderr, completed.stderr
    assert "python3 -m pip install Pillow" in completed.stderr, completed.stderr
    assert "Traceback" not in completed.stderr, completed.stderr


if __name__ == "__main__":
    test_missing_pillow_reports_friendly_error()
    print("blog_image_optimizer_test.py: ok")
