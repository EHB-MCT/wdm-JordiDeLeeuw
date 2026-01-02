from flask import Blueprint, request, jsonify, send_file
from io import BytesIO
import auth_backend
import pytesseract
from PIL import Image
import tempfile
import os
import time

upload_bp = Blueprint("upload", __name__)

def check_auth(request):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id

@upload_bp.route("/api/photos", methods=["POST"])
def upload_photos():
    try:
        print("Upload endpoint called")
        user_id = check_auth(request)
        if not user_id:
            print("Upload failed: No user ID")
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        print(f"User ID: {user_id}")

        if "files" not in request.files:
            print("Upload failed: No files in request")
            return jsonify({"error": "No files uploaded"}), 400

        files = request.files.getlist("files")
        location_opt_in = request.form.get("locationOptIn", "false").lower() == "true"
        
        print(f"Files received: {len(files)}, Location opt-in: {location_opt_in}")
        
        if len(files) == 0:
            print("Upload failed: No files selected")
            return jsonify({"error": "No files selected"}), 400

        uploaded_photos = []

        for file in files:
            if file.filename == "":
                continue

            try:
                print(f"Processing file: {file.filename}")
                image_data = file.read()
                mime_type = file.mimetype or "image/jpeg"
                print(f"File read: {len(image_data)} bytes, MIME type: {mime_type}")

                photo_id = auth_backend.save_photo(
                    user_id=user_id,
                    original_filename=file.filename,
                    image_data=image_data,
                    mime_type=mime_type,
                    location_opt_in=location_opt_in,
                )

                print(f"Photo saved with ID: {photo_id}")
                uploaded_photos.append({
                    "id": str(photo_id),
                    "originalFilename": file.filename,
                })
            except Exception as e:
                print(f"Failed to upload {file.filename}: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({
                    "error": f"Failed to upload {file.filename}",
                    "details": str(e)
                }), 500

        print(f"Upload complete: {len(uploaded_photos)} photos uploaded")
        return jsonify({
            "message": f"{len(uploaded_photos)} foto(s) succesvol geüpload",
            "photos": uploaded_photos,
        }), 201
    except Exception as e:
        print(f"Upload endpoint error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Upload failed",
            "details": str(e)
        }), 500

@upload_bp.route("/api/photos", methods=["GET"])
def get_photos():
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        photos = auth_backend.get_user_photos(user_id)
        
        return jsonify({
            "photos": photos,
            "count": len(photos),
        }), 200
    except Exception as e:
        print(f"Get photos error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve photos",
            "details": str(e)
        }), 500

@upload_bp.route("/api/photos/<photo_id>/file", methods=["GET"])
def get_photo_file(photo_id):
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        photo = auth_backend.get_photo_by_id(photo_id, user_id)
        
        if not photo:
            return jsonify({"error": "Photo not found or access denied"}), 404

        return send_file(
            BytesIO(photo["imageData"]),
            mimetype=photo["mimeType"],
            as_attachment=False,
            download_name=f"photo_{photo_id}",
        )
    except Exception as e:
        print(f"Get photo file error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve photo file",
            "details": str(e)
        }), 500

@upload_bp.route("/api/photos/process-all", methods=["POST"])
def process_all_photos():
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        photos_to_process = auth_backend.get_photos_for_processing(user_id)
        
        if len(photos_to_process) == 0:
            return jsonify({"error": "Geen foto's om te verwerken"}), 400

        photo_ids = [str(photo["_id"]) for photo in photos_to_process]
        
        for photo_id in photo_ids:
            auth_backend.update_photo_status(photo_id, "received")

        import threading
        def process_photos_background():
            for photo in photos_to_process:
                photo_id = str(photo["_id"])
                
                try:
                    auth_backend.update_photo_status(photo_id, "extracting")
                    
                    image_data = photo["imageStorage"]["imageData"]
                    
                    start_time = time.time()
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
                        temp_file.write(image_data)
                        temp_path = temp_file.name
                    
                    try:
                        img = Image.open(temp_path)
                        raw_text = pytesseract.image_to_string(img, lang="eng+nld")
                        extracted_text = " ".join(raw_text.split())
                        
                        processing_duration = int((time.time() - start_time) * 1000)
                        text_length = len(extracted_text)
                        line_count = len(raw_text.split('\n'))
                        
                        processing_meta = {
                            "textLength": text_length,
                            "lineCount": line_count,
                            "processingDurationMs": processing_duration,
                        }
                        
                        auth_backend.update_photo_status(photo_id, "done", extracted_text=extracted_text, processing_meta=processing_meta)
                    finally:
                        os.unlink(temp_path)
                        
                except Exception as e:
                    error_message = str(e)
                    auth_backend.update_photo_status(photo_id, "error", error_message=error_message)

        thread = threading.Thread(target=process_photos_background)
        thread.start()

        return jsonify({
            "message": f"Verwerken van {len(photo_ids)} foto('s) gestart",
            "photoIds": photo_ids,
            "total": len(photo_ids),
        }), 202
    except Exception as e:
        print(f"Process all photos error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to process photos",
            "details": str(e)
        }), 500

