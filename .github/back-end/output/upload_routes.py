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

def validate_json_structure(data):
    """Validate JSON response structure and types"""
    required_keys = [
        "highlights", "action_items", "dates_deadlines", 
        "names_entities", "numbers_amounts", "key_takeaways", "short_summary"
    ]
    
    if not isinstance(data, dict) or not all(key in data for key in required_keys):
        return False, "Missing required keys or not a dict"
    
    if not all(isinstance(data.get(key), list) for key in [
        "highlights", "action_items", "dates_deadlines", 
        "names_entities", "numbers_amounts", "key_takeaways"
    ]):
        return False, "Array fields must be lists"
    
    if not isinstance(data.get("short_summary"), str):
        return False, "short_summary must be a string"
    
    #validate dates_deadlines structure
    for item in data.get("dates_deadlines", []):
        if not isinstance(item, dict) or "date" not in item or "context" not in item:
            return False, "dates_deadlines items must have date and context"
    
    #validate numbers_amounts structure
    for item in data.get("numbers_amounts", []):
        if not isinstance(item, dict) or "value" not in item or "context" not in item:
            return False, "numbers_amounts items must have value and context"
    
    #ensure short_summary is plain text, not JSON
    short_summary = data.get("short_summary", "")
    if '{' in short_summary or '}' in short_summary:
        #clean JSON artifacts from short_summary
        cleaned = short_summary.replace('{', '').replace('}', '').strip()
        if cleaned.startswith('"') and cleaned.endswith('"'):
            cleaned = cleaned[1:-1]
        data["short_summary"] = cleaned
        print("Cleaned JSON artifacts from short_summary")
    
    return True, "Valid"

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
    return f'''You are analyzing a chunk (chunk {chunk_index + 1} of {total_chunks}) from a photo.

Photo: {photo_info['filename']} (uploaded: {photo_info['uploaded_at']})

INSTRUCTIONS:
- Return ONLY valid JSON. No preamble. No explanation. No markdown.
- Do NOT include JSON inside short_summary.
- short_summary must be plain text (1-2 sentences for this chunk).
- If info exists in chunk text, fill correct arrays; do not leave everything empty.
- Output must start with "{{" and end with "}}".

Return this JSON structure:
{{
  "highlights": [],
  "action_items": [],
  "dates_deadlines": [{{"date": "", "context": ""}}],
  "names_entities": [],
  "numbers_amounts": [{{"value": "", "context": ""}}],
  "key_takeaways": [],
  "short_summary": ""
}}

Chunk text to analyze:
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

def parse_llm_response(response):
    """Parse and validate LLM response with retry logic"""
    import json
    if not response or not response.strip():
        return None
        
    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            clean_response = response.strip()
            
            #try parsing entire response first
            try:
                result_json = json.loads(clean_response)
            except json.JSONDecodeError:
                #extract JSON between first { and last }
                first_brace = clean_response.find('{')
                last_brace = clean_response.rfind('}')
                
                if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                    json_str = clean_response[first_brace:last_brace + 1]
                    result_json = json.loads(json_str)
                else:
                    raise Exception("No JSON found in response")
            
            #validate structure
            is_valid, validation_msg = validate_json_structure(result_json)
            if is_valid:
                return result_json
            else:
                print(f"Invalid JSON structure: {validation_msg}")
                if attempt == max_attempts - 1:
                    return None
                    
        except Exception as e:
            print(f"Parse attempt {attempt + 1} failed: {e}")
            if attempt == max_attempts - 1:
                return None
    
    return None

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

        #get photos with completed OCR - LIMIT to prevent resource overload
        photos_data = auth_backend.get_photos_for_analysis_limited(user_id, max_photos=20, max_chars=8000)
        
        if len(photos_data) == 0:
            return jsonify({"error": "No photos with completed OCR found to analyze"}), 400

#chunking-based analysis per photo with total limits
        max_photos = 20
        max_chunks_per_photo = 10
        
        print(f"Starting chunked analysis of {len(photos_data)} photos for user {user_id}")
        
        per_photo_results = {}
        all_photo_data = []
        
        for photo_idx, photo in enumerate(photos_data[:max_photos]):
            photo_id = str(photo["_id"])
            photo_info = {
                "id": photo_id,
                "filename": photo.get("originalFilename", f"photo_{photo_id}"),
                "uploaded_at": photo.get("uploadedAt", "").strftime("%Y-%m-%d %H:%M") if photo.get("uploadedAt") else "unknown",
                "extracted_text": photo.get("ocr", {}).get("extractedText", "").strip()
            }
            
            if not photo_info["extracted_text"]:
                print(f"Skipping photo {photo_idx + 1} - no extracted text")
                continue
            
            #chunk the text
            chunks = chunk_text(photo_info["extracted_text"], chunk_size=1000, overlap=150)
            
            #limit chunks per photo
            if len(chunks) > max_chunks_per_photo:
                chunks = chunks[:max_chunks_per_photo]
                print(f"Limited photo {photo_idx + 1} to {max_chunks_per_photo} chunks")
            
            print(f"Processing photo {photo_idx + 1}: {photo_info['filename']}, {len(chunks)} chunks, {len(photo_info['extracted_text'])} chars")
            
            chunk_results = []
            
            #analyze each chunk
            for chunk_idx, chunk in enumerate(chunks):
                print(f"  Analyzing chunk {chunk_idx + 1}/{len(chunks)} ({len(chunk)} chars)")
                
                chunk_prompt = create_chunk_prompt(photo_info, chunk, chunk_idx, len(chunks))
                
                try:
                    chunk_response = auth_backend.query_ollama(chunk_prompt, "llama3")
                    chunk_result = parse_llm_response(chunk_response)
                    
                    if chunk_result:
                        chunk_results.append(chunk_result)
                        print(f"    ✓ Chunk {chunk_idx + 1} analyzed successfully")
                    else:
                        print(f"    ✗ Chunk {chunk_idx + 1} failed to parse")
                        
                except Exception as e:
                    print(f"    ✗ Chunk {chunk_idx + 1} error: {e}")
            
            #merge chunk results for this photo
            if chunk_results:
                merged_photo_analysis = merge_analysis_results(chunk_results)
                
                #create final photo summary
                summary_prompt = create_photo_summary_prompt(photo_info, merged_photo_analysis)
                try:
                    summary_response = auth_backend.query_ollama(summary_prompt, "llama3")
                    summary_result = parse_llm_response(summary_response)
                    
                    if summary_result and "short_summary" in summary_result:
                        merged_photo_analysis["short_summary"] = summary_result["short_summary"]
                        print(f"    ✓ Photo summary created: {summary_result['short_summary'][:100]}...")
                    else:
                        #fallback: use best existing summary or create generic one
                        existing_summaries = [cr.get("short_summary", "") for cr in chunk_results if cr.get("short_summary")]
                        merged_photo_analysis["short_summary"] = existing_summaries[0] if existing_summaries else f"Analysis of {photo_info['filename']} with {len(chunk_results)} processed chunks"
                        
                except Exception as e:
                    print(f"    ✗ Photo summary error: {e}")
                    merged_photo_analysis["short_summary"] = f"Analysis of {photo_info['filename']}"
                
                #store photo result
                per_photo_results[photo_id] = {
                    "photo_info": photo_info,
                    "analysis": merged_photo_analysis,
                    "chunk_count": len(chunk_results)
                }
                all_photo_data.append(merged_photo_analysis)
                
                #save per-photo pipeline result
                try:
                    auth_backend.update_photo_pipeline_result(photo_id, "userExtract", merged_photo_analysis)
                except Exception as e:
                    print(f"    ⚠ Failed to save pipeline result: {e}")
            
            print(f"  Photo {photo_idx + 1} complete: {len(chunk_results)} chunks analyzed")
        
        #create final combined summary across all photos
        if all_photo_data:
            print(f"Creating final combined summary from {len(all_photo_data)} photos...")
            final_merged = merge_analysis_results(all_photo_data)
            
            #create final combined summary prompt
            final_prompt = f'''Create a concise summary (1-3 sentences) of all analyzed photos based on these combined insights:

