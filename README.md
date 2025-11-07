## [kunkka-torrent](https://torrent.klesun.net)

A web app that allows playing video/music from torrents directly in the browser, without downloading to PC

Unlike projects like https://webtor.io/, this one will get advantage of it nonameness and will be more positioned towards helping users in finding the torrents rather than just provide an engine to play a torrent file from your pc. Also I think webtor.io streams through server and applies priced rate limits, which won't be happening here as you will be peering the torrent yourself in your browser, without a middleman service, the site will only host the client scripts and tools that will help you find torrent files in the database from various trackers.

Most likely will be powered by https://webtorrent.io/intro

Please, be aware of https://github.com/asapach/peerflix-server

![image](https://user-images.githubusercontent.com/5202330/92304972-87705500-ef8b-11ea-84c6-ad305c70b045.png)


For the best value, you want to install qBittorrent and make sure that its Wib UI API is accessible on the 44011 port so that app could use it as an additional source of torrents.

You also likely want to install jackett and add its plugin to qBittorrent, it has tons of torrents
https://github.com/Jackett/Jackett
Don't forget to add indexers in its web ui!

____________________

## Server Dependencies
You can run it locally if you have `./data/db/Infohashes.sqlite` and `./data/db/TorrentNamesFts.sqlite` files. You can download them from here:
- http://torrent.klesun.net/data/db/Infohashes.sqlite
- http://torrent.klesun.net/data/db/TorrentNamesFts.sqlite

They are several GiB each.

It is also advised to set up the following:
- Install [ffmpeg](https://www.ffmpeg.org/download.html), it's needed for many of the playback features including changing sub/audio tracks
- Install and start [qBittorrent](https://www.qbittorrent.org/download) and enable WebUI with port 44011 in settings and allow localhost access and disabling all security validation checkboxes. It is advised to also add some plugins, especially jacket mentioned earlier

To start the server:
- First, install dependencies with `npm i` ([node.js](https://nodejs.org/en/download) must be installed beforehand)
- Then run `npm run dev`
- The server should then be accessible in browser at the address: http://localhost:36865/