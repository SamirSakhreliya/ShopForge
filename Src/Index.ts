import * as express from 'express';
import { ErrorRequestHandler } from 'express';
import { Application } from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import bodyParser from 'body-parser';

dotenv.config();

export default class Server {
  constructor(app: Application) {
    // holds the express application for multiple route endpoints
    this.config(app);
    this.setupSwagger(app);
  }

  public config(app: Application): void {
    // Middleware setup
    app.use(express.json({ limit: '5mb' })); // Parse JSON bodies

    app.use('/uploads', express.static('uploads'));
    /*
      the local uploads folder on the server that needs to be replaced with
      S3 bucket that would be used in production grade applications.
      This is just for development and testing purposes, and should not be used in production.
    */
    app.use(bodyParser.json({ limit: '5mb' })); // Parse JSON bodies with a size limit
    app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      console.error('Error:', err);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    };
    app.use(errorHandler);
  }

  //Swagger Setup
  private setupSwagger(app: Application): void {
    const port: number = process.env.PORT
      ? parseInt(process.env.PORT, 10)
      : 3000;
    const serverIP: string = process.env.SWAGGER_IP ?? '0.0.0.0';
    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'ShopForge API Documentation',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${port}`,
            description: 'Local server',
          },
          {
            url: `http://${serverIP}:${port}`,
            description: 'External server for network devices',
          },
        ],
      },
      apis: [path.join(__dirname, './Routes/**/*.ts')],
      // Path to the API route files for swagger-jsdoc to scan for annotations
    };

    // Initialize swagger-jsdoc
    const swaggerSpec = swaggerJsdoc(options);

    //setup swagger UI
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // Documents endpoint
  }
}
