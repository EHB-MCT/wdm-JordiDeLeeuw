from flask import Flask, jsonify
from flask_cors import CORS
from routes.extract_text import ocr_bp
from routes.auth_routes import auth_bp
from routes.upload_routes import upload_bp
from routes.admin_routes import admin_bp

# Maakt de hoofd-Flask-app aan
app = Flask(__name__)

# Activeert CORS voor alle routes (frontend kan nu requests maken)
CORS(app, supports_credentials=True, origins=["http://localhost:5173"], allow_headers=["Content-Type", "Authorization", "X-User-ID"])

# Registreert de blueprints
app.register_blueprint(ocr_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(admin_bp)

# Globale error handlers voor consistente API-responses
@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "details": str(error)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found", "details": str(error)}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method not allowed", "details": str(error)}), 405

if __name__ == "__main__":
    # Start de app lokaal in debugmodus
    app.run(host="0.0.0.0", port=5000, debug=True)
