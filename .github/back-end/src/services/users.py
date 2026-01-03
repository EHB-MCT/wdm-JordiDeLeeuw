import bcrypt
from bson import ObjectId
from db import users


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_user_by_email(email: str):
    return users.find_one({"email": email})


def get_user_by_id(user_id: str):
    try:
        return users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def create_user(email: str, password: str, is_admin: bool = False):
    hashed_pw = hash_password(password)
    user = {
        "email": email,
        "password": hashed_pw,
        "isAdmin": is_admin,
    }
    result = users.insert_one(user)
    return result.inserted_id
