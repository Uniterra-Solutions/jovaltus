import { useState } from 'react';
import { useLocalRuntime, AssistantRuntimeProvider } from '@assistant-ui/react';
import { createJovaltusAdapter } from './chat-adapter.js';
import { ChatView } from './components/ChatView.js';
import type { ModelOption } from './components/ModelSelector.js';

const MODELS: readonly ModelOption[] = [
  { id: 'claude-sonnet-4-5', provider: 'anthropic' },
  { id: 'claude-haiku-4-5', provider: 'anthropic' },
  { id: 'gpt-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', provider: 'openai' },
];

export function App(): React.JSX.Element {
  const [currentModelId, setCurrentModelId] = useState('claude-sonnet-4-5');
  const runtime = useLocalRuntime(createJovaltusAdapter());

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatView
        currentModelId={currentModelId}
        availableModels={MODELS}
        onModelChange={(modelId) => {
          setCurrentModelId(modelId);
          acquireVsCodeApi().postMessage({ type: 'modelSwitch', modelId });
        }}
      />
    </AssistantRuntimeProvider>
  );
}
