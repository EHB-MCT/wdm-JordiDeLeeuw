from flask import Blueprint, request, jsonify
import auth_backend
import time
from utils.auth import require_user_id

# Blueprint voor analyse-routes
analysis_bp = Blueprint("analysis", __name__)


def validate_final_result_structure(data):
    """Validate FINAL resultJson structure:
    {
      "user": {"short_summary": "string"},
      "admin": {
        "timestampLeakage": [{"hour": int, "count": int}] * 24,
        "socialContextLeakage": {relationshipLabels, handles, emails, phonePatterns, nameEntities},
        "professionalLiabilitySignals": [{name,count}] * 3,
        "locationLeakageSignals": [{name,count}] * 3
      }
    }
    """
    # Valideer de verwachte eindstructuur (user/admin)
    if not isinstance(data, dict):
        return False, "Not an object"

    if "user" not in data or "admin" not in data:
        return False, "Missing user/admin"

    user = data.get("user")
    admin = data.get("admin")

    if not isinstance(user, dict) or not isinstance(admin, dict):
        return False, "user/admin must be objects"

    if not isinstance(user.get("short_summary"), str):
        return False, "user.short_summary must be a string"

    # timestampLeakage
    tl = admin.get("timestampLeakage")
    if not isinstance(tl, list) or len(tl) != 24:
        return False, "admin.timestampLeakage must be a list of 24 items"
    for i, item in enumerate(tl):
        if not isinstance(item, dict):
            return False, f"timestampLeakage[{i}] must be an object"
        if item.get("hour") != i:
            return False, f"timestampLeakage[{i}].hour must be {i}"
        if not isinstance(item.get("count"), int) or item.get("count") < 0:
            return False, f"timestampLeakage[{i}].count must be a non-negative int"

    # socialContextLeakage
    scl = admin.get("socialContextLeakage")
    if not isinstance(scl, dict):
        return False, "admin.socialContextLeakage must be an object"
    for key in ["relationshipLabels", "handles", "emails", "phonePatterns", "nameEntities"]:
        if not isinstance(scl.get(key), int) or scl.get(key) < 0:
            return False, f"socialContextLeakage.{key} must be a non-negative int"

    # professionalLiabilitySignals
    pls = admin.get("professionalLiabilitySignals")
    if not isinstance(pls, list) or len(pls) != 3:
        return False, "admin.professionalLiabilitySignals must be a list of 3 items"
    expected_pls = ["Aggression Hits", "Profanity Hits", "Shouting Hits"]
    for i, exp_name in enumerate(expected_pls):
        item = pls[i]
        if not isinstance(item, dict):
            return False, f"professionalLiabilitySignals[{i}] must be an object"
        if item.get("name") != exp_name:
            return False, f"professionalLiabilitySignals[{i}].name must be '{exp_name}'"
        if not isinstance(item.get("count"), int) or item.get("count") < 0:
            return False, f"professionalLiabilitySignals[{i}].count must be a non-negative int"

    # locationLeakageSignals
    lls = admin.get("locationLeakageSignals")
    if not isinstance(lls, list) or len(lls) != 3:
        return False, "admin.locationLeakageSignals must be a list of 3 items"
    expected_lls = ["Explicit location keywords", "Travel/route context", "No location signals"]
    for i, exp_name in enumerate(expected_lls):
        item = lls[i]
        if not isinstance(item, dict):
            return False, f"locationLeakageSignals[{i}] must be an object"
        if item.get("name") != exp_name:
            return False, f"locationLeakageSignals[{i}].name must be '{exp_name}'"
        if not isinstance(item.get("count"), int) or item.get("count") < 0:
            return False, f"locationLeakageSignals[{i}].count must be a non-negative int"

    return True, "Valid"


def validate_summary_only(data):
    """Validate summary-only JSON: {"short_summary": "..."}"""
    # Controleer of het een geldige summary-only structuur is
    if not isinstance(data, dict):
        return False
    ss = data.get("short_summary")
    return isinstance(ss, str) and len(ss.strip()) > 0


