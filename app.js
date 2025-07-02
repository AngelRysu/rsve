const express = require("express");
const dotenv = require("dotenv");
const https = require("https");

dotenv.config();

const http_server = express();
http_server.use( express.json() );

http_server.use(( req, res, next ) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
});


/*const privateKey  = fs.readFileSync( '/etc/letsencrypt/live/xura.tsj.mx/privkey.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/xura.tsj.mx/fullchain.pem', 'utf8');
const certificate = fs.readFileSync( '/etc/letsencrypt/live/xura.tsj.mx/cert.pem', 'utf8');*/

//const credentials = { key: privateKey, ca: ca, cert: certificate };
//const https_server = https.createServer( credentials, http_server );

http_server.listen( process.env.PORT , () => { console.log('servidor corriendo en el puerto: ', process.env.PORT); });