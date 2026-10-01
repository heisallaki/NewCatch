import json
import logging
import re
import threading
import urllib.error
import urllib.request
from collections import OrderedDict
from pathlib import Path
from typing import Optional

from app.config import settings
from app.errors import ApiError

logger = logging.getLogger("newcatch.storage")

FILENAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.jpg$")
FOLDERS = ("photos", "reports")
USER_AGENT = "newcatch-backend/1.0"
CACHE_LIMIT = 64


def check_name(folder: str, filename: str) -> None:
    if folder not in FOLDERS or not FILENAME_PATTERN.match(filename):
        raise ApiError(404, "not_found", "Not Found")


def unavailable() -> ApiError:
    return ApiError(503, "storage_unavailable", "Photo storage is temporarily unavailable. Please try again.")


class LocalStorage:
    def __init__(self) -> None:
        root = Path(settings.upload_dir)
        if not root.is_absolute():
            root = Path(__file__).resolve().parents[1] / root
        self.root = root

    def path(self, folder: str, filename: str) -> Path:
        check_name(folder, filename)
        directory = self.root / folder
        directory.mkdir(parents=True, exist_ok=True)
        return directory / filename

    def put(self, folder: str, filename: str, data: bytes) -> None:
        self.path(folder, filename).write_bytes(data)

    def get(self, folder: str, filename: str) -> Optional[bytes]:
        path = self.path(folder, filename)
        return path.read_bytes() if path.exists() else None

    def delete(self, folder: str, filename: str) -> None:
        self.path(folder, filename).unlink(missing_ok=True)

    def keepalive(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)


class SupabaseStorage:
    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required when STORAGE_BACKEND=supabase")
        self.root_url = settings.supabase_url.rstrip("/")
        self.base = f"{self.root_url}/storage/v1"
        self.bucket = settings.supabase_bucket
        self.cache: OrderedDict = OrderedDict()
        self.lock = threading.Lock()

    def headers(self, content_type: Optional[str] = None) -> dict:
        key = settings.supabase_service_key
        headers = {"apikey": key, "User-Agent": USER_AGENT}
        if not key.startswith("sb_"):
            headers["Authorization"] = f"Bearer {key}"
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def call(self, method: str, url: str, data: Optional[bytes] = None, content_type: Optional[str] = None):
        request = urllib.request.Request(url, data=data, method=method, headers=self.headers(content_type))
        return urllib.request.urlopen(request, timeout=20)

    def object_url(self, folder: str, filename: str, authenticated: bool = False) -> str:
        check_name(folder, filename)
        prefix = "object/authenticated" if authenticated else "object"
        return f"{self.base}/{prefix}/{self.bucket}/{folder}/{filename}"

    def put(self, folder: str, filename: str, data: bytes) -> None:
        try:
            with self.call("POST", self.object_url(folder, filename), data, "image/jpeg"):
                return
        except urllib.error.HTTPError as error:
            logger.error("Storage upload rejected with status %s", error.code)
        except Exception:
            logger.exception("Storage upload failed")
        raise unavailable()

    def get(self, folder: str, filename: str) -> Optional[bytes]:
        key = (folder, filename)
        with self.lock:
            cached = self.cache.get(key)
            if cached is not None:
                self.cache.move_to_end(key)
                return cached
        try:
            with self.call("GET", self.object_url(folder, filename, True)) as response:
                data = response.read()
        except urllib.error.HTTPError as error:
            if error.code in (400, 404):
                return None
            logger.error("Storage download rejected with status %s", error.code)
            raise unavailable()
        except Exception:
            logger.exception("Storage download failed")
            raise unavailable()
        with self.lock:
            self.cache[key] = data
            while len(self.cache) > CACHE_LIMIT:
                self.cache.popitem(last=False)
        return data

    def delete(self, folder: str, filename: str) -> None:
        with self.lock:
            self.cache.pop((folder, filename), None)
        try:
            with self.call("DELETE", self.object_url(folder, filename)):
                return
        except urllib.error.HTTPError as error:
            if error.code not in (400, 404):
                logger.error("Storage delete rejected with status %s", error.code)
        except Exception:
            logger.exception("Storage delete failed")

    def keepalive(self) -> None:
        body = json.dumps({"prefix": "photos", "limit": 1}).encode()
        with self.call("POST", f"{self.base}/object/list/{self.bucket}", body, "application/json"):
            pass
        try:
            with self.call("GET", f"{self.root_url}/rest/v1/"):
                pass
        except Exception:
            return

    def create_bucket(self) -> None:
        body = json.dumps(
            {
                "id": self.bucket,
                "name": self.bucket,
                "public": False,
                "file_size_limit": 5242880,
                "allowed_mime_types": ["image/jpeg"],
            }
        ).encode()
        try:
            with self.call("POST", f"{self.base}/bucket", body, "application/json"):
                return
        except urllib.error.HTTPError as error:
            if error.code in (400, 409):
                return
            raise


if settings.storage_backend == "supabase":
    storage = SupabaseStorage()
elif settings.storage_backend == "local":
    storage = LocalStorage()
else:
    raise RuntimeError("STORAGE_BACKEND must be local or supabase")