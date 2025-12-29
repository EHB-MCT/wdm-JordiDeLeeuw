from flask import Blueprint, request, jsonify, send_file
from io import BytesIO
import auth_backend
import pytesseract
from PIL import Image
import tempfile
import os

upload_bp = Blueprint("upload", __name__)

def check_auth(request):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id

@upload_bp.route("/api/photos", methods=["POST"])
def upload_photos():
    user_id = check_auth(request)
    if not user_id:
        return jsonify({"error": "Unauthorized - no user ID provided"}), 401

    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    
    if len(files) == 0:
        return jsonify({"error": "No files selected"}), 400

    uploaded_photos = []

    for file in files:
        if file.filename == "":
            continue

        image_data = file.read()
        mime_type = file.mimetype or "image/jpeg"
        size = len(image_data)

        photo_id = auth_backend.save_photo(
            user_id=user_id,
            filename=file.filename,
            mime_type=mime_type,
            size=size,
            image_data=image_data,
        )

        uploaded_photos.append({
            "id": str(photo_id),
            "filename": file.filename,
            "size": size,
        })

    return jsonify({
        "message": f"{len(uploaded_photos)} foto(s) succesvol geüpload",
        "photos": uploaded_photos,
    }), 200

@upload_bp.route("/api/photos", methods=["GET"])
def get_photos():
    user_id = check_auth(request)
    if not user_id:
        return jsonify({"error": "Unauthorized - no user ID provided"}), 401

    photos = auth_backend.get_user_photos(user_id)
    
    return jsonify({
        "photos": photos,
        "count": len(photos),
    }), 200

@upload_bp.route("/api/photos/<photo_id>/file", methods=["GET"])
def get_photo_file(photo_id):
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

@upload_bp.route("/api/photos/process-all", methods=["POST"])
def process_all_photos():
    user_id = check_auth(request)
    if not user_id:
        return jsonify({"error": "Unauthorized - no user ID provided"}), 401

    photos_to_process = auth_backend.get_photos_for_processing(user_id)
    
    if len(photos_to_process) == 0:
        return jsonify({"error": "Geen foto&apos;s om te verwerken"}), 400

    photo_ids = [str(photo["_id"]) for photo in photos_to_process]
    
    for photo_id in photo_ids:
        auth_backend.update_photo_status(photo_id, "received")

    import threading
    def process_photos_background():
        for photo in photos_to_process:
            photo_id = str(photo["_id"])
            
            try:
                auth_backend.update_photo_status(photo_id, "extracting")
                
                image_data = photo["imageData"]
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
                    temp_file.write(image_data)
                    temp_path = temp_file.name
                
                try:
                    img = Image.open(temp_path)
                    raw_text = pytesseract.image_to_string(img, lang="eng+nld")
                    extracted_text = " ".join(raw_text.split())
                    
                    auth_backend.update_photo_status(photo_id, "done", extracted_text=extracted_text)
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

@upload_bp.route("/api/photos/status", methods=["GET"])
def get_photos_status():
    user_id = check_auth(request)
    if not user_id:
        return jsonify({"error": "Unauthorized - no user ID provided"}), 401

    photos = auth_backend.get_user_photos(user_id)
    
    status_list = [
        {
            "id": photo["id"],
            "filename": photo["filename"],
            "status": photo["status"],
            "extractedText": photo.get("extractedText"),
            "errorMessage": photo.get("errorMessage"),
        }
        for photo in photos
    ]
    
    return jsonify({
        "photos": status_list,
        "total": len(status_list),
    }), 200

@upload_bp.route("/api/photos", methods=["DELETE"])
def delete_all_photos():
    user_id = check_auth(request)
    if not user_id:
        return jsonify({"error": "Unauthorized - no user ID provided"}), 401

    deleted_count = auth_backend.delete_user_photos(user_id)
    
    return jsonify({
        "deletedCount": deleted_count,
        "message": f"{deleted_count} foto('s) verwijderd",
    }), 200
