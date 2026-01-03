import requests


def query_ollama(prompt: str, model: str = "llama3"):
    try:
        prompt_length = len(prompt)
        print(f"LLM REQUEST: Prompt length: {prompt_length} characters, Model: {model}")

        if prompt_length > 20000:
            raise Exception(f"Prompt too long: {prompt_length} characters (max 20000)")

        if prompt_length > 15000:
            print(f"WARNING: Large prompt ({prompt_length} chars) - may cause high resource usage")

        ollama_url = "http://ollama:11434/api/generate"

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 2000,
                "top_k": 40,
                "top_p": 0.9,
            },
        }

        print(f"Sending LLM request to {ollama_url}")

        response = requests.post(
            ollama_url,
            json=payload,
            timeout=(30, 240),
        )

        response.raise_for_status()
        result = response.json()

        llm_response = result.get("response", "")
        response_length = len(llm_response)
        print(f"LLM RESPONSE: Length: {response_length} characters")

        return llm_response
    except requests.exceptions.Timeout:
        raise Exception("Ollama request timed out - try with fewer photos or shorter text")
    except requests.exceptions.ConnectionError:
        raise Exception("Could not connect to Ollama service - ensure it's running")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Ollama request failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Ollama query error: {str(e)}")