def parse_llm_response(response, mode: str = "summary"):
    """Parse LLM response.
    mode:
      - "summary": expects {"short_summary": "..."}
      - "final": expects the full resultJson structure (user/admin)
    """
    import json
    # Parseer LLM output naar JSON met validatie
    if not response or not response.strip():
        return None

    clean_response = response.strip()

    # Try direct JSON parse
    try:
        obj = json.loads(clean_response)
    except json.JSONDecodeError:
        # Extract JSON between first { and last }
        first_brace = clean_response.find('{')
        last_brace = clean_response.rfind('}')
        if first_brace == -1 or last_brace == -1 or last_brace <= first_brace:
            return None
        try:
            obj = json.loads(clean_response[first_brace:last_brace + 1])
        except Exception:
            return None

    if mode == "summary":
        if validate_summary_only(obj):
            # Clean weird braces inside the string if the model did that
            ss = obj.get("short_summary", "")
            if isinstance(ss, str) and ('{' in ss or '}' in ss):
                obj["short_summary"] = ss.replace('{', '').replace('}', '').strip()
            return obj
        return None

    if mode == "final":
        ok, _msg = validate_final_result_structure(obj)
        return obj if ok else None

    return None


# === Helper functions for admin metrics and final resultJson ===

def _empty_admin_metrics():
    # Standaard lege metrics met juiste structuur
    return {
        "timestampLeakage": [{"hour": i, "count": 0} for i in range(24)],
        "socialContextLeakage": {
            "relationshipLabels": 0,
            "handles": 0,
            "emails": 0,
            "phonePatterns": 0,
            "nameEntities": 0,
        },
        "professionalLiabilitySignals": [
            {"name": "Aggression Hits", "count": 0},
            {"name": "Profanity Hits", "count": 0},
            {"name": "Shouting Hits", "count": 0},
        ],
        "locationLeakageSignals": [
            {"name": "Explicit location keywords", "count": 0},
            {"name": "Travel/route context", "count": 0},
            {"name": "No location signals", "count": 0},
        ],
    }


