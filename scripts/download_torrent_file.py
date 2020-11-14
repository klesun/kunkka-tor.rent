import sys
import json

download_url = sys.argv[1]

tracker_client = None
if download_url.startswith("https://rutracker.org/"):
    from rutracker import rutracker
    tracker_client = rutracker()
elif download_url.startswith("https://bakabt.me/"):
    from bakabt import bakabt
    tracker_client = bakabt()
elif download_url.startswith("http://dl.kinozal.tv/"):
    from kinozal import kinozal
    tracker_client = kinozal()
else:
    print(json.dumps({
        "status": "UNSUPPORTED_TRACKER",
    }), file=sys.stderr)
    exit(127)

tracker_client.download_torrent(download_url)