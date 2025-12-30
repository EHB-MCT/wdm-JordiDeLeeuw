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

@upload_bp.route("/api/photos/analyze", methods=["POST"])
def analyze_photos():
    #analyze OCR text using Ollama LLM
    import json
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        #get photos with completed OCR
        photos_data = auth_backend.get_photos_for_analysis(user_id)
        
        if len(photos_data) == 0:
            return jsonify({"error": "No photos with completed OCR found to analyze"}), 400

        #build input text for LLM
        input_text = "Here are the extracted texts from photos:\n\n"
        photo_ids = []
        
        for i, photo in enumerate(photos_data, 1):
            photo_ids.append(str(photo["_id"]))
            filename = photo.get("originalFilename", f"photo_{photo['_id']}")
            uploaded_at = photo.get("uploadedAt", "").strftime("%Y-%m-%d %H:%M") if photo.get("uploadedAt") else "unknown"
            extracted_text = photo.get("ocr", {}).get("extractedText", "").strip()
            
            input_text += f"Photo {i}: {filename} (uploaded: {uploaded_at})\n"
            input_text += f"Text: {extracted_text}\n\n"

        #build the proper prompt
        prompt = f'''You are a personal assistant helping a normal user remember important information from screenshots and photos.
Based ONLY on the text below, extract what is important to remember.
Do not invent information.
Return STRICT JSON in the following format:

{{
  "highlights": [],
  "action_items": [],
  "dates_deadlines": [{{ "date": "", "context": "" }}],
  "names_entities": [],
  "numbers_amounts": [{{ "value": "", "context": "" }}],
  "key_takeaways": [],
  "short_summary": ""
}}

If something is not present, return empty arrays or empty strings.

Text to analyze:
{input_text}'''

        print(f"Analyzing {len(photos_data)} photos for user {user_id}")
        
        #query Ollama
        response = auth_backend.query_ollama(prompt, "llama3")
        
        try:
            #parse JSON response
            result_json = json.loads(response)
            short_summary = result_json.get("short_summary", "")
        except json.JSONDecodeError:
            #if JSON parsing fails, create a structured response with raw text
            print(f"Failed to parse JSON from Ollama, using fallback")
            result_json = {
                "highlights": [],
                "action_items": [],
                "dates_deadlines": [],
                "names_entities": [],
                "numbers_amounts": [],
                "key_takeaways": [],
                "short_summary": response[:200] + "..." if len(response) > 200 else response
            }
            short_summary = result_json["short_summary"]

        #save summary to database
        summary_id = auth_backend.save_user_summary(
            user_id=user_id,
            photo_ids=photo_ids,
            model_used="llama3",
            result_json=result_json,
            short_summary=short_summary
        )

        print(f"Analysis complete for user {user_id}, summary ID: {summary_id}")

        return jsonify({
            "summary": short_summary,
            "details": result_json,
            "analyzedPhotos": len(photos_data),
            "summaryId": str(summary_id)
        }), 200

    except Exception as e:
        print(f"Analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Analysis failed",
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