def build_admin_metrics_from_ocr(ocr_texts):
    """Deterministically compute admin dashboard metrics from OCR text.
    This ensures the JSON ALWAYS matches the AdminDashboard graphs.
    """
    import re

    # Bouw deterministische metrics op basis van OCR-tekst
    metrics = _empty_admin_metrics()

    combined = "\n".join([t for t in ocr_texts if isinstance(t, str) and t.strip()])
    if not combined.strip():
        metrics["locationLeakageSignals"][2]["count"] = 1
        return metrics

    # Timestamp leakage (deterministic)
    metrics["timestampLeakage"] = extract_timestamp_leakage(ocr_texts)

    # Social context leakage
    # Handles: avoid matching the @ inside emails by requiring the @ NOT be preceded by an email-local character.
    handle_pat = re.compile(r"(?<![A-Za-z0-9._%+-])@([A-Za-z0-9_]{2,})\b")
    email_pat = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

    # Phones: extract digit-heavy patterns and count unique normalized numbers (keeps OCR spacing tolerant)
    phone_pat = re.compile(r"(?:\+\s*\d{1,3}[\s./-]*)?(?:\(?\d{1,4}\)?[\s./-]*){2,5}\d{2,4}")

    metrics["socialContextLeakage"]["handles"] = len(handle_pat.findall(combined))
    metrics["socialContextLeakage"]["emails"] = len(email_pat.findall(combined))

    # Count unique phone-like sequences by normalizing to digits and requiring a reasonable length
    phones_found = []
    for m in phone_pat.finditer(combined):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        # Typical minimum for a real phone is ~9 digits (BE mobiles are 9/10 without country code)
        if len(digits) < 9:
            continue
        # Cap to avoid absurd OCR runs
        if len(digits) > 16:
            continue
        phones_found.append(digits)

    metrics["socialContextLeakage"]["phonePatterns"] = len(set(phones_found))

    # --- Expanded aggression/profanity/relationship detection (multilingual, per-line, substring match, count once per line) ---
    lines = [l.strip().lower() for l in combined.splitlines() if l.strip()]

    # Helper: support keywords and simple stems ending with '*'
    def _compile_kw(kw: str):
        kw = (kw or "").strip().lower()
        if not kw:
            return None
        # Phrase -> simple substring check later
        if " " in kw:
            return kw
        # Stem wildcard at end: bedreig* -> \\bbedreig\\w*\\b
        if kw.endswith("*"):
            base = re.escape(kw[:-1])
            return re.compile(rf"\\b{base}\\w*\\b")
        # Normal token
        token = re.escape(kw)
        return re.compile(rf"\\b{token}\\b")

    def _line_has_any(line: str, compiled_list):
        for item in compiled_list:
            if not item:
                continue
            if isinstance(item, str):
                # phrase
                if item in line:
                    return True
            else:
                if item.search(line):
                    return True
        return False

    aggression_words = [
        # EN (stems + phrases)
        "threat*","attack*","hurt*","kill*","murder*","stab*","shoot*","punch*","slap*","beat*",
        "strangle*","choke*","bash*","smash*","destroy*","burn*","explode*","violent","violence",
        "i will kill","i'll kill","you will pay","watch out","i swear","i'm coming for you",

        # NL
        "bedreig*","dreig*","aanval*","aanvall*","slaan","sla","sloeg","geslagen",
        "mepp*","klopp*","ramm*","beuk*","schopp*","trapp*","afmak*","doodmak*","dood*",
        "vermoord*","neersteek*","steek*","schiet*","neerschiet*","kapotmaak*","verniel*",
        "geweld","agress*","ik pak je","ik krijg je","je gaat eraan","ik maak je af","pas op",

        # FR
        "menac*","attaque*","frapp*","tap*","cogn*","gifl*",
        "tuer","tué","tue","tuez","assassin*","poignard*","couteau",
        "tir*","fusill*","étrangl*","étouff*","détru*",
        "violence","violent","agress*","je vais te tuer","tu vas payer","tu vas voir","fais gaffe"
    ]

    profanity_words = [
        # EN
        "fuck","fucking","shit","bullshit","asshole","bitch","bastard","damn","goddamn",
        "motherfucker","dick","douche","piss","crap","slut","whore","wanker","prick",
        "jerk","moron","idiot","stupid","dumb","screw you","piece of shit",

        # NL
        "kut","kloot*","klote","klootzak","lul","eikel","zak","zakkenwasser",
        "hoer","slet","neuk*","godverdomme","verdomme","sh*t","shit",
        "kanker","tering","tyfus","mongool","idioot","debiel","achterlijk","sukkel",
        "rot op","hou je bek","krijg de tering",

        # FR
        "putain","merde","bordel","con","connard","connasse","salope","pute",
        "enculé","nique","ta gueule","abruti","imbécile","crétin","débile","salaud","bâtard",
        "enfoiré","fils de pute","va te faire","casse-toi"
    ]

    aggr_compiled = [_compile_kw(w) for w in aggression_words]
    prof_compiled = [_compile_kw(w) for w in profanity_words]

    def _count_any_occurrences(text: str, compiled_list, cap: int = 25) -> int:
        """Count occurrences of any keyword/phrase across the whole text.
        - regex items count matches
        - string phrase items count substring occurrences
        Capped to keep dashboards readable.
        """
        # Tel woorden/phrases en cap om UI leesbaar te houden
        if not text:
            return 0
        total = 0
        for item in compiled_list:
            if not item:
                continue
            if isinstance(item, str):
                # phrase substring occurrences (overlapping isn't important here)
                total += text.count(item)
            else:
                try:
                    total += len(item.findall(text))
                except Exception:
                    continue
            if total >= cap:
                return cap
        return min(total, cap)

    combined_low = combined.lower()
    aggr_hits = _count_any_occurrences(combined_low, aggr_compiled, cap=25)
    prof_hits = _count_any_occurrences(combined_low, prof_compiled, cap=25)

    metrics["professionalLiabilitySignals"][0]["count"] = aggr_hits
    metrics["professionalLiabilitySignals"][1]["count"] = prof_hits

    # --- Relationship label detection (expanded multilingual, per-line, substring match, count once per line) ---
    # === Relationship labels (EN + NL + FR) ===
    relationship_words = [
        # EN
        "friend","friends","best friend","bestie","buddy","pal","mate",
        "boyfriend","girlfriend","partner","husband","wife","fiancé","fiancee","spouse",
        "ex","my ex","family","mom","mother","dad","father","brother","sister","cousin",
        "aunt","uncle","grandma","grandpa","roommate","neighbour","neighbor",
        "boss","manager","supervisor","colleague","coworker","team lead","teacher","student",

        # NL
        "vriend","vriendin","vrienden","beste vriend","beste vriendin","bestie","maat","makker",
        "partner","relatie","vriendje","vriendinnetje","man","vrouw","echtgenoot","echtgenote",
        "verloofde","ex","familie","mama","moeder","papa","vader","broer","zus","neef","nicht",
        "oom","tante","collega","baas","manager","teamleider","leerkracht","leraar","docent","student",
        "huisgenoot","kamergenoot","buur","buurman","buurvrouw",

        # FR
        "ami","amie","amis","meilleur ami","meilleure amie","pote","copain","copine","partenaire",
        "mari","femme","époux","épouse","fiancé","fiancée","ex","famille","maman","mère","papa","père",
        "frère","sœur","cousin","cousine","oncle","tante","collègue","chef","manager","superviseur",
        "prof","enseignant","étudiant","voisin","voisine","coloc","colocation"
    ]

    rel_compiled = [_compile_kw(w) for w in relationship_words]

    # Count DISTINCT relationship labels present (keeps signal stable even when OCR is flattened)
    found_rel = set()
    combined_low = combined.lower()
    for item in rel_compiled:
        if not item:
            continue
        if isinstance(item, str):
            if item in combined_low:
                found_rel.add(item)
        else:
            try:
                if item.search(combined_low):
                    found_rel.add(item.pattern)
            except Exception:
                continue

    # Cap lightly for dashboard readability
    metrics["socialContextLeakage"]["relationshipLabels"] = min(len(found_rel), 15)

    # Name entities (fallback heuristic): count DISTINCT candidate spans (not perfect).
    # If the LLM-filtered persons are available, they will override this later.
    candidates = extract_name_candidates(ocr_texts, max_candidates=80)
    # Keep this readable; LLM person-name filtering (when available) will override later during /analyze.
    metrics["socialContextLeakage"]["nameEntities"] = min(len(candidates), 50)

    # Shouting hits: ALL CAPS tokens length>=4 or excessive !!
    caps_tokens_raw = re.findall(r"\b[A-Z]{4,}\b", combined)
    caps_ignore = set([
        "BRUSSEL","BRUSSELS","CENTRAAL","CENTRAL","AIRPORT","ZAVENTEM","MIDI","ZUID",
        "IC","NMBS","SNCB","PLATFORM","TRAIN","TICKET","GATE","JOURNEY","DETAILS","ON","TIME",
        "MALINES","MECHELEN","ANVERS","ANTWERPEN","LIEGE","LUIK"
    ])
    caps_tokens = [t for t in caps_tokens_raw if t not in caps_ignore]
    exclam = combined.count("!!")
    shout_hits = len(caps_tokens) + exclam
    metrics["professionalLiabilitySignals"][2]["count"] = shout_hits

    # Location leakage
    location_keywords = [
        "street", "st.", "straat", "address", "adres", "city", "stad",
        "station", "metro", "tram", "bus", "airport", "hotel", "postcode",
        "zip", "gps", "latitude", "longitude"
    ]
    travel_keywords = [
        "route", "travel", "trip", "flight", "train", "platform", "gate",
        "departure", "arrival", "destination"
    ]

    low = combined.lower()
    loc_count = 0
    trav_count = 0
    for w in location_keywords:
        loc_count += low.count(w)
    for w in travel_keywords:
        trav_count += low.count(w)

    if loc_count == 0 and trav_count == 0:
        metrics["locationLeakageSignals"][2]["count"] = 1
    else:
        metrics["locationLeakageSignals"][0]["count"] = loc_count
        metrics["locationLeakageSignals"][1]["count"] = trav_count
        metrics["locationLeakageSignals"][2]["count"] = 0

    return metrics


