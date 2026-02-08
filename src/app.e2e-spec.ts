import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/api/auth/register (POST) - should register a new user", () => {
    return request(app.getHttpServer())
      .post("/api/auth/register")
      .send({
        email: "test@example.com",
        password: "password123",
        role: "ADMIN",
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty("data");
        expect(res.body.data).toHaveProperty("access_token");
        expect(res.body.data).toHaveProperty("user");
      });
  });

  it("/api/auth/login (POST) - should login user", () => {
    return request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "password123",
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty("data");
        expect(res.body.data).toHaveProperty("access_token");
      });
  });
});