@upload_bp.route("/api/photos/status", methods=["GET"])
def get_photos_status():
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        photos = auth_backend.get_photos_status(user_id)
        
        return jsonify({
            "photos": photos,
            "total": len(photos),
        }), 200
    except Exception as e:
        print(f"Get photos status error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve photos status",
            "details": str(e)
        }), 500

@upload_bp.route("/api/photos", methods=["DELETE"])
def delete_all_photos():
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        deleted_count = auth_backend.delete_user_photos(user_id)
        
        return jsonify({
            "deletedCount": deleted_count,
            "message": f"{deleted_count} foto('s) verwijderd",
        }), 200
    except Exception as e:
        print(f"Delete photos error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to delete photos",
            "details": str(e)
        }), 500

@upload_bp.route("/api/admin/migrate-photos", methods=["POST"])
def migrate_photos():
    #admin endpoint to run migration for missing originalFilename fields
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        updated_count = auth_backend.migrate_missing_original_filenames()
        
        return jsonify({
            "message": f"Migration complete: {updated_count} photos updated",
            "updatedCount": updated_count,
        }), 200
    except Exception as e:
        print(f"Migration error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Migration failed",
            "details": str(e)
        }), 500


def validate_final_result_structure(data):
    """Validate FINAL resultJson structure:
    {
      "user": {"short_summary": "string"},
      "admin": {
        "timestampLeakage": [{"hour": int, "count": int}] * 24,
        "socialContextLeakage": {relationshipLabels, handles, emails, phonePatterns, nameEntities},
        "professionalLiabilitySignals": [{name,count}] * 3,
        "locationLeakageSignals": [{name,count}] * 3
      }
    }
    """
    if not isinstance(data, dict):
        return False, "Not an object"

    if "user" not in data or "admin" not in data:
        return False, "Missing user/admin"

    user = data.get("user")
    admin = data.get("admin")

    if not isinstance(user, dict) or not isinstance(admin, dict):
        return False, "user/admin must be objects"

    if not isinstance(user.get("short_summary"), str):
        return False, "user.short_summary must be a string"

    # timestampLeakage
    tl = admin.get("timestampLeakage")
    if not isinstance(tl, list) or len(tl) != 24:
        return False, "admin.timestampLeakage must be a list of 24 items"
    for i, item in enumerate(tl):
        if not isinstance(item, dict):
            return False, f"timestampLeakage[{i}] must be an object"
        if item.get("hour") != i:
            return False, f"timestampLeakage[{i}].hour must be {i}"
        if not isinstance(item.get("count"), int) or item.get("count") < 0:
            return False, f"timestampLeakage[{i}].count must be a non-negative int"

    # socialContextLeakage
    scl = admin.get("socialContextLeakage")
    if not isinstance(scl, dict):
        return False, "admin.socialContextLeakage must be an object"
    for key in ["relationshipLabels", "handles", "emails", "phonePatterns", "nameEntities"]:
        if not isinstance(scl.get(key), int) or scl.get(key) < 0:
            return False, f"socialContextLeakage.{key} must be a non-negative int"

    # professionalLiabilitySignals
    pls = admin.get("professionalLiabilitySignals")
    if not isinstance(pls, list) or len(pls) != 3:
        return False, "admin.professionalLiabilitySignals must be a list of 3 items"
    expected_pls = ["Aggression Hits", "Profanity Hits", "Shouting Hits"]
    for i, exp_name in enumerate(expected_pls):
        item = pls[i]
        if not isinstance(item, dict):
            return False, f"professionalLiabilitySignals[{i}] must be an object"
        if item.get("name") != exp_name:
            return False, f"professionalLiabilitySignals[{i}].name must be '{exp_name}'"
        if not isinstance(item.get("count"), int) or item.get("count") < 0:
            return False, f"professionalLiabilitySignals[{i}].count must be a non-negative int"

    # locationLeakageSignals
    lls = admin.get("locationLeakageSignals")
    if not isinstance(lls, list) or len(lls) != 3:
        return False, "admin.locationLeakageSignals must be a list of 3 items"
    expected_lls = ["Explicit location keywords", "Travel/route context", "No location signals"]
    for i, exp_name in enumerate(expected_lls):
        item = lls[i]
        if not isinstance(item, dict):
            return False, f"locationLeakageSignals[{i}] must be an object"
        if item.get("name") != exp_name:
            return False, f"locationLeakageSignals[{i}].name must be '{exp_name}'"
        if not isinstance(item.get("count"), int) or item.get("count") < 0:
            return False, f"locationLeakageSignals[{i}].count must be a non-negative int"

    return True, "Valid"


