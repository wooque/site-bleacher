#!/bin/bash
rm site-bleacher.zip
zip -r site-bleacher.zip . -x ".*" -x README.md -x "package.sh"
