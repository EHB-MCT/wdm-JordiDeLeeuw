# Screenshot text extractor - Portfolio

## description

Dit project helpt mensen om hun screenshots op te ruimen door automatisch tekst uit hun afbeeldingen te halen.  
De tool toont welke informatie er in je screenshots zit, soms zelfs gevoelige data waarvan je je niet bewust was.  
Het idee is om op een speelse manier te tonen hoeveel je eigenlijk deelt zonder het te beseffen.

## features

- Upload screenshots via een kleine webinterface (in opbouw)
- Herkent tekst uit afbeeldingen met behulp van **Tesseract OCR**
- Geeft de herkende tekst terug als resultaat
- Draait volledig in **Docker containers** (frontend + backend)
- Simpel te testen via **Postman** of een lokaal formulier

## current technologies

- Python 3.11
- Flask
- pytesseract
- Pillow (voor beeldverwerking)
- Node.js (Vite + React)
- Docker & Docker Compose

## backend sources

- [Image to Text](https://blog.calcont.in/2023/10/building-image-to-text-converter-using.html) used in back-end -> output -> `extract_text.py`
- [From Image to Text in Seconds — Tesseract OCR in a Docker Container](https://dev.to/moni121189/from-image-to-text-in-seconds-tesseract-ocr-in-a-docker-container-1ohi) used in back-end -> `Dockerfile`
- [Writing a Dockerfile](https://docs.docker.com/get-started/docker-concepts/building-images/writing-a-dockerfile/) used in back-end -> `Dockerfile`
- [Why does the Python Docker image recommend copying only the requirements.txt file first, then the rest of the files?](https://www.reddit.com/r/docker/comments/w325au/why_does_the_python_docker_image_recommend/) used in back-end -> `Dockerfile`
- [Docker for Beginners: Crafting Your Backend Development Environment](https://dev.to/suzuki0430/docker-for-beginners-crafting-your-backend-development-environment-38oo) used in `dockker-compose.yml`
- [Define and manage networks in Docker Compose](https://docs.docker.com/reference/compose-file/networks/) used in `dockker-compose.yml`

## author

**Jordi De Leeuw**  
Student – DEV V  
2025