def validate_summary_only(data):
    """Validate summary-only JSON: {"short_summary": "..."}"""
    if not isinstance(data, dict):
        return False
    ss = data.get("short_summary")
    return isinstance(ss, str) and len(ss.strip()) > 0

def chunk_text(text, chunk_size=1000, overlap=150):
    """Split text into chunks with overlap"""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        
        # If not the last chunk, try to break at word boundary
        if end < len(text):
            # Find last space before the end
            last_space = chunk.rfind(' ')
            if last_space > chunk_size - overlap - 50:  # Ensure we don't cut too much
                chunk = chunk[:last_space]
                end = start + last_space
        
        chunks.append(chunk)
        
        # Calculate next start with overlap - we should have moved past end-overlap
        if end >= len(text):  # Last chunk
            break
            
        # Move start forward, ensuring we make progress
        start = end - overlap
        
        # Ensure we make forward progress
        if start <= end - chunk_size:
            start = end
            
        # Safety limit
        if len(chunks) >= 10:  # realistic cap per photo
            print(f"Warning: Chunking stopped at 10 chunks to prevent overload")
            break
    
    return chunks

def create_chunk_prompt(photo_info, chunk_text, chunk_index, total_chunks):
    """Create prompt for analyzing a single text chunk"""
    return f'''You are summarizing OCR text from a photo.

Photo: {photo_info['filename']} (uploaded: {photo_info['uploaded_at']})

INSTRUCTIONS:
- Return ONLY valid JSON. No preamble. No explanation. No markdown.
- Output must start with "{{" and end with "}}".
- Keep short_summary natural human text, 1-3 sentences.

Return this JSON structure:
{{"short_summary": ""}}

OCR text to summarize:
{chunk_text}'''

def merge_analysis_results(results_list):
    """Merge multiple analysis results with deduplication"""
    merged = {
        "highlights": [],
        "action_items": [],
        "dates_deadlines": [],
        "names_entities": [],
        "numbers_amounts": [],
        "key_takeaways": []
    }
    
    # Helper to dedupe by key function
    def dedupe_list(items, key_func=None):
        seen = set()
        unique = []
        for item in items:
            # Handle dictionary items for structured fields
            if isinstance(item, dict):
                key = key_func(item) if key_func else str(item)
            else:
                key = key_func(item) if key_func else item
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique
    
    for result in results_list:
        if not isinstance(result, dict):
            continue
            
        # Merge and dedupe each field
        merged["highlights"].extend(result.get("highlights", []))
        merged["action_items"].extend(result.get("action_items", []))
        merged["dates_deadlines"].extend(result.get("dates_deadlines", []))
        merged["names_entities"].extend(result.get("names_entities", []))
        merged["numbers_amounts"].extend(result.get("numbers_amounts", []))
        merged["key_takeaways"].extend(result.get("key_takeaways", []))
    
    # Dedupe each field
    merged["highlights"] = dedupe_list(merged["highlights"])
    merged["action_items"] = dedupe_list(merged["action_items"])
    merged["names_entities"] = dedupe_list(merged["names_entities"])
    merged["key_takeaways"] = dedupe_list(merged["key_takeaways"])
    
    # Dedupe structured fields
    merged["dates_deadlines"] = dedupe_list(
        merged["dates_deadlines"], 
        lambda x: f"{x.get('date', '')}|{x.get('context', '')}"
    )
    merged["numbers_amounts"] = dedupe_list(
        merged["numbers_amounts"],
        lambda x: f"{x.get('value', '')}|{x.get('context', '')}"
    )
    
    return merged

