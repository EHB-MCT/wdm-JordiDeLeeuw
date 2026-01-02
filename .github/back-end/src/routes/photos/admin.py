from flask import Blueprint, request, jsonify
import auth_backend
from utils.auth import require_user_id

photos_admin_bp = Blueprint("photos_admin", __name__)


@photos_admin_bp.route("/api/admin/migrate-photos", methods=["POST"])
def migrate_photos():
    # admin endpoint to run migration for missing originalFilename fields
    try:
        user_id, err = require_user_id(request)
        if err:
            return err

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
