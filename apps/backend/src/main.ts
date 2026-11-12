import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>("nodeEnv") || "development";
  const frontendUrl = config.get<string>("frontendUrl") || "http://localhost:3000";
  const port = config.get<number>("backendPort") || 3001;

  app.setGlobalPrefix("api");

  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Request-Id",
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Kisa Backend API")
      .setDescription("Discord bot dashboard API")
      .setVersion("0.1.0")
      .addCookieAuth("kisa_session")
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document, {
      jsonDocumentUrl: "api/docs-json",
    });
  }

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${port}`);
  if (nodeEnv !== "production") {
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
