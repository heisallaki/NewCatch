from app.models import Profile


def visible_to(viewer: Profile, target: Profile) -> bool:
    if target.visibility == "hidden":
        return False
    if target.visibility == "matching" and not (set(viewer.looking_for) & set(target.looking_for)):
        return False
    if target.discovery_scope == "my_campus" and target.campus != viewer.campus:
        return False
    return True


def can_see(viewer: Profile, target: Profile) -> bool:
    if viewer.discovery_scope == "my_campus" and target.campus != viewer.campus:
        return False
    return visible_to(viewer, target)