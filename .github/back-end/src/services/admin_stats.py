from datetime import datetime, timedelta
from bson import ObjectId
from db import users, photos, summaries


def check_admin_status(user_id: str) -> bool:
    # Controleer of een gebruiker adminrechten heeft
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
    # Bouw algemene adminstatistieken op
    try:
        stats = {}

        stats["totalUsers"] = users.count_documents({})

        stats["adminUsers"] = users.count_documents({"email": {"$regex": "admin", "$options": "i"}})

        seven_days_ago = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
        stats["newUsersLast7Days"] = users.count_documents({
            "_id": {"$gte": seven_days_ago},
        })

        stats["totalPhotos"] = photos.count_documents({})

        stats["photosLast7Days"] = photos.count_documents({
            "uploadedAt": {"$gte": seven_days_ago},
        })

        if stats["totalUsers"] > 0:
            stats["avgPhotosPerUser"] = round(stats["totalPhotos"] / stats["totalUsers"], 2)
        else:
            stats["avgPhotosPerUser"] = 0

        stats["ocrDone"] = photos.count_documents({"ocr.status": "done"})
        stats["ocrProcessing"] = photos.count_documents({"ocr.status": {"$in": ["uploaded", "received", "extracting"]}})
        stats["ocrError"] = photos.count_documents({"ocr.status": "error"})

        total_ocr_processed = stats["ocrDone"] + stats["ocrError"]
        if total_ocr_processed > 0:
            stats["ocrSuccessRate"] = round(stats["ocrDone"] / total_ocr_processed, 3)
        else:
            stats["ocrSuccessRate"] = 0

        ocr_pipeline = [
            {"$match": {"ocr.status": "done", "ocr.extractedText": {"$exists": True, "$ne": ""}}},
            {"$group": {
                "_id": None,
                "avgTextLength": {"$avg": "$ocr.meta.textLength"},
                "avgLineCount": {"$avg": "$ocr.meta.lineCount"},
            }},
        ]

        ocr_aggregations = list(photos.aggregate(ocr_pipeline))
        if ocr_aggregations:
            stats["avgTextLength"] = round(ocr_aggregations[0]["avgTextLength"], 0) if ocr_aggregations[0]["avgTextLength"] else 0
            stats["avgLineCount"] = round(ocr_aggregations[0]["avgLineCount"], 0) if ocr_aggregations[0]["avgLineCount"] else 0
        else:
            stats["avgTextLength"] = 0
            stats["avgLineCount"] = 0

        stats["analysisDone"] = photos.count_documents({"pipelines.userExtract.status": "completed"})
        stats["analysisFallback"] = photos.count_documents({"pipelines.userExtract.status": "fallback_used"})
        stats["analysisError"] = photos.count_documents({"pipelines.userExtract.status": {"$in": ["llm_failed", "error"]}})

        total_analysis_processed = stats["analysisDone"] + stats["analysisFallback"] + stats["analysisError"]
        if total_analysis_processed > 0:
            stats["fallbackRate"] = round(stats["analysisFallback"] / total_analysis_processed, 3)
        else:
            stats["fallbackRate"] = 0

        pipeline = [
            {"$match": {"pipelines.userExtract.status": "completed", "pipelines.userExtract.resultJson": {"$exists": True}}},
            {"$project": {"chunkCount": 1}},
            {"$group": {"_id": None, "avgChunks": {"$avg": "$chunkCount"}}},
        ]
        _ = pipeline

        stats["avgChunksPerPhoto"] = None
        stats["avgLlmDurationMs"] = None

        stats["photosWithExif"] = photos.count_documents({"exif": {"$exists": True, "$ne": None}})
        stats["photosWithGpsPresent"] = photos.count_documents({"exif.gpsPresent": True})
        stats["photosWithGpsStored"] = photos.count_documents({
            "exif.gpsLatitude": {"$exists": True},
            "exif.gpsLongitude": {"$exists": True},
        })

        stats["photosWithEmailsDetected"] = 0
        stats["photosWithPhoneNumbersDetected"] = 0
        stats["photosWithIBANDetected"] = 0
        stats["photosWithAddressLikeTextDetected"] = 0

        stats["sensitivityScoreDistribution"] = {
            "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0,
        }

        return stats

    except Exception as e:
        print(f"Error getting admin stats: {e}")
        import traceback
        traceback.print_exc()
        return {}


def get_admin_trends(days: int = 7) -> dict:
    # Haal trenddata per dag op voor de gekozen periode
    try:
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)

        trends = {}

        users_pipeline = [
            {"$match": {"_id": {"$gte": start_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$_id"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]

        users_per_day = list(users.aggregate(users_pipeline))
        trends["usersPerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in users_per_day]

        photos_pipeline = [
            {"$match": {"uploadedAt": {"$gte": start_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$uploadedAt"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]

        photos_per_day = list(photos.aggregate(photos_pipeline))
        trends["photosPerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in photos_per_day]

        ocr_pipeline = [
            {"$match": {"ocr.processedAt": {"$gte": start_date}, "ocr.status": "done"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ocr.processedAt"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]

        ocr_done_per_day = list(photos.aggregate(ocr_pipeline))
        trends["ocrDonePerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in ocr_done_per_day]

        analysis_pipeline = [
            {"$match": {"pipelines.userExtract.processedAt": {"$gte": start_date}, "pipelines.userExtract.status": "completed"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$pipelines.userExtract.processedAt"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]

        analysis_done_per_day = list(photos.aggregate(analysis_pipeline))
        trends["analysisDonePerDay"] = [{"date": doc["_id"], "count": doc["count"]} for doc in analysis_done_per_day]

        fallback_pipeline = [
            {"$match": {"pipelines.userExtract.processedAt": {"$gte": start_date}, "pipelines.userExtract.status": "fallback_used"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$pipelines.userExtract.processedAt"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
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
    # Aggregeer AI-gerelateerde metrics over alle samenvattingen
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

        pls_map = {p["name"]: p for p in aggregated["professionalLiabilitySignals"]}
        lls_map = {l["name"]: l for l in aggregated["locationLeakageSignals"]}

        cursor = summaries.find(
            {"resultJson.admin": {"$exists": True}},
            {"resultJson.admin": 1},
        )

        for summary in cursor:
            admin = (summary.get("resultJson") or {}).get("admin") or {}

            for entry in admin.get("timestampLeakage", []) or []:
                try:
                    hour = entry.get("hour")
                    count = int(entry.get("count", 0) or 0)
                except Exception:
                    continue
                if isinstance(hour, int) and 0 <= hour <= 23:
                    aggregated["timestampLeakage"][hour]["count"] += count

            scl = admin.get("socialContextLeakage") or {}
            for key in aggregated["socialContextLeakage"].keys():
                try:
                    aggregated["socialContextLeakage"][key] += int(scl.get(key, 0) or 0)
                except Exception:
                    pass

            for signal in admin.get("professionalLiabilitySignals", []) or []:
                name = signal.get("name")
                if name in pls_map:
                    try:
                        pls_map[name]["count"] += int(signal.get("count", 0) or 0)
                    except Exception:
                        pass

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


def get_admin_analyses_overview(limit: int = 100):
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
