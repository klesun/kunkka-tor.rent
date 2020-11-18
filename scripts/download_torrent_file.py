import sys
import json

download_url = sys.argv[1]

tracker_client = None
# would be probably more idiomatic to get use of qbt API to get list of installed plugins...
if download_url.startswith("https://rutracker.org/"):
    from rutracker import rutracker
    tracker_client = rutracker()
elif download_url.startswith("https://bakabt.me/"):
    from bakabt import bakabt
    tracker_client = bakabt()
elif download_url.startswith("http://dl.kinozal.tv/"):
    from kinozal import kinozal
    tracker_client = kinozal()
elif download_url.startswith("https://1337x.to/"):
    from leetx import leetx
    tracker_client = leetx()
elif download_url.startswith("https://nnmclub.to/"):
    from nnmclub import nnmclub
    tracker_client = nnmclub()
elif download_url.startswith("https://www.torlock.com/"):
    from torlock import torlock
    tracker_client = torlock()
else:
    print(json.dumps({
        "status": "UNSUPPORTED_TRACKER",
    }), file=sys.stderr)
    exit(127)

tracker_client.download_torrent(download_url)