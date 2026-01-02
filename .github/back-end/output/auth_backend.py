from pymongo import MongoClient
import os
import bcrypt
import hashlib
from datetime import datetime, timedelta
from bson import ObjectId
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io
import requests
import json

#maakt connectie met mongodb via environment variabele
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

client = MongoClient(MONGO_URI)
db = client["dev5"]
users = db["users"]
photos = db["photos"]
summaries = db["summaries"]

#maakt index aan voor snelle queries per user
photos.create_index([("userId", 1), ("uploadedAt", -1)])
photos.create_index([("userId", 1), ("metadata.sha256Hash", 1)])
summaries.create_index([("userId", 1), ("createdAt", -1)])

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

def get_user_by_id(user_id: str):
    #zoekt een user op basis van ID
    try:
        return users.find_one({"_id": ObjectId(user_id)})
    except:
        return None

def create_user(email: str, password: str, is_admin: bool = False):
    #maakt een nieuwe user aan met gehashed wachtwoord
    hashed_pw = hash_password(password)
    user = {
        "email": email,
        "password": hashed_pw,
        "isAdmin": is_admin,
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
                "status": photo.get("ocr", {}).get("status", "uploaded"),
                "extractedText": photo.get("ocr", {}).get("extractedText"),
                "errorMessage": photo.get("ocr", {}).get("errorMessage"),
                "size": photo.get("metadata", {}).get("fileSizeBytes", 0),
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

def query_ollama(prompt: str, model: str = "llama3"):
    #query ollama for LLM analysis with resource safeguards
    try:
        #log prompt size for monitoring
        prompt_length = len(prompt)
        print(f"LLM REQUEST: Prompt length: {prompt_length} characters, Model: {model}")
        
        if prompt_length > 20000:
            raise Exception(f"Prompt too long: {prompt_length} characters (max 20000)")
        
        if prompt_length > 15000:
            print(f"WARNING: Large prompt ({prompt_length} chars) - may cause high resource usage")
        
        ollama_url = "http://ollama:11434/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,  # lower temp for more predictable responses
                "num_predict": 2000,  # limit output length
                "top_k": 40,
                "top_p": 0.9
            }
        }
        
        print(f"Sending LLM request to {ollama_url}")
        
        #longer timeout for better analysis completion
        response = requests.post(
            ollama_url,
            json=payload,
            timeout=(30, 240)  # (connect_timeout, read_timeout) - increased to reduce fallbacks
        )
        
        response.raise_for_status()
        result = response.json()
        
        llm_response = result.get("response", "")
        response_length = len(llm_response)
        print(f"LLM RESPONSE: Length: {response_length} characters")
        
        return llm_response
    except requests.exceptions.Timeout:
        raise Exception("Ollama request timed out - try with fewer photos or shorter text")
    except requests.exceptions.ConnectionError:
        raise Exception("Could not connect to Ollama service - ensure it's running")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ollama request failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Ollama query error: {str(e)}")

def get_photos_for_analysis(user_id: str):
    #get all photos for user that have completed OCR
    return list(photos.find({
        "userId": ObjectId(user_id),
        "ocr.status": "done"
    }).sort("uploadedAt", 1))

def get_photos_for_analysis_limited(user_id: str, max_photos: int = 20, max_chars: int = 8000):
    #get photos for analysis with safeguards against resource overload
    print(f"DEBUG: Looking for photos with userId: {user_id}")
    
    # First check if any photos exist for this user with OCR done
    total_user_photos = photos.count_documents({"userId": ObjectId(user_id)})
    ocr_done_photos = photos.count_documents({
        "userId": ObjectId(user_id), 
        "ocr.status": "done"
    })
    print(f"DEBUG: User has {total_user_photos} total photos, {ocr_done_photos} with OCR done")
    
    photos_cursor = photos.find({
        "userId": ObjectId(user_id),
        "ocr.status": "done",
        "ocr.extractedText": {"$exists": True, "$ne": ""}
    }).sort("uploadedAt", -1)  # most recent first
    
    limited_photos = []
    total_chars = 0
    
    for photo in photos_cursor:
        #check if we've hit the photo limit
        if len(limited_photos) >= max_photos:
            print(f"Reached photo limit of {max_photos}")
            break
            
        #get extracted text length
        extracted_text = photo.get("ocr", {}).get("extractedText", "").strip()
        text_length = len(extracted_text)
        
        #check if adding this would exceed character limit
        if total_chars + text_length > max_chars:
            print(f"Character limit reached: {total_chars} + {text_length} > {max_chars}")
            break
            
        limited_photos.append(photo)
        total_chars += text_length
    
    print(f"Selected {len(limited_photos)} photos with {total_chars} total characters")
    return limited_photos

