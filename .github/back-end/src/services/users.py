import bcrypt
from bson import ObjectId
from db import users


def hash_password(password: str) -> str:
    # Genereer een hash voor het wachtwoord met een random salt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    # Vergelijk een plain-text wachtwoord met de opgeslagen hash
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_user_by_email(email: str):
    # Zoek een gebruiker op e-mail
    return users.find_one({"email": email})


def get_user_by_id(user_id: str):
    # Zoek een gebruiker op id (ObjectId)
    try:
        return users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def create_user(email: str, password: str, is_admin: bool = False):
    # Maak een nieuwe gebruiker aan met gehashte wachtwoorden
    hashed_pw = hash_password(password)
    user = {
        "email": email,
        "password": hashed_pw,
        "isAdmin": is_admin,
    }
    result = users.insert_one(user)
    return result.inserted_id
