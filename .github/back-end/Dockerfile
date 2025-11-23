#gebruik een python basisimage
FROM python:3.11-slim

#installeer tesseract ocr, nodig voor tekstherkenning
RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-nld && apt-get clean

#maak en stel de werkmap in binnen de container
WORKDIR /app

#kopieer het requirements-bestand en installeer de python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

#kopieer de rest van de backend code naar de container
COPY . .

#stel de poort in waarop de backend draait
EXPOSE 5000

#start het python script wanneer de container opstart
CMD ["python3", "output/extract_text.py"]