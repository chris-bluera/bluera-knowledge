#!/usr/bin/env python3
import sys
import json
import asyncio
import os

# Suppress crawl4ai logging before import
os.environ['CRAWL4AI_VERBOSE'] = '0'

# Redirect stderr to suppress logging (crawl4ai uses console for progress)
import io
sys.stderr = io.StringIO()

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

async def fetch_headless(url: str):
    """Fetch URL with headless browser (Playwright via crawl4ai)"""
    browser_config = BrowserConfig(headless=True, verbose=False)
    run_config = CrawlerRunConfig(
        wait_for="js:() => document.readyState === 'complete'",
        page_timeout=30000
    )

    async with AsyncWebCrawler(config=browser_config, verbose=False) as crawler:
        result = await crawler.arun(url, config=run_config)

        if not result.success:
            raise Exception(f"Crawl failed: {result.error_message}")

        return {
            "html": result.html or '',
            "markdown": result.markdown or result.cleaned_html or '',
            "links": result.links.get("internal", []) if isinstance(result.links, dict) else []
        }

async def process_request(crawler, request):
    """Process a single crawl request"""
    try:
        params = request.get('params', {})
        url = params.get('url')

        if not url:
            raise ValueError('URL parameter is required')

        # Perform async crawl
        result = await crawler.arun(url=url)

        response = {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {
                'pages': [{
                    'url': url,
                    'title': result.title or '',
                    'content': result.markdown or result.cleaned_html or '',
                    'html': result.html or '',
                    'links': result.links.get('internal', []) + result.links.get('external', []) if isinstance(result.links, dict) else [],
                    'crawledAt': '',  # crawl4ai 0.7.8 doesn't provide crawled_at
                }]
            }
        }
        print(json.dumps(response), flush=True)
    except Exception as e:
        error_response = {
            'jsonrpc': '2.0',
            'id': request.get('id') if isinstance(request, dict) else None,
            'error': {'code': -1, 'message': str(e)}
        }
        print(json.dumps(error_response), flush=True)

async def main():
    """Main async loop processing stdin requests"""
    # Disable verbose logging in crawl4ai
    async with AsyncWebCrawler(verbose=False) as crawler:
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                method = request.get('method')

                if method == 'crawl':
                    await process_request(crawler, request)
                elif method == 'fetch_headless':
                    # Handle headless fetch request
                    try:
                        params = request.get('params', {})
                        url = params.get('url')
                        if not url:
                            raise ValueError('URL parameter is required')

                        result = await fetch_headless(url)
                        response = {
                            'jsonrpc': '2.0',
                            'id': request.get('id'),
                            'result': result
                        }
                        print(json.dumps(response), flush=True)
                    except Exception as e:
                        error_response = {
                            'jsonrpc': '2.0',
                            'id': request.get('id'),
                            'error': {'code': -1, 'message': str(e)}
                        }
                        print(json.dumps(error_response), flush=True)

            except Exception as e:
                error_response = {
                    'jsonrpc': '2.0',
                    'id': request.get('id') if isinstance(request, dict) else None,
                    'error': {'code': -1, 'message': str(e)}
                }
                print(json.dumps(error_response), flush=True)

if __name__ == '__main__':
    asyncio.run(main())
