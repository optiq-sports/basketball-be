import { PartialType } from "@nestjs/mapped-types";
import { CreateStatisticianDto } from "./create-statistician.dto";

export class UpdateStatisticianDto extends PartialType(CreateStatisticianDto) {}
