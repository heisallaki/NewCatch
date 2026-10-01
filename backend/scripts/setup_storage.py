import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.storage import SupabaseStorage, storage


def main() -> None:
    if not isinstance(storage, SupabaseStorage):
        print("Set STORAGE_BACKEND=supabase in the environment file first.")
        sys.exit(1)
    storage.create_bucket()
    print(f"Bucket '{storage.bucket}' is ready (private, JPEG only, 5 MB per file).")


if __name__ == "__main__":
    main()