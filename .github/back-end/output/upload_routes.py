from flask import Blueprint, request, jsonify, send_file
from io import BytesIO
import auth_backend

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