def save_user_summary(user_id: str, photo_ids: list, model_used: str, result_json: dict, short_summary: str):
    #save analysis result to database
    try:
        summary = {
            "userId": ObjectId(user_id),
            "createdAt": datetime.utcnow(),
            "sourcePhotoIds": [ObjectId(pid) for pid in photo_ids],
            "modelUsed": model_used,
            "resultJson": result_json,
            "shortSummary": short_summary
        }
        
        result = summaries.insert_one(summary)
        return result.inserted_id
    except Exception as e:
        print(f"Error saving user summary: {e}")
        import traceback
        traceback.print_exc()
        raise

def get_latest_user_summary(user_id: str):
    #get the most recent analysis for a user
    try:
        summary = summaries.find_one(
            {"userId": ObjectId(user_id)},
            sort=[("createdAt", -1)]
        )
        
        if summary:
            summary["_id"] = str(summary["_id"])
            summary["userId"] = str(summary["userId"])
            summary["sourcePhotoIds"] = [str(pid) for pid in summary["sourcePhotoIds"]]
            return summary
        return None
    except Exception as e:
        print(f"Error getting user summary: {e}")
        return None

def update_photo_pipeline_result(photo_id: str, pipeline_name: str, result_json: dict):
    #update pipeline result for a photo
    try:
        update_data = {
            f"pipelines.{pipeline_name}.status": "done",
            f"pipelines.{pipeline_name}.resultJson": result_json,
            f"pipelines.{pipeline_name}.processedAt": datetime.utcnow()
        }
        
        result = photos.update_one(
            {"_id": ObjectId(photo_id)},
            {"$set": update_data}
        )
        
        print(f"Updated {pipeline_name} pipeline result for photo {photo_id}")
        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating photo pipeline result: {e}")
        import traceback
        traceback.print_exc()
        return False

def update_analysis_progress(photo_id: str, status: str, error_message: str = None):
    """Update analysis progress status for a photo"""
    try:
        update_data = {f"pipelines.userExtract.status": status}
        
        if error_message:
            update_data[f"pipelines.userExtract.errorMessage"] = error_message
            
        result = photos.update_one(
            {"_id": ObjectId(photo_id)},
            {"$set": update_data}
        )
        if result.modified_count > 0:
            print(f"ANALYSIS PROGRESS: Updated photo {photo_id} status to {status}")
        else:
            print(f"ANALYSIS PROGRESS: Warning - photo {photo_id} status update may have failed")
        return result.modified_count > 0
    except Exception as e:
        print(f"ANALYSIS PROGRESS: Error updating analysis progress for photo {photo_id}: {e}")
        return False

def get_analysis_progress(user_id: str):
    """Get analysis progress for all photos of a user"""
    try:
        user_photos = photos.find(
            {"userId": ObjectId(user_id)}, 
            {
                "_id": 1,
                "originalFilename": 1,
                "pipelines.userExtract.status": 1,
                "pipelines.userExtract.errorMessage": 1,
                "ocr.status": 1
            }
        ).sort("uploadedAt", 1)
        
        result = []
        for photo in user_photos:
            result.append({
                "id": str(photo["_id"]),
                "filename": photo.get("originalFilename", "unknown"),
                "analysisStatus": photo.get("pipelines", {}).get("userExtract", {}).get("status", "pending"),
                "analysisError": photo.get("pipelines", {}).get("userExtract", {}).get("errorMessage"),
                "ocrStatus": photo.get("ocr", {}).get("status", "uploaded")
            })
        return result
    except Exception as e:
        print(f"Error getting analysis progress: {e}")
        return []

