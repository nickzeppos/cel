#!/bin/bash

# Set favicon to a random congressional portrait from public/square-images

# echo pwd

# consts
PUBLIC_PATH="public"
SQ_IMG_PATH="$PUBLIC_PATH/square-images"
FAVICON_PATH="$PUBLIC_PATH/favicon.ico"

# List of jpg files
JPGS=("$SQ_IMG_PATH"/*.jpg)

# if no jpgs, exit
if [ ${#JPGS[@]} -eq 0 ]; then
  exit 1
fi

# Select a random jpg
RAND_JPG=${JPGS[RANDOM % ${#JPGS[@]}]}

# Copy the selected file to favicon.ico
cp "$RAND_JPG" "$FAVICON_PATH"


