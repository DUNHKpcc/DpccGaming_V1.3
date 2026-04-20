 # 接入codex cli教程 同样适用于codex app

  本文用于将 Codex CLI 接入你的 `new-api` 网关。

  ## 1. 前提条件

  你需要准备好：

  - `new-api` 网关地址
  - 可用的 API Key
  - 可调用的模型名

  当前示例使用：

  - Base URL: `https://api.dpccgaming.xyz/v1`
  - Model: `gpt-5.4`

  ## 2. 配置 Codex CLI

  Codex CLI 的配置文件路径通常是：

  ```text
  ~/.codex/config.toml

  将下面内容写入 ~/.codex/config.toml：

  profile = "dpcc"

  [profiles.dpcc]
  model_provider = "dpcc"
  model = "gpt-5.4"

  [model_providers.dpcc]
  name = "DPCC new-api"
  base_url = "https://api.dpccgaming.xyz/v1"
  env_key = "OPENAI_API_KEY"
  requires_openai_auth = true
  wire_api = "responses"

  model = "gpt-5.4"
  model_reasoning_effort = "medium"

  ## 3. 设置环境变量

  在终端执行：

  export OPENAI_API_KEY="sk-你的API密钥"

  注意：

  - env_key = "OPENAI_API_KEY" 填的是环境变量名
  - 不是直接把 sk-xxx 写进 env_key

  错误示例：

  env_key = "sk-xxxx"

  这是错误的，因为 Codex 会把它当作“环境变量名称”去查找。

  ## 4. 启动 Codex CLI

  执行：

  codex --profile dpcc

  如果你的默认 profile 就是这个，也可以直接：

  codex

  ## 5. 如何检查是否接入成功

  你可以先用 API 测试模型是否可见：

  curl https://api.dpccgaming.xyz/v1/models \
    -H "Authorization: Bearer sk-你的API密钥"

  如果返回里能看到：

  {
    "id": "gpt-5.4"
  }

  说明该 key 可以访问这个模型。

  ## 6. 常见问题

  ### 6.1 报错：Missing environment variable

  例如：

  Missing environment variable: `sk-xxxx`

  原因通常是你把真实 API Key 写进了 env_key。

  正确写法：

  env_key = "OPENAI_API_KEY"

  然后在终端设置：

  export OPENAI_API_KEY="sk-xxxx"

  ### 6.2 报错：This token has no access to model gpt-5.4

  这表示当前 key 对这个模型没有权限。

  需要去 new-api 后台检查该令牌的：

  - 模型限制列表
  - 是否包含 gpt-5.4

  ### 6.3 报错：Stream must be set to true

  这通常说明当前模型命中了 Codex/responses 上游，并且上游要求流式请求。

  Codex CLI 走的是 responses，通常比 Claude Code 更适合当前这类模型接入。

  ## 7. 推荐说明

  如果你当前使用的是：

  - gpt-5.4
  - wire_api = "responses"

  那么更推荐使用：

  - Codex CLI
  - 而不是 Claude Code

  因为 Claude Code 走的是 Anthropic 兼容链路，和这类 responses 模型的兼容性更容易出问题。

  ## 8. 最终配置示例

  profile = "dpcc"

  [profiles.dpcc]
  model_provider = "dpcc"
  model = "gpt-5.4"

  [model_providers.dpcc]
  name = "DPCC new-api"
  base_url = "https://api.dpccgaming.xyz/v1"
  env_key = "OPENAI_API_KEY"
  requires_openai_auth = true
  wire_api = "responses"

  model = "gpt-5.4"
  model_reasoning_effort = "medium"

  环境变量：

  export OPENAI_API_KEY="sk-你的API密钥"

  启动命令：

  codex --profile dpcc