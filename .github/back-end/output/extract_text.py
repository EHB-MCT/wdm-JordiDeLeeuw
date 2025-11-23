from flask import Flask, request, jsonify
import pytesseract
from PIL import Image

#maakt een flask app aan
app = Flask(__name__)

#deze route wordt gebruikt om tekst uit één of meerdere afbeeldingen te halen
@app.route("/api/extract", methods=["POST"])
def extract_text():
    #kijk of er minstens één bestand is meegestuurd
    if "file" in request.files:
        #één bestand met key "file"
        files = [request.files["file"]]
    elif "files" in request.files:
        #meerdere bestanden met key "files"
        files = request.files.getlist("files")
    else:
        return jsonify({"error": "no file(s) uploaded"}), 400

    results = []

    for i, f in enumerate(files, start=1):
    #opent het bestand als afbeelding met pillow
        img = Image.open(f.stream)

    #haalt tekst uit de afbeelding, in engels en nederlands met pytesseract
        raw_text = pytesseract.image_to_string(img, lang="eng+nld")

    #maakt de tekst proper: verwijdert extra newlines en dubbele spaties
        clean_text = " ".join(raw_text.split())

    #object per screenshot
        results.append({
            "index": i,
            "filename": f.filename,
            "text": clean_text,
        })

#als er maar één afbeelding was, stuur gewoon één object terug
    if len(results) == 1:
        return jsonify(results[0])

#bij meerdere afbeeldingen een lijst terugsturen
    return jsonify({"screenshots": results})

#simpele test route om te checken of de backend werkt
@app.route("/api/test")
def test():
    return jsonify({"message": "backend api is running!"})

#start de flask app als dit bestand direct wordt uitgevoerd
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)