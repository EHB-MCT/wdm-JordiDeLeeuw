from flask import Blueprint, jsonify, request
from auth_backend import check_admin_status, get_admin_ai_aggregated_stats, get_admin_trends, get_admin_analyses_overview

# Maakt de admin-blueprint aan
admin_bp = Blueprint("admin", __name__)

def check_auth(request):
    # Haal de user-id uit de X-User-Id header
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id

@admin_bp.route("/api/admin/stats", methods=["GET"])
def get_admin_stats_endpoint():
    # Haalt adminstatistieken op (alleen voor admins)
    try:
        # Check authenticatie
        user_id = check_auth(request)
        if not user_id:
            print(f"Admin stats: No user_id provided in headers: {dict(request.headers)}")
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401
        
        print(f"Admin stats: Received request for user_id: {user_id}")
        
        # Check adminstatus
        is_admin = check_admin_status(user_id)
        print(f"Admin stats: User {user_id} admin status: {is_admin}")
        
        if not is_admin:
            print(f"Admin stats: Access denied for user {user_id}")
            return jsonify({"error": "admin only"}), 403
        
        print(f"Admin stats: Access granted for admin user {user_id}")
        
        # Haal admin stats op
        stats = get_admin_ai_aggregated_stats()
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
    # Haalt trenddata op voor charts (alleen voor admins)
    try:
        # Check authenticatie
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401
        
        # Check adminstatus
        if not check_admin_status(user_id):
            return jsonify({"error": "admin only"}), 403
        
        # Lees days parameter (standaard 7)
        days = request.args.get("days", 7, type=int)
        if days < 1 or days > 30:
            return jsonify({"error": "Days parameter must be between 1 and 30"}), 400
        
        # Haal trenddata op
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

@admin_bp.route("/api/admin/analyses", methods=["GET"])
def get_admin_analyses_endpoint():
    # Haalt een overzicht op van alle analyses (alleen voor admins)
    try:
        # Check authenticatie
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401

        # Check adminstatus
        if not check_admin_status(user_id):
            return jsonify({"error": "admin only"}), 403

        # Optionele limit (standaard 100, max 500)
        limit = request.args.get("limit", 100, type=int)
        if limit < 1:
            limit = 1
        if limit > 500:
            limit = 500

        items = get_admin_analyses_overview(limit=limit)
        return jsonify({"items": items, "count": len(items)}), 200

    except Exception as e:
        print(f"Admin analyses overview error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve analyses overview",
            "details": str(e)
        }), 500
