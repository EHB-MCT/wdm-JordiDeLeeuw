from pymongo import MongoClient
import os
import bcrypt
import hashlib
from datetime import datetime
from bson import ObjectId
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io

#maakt connectie met mongodb via environment variabele
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

client = MongoClient(MONGO_URI)
db = client["dev5"]
users = db["users"]
photos = db["photos"]

#maakt index aan voor snelle queries per user
photos.create_index([("userId", 1), ("uploadedAt", -1)])
photos.create_index([("userId", 1), ("metadata.sha256Hash", 1)])

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

def extract_exif(image_data: bytes):
    #extraheert EXIF metadata uit afbeelding
    try:
        img = Image.open(io.BytesIO(image_data))
        exif_data = img._getexif()
        
        if not exif_data:
            return None
        
        exif = {}
        gps_present = False
        
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            
            if tag_name == "DateTimeOriginal":
                try:
                    exif["dateTimeOriginal"] = datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                except:
                    pass
            elif tag_name == "Make":
                exif["make"] = value
            elif tag_name == "Model":
                exif["model"] = value
            elif tag_name == "Orientation":
                exif["orientation"] = value
            elif tag_name == "GPSInfo":
                gps_present = True
        
        exif["gpsPresent"] = gps_present
        
        return exif if exif else None
    except Exception as e:
        print(f"Warning: Failed to extract EXIF: {e}")
        return None

def extract_gps_coords(exif_data):
    #extraheert GPS coördinaten uit EXIF indien aanwezig
    try:
        if not exif_data or "GPSInfo" not in exif_data:
            return None, None
        
        gps_info = exif_data["GPSInfo"]
        
        def convert_to_degrees(value):
            d, m, s = value
            return d + (m / 60.0) + (s / 3600.0)
        
        lat = None
        lon = None
        
        if 2 in gps_info and 1 in gps_info:
            lat = convert_to_degrees(gps_info[2])
            if gps_info[1] == 'S':
                lat = -lat
        
        if 4 in gps_info and 3 in gps_info:
            lon = convert_to_degrees(gps_info[4])
            if gps_info[3] == 'W':
                lon = -lon
        
        return lat, lon
    except:
        return None, None

def calculate_sha256(image_data: bytes) -> str:
    #bereken SHA256 hash voor deduplicatie
    return hashlib.sha256(image_data).hexdigest()

def save_photo(user_id: str, original_filename: str, image_data: bytes, mime_type: str, location_opt_in: bool):
    #slaat een foto op met volledige metadata
    try:
        img = Image.open(io.BytesIO(image_data))
        
        sha256_hash = calculate_sha256(image_data)
        
        metadata = {
            "mimeType": mime_type,
            "fileSizeBytes": len(image_data),
            "imageWidth": img.width,
            "imageHeight": img.height,
            "sha256Hash": sha256_hash,
        }
        
        exif = None
        try:
            exif = extract_exif(image_data)
        except Exception as e:
            print(f"Warning: EXIF extraction failed for {original_filename}: {e}")
        
        if exif and exif.get("gpsPresent") and not location_opt_in:
            exif["gpsPresent"] = True
        elif exif and exif.get("gpsPresent") and location_opt_in:
            try:
                exif_full = extract_exif(image_data)
                if exif_full and "GPSInfo" in exif_full:
                    lat, lon = extract_gps_coords(exif_full)
                    if lat is not None and lon is not None:
                        exif["gpsLatitude"] = lat
                        exif["gpsLongitude"] = lon
            except Exception as e:
                print(f"Warning: GPS extraction failed for {original_filename}: {e}")
        
        photo = {
            "userId": ObjectId(user_id),
            "originalFilename": original_filename,
            "uploadedAt": datetime.utcnow(),
            "imageStorage": {
                "imageData": image_data,
            },
            "metadata": metadata,
            "exif": exif,
            "ocr": {
                "status": "uploaded",
                "extractedText": "",
                "processedAt": None,
                "errorMessage": None,
                "meta": {
                    "textLength": 0,
                    "lineCount": 0,
                    "processingDurationMs": 0,
                },
            },
            "pipelines": {
                "userExtract": {
                    "status": "pending",
                    "resultJson": None,
                    "processedAt": None,
                    "errorMessage": None,
                },
                "adminAnalytics": {
                    "status": "pending",
                    "resultJson": None,
                    "processedAt": None,
                    "errorMessage": None,
                },
            },
        }
        
        result = photos.insert_one(photo)
        return result.inserted_id
    except Exception as e:
        print(f"Error saving photo {original_filename}: {e}")
        import traceback
        traceback.print_exc()
        raise

