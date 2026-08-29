import { PartialType } from "@nestjs/swagger";
import { CreateStatisticianDto } from "./create-statistician.dto";

export class UpdateStatisticianDto extends PartialType(CreateStatisticianDto) {}
