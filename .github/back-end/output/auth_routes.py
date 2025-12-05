from flask import Blueprint, request, jsonify
from auth_backend import get_user_by_email, create_user

#maakt een blueprint aan voor auth-routes
auth_bp = Blueprint("auth", __name__)

#register route
@auth_bp.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    email = data.get("email")
    password = data.get("password")
    confirm = data.get("confirmPassword")

    #check op ontbrekende velden
    if not email or not password or not confirm:
        return jsonify({"error": "ontbrekende velden"}), 400

    #check wachtwoorden gelijk
    if password != confirm:
        return jsonify({"error": "wachtwoorden komen niet overeen"}), 400

    #check of user al bestaat
    if get_user_by_email(email):
        return jsonify({"error": "email bestaat al"}), 400

    user_id = create_user(email, password)

    return jsonify({
        "message": "registratie gelukt",
        "userId": str(user_id),
        "email": email,
    }), 200


#login route
@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "ontbrekende velden"}), 400

    user = get_user_by_email(email)

    if not user:
        return jsonify({"error": "user niet gevonden"}), 400

    if user.get("password") != password:
        return jsonify({"error": "verkeerd wachtwoord"}), 400

    #hier zou normaal een token of session komen
    return jsonify({
        "message": "login gelukt",
        "email": email,
    }), 200