# === New helper functions for admin metrics and final resultJson ===

def extract_timestamp_leakage(ocr_texts):
    """Deterministically count time-like strings and bucket them per hour (00-23)."""
    import re
    # Extraheer tijdslekken en groepeer per uur
    buckets = [{"hour": i, "count": 0} for i in range(24)]
    combined = "\n".join([t for t in ocr_texts if isinstance(t, str) and t.strip()])
    if not combined.strip():
        return buckets

    # Matches: 9:01, 09:51, 13:45, 13:45:22, 13h45, 13 h 45, 13u45
    time_pat = re.compile(r"\b(?P<hour>[01]?\d|2[0-3])\s*(?:[:hHuU]\s*[0-5]\d)(?::\s*[0-5]\d)?\b")
    for m in time_pat.finditer(combined):
        try:
            h = int(m.group("hour"))
            buckets[h]["count"] += 1
        except Exception:
            continue

    # Matches: 11h or 11u (hour only) WITHOUT minutes
    hour_only_pat = re.compile(r"\b(?P<hour>[01]?\d|2[0-3])\s*[hHuU]\b")
    for m in hour_only_pat.finditer(combined):
        try:
            h = int(m.group("hour"))
            buckets[h]["count"] += 1
        except Exception:
            continue

    return buckets