def create_photo_summary_prompt(photo_info, merged_analysis):
    """Create final summary prompt for a photo using merged chunk results"""
    highlights_text = "\n".join([f"- {h}" for h in merged_analysis.get("highlights", [])[:5]])
    actions_text = "\n".join([f"- {a}" for a in merged_analysis.get("action_items", [])[:5]])
    names_text = "\n".join([f"- {n}" for n in merged_analysis.get("names_entities", [])[:5]])
    
    prompt = f'''Create a concise summary (1-3 sentences) for photo "{photo_info['filename']}'" based on these extracted insights:

Highlights:
{highlights_text}

Action Items:
{actions_text}

Names/Entities:
{names_text}

Return ONLY a JSON object with this structure:
{{"short_summary": "Concise summary here"}}

The summary should be natural human text, NOT JSON-like content.'''

    return prompt

def parse_llm_response(response, mode: str = "summary"):
    """Parse LLM response.
    mode:
      - "summary": expects {"short_summary": "..."}
      - "final": expects the full resultJson structure (user/admin)
    """
    import json
    if not response or not response.strip():
        return None

    clean_response = response.strip()

    # Try direct JSON parse
    try:
        obj = json.loads(clean_response)
    except json.JSONDecodeError:
        # Extract JSON between first { and last }
        first_brace = clean_response.find('{')
        last_brace = clean_response.rfind('}')
        if first_brace == -1 or last_brace == -1 or last_brace <= first_brace:
            return None
        try:
            obj = json.loads(clean_response[first_brace:last_brace + 1])
        except Exception:
            return None

    if mode == "summary":
        if validate_summary_only(obj):
            # Clean weird braces inside the string if the model did that
            ss = obj.get("short_summary", "")
            if isinstance(ss, str) and ('{' in ss or '}' in ss):
                obj["short_summary"] = ss.replace('{', '').replace('}', '').strip()
            return obj
        return None

    if mode == "final":
        ok, _msg = validate_final_result_structure(obj)
        return obj if ok else None

    return None


# === Helper functions for admin metrics and final resultJson ===

def _empty_admin_metrics():
    return {
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


def build_admin_metrics_from_ocr(ocr_texts):
    """Deterministically compute admin dashboard metrics from OCR text.
    This ensures the JSON ALWAYS matches the AdminDashboard graphs.
    """
    import re

    metrics = _empty_admin_metrics()

    combined = "\n".join([t for t in ocr_texts if isinstance(t, str) and t.strip()])
    if not combined.strip():
        metrics["locationLeakageSignals"][2]["count"] = 1
        return metrics

    # Timestamp leakage (00-23h) from time-like patterns
    # Examples: 13:45, 13h45, 13:45:22, 9:01, 09:01
    time_pat = re.compile(r"\b(?P<hour>[01]?\d|2[0-3])\s*(?:[:h]\s*[0-5]\d)(?::\s*[0-5]\d)?\b")
    for m in time_pat.finditer(combined):
        h = int(m.group("hour"))
        metrics["timestampLeakage"][h]["count"] += 1

    # Social context leakage
    handle_pat = re.compile(r"@([A-Za-z0-9_]{2,})")
    email_pat = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
    phone_pat = re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}\b")

    metrics["socialContextLeakage"]["handles"] = len(handle_pat.findall(combined))
    metrics["socialContextLeakage"]["emails"] = len(email_pat.findall(combined))
    metrics["socialContextLeakage"]["phonePatterns"] = len(phone_pat.findall(combined))

    rel_words = [
        "boyfriend", "girlfriend", "bf", "gf", "husband", "wife",
        "mom", "mum", "mother", "dad", "father", "sister", "brother",
        "friend", "bestie", "partner", "manager", "boss"
    ]
    rel_count = 0
    low = combined.lower()
    for w in rel_words:
        rel_count += low.count(w)
    metrics["socialContextLeakage"]["relationshipLabels"] = rel_count

    # Name entities (simple heuristic: capitalized words, excluding common starts)
    # Not perfect, but stable for your admin graphs.
    cap_pat = re.compile(r"\b[A-Z][a-z]{2,}\b")
    caps = cap_pat.findall(combined)
    stop = set(["I", "The", "A", "An", "And", "Or", "But", "To", "Of", "In", "On", "At", "For", "With"])
    nameish = [c for c in caps if c not in stop]
    metrics["socialContextLeakage"]["nameEntities"] = len(nameish)

    # Professional liability signals
    aggression_words = [
        "kill", "hurt", "attack", "threat", "idiot", "stupid", "hate",
        "destroy", "beat", "punch", "slap"
    ]
    profanity_words = [
        "fuck", "shit", "bitch", "asshole", "damn", "cunt", "fucking"
    ]

    aggr_hits = 0
    prof_hits = 0
    for w in aggression_words:
        aggr_hits += low.count(w)
    for w in profanity_words:
        prof_hits += low.count(w)

    # Shouting hits: ALL CAPS tokens length>=4 or excessive !!
    caps_tokens = re.findall(r"\b[A-Z]{4,}\b", combined)
    exclam = combined.count("!!")
    shout_hits = len(caps_tokens) + exclam

    metrics["professionalLiabilitySignals"][0]["count"] = aggr_hits
    metrics["professionalLiabilitySignals"][1]["count"] = prof_hits
    metrics["professionalLiabilitySignals"][2]["count"] = shout_hits

    # Location leakage
    location_keywords = [
        "street", "st.", "straat", "address", "adres", "city", "stad",
        "station", "metro", "tram", "bus", "airport", "hotel", "postcode",
        "zip", "gps", "latitude", "longitude"
    ]
    travel_keywords = [
        "route", "travel", "trip", "flight", "train", "platform", "gate",
        "departure", "arrival", "destination"
    ]

    loc_count = 0
    trav_count = 0
    for w in location_keywords:
        loc_count += low.count(w)
    for w in travel_keywords:
        trav_count += low.count(w)

    if loc_count == 0 and trav_count == 0:
        metrics["locationLeakageSignals"][2]["count"] = 1
    else:
        metrics["locationLeakageSignals"][0]["count"] = loc_count
        metrics["locationLeakageSignals"][1]["count"] = trav_count
        metrics["locationLeakageSignals"][2]["count"] = 0

    return metrics


