import os
import subprocess
import sys


def main():
    if os.environ.get("DATABASE_URL"):
        subprocess.check_call([sys.executable, "manage.py", "migrate", "--noinput"])
    else:
        print("WARNING: DATABASE_URL not set — skipping migrations until database is linked.")


if __name__ == "__main__":
    main()