def get_user_photos(user_id: str):
    #haalt alle fotos op voor een specifieke user
    user_photos = photos.find({"userId": ObjectId(user_id)}).sort("uploadedAt", -1)
    result = []
    for photo in user_photos:
        try:
            result.append({
                "id": str(photo["_id"]),
                "originalFilename": photo.get("originalFilename") or photo.get("filename", "unknown"),
                "uploadedAt": photo.get("uploadedAt", datetime.utcnow()).isoformat(),
                "metadata": photo.get("metadata", {}),
                "exif": photo.get("exif"),
                "ocr": {
                    "status": photo.get("ocr", {}).get("status", "uploaded"),
                    "extractedText": photo.get("ocr", {}).get("extractedText"),
                    "meta": photo.get("ocr", {}).get("meta"),
                },
            })
        except Exception as e:
            print(f"Error processing photo {photo.get('_id')}: {e}")
            continue
    return result

def get_photo_by_id(photo_id: str, user_id: str):
    #haalt een specifieke foto op en controleert of deze van de user is
    try:
        photo = photos.find_one({"_id": ObjectId(photo_id), "userId": ObjectId(user_id)})
        if photo:
            if "imageStorage" in photo and "imageData" in photo["imageStorage"]:
                return {
                    "imageData": photo["imageStorage"]["imageData"],
                    "mimeType": photo["metadata"]["mimeType"],
                }
            elif "imageData" in photo:
                return {
                    "imageData": photo["imageData"],
                    "mimeType": photo.get("mimeType", "image/jpeg"),
                }
        return None
    except Exception as e:
        print(f"Error getting photo {photo_id}: {e}")
        return None

def get_photos_for_processing(user_id: str):
    #haalt fotos op die verwerkt moeten worden
    return list(photos.find({"userId": ObjectId(user_id), "ocr.status": {"$in": ["uploaded", "error"]}}))

def update_photo_status(photo_id: str, status: str, extracted_text: str = None, error_message: str = None, processing_meta: dict = None):
    #werkt de OCR status van een foto bij
    update_data = {"ocr.status": status}
    
    if status == "done":
        update_data["ocr.extractedText"] = extracted_text
        update_data["ocr.processedAt"] = datetime.utcnow()
        if processing_meta:
            update_data["ocr.meta"] = processing_meta
    elif status == "error":
        update_data["ocr.errorMessage"] = error_message
    
    photos.update_one({"_id": ObjectId(photo_id)}, {"$set": update_data})

def get_photos_status(user_id: str):
    #haalt status op van alle fotos van een user
    user_photos = photos.find({"userId": ObjectId(user_id)}).sort("uploadedAt", 1)
    result = []
    for photo in user_photos:
        try:
            result.append({
                "id": str(photo["_id"]),
                "originalFilename": photo.get("originalFilename") or photo.get("filename") or photo.get("original_name") or "unknown",
                "status": photo.get("ocr", {}).get("status", "unknown"),
                "extractedText": photo.get("ocr", {}).get("extractedText"),
                "errorMessage": photo.get("ocr", {}).get("errorMessage"),
            })
        except Exception as e:
            print(f"Error processing photo status {photo.get('_id')}: {e}")
            continue
    return result

def delete_user_photos(user_id: str):
    #verwijdert alle fotos van een user
    result = photos.delete_many({"userId": ObjectId(user_id)})
    return result.deleted_count

def migrate_missing_original_filenames():
    #one-time migration to fix missing originalFilename fields
    try:
        #find all photos missing originalFilename
        missing_photos = photos.find({"originalFilename": {"$exists": False}})
        updated_count = 0
        
        for photo in missing_photos:
            #determine best fallback name
            fallback_name = (
                photo.get("filename") or 
                photo.get("original_name") or 
                f"photo_{photo['_id']}"
            )
            
            #update the document
            photos.update_one(
                {"_id": photo["_id"]},
                {"$set": {"originalFilename": fallback_name}}
            )
            updated_count += 1
            
        print(f"Migration complete: updated {updated_count} photos with originalFilename")
        return updated_count
    except Exception as e:
        print(f"Migration error: {e}")
        import traceback
        traceback.print_exc()
        raise
