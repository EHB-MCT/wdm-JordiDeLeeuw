from flask import Blueprint, request, jsonify
import auth_backend
import pytesseract
from PIL import Image
import tempfile
import os
import time
from utils.auth import require_user_id

processing_bp = Blueprint("processing", __name__)


@processing_bp.route("/api/photos/process-all", methods=["POST"])
def process_all_photos():
    try:
        user_id, err = require_user_id(request)
        if err:
            return err

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


@processing_bp.route("/api/photos/status", methods=["GET"])
def get_photos_status():
    try:
        user_id, err = require_user_id(request)
        if err:
            return err

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
