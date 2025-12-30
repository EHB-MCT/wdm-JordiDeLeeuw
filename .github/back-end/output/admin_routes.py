from flask import Blueprint, jsonify, request
from auth_backend import check_admin_status, get_admin_stats, get_admin_trends

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
    """Get comprehensive admin statistics - admin only endpoint"""
    try:
        # Check authentication
        user_id = check_auth(request)
        if not user_id:
            print(f"Admin stats: No user_id provided in headers: {dict(request.headers)}")
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401
        
        print(f"Admin stats: Received request for user_id: {user_id}")
        
        # Check admin status
        is_admin = check_admin_status(user_id)
        print(f"Admin stats: User {user_id} admin status: {is_admin}")
        
        if not is_admin:
            print(f"Admin stats: Access denied for user {user_id}")
            return jsonify({"error": "admin only"}), 403
        
        print(f"Admin stats: Access granted for admin user {user_id}")
        
        # Get admin stats
        stats = get_admin_stats()
        if not stats:
            return jsonify({"error": "Failed to retrieve admin statistics"}), 500
            
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"Admin stats error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve admin stats",
            "details": str(e)
        }), 500

@admin_bp.route("/api/admin/trends", methods=["GET"])
def get_admin_trends_endpoint():
    """Get admin trend data for charts - admin only endpoint"""
    try:
        # Check authentication
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401
        
        # Check admin status
        if not check_admin_status(user_id):
            return jsonify({"error": "admin only"}), 403
        
        # Get days parameter (default to 7)
        days = request.args.get("days", 7, type=int)
        if days < 1 or days > 30:
            return jsonify({"error": "Days parameter must be between 1 and 30"}), 400
        
        # Get trends data
        trends = get_admin_trends(days)
        if not trends:
            return jsonify({"error": "Failed to retrieve trend data"}), 500
            
        return jsonify(trends), 200
        
    except Exception as e:
        print(f"Admin trends error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve trends",
            "details": str(e)
        }), 500