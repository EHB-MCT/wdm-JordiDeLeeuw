from flask import Blueprint, request, jsonify
import os
from datetime import datetime

upload_bp = Blueprint("upload", __name__)

UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/app/uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def check_auth(request):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id

@upload_bp.route("/api/upload", methods=["POST"])
def upload_files():
    user_id = check_auth(request)
    if not user_id:
        return jsonify({"error": "Unauthorized - no user ID provided"}), 401

    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    
    if len(files) == 0:
        return jsonify({"error": "No files selected"}), 400

    uploaded_files = []
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    for i, file in enumerate(files):
        if file.filename == "":
            continue

        filename = f"{user_id}_{timestamp}_{i}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        file.save(filepath)
        
        uploaded_files.append({
            "original_name": file.filename,
            "saved_name": filename,
            "size": os.path.getsize(filepath),
        })

    return jsonify({
        "message": f"{len(uploaded_files)} bestand(en) succesvol geüpload",
        "files": uploaded_files,
        "user_id": user_id,
    }), 200
