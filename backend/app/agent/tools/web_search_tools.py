import urllib.parse
import httpx
from strands import tool

@tool
def search_web_for_information(query: str) -> str:
    """Search the web for real-time background knowledge, website descriptions, or research topics.
    Use this whenever the user asks what an unfamiliar website is about, asks to research a company or subject,
    or needs information not present in the active page DOM.
    """
    clean_query = query.strip()
    headers = {"User-Agent": "RecareBrowserAgent/1.0 (accessibility research bot)"}
    results = []

    # 1. Wikipedia summary check for entity / website / concept
    entity_name = (
        clean_query.replace("what is", "")
        .replace("website", "")
        .replace("about", "")
        .replace("who is", "")
        .strip(" ?.!")
        .title()
    )
    try:
        wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(entity_name)}"
        with httpx.Client(timeout=4.0) as client:
            r = client.get(wiki_url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                if data.get("extract"):
                    results.append(f"Wikipedia: {data['extract']}")
    except Exception:
        pass

    # 2. DuckDuckGo Instant Answer / Abstract
    try:
        ddg_url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(clean_query)}&format=json&no_html=1&skip_disambig=1"
        with httpx.Client(timeout=4.0) as client:
            r = client.get(ddg_url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                if data.get("AbstractText"):
                    results.append(f"Overview: {data['AbstractText']}")
                elif data.get("RelatedTopics"):
                    first = data["RelatedTopics"][0]
                    if isinstance(first, dict) and first.get("Text"):
                        results.append(f"Details: {first['Text']}")
    except Exception:
        pass

    if results:
        return "\n\n".join(results)
    return f"Web search results for '{clean_query}': To inspect live web results, use NAVIGATE to https://www.google.com/search?q={urllib.parse.quote(clean_query)}"
