import { Type } from '@sinclair/typebox';

export const CheckPlanSchema = Type.Object({
  taskSummary: Type.String(),
  implementationPlan: Type.String(),
  acceptanceCriteria: Type.Array(Type.String()),
  affectedModules: Type.Array(Type.String()),
  verificationItems: Type.Array(
    Type.Object({
      description: Type.String(),
      command: Type.String(),
    }),
  ),
});
