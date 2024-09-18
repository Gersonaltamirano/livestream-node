import NodeMediaServer from "node-media-server";
import express from "express";
import ffmpeg from "ffmpeg-static";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv"

const {
    PORT_HTTP,
    PORT_RTMP,
    PORT_VIDEO,
    URL_BASE,
    URL_DOMINIO,
    URL_RTMP,
    URL_VIDEO,
} = dotenv.config().parsed


// Simular __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del servidor media
const mediaRootPath = path.resolve(__dirname, "media");
const ffmpegPath = ffmpeg || path.resolve(__dirname, "bin", "ffmpeg");

// Verificar que el directorio media existe o crearlo si no
if (!fs.existsSync(mediaRootPath)) {
  fs.mkdirSync(mediaRootPath, { recursive: true });
}

// Configuración dinámica
const config = {
  rtmp: {
    port: PORT_RTMP,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: PORT_VIDEO,
    allow_origin: "*",
    // api: true,
    mediaroot: "./media",
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [],
  },
};

// Inicializar el servidor de Node Media
const nms = new NodeMediaServer(config);

// Express para manejar las rutas dinámicas
const app = express();

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
    <html>
    <head>
      <title>Reproductor de canales en vivos</title>
    </head>
    <body>
      <h1>Para reproducir un canal en vivo coloque la ruta correcta</h1>
    </body>
    </html>
  `);
});

// Crear rutas dinámicas para canales
app.get("/channel/:channel", (req, res) => {
  console.log("Solicitud de canal", req.params.channel);
  const channelName = req.params.channel;

  // Crear un directorio para almacenar los archivos HLS/DASH de cada canal
  const channelPath = path.join(mediaRootPath, channelName);
  if (!fs.existsSync(channelPath)) {
    fs.mkdirSync(channelPath, { recursive: true });
  }

  // Añadir configuración dinámica para el canal
  config.trans.tasks.push({
    app: channelName,
    hls: true,
    hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
    dash: true,
    mp4: true,
    mp4Flags: "[movflags=frag_keyframe+empty_moov]",
    mediaRoot: channelPath, // Directorio específico para el canal
  });

  const url_m3u8 = "https://" + URL_BASE + "-" + URL_VIDEO + "." + URL_DOMINIO + "/" + channelName + "/index.m3u8"


  // Responder al cliente con información del canal
  //   http://localhost:8000/${channelName}/index.m3u8
  res.send(`
	<!DOCTYPE html>
    <html>
    <head>
      <title>Reproductor de Canal ${channelName}</title>
    </head>
    <body>
      <!-- CSS  -->
<link
  href="https://vjs.zencdn.net/7.2.3/video-js.css"
  rel="stylesheet" />

  <a href="${url_m3u8}">lista</a>
  <h1>URL PARA TRANSMITIR EN VIVO: </h1>
  <h1>rtmp://${URL_BASE}-${URL_RTMP}.${URL_DOMINIO}/${channelName}</h1>

	<!-- HTML -->
	<video
	id="hls-example"
	class="video-js vjs-default-skin"
	width="1024"
	height="600"
	controls>
	<source
		type="application/x-mpegURL"
		src="${url_m3u8}" />
	</video>
	<!-- JS code -->
	<!-- If you'd like to support IE8 (for Video.js versions prior to v7) -->
	<script src="https://vjs.zencdn.net/ie8/ie8-version/videojs-ie8.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/videojs-contrib-hls/5.14.1/videojs-contrib-hls.js"></script>
	<script src="https://vjs.zencdn.net/7.2.3/video.js"></script>

	<script>
	var player = videojs("hls-example");
	player.play();
	</script>
    </html>
  `);
});

// Iniciar el servidor de express en el puerto 8001
app.listen(PORT_HTTP, () => {
  console.log("Servidor HTTP dinámico corriendo en puerto " + PORT_HTTP);
});

// Iniciar el servidor de transmisión
nms.run();
