import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PortfolioAssetInputDto {
  @IsString()
  @MaxLength(10)
  symbol!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  weight!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}

export class CreatePortfolioDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PortfolioAssetInputDto)
  assets!: PortfolioAssetInputDto[];
}
