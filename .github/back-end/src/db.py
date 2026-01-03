from pymongo import MongoClient
import os

# Database connection
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

client = MongoClient(MONGO_URI)
db = client["dev5"]

users = db["users"]
photos = db["photos"]
summaries = db["summaries"]

# Indexes
photos.create_index([("userId", 1), ("uploadedAt", -1)])
photos.create_index([("userId", 1), ("metadata.sha256Hash", 1)])
summaries.create_index([("userId", 1), ("createdAt", -1)])
