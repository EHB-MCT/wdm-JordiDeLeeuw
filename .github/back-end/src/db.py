from pymongo import MongoClient
import os

# Databaseverbinding
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/dev5")

# Maak de client en selecteer de database
client = MongoClient(MONGO_URI)
db = client["dev5"]

# Collections
users = db["users"]
photos = db["photos"]
summaries = db["summaries"]

# Indexen voor snellere queries
photos.create_index([("userId", 1), ("uploadedAt", -1)])
photos.create_index([("userId", 1), ("metadata.sha256Hash", 1)])
summaries.create_index([("userId", 1), ("createdAt", -1)])