def build_final_result_json(short_summary: str, admin_metrics: dict):
    result = {
        "user": {"short_summary": short_summary or ""},
        "admin": admin_metrics or _empty_admin_metrics(),
    }
    # Defensive: ensure correct structure
    ok, _ = validate_final_result_structure(result)
    if not ok:
        result = {
            "user": {"short_summary": short_summary or ""},
            "admin": _empty_admin_metrics(),
        }
    return result

@upload_bp.route("/api/photos/analyze", methods=["POST"])
def analyze_photos():
    #analyze OCR text using Ollama LLM
    import json
    import time

    #simple in-memory lock to prevent concurrent analyze requests
    if not hasattr(analyze_photos, '_locks'):
        analyze_photos._locks = {}

    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        current_time = time.time()
        if user_id in analyze_photos._locks:
            last_request_time = analyze_photos._locks[user_id]
            if current_time - last_request_time < 30:  # 30 second cooldown
                return jsonify({"error": "Analysis already in progress. Please wait 30 seconds between requests."}), 429

        analyze_photos._locks[user_id] = current_time

        # Initialize analysis status for all eligible photos
        print(f"ANALYSIS PROGRESS: Initializing analysis status for user {user_id}")
        queued_count = auth_backend.initialize_analysis_status(user_id)
        print(f"ANALYSIS PROGRESS: Queued {queued_count} photos for analysis")

        #get photos with completed OCR - LIMIT to prevent resource overload
        photos_data = auth_backend.get_photos_for_analysis_limited(user_id, max_photos=20, max_chars=8000)

        if len(photos_data) == 0:
            return jsonify({"error": "No photos with completed OCR found to analyze"}), 400

        print(f"Found {len(photos_data)} photos with OCR text for analysis")
        print(f"ANALYSIS PROGRESS: Starting analysis of {len(photos_data)} photos for user {user_id}")

        # Build OCR text list for admin metrics
        ocr_texts = []
        per_photo_results = {}

        analysis_progress = {
            "photos_found": len(photos_data),
            "photos_started": 0,
            "photos_completed": 0,
            "photos_failed": 0,
            "photos_fallback": 0,
        }

        # Mark each photo as processing/completed so your progress UI keeps working
        for photo_idx, photo in enumerate(photos_data):
            photo_id = str(photo["_id"])
            filename = photo.get("originalFilename", f"photo_{photo_id}")
            auth_backend.update_analysis_progress(photo_id, "processing")
            analysis_progress["photos_started"] += 1

            text = (photo.get("ocr", {}) or {}).get("extractedText", "")
            text = (text or "").strip()
            if text:
                ocr_texts.append(text)

            # Keep perPhotoResults minimal but useful
            per_photo_results[photo_id] = {
                "filename": filename,
                "hasText": bool(text),
                "textLength": len(text),
            }

            auth_backend.update_analysis_progress(photo_id, "completed")
            analysis_progress["photos_completed"] += 1

        # Deterministic admin metrics (matches AdminDashboard expected shape)
        admin_metrics = build_admin_metrics_from_ocr(ocr_texts)

        # LLM summary (ONLY user short summary)
        combined_text = "\n\n".join(ocr_texts)
        # Safety: do not send extremely large prompts
        max_chars = 9000
        if len(combined_text) > max_chars:
            combined_text = combined_text[:max_chars]

        summary_prompt = f'''You summarize OCR text from multiple screenshots.

INSTRUCTIONS:
- Return ONLY valid JSON. No preamble. No explanation. No markdown.
- Output must start with "{{" and end with "}}".
- Keep short_summary natural human text, 1-3 sentences.

Return this JSON structure:
{{"short_summary": ""}}

OCR text:
{combined_text}'''

        short_summary = ""
        try:
            llm_resp = auth_backend.query_ollama(summary_prompt, "llama3")
            parsed = parse_llm_response(llm_resp, mode="summary")
            if parsed and parsed.get("short_summary"):
                short_summary = parsed["short_summary"].strip()
        except Exception as e:
            print(f"LLM summary error: {e}")

        if not short_summary:
            # Fallback summary that is still valid for the UI
            short_summary = "Analysis completed, but no reliable summary could be generated."
            analysis_progress["photos_fallback"] += 1

        final_result_json = build_final_result_json(short_summary, admin_metrics)

        # Save combined user summary (shortSummary mirrors user.short_summary)
        try:
            summary_id = auth_backend.save_user_summary(
                user_id=user_id,
                photo_ids=list(per_photo_results.keys()),
                model_used="llama3_summary_only",
                result_json=final_result_json,
                short_summary=final_result_json.get("user", {}).get("short_summary", ""),
            )
            print(f"Saved user summary ID: {summary_id}")
        except Exception as e:
            print(f"Failed to save user summary: {e}")
            return jsonify({
                "error": "Failed to save analysis results",
                "details": str(e)
            }), 500

        return jsonify({
            "summary": final_result_json.get("user", {}).get("short_summary", ""),
            "details": final_result_json,
            "analyzedPhotos": len(per_photo_results),
            "summaryId": str(summary_id),
            "progress": analysis_progress,
            "perPhotoResults": per_photo_results,
        }), 200

    except Exception as e:
        print(f"Analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Analysis failed",
            "details": str(e)
        }), 500
    finally:
        #clean up the lock
        if hasattr(analyze_photos, '_locks') and user_id in analyze_photos._locks:
            del analyze_photos._locks[user_id]

