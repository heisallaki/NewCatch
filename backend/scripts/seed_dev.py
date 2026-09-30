import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.models import Photo, PolicyAcceptance, Profile, Swipe, User
from app.profiles.photos import save_file
from app.security import hash_password

DEV_PASSWORD = "DevPass#2026"
DOMAIN = "@students.jkuat.ac.ke"
COLORS = [(255, 77, 141), (255, 138, 92), (125, 211, 252), (74, 222, 128), (251, 191, 36), (167, 139, 250)]


def person(email, full_name, display_name, campus, year, course, interests, genres, looking, artist):
    return {
        "email": f"{email}{DOMAIN}",
        "full_name": full_name,
        "display_name": display_name,
        "campus": campus,
        "year": year,
        "course": course,
        "interests": interests,
        "genres": genres,
        "looking": looking,
        "artist": artist,
    }


PEOPLE = [
    person("dev.admin", "Dev Admin", "Admin", "Main Campus", "3rd Year", "BBIT",
           ["Technology", "Gaming", "Reading"], ["Hip-Hop", "Alternative"], ["Networking", "New people"], "Kendrick Lamar"),
    person("dev.user1", "Dev User One", "Amani", "Nairobi CBD Campus", "2nd Year", "Computer Science",
           ["Photography", "Technology", "Football", "Movies", "Travel"], ["Afrobeats", "R&B", "Hip-Hop"],
           ["Friendship", "Study buddy", "New people"], "Burna Boy"),
    person("dev.user2", "Dev User Two", "Zuri", "Karen Campus", "4th Year", "Civil Engineering",
           ["Photography", "Travel", "Cooking", "Fitness"], ["Afrobeats", "Amapiano", "R&B"],
           ["Friendship", "Dating"], "Burna Boy"),
    person("sample.01", "Baraka Otieno", "Baraka", "Nairobi CBD Campus", "2nd Year", "Computer Science",
           ["Technology", "Gaming", "Football", "Movies"], ["Hip-Hop", "Afrobeats"], ["Study buddy", "Friendship"], "Wizkid"),
    person("sample.02", "Neema Wanjiru", "Neema", "Main Campus", "1st Year", "Nursing",
           ["Reading", "Cooking", "Fashion", "Music"], ["Gospel", "Soul", "R&B"], ["Friendship", "New people"], "Lauryn Hill"),
    person("sample.03", "Imani Achieng", "Imani", "Nairobi CBD Campus", "3rd Year", "Business Information Technology",
           ["Technology", "Photography", "Travel", "Art"], ["Amapiano", "Afrobeats"], ["Networking", "Friendship"], "Tyla"),
    person("sample.04", "Jabali Kamau", "Jabali", "Karen Campus", "4th Year", "Mechanical Engineering",
           ["Cars", "Motorcycles", "Football", "Fitness"], ["Rock", "Hip-Hop"], ["Activity partner", "New people"], "Travis Scott"),
    person("sample.05", "Tumaini Mwangi", "Tumaini", "Westlands Campus", "2nd Year", "Economics",
           ["Reading", "Basketball", "Movies", "Travel"], ["Jazz", "Soul"], ["Networking", "I'm just exploring"], "Sade"),
    person("sample.06", "Nia Chebet", "Nia", "Eldoret CBD Campus", "3rd Year", "Agribusiness",
           ["Cooking", "Fitness", "Travel", "Fashion"], ["Gengetone", "Afrobeats", "Dancehall"], ["Friendship", "Dating"], "Rema"),
    person("sample.07", "Sila Njoroge", "Sila", "Mombasa CBD Campus", "1st Year", "Hospitality Management",
           ["Photography", "Travel", "Music", "Movies"], ["Reggae", "Dancehall", "Afrobeats"], ["New people", "Friendship"], "Koffee"),
    person("sample.08", "Amara Odhiambo", "Amara", "Main Campus", "3rd Year", "Computer Science",
           ["Technology", "Art", "Gaming", "Reading"], ["Alternative", "Electronic"], ["Study buddy", "Networking"], "Tame Impala"),
    person("sample.09", "Kito Mutua", "Kito", "Nakuru CBD Campus", "5th Year", "Architecture",
           ["Art", "Photography", "Cars", "Travel"], ["Jazz", "Electronic"], ["Activity partner", "Friendship"], "Kaytranada"),
]


def placeholder_photo(initial: str, index: int) -> bytes:
    image = Image.new("RGB", (800, 1000), (27, 10, 61))
    draw = ImageDraw.Draw(image)
    draw.ellipse((100, 200, 700, 800), fill=COLORS[index % len(COLORS)])
    try:
        font = ImageFont.load_default(size=320)
        draw.text((400, 500), initial, fill=(255, 255, 255), font=font, anchor="mm")
    except (TypeError, ValueError, OSError):
        draw.text((390, 490), initial, fill=(255, 255, 255))
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=85)
    return output.getvalue()


def ensure_person(db, data, index):
    user = db.scalar(select(User).where(User.email == data["email"]))
    created = user is None
    if created:
        user = User(email=data["email"], password_hash=hash_password(DEV_PASSWORD))
        user.profile = Profile(
            full_name=data["full_name"],
            display_name=data["display_name"],
            campus=data["campus"],
            year_of_study=data["year"],
            course=data["course"],
        )
        db.add(user)
        db.flush()
        db.add(PolicyAcceptance(user_id=user.id, policy_version=settings.policy_version))
    profile = user.profile
    if not profile.interests:
        profile.interests = data["interests"]
        profile.music_genres = data["genres"]
        profile.looking_for = data["looking"]
        profile.favourite_artist = data["artist"]
    if not user.photos:
        filename = save_file(placeholder_photo(data["display_name"][0].upper(), index))
        user.photos.append(Photo(filename=filename, position=0, width=800, height=1000))
    db.flush()
    print(("Created: " if created else "Updated: ") + data["email"])
    return user


def main() -> None:
    host = make_url(settings.database_url).host
    if settings.app_env != "development" or host not in (None, "localhost", "127.0.0.1"):
        print("Refusing to seed: this script only runs against a local development database.")
        sys.exit(1)

    with SessionLocal() as db:
        users = {}
        for index, data in enumerate(PEOPLE):
            users[data["email"]] = ensure_person(db, data, index)
        amani = users[f"dev.user1{DOMAIN}"]
        zuri = users[f"dev.user2{DOMAIN}"]
        exists = db.scalar(
            select(Swipe.id).where(Swipe.from_user_id == zuri.id, Swipe.to_user_id == amani.id)
        )
        if exists is None:
            db.add(Swipe(from_user_id=zuri.id, to_user_id=amani.id, action="catch"))
        db.commit()
    print(f"Local development password for seeded accounts: {DEV_PASSWORD}")
    print("Zuri (dev.user2) has already Caught Amani (dev.user1): Catch Zuri as Amani to see It's a New Catch!")


if __name__ == "__main__":
    main()