# Screenshot Insight Dashboard - Portfolio

## description

Dit project helpt mensen om hun screenshots op te ruimen door automatisch tekst uit afbeeldingen te halen en die inhoud te analyseren.  
Je kan screenshots uploaden, OCR laten draaien, en daarna een samenvatting + soms privacy-indicatoren krijgen.  
Via grafieken wordt zichtbaar welke soorten informatie meekomen in je screenshots, zonder expliciet te tonen wat je precies deelt.

## features

- Login en registratie (met admin-rollen)
- Upload van meerdere screenshots met optionele GPS opt-in
- OCR pipeline met statusupdates (received/extracting/done/error)
- Analyse van OCR-tekst met **Ollama (llama3)** voor samenvatting
- Admin dashboard met live statistieken en grafieken (Recharts)
- Gebruikersdashboard met voortgang en resultaten
- Volledig containerized via **Docker Compose** (frontend, backend, MongoDB, Ollama)

## current technologies

- Python 3.11
- Flask + Flask-CORS
- MongoDB (pymongo)
- pytesseract + Pillow (OCR + beeldverwerking)
- bcrypt (wachtwoord hashing)
- Ollama (llama3) + requests (LLM calls)
- React 19 + Vite + React Router
- Recharts (admin grafieken)
- Docker + Docker Compose


## sources

- [Image to Text](https://blog.calcont.in/2023/10/building-image-to-text-converter-using.html) used in back-end -> `src/routes/extract_text.py`
- [From Image to Text in Seconds — Tesseract OCR in a Docker Container](https://dev.to/moni121189/from-image-to-text-in-seconds-tesseract-ocr-in-a-docker-container-1ohi) used in back-end -> `Dockerfile`
- [Writing a Dockerfile](https://docs.docker.com/get-started/docker-concepts/building-images/writing-a-dockerfile/) used in back-end -> `Dockerfile`
- [Why does the Python Docker image recommend copying only the requirements.txt file first, then the rest of the files?](https://www.reddit.com/r/docker/comments/w325au/why_does_the_python_docker_image_recommend/) used in back-end -> `Dockerfile`
- [Docker for Beginners: Crafting Your Backend Development Environment](https://dev.to/suzuki0430/docker-for-beginners-crafting-your-backend-development-environment-38oo) used in `docker-compose.yml`
- [Define and manage networks in Docker Compose](https://docs.docker.com/reference/compose-file/networks/) used in `docker-compose.yml`
- [Ollama llama3 model documentation](https://ollama.com/library/llama3) used in `src/services/llm.py`
- OpenCode/Codex prompt log used in `docs/prompts.txt`

## author

**Jordi De Leeuw**  
Student – DEV V  
2025

## Important

De huidige setup voor de llama AI-container gebruikt 3 threads en 3 cores. Op een M2 MacBook Pro (12‑core CPU, 19‑core GPU) zorgt dit voor temperaturen tussen ~60°C en 90°C. Als dit je ongemakkelijk maakt of als je laptop minder krachtig is, kan je in `.github/docker-compose.yml` deze waarden verlagen; dit vertraagt de analyse en kan meer fallbacks veroorzaken (waardoor je mogelijk geen resultaat krijgt). Een andere optie is iStats installeren op je Mac en de fans manueel aanzetten.
