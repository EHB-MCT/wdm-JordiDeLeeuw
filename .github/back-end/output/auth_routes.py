from flask import Blueprint, request, jsonify
from auth_backend import get_user_by_email, create_user, verify_password, get_user_by_id
from bson import ObjectId

#maakt een blueprint aan voor auth-routes
auth_bp = Blueprint("auth", __name__)

#register route
@auth_bp.route("/api/register", methods=["POST"])
def register():
    try:
        data = request.get_json() or {}

        email = data.get("email")
        password = data.get("password")
        confirm = data.get("confirmPassword")
        is_admin = data.get("isAdmin", False)

        #check op ontbrekende velden
        if not email or not password or not confirm:
            return jsonify({"error": "ontbrekende velden"}), 400

        #check wachtwoorden gelijk
        if password != confirm:
            return jsonify({"error": "wachtwoorden komen niet overeen"}), 400

        #check of user al bestaat
        if get_user_by_email(email):
            return jsonify({"error": "email bestaat al"}), 400

        user_id = create_user(email, password, is_admin)

        return jsonify({
            "message": "registratie gelukt",
            "userId": str(user_id),
            "email": email,
            "isAdmin": is_admin,
        }), 201
    except Exception as e:
        print(f"Register error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Registration failed",
            "details": str(e)
        }), 500


#login route
@auth_bp.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "ontbrekende velden"}), 400

        user = get_user_by_email(email)

        if not user:
            return jsonify({"error": "user niet gevonden"}), 400

        if not verify_password(password, user.get("password")):
            return jsonify({"error": "verkeerd wachtwoord"}), 400

        #hier zou normaal een token of session komen
        return jsonify({
            "message": "login gelukt",
            "userId": str(user["_id"]),
            "email": email,
            "isAdmin": user.get("isAdmin", False),
        }), 200
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Login failed",
            "details": str(e)
        }), 500

@auth_bp.route("/api/me", methods=["GET"])
def get_current_user():
    """Get current authenticated user info including admin status"""
    try:
        user_id = check_auth(request)
        if not user_id:
            return jsonify({"error": "Unauthorized - no user ID provided"}), 401
        
        user = get_user_by_id(user_id)
        if user:
            print(f"get_current_user: Found user {user_id}, isAdmin: {user.get('isAdmin', False)} (type: {type(user.get('isAdmin', False))})")
            return jsonify({
                "userId": str(user["_id"]),
                "email": user.get("email"),
                "isAdmin": user.get("isAdmin", False)
            }), 200
        else:
            return jsonify({"error": "User not found"}), 404
            
    except Exception as e:
        print(f"Get current user error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to get user info",
            "details": str(e)
        }), 500

def check_auth(request):
    """Extract user ID from X-User-Id header"""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id