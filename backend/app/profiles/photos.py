import base64
import binascii
import io
import re
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings
from app.errors import ApiError

Image.MAX_IMAGE_PIXELS = 40_000_000

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1080
MIN_SIDE = 200
FILENAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.jpg$")


def invalid_image(message: str = "That file isn't a valid photo.") -> ApiError:
    return ApiError(400, "invalid_image", message)


def upload_root() -> Path:
    root = Path(settings.upload_dir)
    if not root.is_absolute():
        root = Path(__file__).resolve().parents[2] / root
    root = root / "photos"
    root.mkdir(parents=True, exist_ok=True)
    return root


def decode_upload(data: str) -> bytes:
    payload = data.strip()
    if payload.startswith("data:"):
        _, _, payload = payload.partition(",")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise invalid_image()
    if not raw:
        raise invalid_image()
    if len(raw) > settings.max_upload_bytes:
        raise ApiError(413, "file_too_large", "That photo is too large. Try a smaller one.")
    return raw


def process_image(raw: bytes) -> tuple[bytes, int, int]:
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise invalid_image("Only JPEG, PNG or WebP photos are allowed.")
            probe.verify()
        with Image.open(io.BytesIO(raw)) as image:
            oriented = ImageOps.exif_transpose(image)
            if min(oriented.size) < MIN_SIDE:
                raise invalid_image("Photo is too small. Use at least 200 pixels on each side.")
            rgb = oriented.convert("RGB")
            rgb.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            output = io.BytesIO()
            rgb.save(output, format="JPEG", quality=85, optimize=True)
            return output.getvalue(), rgb.size[0], rgb.size[1]
    except ApiError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise invalid_image()


def save_file(data: bytes) -> str:
    filename = f"{uuid.uuid4().hex}.jpg"
    (upload_root() / filename).write_bytes(data)
    return filename


def file_path(filename: str) -> Path:
    if not FILENAME_PATTERN.match(filename):
        raise ApiError(404, "not_found", "Not Found")
    return upload_root() / filename


def delete_file(filename: str) -> None:
    if FILENAME_PATTERN.match(filename):
        (upload_root() / filename).unlink(missing_ok=True)