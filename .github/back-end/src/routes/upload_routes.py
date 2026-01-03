from flask import Blueprint

# Importeer sub-blueprints voor upload-gerelateerde routes
from routes.photos.files import files_bp
from routes.photos.processing import processing_bp
from routes.photos.analysis import analysis_bp
from routes.photos.admin import photos_admin_bp

# Hoofd-blueprint voor uploadfunctionaliteit
upload_bp = Blueprint("upload", __name__)

# Registreer de sub-blueprints onder de upload-bp
upload_bp.register_blueprint(files_bp)
upload_bp.register_blueprint(processing_bp)
upload_bp.register_blueprint(analysis_bp)
upload_bp.register_blueprint(photos_admin_bp)