def extract_name_candidates(ocr_texts, max_candidates: int = 80):
    """Extract candidate name-like spans from OCR deterministically.
    We will later let the LLM FILTER which ones are real PERSON names.
    """
    import re

    # Heuristische extractie van naam-achtige stukken
    combined = "\n".join([t for t in ocr_texts if isinstance(t, str) and t.strip()])
    if not combined.strip():
        return []

    # Capture short sequences of TitleCase / ALLCAPS words that could form a name.
    # Examples: "DE LEEUW Jordi", "MAEYAERT Ann-Sophie", "Sandra Stordeur"
    pat = re.compile(r"\b(?:[A-Z]{2,}|[A-Z][a-z]+)(?:[-'’][A-Z][a-z]+)?(?:\s+(?:[A-Z]{2,}|[A-Z][a-z]+)(?:[-'’][A-Z][a-z]+)?){0,2}\b")

    ui_stop = set([
        "Chat", "Teams", "Assignments", "Calendar", "More", "Recent", "Unread",
        "Mentions", "Favorites", "Chats", "Activity", "You", "Journey", "Ticket",
        "Train", "Platform", "Details", "Intermediate", "stop", "stops", "On", "Time"
    ])

    seen = set()
    out = []
    for m in pat.finditer(combined):
        cand = m.group(0).strip()
        if len(cand) < 3:
            continue
        if cand in ui_stop:
            continue
        # Avoid obvious non-names
        if any(ch.isdigit() for ch in cand):
            continue
        # Avoid long shouty tokens like station names in all caps with hyphens (still allow some)
        if len(cand) > 40:
            continue
        key = cand.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cand)
        if len(out) >= max_candidates:
            break

    return out



def llm_filter_person_names(candidates, ocr_texts, model: str = "llama3"):
    """Use LLM to filter candidate spans down to REAL PERSON NAMES only.
    Returns a list of distinct person names.
    """
    import json

    # Laat de LLM de naamkandidaten filteren tot echte persoonsnamen
    if not candidates:
        return []

    banned_tokens = {
        "bestie", "friend", "friends", "boss", "manager", "team", "colleague",
        "pissed", "fucking", "fuck", "shit", "bullshit", "kill", "killed", "killing",
        "angry", "mad", "sad", "hate", "hate", "damn", "hell", "wtf",
    }

    def _is_banned_name(value: str) -> bool:
        if not value:
            return True
        lower = value.strip().lower()
        if lower in banned_tokens:
            return True
        # All-caps emphasis words are rarely names
        if len(value) >= 4 and value.isupper():
            return True
        return False

    filtered_candidates = [c for c in candidates if isinstance(c, str) and not _is_banned_name(c)]
    if not filtered_candidates:
        return []

    # Provide a small OCR snippet for grounding (avoid huge prompt)
    combined = "\n".join([t for t in ocr_texts if isinstance(t, str) and t.strip()])
    if len(combined) > 3500:
        combined = combined[:3500]

    prompt = f'''You are helping filter OCR-extracted candidate "names".

Task:
- From the candidate list, return ONLY real PERSON names (first/last names), in a JSON object.
- Exclude: stations/places, UI labels, train codes (IC), platforms, dates/times, generic words.
- Keep names as they appear.
- Deduplicate.

Return ONLY valid JSON with this shape:
{{"persons": ["Name 1", "Name 2"]}}

Candidates:
{json.dumps(filtered_candidates, ensure_ascii=False)}

OCR context (for disambiguation):
{combined}
'''

    try:
        resp = auth_backend.query_ollama(prompt, model)
    except Exception as e:
        print(f"LLM person-name filter error: {e}")
        return []

    if not resp or not resp.strip():
        return []

    clean = resp.strip()
    try:
        obj = json.loads(clean)
    except Exception:
        # Try extracting JSON between braces
        first = clean.find('{')
        last = clean.rfind('}')
        if first == -1 or last == -1 or last <= first:
            return []
        try:
            obj = json.loads(clean[first:last+1])
        except Exception:
            return []

    persons = obj.get("persons") if isinstance(obj, dict) else None
    if not isinstance(persons, list):
        return []

    # Normalize + dedupe
    out = []
    seen = set()
    for p in persons:
        if not isinstance(p, str):
            continue
        name = p.strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        if _is_banned_name(name):
            continue
        out.append(name)

    return out



