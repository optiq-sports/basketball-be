import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from "@nestjs/common";
import {
  TournamentFilterDto,
  TOURNAMENT_SORT_FIELDS,
} from "./tournament-filter.dto";

interface ValidationErrorResponse {
  message: string[];
  error: string;
  statusCode: number;
}

describe("TournamentFilterDto Validation", () => {
  let target: ValidationPipe;
  const metadata: ArgumentMetadata = {
    type: "query",
    metatype: TournamentFilterDto,
  };

  beforeEach(() => {
    target = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });
  });

  it("accepts valid tournament sortBy fields", async () => {
    for (const field of TOURNAMENT_SORT_FIELDS) {
      const result = (await target.transform(
        { sortBy: field, sortOrder: "desc" },
        metadata,
      )) as TournamentFilterDto;
      expect(result.sortBy).toBe(field);
      expect(result.sortOrder).toBe("desc");
    }
  });

  it("rejects invalid sortBy value with a message naming allowed values", async () => {
    expect.assertions(3);
    try {
      await target.transform({ sortBy: "nonsense" }, metadata);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BadRequestException);
      const exception = err as BadRequestException;
      const response = exception.getResponse() as ValidationErrorResponse;
      expect(response.message).toBeDefined();
      expect(
        response.message.some((msg) =>
          msg.includes(
            "sortBy must be one of the following values: name, division, numberOfGames, startDate, endDate, venue, createdAt, updatedAt",
          ),
        ),
      ).toBe(true);
    }
  });

  it("rejects unknown query params when somethingElse is provided", async () => {
    expect.assertions(3);
    try {
      await target.transform({ somethingElse: "1" }, metadata);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BadRequestException);
      const exception = err as BadRequestException;
      const response = exception.getResponse() as ValidationErrorResponse;
      expect(response.message).toBeDefined();
      expect(
        response.message.some((msg) =>
          msg.includes("property somethingElse should not exist"),
        ),
      ).toBe(true);
    }
  });

  it("rejects invalid sortOrder value", async () => {
    expect.assertions(2);
    try {
      await target.transform({ sortOrder: "diagonal" }, metadata);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BadRequestException);
      const exception = err as BadRequestException;
      const response = exception.getResponse() as ValidationErrorResponse;
      expect(
        response.message.some((msg) =>
          msg.includes(
            "sortOrder must be one of the following values: asc, desc",
          ),
        ),
      ).toBe(true);
    }
  });
});
