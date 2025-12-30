from flask import Blueprint, request, jsonify
from auth_backend import get_user_by_email, create_user, verify_password

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