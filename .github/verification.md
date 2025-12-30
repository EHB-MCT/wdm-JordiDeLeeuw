# Verification Script for CPU and Timeout Updates

## 1. Verify CPU Limit is Enforced

After running `docker-compose up -d`, verify the CPU limit with:

```bash
# Get the container ID for ollama service
OLLAMA_CONTAINER=$(docker-compose ps -q ollama)

# Inspect the container to verify CPU limit
docker inspect $OLLAMA_CONTAINER | jq '.[0].HostConfig.NanoCpus'

# Should return: 2500000000 (2.5 * 1e9 nanoseconds)
```

Or in one command:
```bash
docker inspect $(docker-compose ps -q ollama) | jq '.[0].HostConfig.NanoCpus'
```

Expected output: `2500000000`

## 2. Verify Timeout Update

The timeout is updated in `auth_backend.py`:
- **Old**: `timeout=(30, 120)`  # 120s read timeout
- **New**: `timeout=(30, 240)`  # 240s read timeout

## 3. Test Analysis Improvement

Test with 2 photos that previously had fallbacks:

```bash
# Start services
docker-compose up -d

# Upload 2 photos via UI
# Click "Next" to process OCR
# Run analysis and observe:

# Expected: More completed, fewer fallback
# Check logs: docker-compose logs -f backend
```

Look for these log patterns:
- `ANALYSIS PROGRESS: Photo X completed successfully` (instead of fallback)
- `LLM RESPONSE: Length: X characters` (successful responses)
- Fewer `⚠ Using fallback result` messages

## 4. Other Fallback Causes Identified

Besides timeout, fallbacks occur when:

1. **Invalid JSON response** (`parse_llm_response` returns None):
   - LLM returns malformed JSON
   - No JSON structure found in response
   - JSON structure validation fails

2. **Network/connection errors**:
   - `requests.exceptions.Timeout` → Fallback
   - `requests.exceptions.ConnectionError` → Fallback
   - `requests.exceptions.RequestException` → Fallback

3. **Resource limits**:
   - Prompt > 20,000 characters → Hard error
   - Prompt > 15,000 characters → Warning + possible timeout
   - > 10 chunks per photo → Limited (not fallback)

4. **LLM service issues**:
   - Ollama not running
   - Model not loaded
   - Internal Ollama errors

## 5. Files Changed

### docker-compose.yml
**Line 63**: `cpus: '1.5'` → `cpus: '2.5'`

### auth_backend.py  
**Line 344**: `timeout=(30, 120)` → `timeout=(30, 240)`

## 6. Expected Performance Improvement

- **CPU**: 66% increase (1.5 → 2.5 cores)
- **Timeout**: 100% increase (120s → 240s)
- **Expected result**: Fewer LLM timeouts → Fewer fallbacks → More successful analysis