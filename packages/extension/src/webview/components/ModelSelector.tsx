import type { ModelOption } from '../init-models.js';

export function ModelSelector({
  currentModelId,
  availableModels,
  onModelChange,
}: {
  readonly currentModelId: string;
  readonly availableModels: readonly ModelOption[];
  readonly onModelChange: (modelId: string) => void;
}): React.JSX.Element {
  return (
    <div className="jovaltus-model-selector">
      <span className="jovaltus-model-label">Model:</span>
      <select
        value={currentModelId}
        onChange={(e) => {
          onModelChange(e.target.value);
        }}
        aria-label="Select AI model"
      >
        {availableModels.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id} ({m.provider})
          </option>
        ))}
      </select>
    </div>
  );
}
