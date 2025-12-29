from flask import Flask
from flask_cors import CORS
from extract_text import ocr_bp
from auth_routes import auth_bp
from upload_routes import upload_bp

#maakt de hoofd-flask-app aan
app = Flask(__name__)

#enable CORS voor alle routes (frontend kan nu requests maken)
CORS(app)

#registreert de blueprints
app.register_blueprint(ocr_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(upload_bp)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)