def build_final_result_json(short_summary: str, admin_metrics: dict):
    # Bouw het finale resultJson met defensieve validatie
    result = {
        "user": {"short_summary": short_summary or ""},
        "admin": admin_metrics or _empty_admin_metrics(),
    }
    # Defensive: ensure correct structure
    ok, _ = validate_final_result_structure(result)
    if not ok:
        result = {
            "user": {"short_summary": short_summary or ""},
            "admin": _empty_admin_metrics(),
        }
    return result


@analysis_bp.route("/api/photos/analyze", methods=["POST"])
def analyze_photos():
    # analyze OCR text using Ollama LLM
    import json

    # Simpele in-memory lock per user om overlap te voorkomen
    # simple in-memory lock to prevent concurrent analyze requests
    if not hasattr(analyze_photos, '_locks'):
        analyze_photos._locks = {}
    try:
        # Haal user-id op uit request en valideer
        user_id, err = require_user_id(request)
        if err:
            return err

        current_time = time.time()
        if user_id in analyze_photos._locks:
            last_request_time = analyze_photos._locks[user_id]
            if current_time - last_request_time < 30:  # 30 second cooldown
                return jsonify({"error": "Analysis already in progress. Please wait 30 seconds between requests."}), 429

        analyze_photos._locks[user_id] = current_time

        # Initialize analysis status for all eligible photos
        print(f"ANALYSIS PROGRESS: Initializing analysis status for user {user_id}")
        queued_count = auth_backend.initialize_analysis_status(user_id)
        print(f"ANALYSIS PROGRESS: Queued {queued_count} photos for analysis")

        # get photos with completed OCR - LIMIT to prevent resource overload
        photos_data = auth_backend.get_photos_for_analysis_limited(user_id, max_photos=20, max_chars=8000)

        if len(photos_data) == 0:
            return jsonify({"error": "No photos with completed OCR found to analyze"}), 400

        print(f"Found {len(photos_data)} photos with OCR text for analysis")
        print(f"ANALYSIS PROGRESS: Starting analysis of {len(photos_data)} photos for user {user_id}")

        # Build OCR text list for admin metrics
        ocr_texts = []
        per_photo_results = {}

        analysis_progress = {
            "photos_found": len(photos_data),
            "photos_started": 0,
            "photos_completed": 0,
            "photos_failed": 0,
            "photos_fallback": 0,
        }

        # Mark each photo as processing while we build metrics + run the LLM summary.
        # IMPORTANT: Do NOT mark as "completed" until the FINAL result is saved.
        for photo_idx, photo in enumerate(photos_data):
            photo_id = str(photo["_id"])
            filename = photo.get("originalFilename", f"photo_{photo_id}")

            auth_backend.update_analysis_progress(photo_id, "processing")
            analysis_progress["photos_started"] += 1

            text = (photo.get("ocr", {}) or {}).get("extractedText", "")
            text = (text or "").strip()
            if text:
                ocr_texts.append(text)

            # Keep perPhotoResults minimal but useful
            per_photo_results[photo_id] = {
                "filename": filename,
                "hasText": bool(text),
                "textLength": len(text),
            }

        # Deterministic admin metrics (matches AdminDashboard expected shape)
        admin_metrics = build_admin_metrics_from_ocr(ocr_texts)

        # Improve nameEntities using LLM filtering (stable counts via deduped PERSON names)
        try:
            name_candidates = extract_name_candidates(ocr_texts, max_candidates=80)
            persons = llm_filter_person_names(name_candidates, ocr_texts, model="llama3")
            if persons:
                admin_metrics["socialContextLeakage"]["nameEntities"] = len(persons)
        except Exception as e:
            print(f"NameEntities LLM override failed: {e}")

        # Mark photos as sent_to_llm right before calling the LLM
        for pid in per_photo_results.keys():
            try:
                auth_backend.update_analysis_progress(pid, "sent_to_llm")
            except Exception as e:
                print(f"Warning: failed to mark photo {pid} as sent_to_llm: {e}")
        # LLM summary (ONLY user short summary)
        combined_text = "\n\n".join(ocr_texts)
        # Safety: do not send extremely large prompts
        max_chars = 9000
        if len(combined_text) > max_chars:
            combined_text = combined_text[:max_chars]

        # Build a more useful, user-facing summary.
        # We include a few extracted hints so the model has something concrete to work with.
        import re

        # Extract up to ~8 time matches (for usefulness only)
        time_matches = []
        time_pat2 = re.compile(r"\b([01]?\d|2[0-3])\s*(?:[:hHuU]\s*[0-5]\d)(?::\s*[0-5]\d)?\b")
        for m in time_pat2.finditer(combined_text):
            time_matches.append(m.group(0).replace(" ", ""))
            if len(time_matches) >= 8:
                break

        # Extract some likely names/entities: sequences of Capitalized words (e.g., "DE LEEUW Jordi")
        name_matches = []
        name_pat2 = re.compile(r"\b(?:[A-Z]{2,}|[A-Z][a-z]+)(?:\s+(?:[A-Z]{2,}|[A-Z][a-z]+)){0,2}\b")
        # Filter out common UI words so we don't flood the model
        ui_stop = set(["Chat", "Teams", "Assignments", "Calendar", "More", "Recent", "Unread", "Mentions", "Favorites", "Chats", "Activity", "You"])
        for m in name_pat2.finditer(combined_text):
            cand = m.group(0).strip()
            if len(cand) < 3:
                continue
            if cand in ui_stop:
                continue
            # Skip things that are clearly not names
            if any(ch.isdigit() for ch in cand):
                continue
            name_matches.append(cand)
            if len(name_matches) >= 8:
                break

        hints_block = ""
        if time_matches:
            hints_block += f"Detected times: {', '.join(time_matches)}\n"
        if name_matches:
            hints_block += f"Detected names/entities: {', '.join(name_matches)}\n"

        # Summary sentence count scales with number of photos (3 sentences per photo), with sensible caps
        photos_n = max(1, len(per_photo_results))
        target_sentences = max(4, min(photos_n * 3, 18))

        summary_prompt = f'''You summarize OCR text from multiple screenshots for an end-user.

INSTRUCTIONS:
- Return ONLY valid JSON. No preamble. No explanation. No markdown.
- Output must start with "{{" and end with "}}".
- short_summary must be useful, specific, and not generic.
- Write EXACTLY {target_sentences} sentences.
- Mention what kind of content it looks like (e.g., chat list, email, receipt, schedule).
- If the text contains names/times, include a few examples.
- If the text suggests privacy-sensitive content (names, tickets, travel details, timestamps), mention that briefly and factually.

Return this JSON structure:
{{"short_summary": ""}}

Helpful extracted hints (you can use these):
{hints_block}

OCR text:
{combined_text}'''

        short_summary = ""
        try:
            # Vraag de LLM om een korte samenvatting
            llm_resp = auth_backend.query_ollama(summary_prompt, "llama3")
            parsed = parse_llm_response(llm_resp, mode="summary")
            if parsed and parsed.get("short_summary"):
                short_summary = parsed["short_summary"].strip()
        except Exception as e:
            print(f"LLM summary error: {e}")

        if not short_summary:
            # Fallback summary that is still valid for the UI
            short_summary = "Analysis completed, but no reliable summary could be generated."
            analysis_progress["photos_fallback"] += 1

        final_result_json = build_final_result_json(short_summary, admin_metrics)

        # Finalizing: we have the final JSON, now persist it.
        for pid in per_photo_results.keys():
            try:
                auth_backend.update_analysis_progress(pid, "finalizing")
            except Exception as e:
                print(f"Warning: failed to mark photo {pid} as finalizing: {e}")

        # Save combined user summary (shortSummary mirrors user.short_summary)
        try:
            # Sla de samenvatting op in de database
            summary_id = auth_backend.save_user_summary(
                user_id=user_id,
                photo_ids=list(per_photo_results.keys()),
                model_used="llama3_summary_only",
                result_json=final_result_json,
                short_summary=final_result_json.get("user", {}).get("short_summary", ""),
            )
            print(f"Saved user summary ID: {summary_id}")
        except Exception as e:
            print(f"Failed to save user summary: {e}")
            # If saving fails, mark involved photos as error so the UI doesn't show completed.
            for pid in per_photo_results.keys():
                try:
                    auth_backend.update_analysis_progress(pid, "error", error_message="Failed to save analysis results")
                except Exception:
                    pass
            return jsonify({
                "error": "Failed to save analysis results",
                "details": str(e)
            }), 500

        # Only mark completed AFTER the summary is successfully saved.
        for pid in per_photo_results.keys():
            try:
                auth_backend.update_analysis_progress(pid, "completed")
            except Exception as e:
                print(f"Warning: failed to mark photo {pid} as completed: {e}")

        analysis_progress["photos_completed"] = len(per_photo_results)

        return jsonify({
            "summary": final_result_json.get("user", {}).get("short_summary", ""),
            "details": final_result_json,
            "analyzedPhotos": len(per_photo_results),
            "summaryId": str(summary_id),
            "progress": analysis_progress,
            "perPhotoResults": per_photo_results,
        }), 200

    except Exception as e:
        print(f"Analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Analysis failed",
            "details": str(e)
        }), 500
    finally:
        # Ruim de lock op
        if hasattr(analyze_photos, '_locks') and 'user_id' in locals() and user_id in analyze_photos._locks:
            del analyze_photos._locks[user_id]


