import base64
import binascii
import io
import uuid
from typing import Optional

from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings
from app.errors import ApiError
from app.storage import storage

Image.MAX_IMAGE_PIXELS = 40_000_000

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1080
MIN_SIDE = 200


def invalid_image(message: str = "That file isn't a valid photo.") -> ApiError:
    return ApiError(400, "invalid_image", message)


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
        raise ApiError(413, "file_too_large", "That image is too large. Try a smaller one.")
    return raw


def process_image(raw: bytes, max_dimension: int = MAX_DIMENSION) -> tuple[bytes, int, int]:
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise invalid_image("Only JPEG, PNG or WebP images are allowed.")
            probe.verify()
        with Image.open(io.BytesIO(raw)) as image:
            oriented = ImageOps.exif_transpose(image)
            if min(oriented.size) < MIN_SIDE:
                raise invalid_image("Image is too small. Use at least 200 pixels on each side.")
            rgb = oriented.convert("RGB")
            rgb.thumbnail((max_dimension, max_dimension))
            output = io.BytesIO()
            rgb.save(output, format="JPEG", quality=85, optimize=True)
            return output.getvalue(), rgb.size[0], rgb.size[1]
    except ApiError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise invalid_image()


def save_file(data: bytes, folder: str = "photos") -> str:
    filename = f"{uuid.uuid4().hex}.jpg"
    storage.put(folder, filename, data)
    return filename


def read_file(filename: str, folder: str = "photos") -> Optional[bytes]:
    return storage.get(folder, filename)


def delete_file(filename: str, folder: str = "photos") -> None:
    storage.delete(folder, filename)