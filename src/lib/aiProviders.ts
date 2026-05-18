export type AIAuthMode = 'bearer' | 'api-key' | 'x-api-key' | 'none';

export interface BuiltinAIProvider {
  id: string;
  name: string;
  region: string;
  baseUrl: string;
  defaultModel: string;
  authMode: AIAuthMode;
}

export const AI_PROVIDERS: BuiltinAIProvider[] = [
  { id: 'openai', name: 'OpenAI', region: 'US', baseUrl: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4.1-mini', authMode: 'bearer' },
  { id: 'azure-openai', name: 'Azure OpenAI', region: 'Global', baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2025-01-01-preview', defaultModel: 'gpt-4.1-mini', authMode: 'api-key' },
  { id: 'github-models', name: 'GitHub Models', region: 'Global', baseUrl: 'https://models.inference.ai.azure.com/chat/completions', defaultModel: 'gpt-4o-mini', authMode: 'bearer' },
  { id: 'azure-ai-foundry', name: 'Azure AI Foundry', region: 'Global', baseUrl: 'https://YOUR-ENDPOINT.models.ai.azure.com/chat/completions', defaultModel: 'gpt-4o-mini', authMode: 'api-key' },
  { id: 'openrouter', name: 'OpenRouter', region: 'Global', baseUrl: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'openai/gpt-4.1-mini', authMode: 'bearer' },
  { id: 'deepseek', name: 'DeepSeek', region: 'CN', baseUrl: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat', authMode: 'bearer' },
  { id: 'moonshot', name: 'Moonshot AI', region: 'CN', baseUrl: 'https://api.moonshot.cn/v1/chat/completions', defaultModel: 'moonshot-v1-8k', authMode: 'bearer' },
  { id: 'zhipu', name: 'Zhipu GLM', region: 'CN', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-4-flash', authMode: 'bearer' },
  { id: 'minimax', name: 'MiniMax', region: 'CN', baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2', defaultModel: 'abab6.5s-chat', authMode: 'bearer' },
  { id: 'baichuan', name: 'Baichuan AI', region: 'CN', baseUrl: 'https://api.baichuan-ai.com/v1/chat/completions', defaultModel: 'Baichuan4', authMode: 'bearer' },
  { id: 'dashscope', name: 'Alibaba DashScope', region: 'CN', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel: 'qwen-plus', authMode: 'bearer' },
  { id: 'tencent-hunyuan', name: 'Tencent Hunyuan', region: 'CN', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', defaultModel: 'hunyuan-lite', authMode: 'bearer' },
  { id: 'baidu-qianfan', name: 'Baidu Qianfan', region: 'CN', baseUrl: 'https://qianfan.baidubce.com/v2/chat/completions', defaultModel: 'ernie-4.0-turbo-8k', authMode: 'bearer' },
  { id: 'volcengine-ark', name: 'Volcengine Ark', region: 'CN', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel: 'doubao-1-5-lite-32k', authMode: 'bearer' },
  { id: 'yi', name: '01.AI Yi', region: 'CN', baseUrl: 'https://api.lingyiwanwu.com/v1/chat/completions', defaultModel: 'yi-lightning', authMode: 'bearer' },
  { id: 'siliconflow', name: 'SiliconFlow', region: 'CN', baseUrl: 'https://api.siliconflow.cn/v1/chat/completions', defaultModel: 'Qwen/Qwen2.5-7B-Instruct', authMode: 'bearer' },
  { id: 'stepfun', name: 'StepFun', region: 'CN', baseUrl: 'https://api.stepfun.com/v1/chat/completions', defaultModel: 'step-1-8k', authMode: 'bearer' },
  { id: 'infinigence', name: 'Infinigence', region: 'CN', baseUrl: 'https://cloud.infini-ai.com/maas/v1/chat/completions', defaultModel: 'qwen2.5-72b-instruct', authMode: 'bearer' },
  { id: 'modelscope', name: 'ModelScope', region: 'CN', baseUrl: 'https://api-inference.modelscope.cn/v1/chat/completions', defaultModel: 'Qwen/Qwen2.5-7B-Instruct', authMode: 'bearer' },
  { id: 'groq', name: 'Groq', region: 'US', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile', authMode: 'bearer' },
  { id: 'together', name: 'Together AI', region: 'US', baseUrl: 'https://api.together.xyz/v1/chat/completions', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', authMode: 'bearer' },
  { id: 'fireworks', name: 'Fireworks AI', region: 'US', baseUrl: 'https://api.fireworks.ai/inference/v1/chat/completions', defaultModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct', authMode: 'bearer' },
  { id: 'mistral', name: 'Mistral AI', region: 'EU', baseUrl: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-small-latest', authMode: 'bearer' },
  { id: 'xai', name: 'xAI', region: 'US', baseUrl: 'https://api.x.ai/v1/chat/completions', defaultModel: 'grok-3-mini', authMode: 'bearer' },
  { id: 'perplexity', name: 'Perplexity', region: 'US', baseUrl: 'https://api.perplexity.ai/chat/completions', defaultModel: 'sonar', authMode: 'bearer' },
  { id: 'cerebras', name: 'Cerebras', region: 'US', baseUrl: 'https://api.cerebras.ai/v1/chat/completions', defaultModel: 'llama3.1-8b', authMode: 'bearer' },
  { id: 'sambanova', name: 'SambaNova', region: 'US', baseUrl: 'https://api.sambanova.ai/v1/chat/completions', defaultModel: 'Meta-Llama-3.1-8B-Instruct', authMode: 'bearer' },
  { id: 'nvidia-nim', name: 'NVIDIA NIM', region: 'US', baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions', defaultModel: 'meta/llama-3.1-8b-instruct', authMode: 'bearer' },
  { id: 'nebius', name: 'Nebius AI Studio', region: 'EU', baseUrl: 'https://api.studio.nebius.com/v1/chat/completions', defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct', authMode: 'bearer' },
  { id: 'novita', name: 'Novita AI', region: 'Global', baseUrl: 'https://api.novita.ai/v3/openai/chat/completions', defaultModel: 'meta-llama/llama-3.1-8b-instruct', authMode: 'bearer' },
  { id: 'hyperbolic', name: 'Hyperbolic', region: 'US', baseUrl: 'https://api.hyperbolic.xyz/v1/chat/completions', defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct', authMode: 'bearer' },
  { id: 'replicate', name: 'Replicate', region: 'US', baseUrl: 'https://api.replicate.com/v1/chat/completions', defaultModel: 'meta/meta-llama-3-8b-instruct', authMode: 'bearer' },
  { id: 'cloudflare-workers-ai', name: 'Cloudflare Workers AI', region: 'Global', baseUrl: 'https://api.cloudflare.com/client/v4/accounts/YOUR-ACCOUNT-ID/ai/v1/chat/completions', defaultModel: '@cf/meta/llama-3.1-8b-instruct', authMode: 'bearer' },
  { id: 'huggingface', name: 'Hugging Face', region: 'Global', baseUrl: 'https://router.huggingface.co/v1/chat/completions', defaultModel: 'meta-llama/Llama-3.1-8B-Instruct', authMode: 'bearer' },
  { id: 'openai-compatible', name: 'OpenAI Compatible', region: 'Custom', baseUrl: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4.1-mini', authMode: 'bearer' },
  { id: 'litellm', name: 'LiteLLM Proxy', region: 'Custom', baseUrl: 'http://localhost:4000/v1/chat/completions', defaultModel: 'gpt-4.1-mini', authMode: 'bearer' },
  { id: 'ollama', name: 'Ollama', region: 'Local', baseUrl: 'http://localhost:11434/v1/chat/completions', defaultModel: 'llama3.2', authMode: 'none' },
  { id: 'lm-studio', name: 'LM Studio', region: 'Local', baseUrl: 'http://localhost:1234/v1/chat/completions', defaultModel: 'local-model', authMode: 'none' },
  { id: 'vllm', name: 'vLLM', region: 'Local', baseUrl: 'http://localhost:8000/v1/chat/completions', defaultModel: 'local-model', authMode: 'none' },
  { id: 'llama-cpp', name: 'llama.cpp', region: 'Local', baseUrl: 'http://localhost:8080/v1/chat/completions', defaultModel: 'local-model', authMode: 'none' },
  { id: 'localai', name: 'LocalAI', region: 'Local', baseUrl: 'http://localhost:8080/v1/chat/completions', defaultModel: 'local-model', authMode: 'none' },
  { id: 'fastchat', name: 'FastChat', region: 'Local', baseUrl: 'http://localhost:8000/v1/chat/completions', defaultModel: 'local-model', authMode: 'none' },
];

export function getAIProvider(id: string): BuiltinAIProvider {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0];
}
