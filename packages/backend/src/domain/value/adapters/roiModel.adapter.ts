import { RoiModel } from '../dto';
import { RoiModelSchema } from '../schemas/roiModel.schema';

export function fromFinancialModel(valueCaseId: string, row: any): RoiModel {
  const model: RoiModel = {
    valueCaseId,
    assumptions: row.assumptions ?? {},
    outputs: row.outputs ?? {},
  };
  RoiModelSchema.parse(model);
  return model;
}
