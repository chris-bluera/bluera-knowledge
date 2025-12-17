#!/usr/bin/env python3
import sys
import json
from crawl4ai import WebCrawler

def main():
    crawler = WebCrawler()
    crawler.warmup()

    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            if request.get('method') == 'crawl':
                params = request.get('params', {})
                url = params.get('url')

                if not url:
                    raise ValueError('URL parameter is required')

                result = crawler.run(url=url)

                response = {
                    'jsonrpc': '2.0',
                    'id': request.get('id'),
                    'result': {
                        'pages': [{
                            'url': url,
                            'title': result.title or '',
                            'content': result.markdown or result.text or '',
                            'links': result.links or [],
                            'crawledAt': result.crawled_at or '',
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

if __name__ == '__main__':
    main()