def initialize_analysis_status(user_id: str):
    """Initialize analysis status to 'queued' for photos with completed OCR"""
    try:
        result = photos.update_many(
            {
                "userId": ObjectId(user_id),
                "ocr.status": "done",
                "pipelines.userExtract.status": {"$in": ["pending", "error"]}
            },
            {"$set": {"pipelines.userExtract.status": "queued"}}
        )
        print(f"Initialized analysis status for {result.modified_count} photos")
        return result.modified_count
    except Exception as e:
        print(f"Error initializing analysis status: {e}")
        return 0

# Admin Analytics Functions
def check_admin_status(user_id: str) -> bool:
    """Check if user has admin privileges - use database isAdmin field"""
    try:
        user = users.find_one({"_id": ObjectId(user_id)})
        if user:
            print(f"check_admin_status: Found user {user_id}, isAdmin field: {user.get('isAdmin', False)} (type: {type(user.get('isAdmin', False))})")
            return bool(user.get("isAdmin", False))
        print(f"check_admin_status: User {user_id} not found")
        return False
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return False

def get_admin_stats() -> dict:
    """Get comprehensive admin statistics for analytics dashboard"""
    try:
        stats = {}
        
        # User Metrics
        stats["totalUsers"] = users.count_documents({})
        
        # Count admin users (those with 'admin' in email)
        stats["adminUsers"] = users.count_documents({"email": {"$regex": "admin", "$options": "i"}})
        
        # Users registered in last 7 days
        seven_days_ago = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
        stats["newUsersLast7Days"] = users.count_documents({
            "_id": {"$gte": seven_days_ago}
        })
        
        # Photo Metrics
        stats["totalPhotos"] = photos.count_documents({})
        
        # Photos uploaded in last 7 days
        stats["photosLast7Days"] = photos.count_documents({
            "uploadedAt": {"$gte": seven_days_ago}
        })
        
        # Average photos per user
        if stats["totalUsers"] > 0:
            stats["avgPhotosPerUser"] = round(stats["totalPhotos"] / stats["totalUsers"], 2)
        else:
            stats["avgPhotosPerUser"] = 0
        
        # OCR Pipeline Metrics
        stats["ocrDone"] = photos.count_documents({"ocr.status": "done"})
        stats["ocrProcessing"] = photos.count_documents({"ocr.status": {"$in": ["uploaded", "received", "extracting"]}})
        stats["ocrError"] = photos.count_documents({"ocr.status": "error"})
        
        # OCR success rate
        total_ocr_processed = stats["ocrDone"] + stats["ocrError"]
        if total_ocr_processed > 0:
            stats["ocrSuccessRate"] = round(stats["ocrDone"] / total_ocr_processed, 3)
        else:
            stats["ocrSuccessRate"] = 0
        
        # Average text length and line count for completed OCR
        ocr_pipeline = [
            {"$match": {"ocr.status": "done", "ocr.extractedText": {"$exists": True, "$ne": ""}}},
            {"$group": {
                "_id": None,
                "avgTextLength": {"$avg": "$ocr.meta.textLength"},
                "avgLineCount": {"$avg": "$ocr.meta.lineCount"}
            }}
        ]
        
        ocr_aggregations = list(photos.aggregate(ocr_pipeline))
        if ocr_aggregations:
            stats["avgTextLength"] = round(ocr_aggregations[0]["avgTextLength"], 0) if ocr_aggregations[0]["avgTextLength"] else 0
            stats["avgLineCount"] = round(ocr_aggregations[0]["avgLineCount"], 0) if ocr_aggregations[0]["avgLineCount"] else 0
        else:
            stats["avgTextLength"] = 0
            stats["avgLineCount"] = 0
        
        # LLM Pipeline Metrics
        stats["analysisDone"] = photos.count_documents({"pipelines.userExtract.status": "completed"})
        stats["analysisFallback"] = photos.count_documents({"pipelines.userExtract.status": "fallback_used"})
        stats["analysisError"] = photos.count_documents({"pipelines.userExtract.status": {"$in": ["llm_failed", "error"]}})
        
        # Analysis fallback rate
        total_analysis_processed = stats["analysisDone"] + stats["analysisFallback"] + stats["analysisError"]
        if total_analysis_processed > 0:
            stats["fallbackRate"] = round(stats["analysisFallback"] / total_analysis_processed, 3)
        else:
            stats["fallbackRate"] = 0
        
        # Average chunks per photo (extract from analysis results)
        pipeline = [
            {"$match": {"pipelines.userExtract.status": "completed", "pipelines.userExtract.resultJson": {"$exists": True}}},
            {"$project": {"chunkCount": 1}},  # Will be populated during analysis
            {"$group": {"_id": None, "avgChunks": {"$avg": "$chunkCount"}}}
        ]
        
        # For now, set to null since we don't track chunk count per photo
        stats["avgChunksPerPhoto"] = None
        
        # Average LLM duration (if available in metadata)
        stats["avgLlmDurationMs"] = None  # Not currently tracked
        
        # Privacy & Risk Metrics
        stats["photosWithExif"] = photos.count_documents({"exif": {"$exists": True, "$ne": None}})
        stats["photosWithGpsPresent"] = photos.count_documents({"exif.gpsPresent": True})
        stats["photosWithGpsStored"] = photos.count_documents({
            "exif.gpsLatitude": {"$exists": True}, 
            "exif.gpsLongitude": {"$exists": True}
        })
        
        # PII Detection Metrics (will be populated by admin analytics pipeline)
        stats["photosWithEmailsDetected"] = 0
        stats["photosWithPhoneNumbersDetected"] = 0
        stats["photosWithIBANDetected"] = 0
        stats["photosWithAddressLikeTextDetected"] = 0
        
        # Sensitivity Score Distribution (0-5)
        stats["sensitivityScoreDistribution"] = {
            "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0
        }
        
        return stats
        
    except Exception as e:
        print(f"Error getting admin stats: {e}")
        import traceback
        traceback.print_exc()
        return {}

