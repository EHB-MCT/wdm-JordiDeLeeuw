from pymongo import MongoClient
import os
import bcrypt
from datetime import datetime
from bson import ObjectId

#maakt connectie met mongodb via environment variabele
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

client = MongoClient(MONGO_URI)
db = client["dev5"]
users = db["users"]
photos = db["photos"]

#maakt index aan voor snelle queries per user
photos.create_index([("userId", 1), ("uploadedAt", -1)])

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

def save_photo(user_id: str, filename: str, mime_type: str, size: int, image_data: bytes):
    #slaat een foto op in mongodb gekoppeld aan een user
    photo = {
        "userId": ObjectId(user_id),
        "filename": filename,
        "mimeType": mime_type,
        "size": size,
        "uploadedAt": datetime.utcnow(),
        "imageData": image_data,
        "status": "uploaded",
        "extractedText": None,
        "errorMessage": None,
        "processedAt": None,
    }
    result = photos.insert_one(photo)
    return result.inserted_id

def get_user_photos(user_id: str):
    #haalt alle fotos op voor een specifieke user
    user_photos = photos.find({"userId": ObjectId(user_id)}).sort("uploadedAt", -1)
    return [
        {
            "id": str(photo["_id"]),
            "filename": photo["filename"],
            "mimeType": photo["mimeType"],
            "size": photo["size"],
            "uploadedAt": photo["uploadedAt"].isoformat(),
            "status": photo.get("status", "uploaded"),
            "extractedText": photo.get("extractedText"),
            "errorMessage": photo.get("errorMessage"),
            "processedAt": photo.get("processedAt").isoformat() if photo.get("processedAt") else None,
        }
        for photo in user_photos
    ]

def get_photo_by_id(photo_id: str, user_id: str):
    #haalt een specifieke foto op en controleert of deze van de user is
    try:
        photo = photos.find_one({"_id": ObjectId(photo_id), "userId": ObjectId(user_id)})
        if photo:
            return {
                "mimeType": photo["mimeType"],
                "imageData": photo["imageData"],
                "status": photo.get("status", "uploaded"),
                "extractedText": photo.get("extractedText"),
                "errorMessage": photo.get("errorMessage"),
            }
        return None
    except:
        return None

def get_photos_for_processing(user_id: str):
    #haalt fotos op die verwerkt moeten worden
    return list(photos.find({"userId": ObjectId(user_id), "status": {"$in": ["uploaded", "error"]}}))

def update_photo_status(photo_id: str, status: str, extracted_text: str = None, error_message: str = None):
    #werkt de status van een foto bij
    update_data = {"status": status}
    
    if status == "done":
        update_data["extractedText"] = extracted_text
        update_data["processedAt"] = datetime.utcnow()
    elif status == "error":
        update_data["errorMessage"] = error_message
    
    photos.update_one({"_id": ObjectId(photo_id)}, {"$set": update_data})

def get_photos_status(user_id: str):
    #haalt status op van alle fotos van een user
    user_photos = photos.find({"userId": ObjectId(user_id)}).sort("uploadedAt", 1)
    return [
        {
            "id": str(photo["_id"]),
            "filename": photo["filename"],
            "status": photo.get("status", "uploaded"),
            "extractedText": photo.get("extractedText"),
            "errorMessage": photo.get("errorMessage"),
        }
        for photo in user_photos
    ]

def delete_user_photos(user_id: str):
    #verwijdert alle fotos van een user
    result = photos.delete_many({"userId": ObjectId(user_id)})
    return result.deleted_count