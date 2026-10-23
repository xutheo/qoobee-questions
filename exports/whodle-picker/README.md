# Local Whodle question picker

From PowerShell:

```powershell
cd "C:\Users\zhaok\Desktop\whodle\whodle"
python picker\app.py
```

Open http://127.0.0.1:3010. Stop with Ctrl+C. Requires Python 3.10+; no packages to install.

1. Find a member by username/nickname prefix or numeric Discord user ID.
2. Set inclusive UTC dates, quote/image mode, and minimum characters or words.
3. Optionally choose configured channels; click **Find all matches**.
4. Review the answers and original Discord links, then download JSON.

The app reads the existing bot token, guild ID and channel list from `scripts/generate_data.py` without running the scraper. `DISCORD_TOKEN` can override the token; `PICKER_PORT` can override port 3010. Credentials remain on the Python server. It binds only to localhost; do not tunnel this utility publicly.

The bot needs View Channel / Read Message History and Message Content intent to read quotes. Member lookup may require Server Members intent. Only the existing scraper's configured text channels are scanned, not threads. All unique matching messages found in scanned history are returned. Searches have a configurable global scan cap; a warning reports incomplete scans. Images are attachments or image embeds; minimum length applies to the caption, so choose zero for image-only posts.

Each completed or cancelled search is automatically saved as a uniquely named JSON file in `picker/results/`, including filters, source metadata and any partial-scan warnings. The page shows the saved path. Image URLs are saved, not the image files themselves. Downloaded JSON contains quotes, author answers, image URLs and source metadata; it is not a complete Jeopardy board import. Discord image URLs can expire, so save desired images locally for use in your questions.

Run checks: `python -m unittest discover -s picker -p "test_*.py"`.
