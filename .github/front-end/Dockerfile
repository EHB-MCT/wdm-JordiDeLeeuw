#gebruik een node.js basisimage
FROM node:20.19.0

#maak en stel de werkmap in binnen de container
WORKDIR /app

#kopieer de package-bestanden en installeer de nodige dependencies
COPY package.json ./
RUN npm install -g vite && npm install

#kopieer de rest van het project naar de container
COPY . .

#stel de poort in waarop de frontend  draait
EXPOSE 5173

#start de development server wanneer de container opstart
CMD ["npm", "run", "dev", "--", "--host"]