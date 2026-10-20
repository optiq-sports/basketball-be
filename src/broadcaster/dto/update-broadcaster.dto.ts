import { PartialType } from "@nestjs/swagger";
import { CreateBroadcasterDto } from "./create-broadcaster.dto";

export class UpdateBroadcasterDto extends PartialType(CreateBroadcasterDto) {}
