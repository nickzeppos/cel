FROM node:16.17.1-alpine
WORKDIR /app
ENV DB_URL $DB_URL
ENV CONGRESS_GOV_API_KEY $CONGRESS_GOV_API_KEY
ENV CONGRESS_GOV_API_BASE_URL $CONGRESS_GOV_API_BASE_URL
EXPOSE 3000
EXPOSE 3030
EXPOSE 49153