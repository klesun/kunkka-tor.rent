
CREATE VIRTUAL TABLE TorrentNamesFts USING fts5(infohash, name);
