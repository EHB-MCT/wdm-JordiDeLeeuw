from flask import Blueprint, jsonify, request
from auth_backend import check_admin_status, get_admin_stats, get_user_by_id

# Create admin blueprint
admin_bp = Blueprint("admin", __name__)

def check_auth(request):
    """Extract user ID from X-User-Id header"""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id

@admin_bp.route("/api/admin/stats", methods=["GET"])
def get_admin_stats_endpoint():
    """Get admin statistics - admin only endpoint"""
    try:
        # Check authentication
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401
        
        # Check admin status
        if not check_admin_status(user_id):
            return jsonify({"error": "admin only"}), 403
        
        # Get admin stats
        stats = get_admin_stats()
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"Admin stats error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve admin stats",
            "details": str(e)
        }), 500