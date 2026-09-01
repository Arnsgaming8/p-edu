"""Vercel serverless entrypoint for the Flask app.

Vercel's Python runtime detects the WSGI `app` object in this file and serves
it for every route matched in vercel.json.
"""

import os
import sys

# Make the repo root importable so `webapp` resolves from api/index.py.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from webapp import app  # noqa: E402  (Flask WSGI app)