@upload_bp.route("/api/photos/analysis-progress", methods=["GET"])
def get_analysis_progress():
    """Get real-time analysis progress for user's photos"""
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        progress_data = auth_backend.get_analysis_progress(user_id)
        
        # Calculate counters
        counters = {
            "photos_found": len(progress_data),
            "photos_started": len([p for p in progress_data if p["analysisStatus"] in ["processing", "sent_to_llm", "llm_failed", "fallback_used", "completed"]]),
            "photos_completed": len([p for p in progress_data if p["analysisStatus"] == "completed"]),
            "photos_failed": len([p for p in progress_data if p["analysisStatus"] == "llm_failed"]),
            "photos_fallback": len([p for p in progress_data if p["analysisStatus"] == "fallback_used"]),
            "photos_queued": len([p for p in progress_data if p["analysisStatus"] == "queued"])
        }
        
        return jsonify({
            "photos": progress_data,
            "counters": counters
        }), 200

    except Exception as e:
        print(f"Get analysis progress error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve analysis progress",
            "details": str(e)
        }), 500

@upload_bp.route("/api/photos/summary", methods=["GET"])
def get_summary():
    #get latest analysis for user
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        summary = auth_backend.get_latest_user_summary(user_id)
        
        if not summary:
            return jsonify({"error": "No analysis found"}), 404

        return jsonify({
            "summary": summary.get("shortSummary", ""),
            "details": summary.get("resultJson", {}),
            "createdAt": summary.get("createdAt"),
            "analyzedPhotos": len(summary.get("sourcePhotoIds", []))
        }), 200

    except Exception as e:
        print(f"Get summary error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve analysis",
            "details": str(e)
        }), 500
