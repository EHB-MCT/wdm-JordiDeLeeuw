from flask import Blueprint

from routes.photos.files import files_bp
from routes.photos.processing import processing_bp
from routes.photos.analysis import analysis_bp
from routes.photos.admin import photos_admin_bp

upload_bp = Blueprint("upload", __name__)

upload_bp.register_blueprint(files_bp)
upload_bp.register_blueprint(processing_bp)
upload_bp.register_blueprint(analysis_bp)
upload_bp.register_blueprint(photos_admin_bp)
