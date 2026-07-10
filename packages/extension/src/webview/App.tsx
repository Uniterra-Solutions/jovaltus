import { useState } from 'react';
import { useLocalRuntime, AssistantRuntimeProvider } from '@assistant-ui/react';
import { createJovaltusAdapter } from './chat-adapter.js';
import { ChatView } from './components/ChatView.js';
import { parseInitMeta, type InitModels } from './init-models.js';

/** Read the host-injected model list + default from the jovaltus-init meta tag. */
function readInitModels(): InitModels {
  const meta = document.querySelector('meta[name="jovaltus-init"]');
  return parseInitMeta(meta?.getAttribute('content')) ?? { models: [], defaultModelId: '' };
}

export function App(): React.JSX.Element {
  const [init] = useState<InitModels>(readInitModels);
  const [currentModelId, setCurrentModelId] = useState(init.defaultModelId);
  const runtime = useLocalRuntime(createJovaltusAdapter());

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatView
        currentModelId={currentModelId}
        availableModels={init.models}
        onModelChange={(modelId) => {
          setCurrentModelId(modelId);
          acquireVsCodeApi().postMessage({ type: 'modelSwitch', modelId });
        }}
      />
    </AssistantRuntimeProvider>
  );
}