Total photos analyzed: {len(all_photo_data)}

Key highlights found:
{chr(10).join([f"- {h}" for h in final_merged.get("highlights", [])[:5]])}

Main action items:
{chr(10).join([f"- {a}" for a in final_merged.get("action_items", [])[:5]])}

Important dates/entities:
{chr(10).join([f"- {n}" for n in final_merged.get("names_entities", [])[:3]])}

Return ONLY this JSON structure:
{{"short_summary": "Concise summary of all photos"}}

The summary should be natural human text covering the main insights from all photos.'''
            
            try:
                final_response = auth_backend.query_ollama(final_prompt, "llama3")
                final_summary_result = parse_llm_response(final_response)
                
                if final_summary_result and "short_summary" in final_summary_result:
                    final_merged["short_summary"] = final_summary_result["short_summary"]
                    print(f"✓ Final summary created: {final_summary_result['short_summary'][:150]}...")
                else:
                    final_merged["short_summary"] = f"Analysis of {len(all_photo_data)} photos with extracted text and insights"
                    
            except Exception as e:
                print(f"✗ Final summary error: {e}")
                final_merged["short_summary"] = f"Analysis of {len(all_photo_data)} photos"
            
            final_result_json = final_merged
        else:
            final_result_json = {
                "highlights": [],
                "action_items": [],
                "dates_deadlines": [],
                "names_entities": [],
                "numbers_amounts": [],
                "key_takeaways": [],
                "short_summary": "No photos with extracted text found to analyze"
            }

        print(f"Chunked analysis complete for user {user_id}")
        
        #save combined user summary
        try:
            summary_id = auth_backend.save_user_summary(
                user_id=user_id,
                photo_ids=list(per_photo_results.keys()),
                model_used="llama3_chunked",
                result_json=final_result_json,
                short_summary=final_result_json.get("short_summary", "")
            )
            print(f"Saved user summary ID: {summary_id}")
        except Exception as e:
            print(f"Failed to save user summary: {e}")
            return jsonify({
                "error": "Failed to save analysis results",
                "details": str(e)
            }), 500

        return jsonify({
            "summary": final_result_json.get("short_summary", ""),
            "details": final_result_json,
            "analyzedPhotos": len(per_photo_results),
            "summaryId": str(summary_id),
            "perPhotoResults": {
                str(pid): {
                    "filename": result["photo_info"]["filename"],
                    "chunkCount": result["chunk_count"],
                    "analysis": result["analysis"]
                }
                for pid, result in per_photo_results.items()
            }
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
