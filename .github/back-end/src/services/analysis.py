from datetime import datetime
from bson import ObjectId
from db import photos, summaries


def get_photos_for_analysis(user_id: str):
    # Haal alle foto's op die klaar zijn voor analyse
    return list(photos.find({
        "userId": ObjectId(user_id),
        "ocr.status": "done",
    }).sort("uploadedAt", 1))


def get_photos_for_analysis_limited(user_id: str, max_photos: int = 20, max_chars: int = 8000):
    # Haal een gelimiteerd aantal foto's op om resourcegebruik te beperken
    print(f"DEBUG: Looking for photos with userId: {user_id}")

    total_user_photos = photos.count_documents({"userId": ObjectId(user_id)})
    ocr_done_photos = photos.count_documents({
        "userId": ObjectId(user_id),
        "ocr.status": "done",
    })
    print(f"DEBUG: User has {total_user_photos} total photos, {ocr_done_photos} with OCR done")

    photos_cursor = photos.find({
        "userId": ObjectId(user_id),
        "ocr.status": "done",
        "ocr.extractedText": {"$exists": True, "$ne": ""},
    }).sort("uploadedAt", -1)

    limited_photos = []
    total_chars = 0

    for photo in photos_cursor:
        if len(limited_photos) >= max_photos:
            print(f"Reached photo limit of {max_photos}")
            break

        extracted_text = photo.get("ocr", {}).get("extractedText", "").strip()
        text_length = len(extracted_text)

        if total_chars + text_length > max_chars:
            print(f"Character limit reached: {total_chars} + {text_length} > {max_chars}")
            break

        limited_photos.append(photo)
        total_chars += text_length

    print(f"Selected {len(limited_photos)} photos with {total_chars} total characters")
    return limited_photos


def save_user_summary(user_id: str, photo_ids: list, model_used: str, result_json: dict, short_summary: str):
    # Sla een samenvatting op voor de gebruiker
    try:
        summary = {
            "userId": ObjectId(user_id),
            "createdAt": datetime.utcnow(),
            "sourcePhotoIds": [ObjectId(pid) for pid in photo_ids],
            "modelUsed": model_used,
            "resultJson": result_json,
            "shortSummary": short_summary,
        }

        result = summaries.insert_one(summary)
        return result.inserted_id
    except Exception as e:
        print(f"Error saving user summary: {e}")
        import traceback
        traceback.print_exc()
        raise


def get_latest_user_summary(user_id: str):
    # Haal de meest recente samenvatting op
    try:
        summary = summaries.find_one(
            {"userId": ObjectId(user_id)},
            sort=[("createdAt", -1)],
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


def update_analysis_progress(photo_id: str, status: str, error_message: str = None):
    # Update de analyse-status voor een foto
    try:
        update_data = {"pipelines.userExtract.status": status}

        if error_message:
            update_data["pipelines.userExtract.errorMessage"] = error_message

        result = photos.update_one(
            {"_id": ObjectId(photo_id)},
            {"$set": update_data},
        )
        if result.modified_count > 0:
            print(f"ANALYSIS PROGRESS: Updated photo {photo_id} status to {status}")
        else:
            print("ANALYSIS PROGRESS: Warning - photo status update may have failed")
        return result.modified_count > 0
    except Exception as e:
        print(f"ANALYSIS PROGRESS: Error updating analysis progress for photo {photo_id}: {e}")
        return False


def get_analysis_progress(user_id: str):
    # Haal de analysevoortgang op voor alle foto's van de gebruiker
    try:
        user_photos = photos.find(
            {"userId": ObjectId(user_id)},
            {
                "_id": 1,
                "originalFilename": 1,
                "pipelines.userExtract.status": 1,
                "pipelines.userExtract.errorMessage": 1,
                "ocr.status": 1,
            },
        ).sort("uploadedAt", 1)

        result = []
        for photo in user_photos:
            result.append({
                "id": str(photo["_id"]),
                "filename": photo.get("originalFilename", "unknown"),
                "analysisStatus": photo.get("pipelines", {}).get("userExtract", {}).get("status", "pending"),
                "analysisError": photo.get("pipelines", {}).get("userExtract", {}).get("errorMessage"),
                "ocrStatus": photo.get("ocr", {}).get("status", "uploaded"),
            })
        return result
    except Exception as e:
        print(f"Error getting analysis progress: {e}")
        return []


def initialize_analysis_status(user_id: str):
    # Zet status van analyseerbare foto's op "queued"
    try:
        result = photos.update_many(
            {
                "userId": ObjectId(user_id),
                "ocr.status": "done",
                "pipelines.userExtract.status": {"$in": ["pending", "error"]},
            },
            {"$set": {"pipelines.userExtract.status": "queued"}},
        )
        print(f"Initialized analysis status for {result.modified_count} photos")
        return result.modified_count
    except Exception as e:
        print(f"Error initializing analysis status: {e}")
        return 0
