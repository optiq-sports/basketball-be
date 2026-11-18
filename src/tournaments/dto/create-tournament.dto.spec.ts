import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateTournamentDto } from "./create-tournament.dto";
import { UpdateTournamentDto } from "./update-tournament.dto";
import { TournamentDivision, TournamentFormat } from "@prisma/client";

describe("CreateTournamentDto & UpdateTournamentDto Officials Validation", () => {
  const validBasePayload = {
    name: "Summer League 2026",
    division: TournamentDivision.DIVISION_1,
    numberOfGames: 10,
    quarterDuration: 10,
    startDate: "2026-06-01T00:00:00Z",
    venue: "Main Arena",
    format: TournamentFormat.ROUND_ROBIN,
  };

  describe("CreateTournamentDto", () => {
    it("succeeds when crewChief is provided and umpire1, umpire2, commissioner are omitted", async () => {
      const dto = plainToInstance(CreateTournamentDto, {
        ...validBasePayload,
        crewChief: "John Doe",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("succeeds when all officials (crewChief, umpire1, umpire2, commissioner) are provided", async () => {
      const dto = plainToInstance(CreateTournamentDto, {
        ...validBasePayload,
        crewChief: "John Doe",
        umpire1: "Jane Smith",
        umpire2: "Mike Johnson",
        commissioner: "Adam Silver",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("fails when crewChief is omitted", async () => {
      const dto = plainToInstance(CreateTournamentDto, {
        ...validBasePayload,
        // crewChief missing
      });

      const errors = await validate(dto);
      const crewChiefError = errors.find((e) => e.property === "crewChief");
      expect(crewChiefError).toBeDefined();
    });

    it("fails when crewChief is an empty string", async () => {
      const dto = plainToInstance(CreateTournamentDto, {
        ...validBasePayload,
        crewChief: "",
      });

      const errors = await validate(dto);
      const crewChiefError = errors.find((e) => e.property === "crewChief");
      expect(crewChiefError).toBeDefined();
      expect(crewChiefError?.constraints).toHaveProperty("isNotEmpty");
    });

    it("succeeds when only crewChief and commissioner are provided (umpire1 and umpire2 omitted)", async () => {
      const dto = plainToInstance(CreateTournamentDto, {
        ...validBasePayload,
        crewChief: "John Doe",
        commissioner: "Adam Silver",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe("UpdateTournamentDto", () => {
    it("succeeds when crewChief is omitted in an update", async () => {
      const dto = plainToInstance(UpdateTournamentDto, {
        name: "Updated League Name",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("fails when crewChief is passed as empty string in an update", async () => {
      const dto = plainToInstance(UpdateTournamentDto, {
        crewChief: "",
      });

      const errors = await validate(dto);
      const crewChiefError = errors.find((e) => e.property === "crewChief");
      expect(crewChiefError).toBeDefined();
      expect(crewChiefError?.constraints).toHaveProperty("isNotEmpty");
    });

    it("succeeds when crewChief is updated to a non-empty string", async () => {
      const dto = plainToInstance(UpdateTournamentDto, {
        crewChief: "New Crew Chief",
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
