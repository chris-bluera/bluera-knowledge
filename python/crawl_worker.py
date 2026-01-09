#!/usr/bin/env python3
import sys
import json
import asyncio
import os
import ast
from typing import List, Dict, Any

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

        # Combine internal and external links - let TypeScript filter by domain
        all_links = []
        if isinstance(result.links, dict):
            all_links = result.links.get("internal", []) + result.links.get("external", [])

        return {
            "html": result.html or '',
            "markdown": result.markdown or result.cleaned_html or '',
            "links": all_links
        }

def is_exported(node: ast.AST) -> bool:
    """Check if a function or class is exported (Python doesn't have explicit exports, check if starts with '_')"""
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        return not node.name.startswith('_')
    return False

def get_signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    """Extract function signature from AST node"""
    args_list = []

    for arg in node.args.args:
        arg_str = arg.arg
        if arg.annotation:
            arg_str += f': {ast.unparse(arg.annotation)}'
        args_list.append(arg_str)

    return_annotation = ''
    if node.returns:
        return_annotation = f' -> {ast.unparse(node.returns)}'

    return f"{node.name}({', '.join(args_list)}){return_annotation}"

def extract_imports(tree: ast.AST) -> List[Dict[str, Any]]:
    """Extract import statements from AST"""
    imports = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append({
                    'source': alias.name,
                    'imported': alias.asname if alias.asname else alias.name
                })
        elif isinstance(node, ast.ImportFrom):
            module = node.module if node.module else ''
            for alias in node.names:
                imports.append({
                    'source': module,
                    'imported': alias.name,
                    'alias': alias.asname if alias.asname else None
                })

    return imports

def extract_calls(node: ast.AST) -> List[str]:
    """Extract function calls from a function/method body"""
    calls = []

    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            if isinstance(child.func, ast.Name):
                calls.append(child.func.id)
            elif isinstance(child.func, ast.Attribute):
                calls.append(child.func.attr)

    return calls

async def parse_python_ast(code: str, file_path: str) -> Dict[str, Any]:
    """Parse Python code and return CodeNode array"""
    try:
        tree = ast.parse(code)
        nodes = []

        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                nodes.append({
                    'type': 'function',
                    'name': node.name,
                    'exported': is_exported(node),
                    'startLine': node.lineno,
                    'endLine': node.end_lineno if node.end_lineno else node.lineno,
                    'async': isinstance(node, ast.AsyncFunctionDef),
                    'signature': get_signature(node),
                    'calls': extract_calls(node)
                })

            elif isinstance(node, ast.ClassDef):
                methods = []
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        methods.append({
                            'name': item.name,
                            'async': isinstance(item, ast.AsyncFunctionDef),
                            'signature': get_signature(item),
                            'startLine': item.lineno,
                            'endLine': item.end_lineno if item.end_lineno else item.lineno,
                            'calls': extract_calls(item)
                        })

                nodes.append({
                    'type': 'class',
                    'name': node.name,
                    'exported': is_exported(node),
                    'startLine': node.lineno,
                    'endLine': node.end_lineno if node.end_lineno else node.lineno,
                    'methods': methods
                })

        imports = extract_imports(tree)

        return {
            'nodes': nodes,
            'imports': imports
        }

    except SyntaxError as e:
        raise Exception(f"Python syntax error at line {e.lineno}: {e.msg}")
    except Exception as e:
        raise Exception(f"Failed to parse Python AST: {str(e)}")

async def process_request(crawler, request):
    """Process a single crawl request"""
    try:
        params = request.get('params', {})
        url = params.get('url')

        if not url:
            raise ValueError('URL parameter is required')

        # Perform async crawl
        result = await crawler.arun(url=url)

        if not result.success:
            raise Exception(f"Crawl failed: {result.error_message}")

        # Extract title from metadata (crawl4ai 0.7.8 stores title in metadata dict)
        title = ''
        if result.metadata and isinstance(result.metadata, dict):
            title = result.metadata.get('title', '')

        # Get markdown content (crawl4ai 0.7.8)
        markdown = result.markdown or result.cleaned_html or ''

        # Extract links - crawl4ai 0.7.8 returns dict with 'internal' and 'external' keys
        # Each link is an object with href, text, title, etc. - extract just href strings
        all_links = []
        if isinstance(result.links, dict):
            internal = result.links.get('internal', [])
            external = result.links.get('external', [])
            # Extract href from link objects (crawl4ai 0.7.8 returns objects, not strings)
            for link in internal + external:
                if isinstance(link, dict):
                    all_links.append(link.get('href', ''))
                elif isinstance(link, str):
                    all_links.append(link)

        response = {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {
                'pages': [{
                    'url': url,
                    'title': title,
                    'content': markdown,
                    'html': result.html or '',
                    'links': all_links,
                    'crawledAt': '',  # crawl4ai 0.7.8 doesn't provide timestamp
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

                elif method == 'parse_python':
                    # Handle Python AST parsing request
                    try:
                        params = request.get('params', {})
                        code = params.get('code')
                        file_path = params.get('filePath', '<unknown>')

                        if not code:
                            raise ValueError('code parameter is required')

                        result = await parse_python_ast(code, file_path)
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