def get_admin_trends(days: int = 7) -> dict:
    """Get trend data for the last N days"""
    try:
        from datetime import timedelta
        
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days-1)
        
        trends = {}
        
        # Users per day trend
        users_pipeline = [
            {"$match": {"_id": {"$gte": start_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$_id"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        users_per_day = list(users.aggregate(users_pipeline))
        trends["usersPerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in users_per_day]
        
        # Photos per day trend
        photos_pipeline = [
            {"$match": {"uploadedAt": {"$gte": start_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$uploadedAt"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        photos_per_day = list(photos.aggregate(photos_pipeline))
        trends["photosPerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in photos_per_day]
        
        # OCR completion per day trend
        ocr_pipeline = [
            {"$match": {"ocr.processedAt": {"$gte": start_date}, "ocr.status": "done"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ocr.processedAt"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        ocr_done_per_day = list(photos.aggregate(ocr_pipeline))
        trends["ocrDonePerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in ocr_done_per_day]
        
        # Analysis completion per day trend
        analysis_pipeline = [
            {"$match": {"pipelines.userExtract.processedAt": {"$gte": start_date}, "pipelines.userExtract.status": "completed"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$pipelines.userExtract.processedAt"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        analysis_done_per_day = list(photos.aggregate(analysis_pipeline))
        trends["analysisDonePerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in analysis_done_per_day]
        
        # Analysis fallback per day trend
        fallback_pipeline = [
            {"$match": {"pipelines.userExtract.processedAt": {"$gte": start_date}, "pipelines.userExtract.status": "fallback_used"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$pipelines.userExtract.processedAt"}},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        fallback_per_day = list(photos.aggregate(fallback_pipeline))
        trends["fallbackPerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in fallback_per_day]
        
        return trends
        
    except Exception as e:
        print(f"Error getting admin trends: {e}")
        import traceback
        traceback.print_exc()
        return {}

def get_admin_ai_aggregated_stats():
    """
    Aggregate ALL AI analysis results across ALL users.
    Output structure MUST match AdminDashboard demoData exactly.

    Expected keys:
      - totalUsers, totalPhotos
      - timestampLeakage: [{hour:0..23,count:int}, ...]
      - socialContextLeakage: {relationshipLabels,handles,emails,phonePatterns,nameEntities}
      - professionalLiabilitySignals: [{name,count}, ...]
      - locationLeakageSignals: [{name,count}, ...]
    """
    try:
        aggregated = {
            "totalUsers": int(users.count_documents({})),
            "totalPhotos": int(photos.count_documents({})),
            "timestampLeakage": [{"hour": i, "count": 0} for i in range(24)],
            "socialContextLeakage": {
                "relationshipLabels": 0,
                "handles": 0,
                "emails": 0,
                "phonePatterns": 0,
                "nameEntities": 0,
            },
            "professionalLiabilitySignals": [
                {"name": "Aggression Hits", "count": 0},
                {"name": "Profanity Hits", "count": 0},
                {"name": "Shouting Hits", "count": 0},
            ],
            "locationLeakageSignals": [
                {"name": "Explicit location keywords", "count": 0},
                {"name": "Travel/route context", "count": 0},
                {"name": "No location signals", "count": 0},
            ],
        }

        # Fast lookup maps for accumulating list-based signals
        pls_map = {p["name"]: p for p in aggregated["professionalLiabilitySignals"]}
        lls_map = {l["name"]: l for l in aggregated["locationLeakageSignals"]}

        # Only pull the fields we need
        cursor = summaries.find(
            {"resultJson.admin": {"$exists": True}},
            {"resultJson.admin": 1}
        )

        for summary in cursor:
            admin = (summary.get("resultJson") or {}).get("admin") or {}

            # TIMESTAMP LEAKAGE
            for entry in admin.get("timestampLeakage", []) or []:
                try:
                    hour = entry.get("hour")
                    count = int(entry.get("count", 0) or 0)
                except Exception:
                    continue
                if isinstance(hour, int) and 0 <= hour <= 23:
                    aggregated["timestampLeakage"][hour]["count"] += count

            # SOCIAL CONTEXT LEAKAGE
            scl = admin.get("socialContextLeakage") or {}
            for key in aggregated["socialContextLeakage"].keys():
                try:
                    aggregated["socialContextLeakage"][key] += int(scl.get(key, 0) or 0)
                except Exception:
                    # keep going even if a field is malformed
                    pass

            # PROFESSIONAL LIABILITY SIGNALS
            for signal in admin.get("professionalLiabilitySignals", []) or []:
                name = signal.get("name")
                if name in pls_map:
                    try:
                        pls_map[name]["count"] += int(signal.get("count", 0) or 0)
                    except Exception:
                        pass

            # LOCATION LEAKAGE SIGNALS
            for signal in admin.get("locationLeakageSignals", []) or []:
                name = signal.get("name")
                if name in lls_map:
                    try:
                        lls_map[name]["count"] += int(signal.get("count", 0) or 0)
                    except Exception:
                        pass

        return aggregated

    except Exception as e:
        print(f"ERROR aggregating admin AI stats: {e}")
        import traceback
        traceback.print_exc()
        # Always return a valid empty structure so the dashboard never crashes
        return {
            "totalUsers": 0,
            "totalPhotos": 0,
            "timestampLeakage": [{"hour": i, "count": 0} for i in range(24)],
            "socialContextLeakage": {
                "relationshipLabels": 0,
                "handles": 0,
                "emails": 0,
                "phonePatterns": 0,
                "nameEntities": 0,
            },
            "professionalLiabilitySignals": [
                {"name": "Aggression Hits", "count": 0},
                {"name": "Profanity Hits", "count": 0},
                {"name": "Shouting Hits", "count": 0},
            ],
            "locationLeakageSignals": [
                {"name": "Explicit location keywords", "count": 0},
                {"name": "Travel/route context", "count": 0},
                {"name": "No location signals", "count": 0},
            ],
        }


# New helper: get_admin_analyses_overview
def get_admin_analyses_overview(limit: int = 100):
    """Return an overview of the most recent analyses across ALL users.

    Intended for an admin "All analyses" screen.
    """
    try:
        limit = max(1, min(int(limit), 500))

        cursor = summaries.find({}, sort=[("createdAt", -1)], limit=limit)
        out = []

        for s in cursor:
            user_id = s.get("userId")
            email = None
            try:
                if user_id:
                    u = users.find_one({"_id": user_id}, {"email": 1})
                    email = u.get("email") if u else None
            except Exception:
                email = None

            source_ids = s.get("sourcePhotoIds") or []
            out.append({
                "summaryId": str(s.get("_id")),
                "userId": str(user_id) if user_id else None,
                "userEmail": email,
                "createdAt": s.get("createdAt").isoformat() if s.get("createdAt") else None,
                "shortSummary": s.get("shortSummary", ""),
                "analyzedPhotos": len(source_ids),
            })

        return out

    except Exception as e:
        print(f"Error in get_admin_analyses_overview: {e}")
        return []