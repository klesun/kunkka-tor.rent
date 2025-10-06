#!/bin/bash
set -e

zip app.zip server.js package.json

az webapp deployment source config-zip --src ./app.zip -n nyaa-si-proxy -g sosi --subscription 3a50dbec-b5b4-4041-b97d-a3125ef48c42