@analysis_bp.route("/api/photos/analysis-progress", methods=["GET"])
def get_analysis_progress():
    """Get real-time analysis progress for user's photos"""
    try:
        # Haal user-id op uit request en valideer
        user_id, err = require_user_id(request)
        if err:
            return err

        progress_data = auth_backend.get_analysis_progress(user_id)

        # Only count photos that are eligible for analysis (OCR done)
        eligible = [p for p in progress_data if p.get("ocrStatus") == "done"]

        def _is_active(status: str) -> bool:
            return status in [
                "queued",
                "processing",
                "sent_to_llm",
                "finalizing",
                "llm_failed",
                "fallback_used",
                "completed",
                "error",
            ]

        def _is_failed(status: str) -> bool:
            return status in ["llm_failed", "error"]

        # Calculate counters (based on eligible photos only)
        counters = {
            "photos_total": len(eligible),
            "photos_started": len([p for p in eligible if _is_active(p.get("analysisStatus", "pending"))]),
            "photos_processing": len([p for p in eligible if p.get("analysisStatus") == "processing"]),
            "photos_sent_to_llm": len([p for p in eligible if p.get("analysisStatus") == "sent_to_llm"]),
            "photos_finalizing": len([p for p in eligible if p.get("analysisStatus") == "finalizing"]),
            "photos_completed": len([p for p in eligible if p.get("analysisStatus") == "completed"]),
            "photos_failed": len([p for p in eligible if _is_failed(p.get("analysisStatus", "pending"))]),
            "photos_fallback": len([p for p in eligible if p.get("analysisStatus") == "fallback_used"]),
            "photos_queued": len([p for p in eligible if p.get("analysisStatus") == "queued"]),
        }

        # Provide a simple phase hint for the frontend
        if counters["photos_total"] == 0:
            phase = "waiting_for_ocr"
        elif counters["photos_finalizing"] > 0:
            phase = "finalizing"
        elif counters["photos_sent_to_llm"] > 0:
            phase = "sent_to_llm"
        elif counters["photos_processing"] > 0:
            phase = "processing"
        elif counters["photos_queued"] > 0:
            phase = "queued"
        elif counters["photos_completed"] == counters["photos_total"]:
            phase = "completed"
        else:
            phase = "idle"

        return jsonify({
            "photos": progress_data,  # still return full list for any UI lists
            "eligiblePhotos": eligible,
            "counters": counters,
            "phase": phase,
        }), 200

    except Exception as e:
        print(f"Get analysis progress error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve analysis progress",
            "details": str(e)
        }), 500


@analysis_bp.route("/api/photos/summary", methods=["GET"])
def get_summary():
    # Haal de laatste analyse voor deze gebruiker op
    try:
        # Haal user-id op uit request en valideer
        user_id, err = require_user_id(request)
        if err:
            return err

        summary = auth_backend.get_latest_user_summary(user_id)

        if not summary:
            return jsonify({"error": "No analysis found"}), 404

        return jsonify({
            "summary": summary.get("shortSummary", ""),
            "details": summary.get("resultJson", {}),
            "createdAt": summary.get("createdAt").isoformat() if summary.get("createdAt") else None,
            "analyzedPhotos": len(summary.get("sourcePhotoIds", []))
        }), 200

    except Exception as e:
        print(f"Get summary error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to retrieve analysis",
            "details": str(e)
        }), 500
