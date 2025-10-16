from flask import Flask, request, jsonify
import pytesseract
from PIL import Image

#maakt een flask app aan
app = Flask(__name__)

#deze route wordt gebruikt om tekst uit een afbeelding te halen
@app.route("/api/extract", methods=["POST"])
def extract_text():
    #controleert of er een bestand is meegestuurd in de request
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    #pakt het bestand uit de request
    file = request.files["file"]

    #opent het bestand als afbeelding met pillow
    image = Image.open(file.stream)

    #laat pytesseract de tekst uit de afbeelding halen
    text = pytesseract.image_to_string(image)

    #stuurt de gevonden tekst terug als json
    return jsonify({"extracted_text": text})

#simpele test route om te checken of de backend werkt
@app.route("/api/test")
def test():
    return jsonify({"message": "backend api is running!"})

#start de flask app als dit bestand direct wordt uitgevoerd
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)