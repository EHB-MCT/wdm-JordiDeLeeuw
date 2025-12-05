from pymongo import MongoClient
import os

#maakt connectie met mongodb via environment variabele
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

client = MongoClient(MONGO_URI)
db = client["dev5"]
users = db["users"]

def get_user_by_email(email: str):
    #zoekt een user op basis van email
    return users.find_one({"email": email})

def create_user(email: str, password: str):
    #maakt een nieuwe user aan (nu nog plain text wachtwoord)
    user = {
        "email": email,
        "password": password,
    }
    result = users.insert_one(user)
    return result.inserted_id