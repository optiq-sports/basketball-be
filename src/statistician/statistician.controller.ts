import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from "@nestjs/common";
import { StatisticianService } from "./statistician.service";
import { CreateStatisticianDto } from "./dto/create-statistician.dto";
import { UpdateStatisticianDto } from "./dto/update-statistician.dto";

@Controller("statistician")
export class StatisticianController {
  constructor(private readonly statisticianService: StatisticianService) {}

  @Post()
  create(@Body() createStatisticianDto: CreateStatisticianDto) {
    return this.statisticianService.create(createStatisticianDto);
  }

  @Get()
  findAll() {
    return this.statisticianService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.statisticianService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateStatisticianDto: UpdateStatisticianDto,
  ) {
    return this.statisticianService.update(id, updateStatisticianDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.statisticianService.remove(id);
  }
}
