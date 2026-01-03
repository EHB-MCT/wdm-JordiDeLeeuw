from flask import request, jsonify

def get_user_id(req: request):
    # Haal de user-id uit de headers (X-User-Id)
    user_id = req.headers.get("X-User-Id")
    if not user_id:
        return None
    return user_id


def require_user_id(req: request):
    # Vereist een user-id en geeft anders een 401 response terug
    user_id = get_user_id(req)
    if not user_id:
        return None, (jsonify({"error": "Unauthorized - no user ID provided"}), 401)
    return user_id, None
