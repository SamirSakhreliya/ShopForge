import express, { Application } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import Server from './Src/Index';
import http from 'http';

dotenv.config();
const app: Application = express();

app.use('/uploads', express.static('uploads')); // serves static files from the uploads directory
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from any origin on the local network, replace with specific IPs if needed
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

new Server(app);
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SERVER_IP: string = process.env.SERVER_IP ?? '0.0.0.0';

const server = http.createServer(app);

server
  .listen(PORT, SERVER_IP, function () {
    console.log(`Server is running on http://${SERVER_IP}:${PORT}`);
  })
  .on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      return error;
    } else {
      return new Error('INTERNAL SERVER ERROR');
    }
  });
