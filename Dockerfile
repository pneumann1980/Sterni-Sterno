# Seestern Fighters — Docker Image
# Lightweight nginx to serve the static game files

FROM nginx:alpine

# Copy game files into nginx web root
COPY . /usr/share/nginx/html

# nginx serves on port 80 by default
EXPOSE 80
