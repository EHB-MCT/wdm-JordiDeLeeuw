from pymongo import MongoClient
import os
import bcrypt

#maakt connectie met mongodb via environment variabele
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

client = MongoClient(MONGO_URI)
db = client["dev5"]
users = db["users"]

def hash_password(password: str) -> str:
    #hash het wachtwoord met bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    #vergelijk het ingevoerde wachtwoord met de hash
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_user_by_email(email: str):
    #zoekt een user op basis van email
    return users.find_one({"email": email})

def create_user(email: str, password: str):
    #maakt een nieuwe user aan met gehashed wachtwoord
    hashed_pw = hash_password(password)
    user = {
        "email": email,
        "password": hashed_pw,
    }
    result = users.insert_one(user)
    return result.inserted_id