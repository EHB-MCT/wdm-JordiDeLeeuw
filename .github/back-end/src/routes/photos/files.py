from flask import Blueprint, request, jsonify, send_file
from io import BytesIO
import auth_backend
from utils.auth import require_user_id

files_bp = Blueprint("files", __name__)

@files_bp.route("/api/photos", methods=["POST"])
def upload_photos():
    try:
        print("Upload endpoint called")
        user_id, err = require_user_id(request)
        if err:
            print("Upload failed: No user ID")
            return err

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
            "message": f"{len(uploaded_photos)} foto(s) succesvol geupload",
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


@files_bp.route("/api/photos", methods=["GET"])
def get_photos():
    try:
        user_id, err = require_user_id(request)
        if err:
            return err

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


@files_bp.route("/api/photos/<photo_id>/file", methods=["GET"])
def get_photo_file(photo_id):
    try:
        user_id, err = require_user_id(request)
        if err:
            return err

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


@files_bp.route("/api/photos", methods=["DELETE"])
def delete_all_photos():
    try:
        user_id, err = require_user_id(request)
        if err:
            return err

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
