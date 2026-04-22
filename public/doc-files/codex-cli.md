# 接入 Codex CLI 教程，同样适用于 Codex App

本文用于将 `Codex CLI` 接入你的 `new-api` 网关。

## 1. 前提条件

你需要准备好：

- `new-api` 网关地址
- 可用的 API Key
- 可调用的模型名

示例参数：

- Base URL: `https://api.dpccgaming.xyz/v1`
- Model: `gpt-5.4`

## 2. 配置 Codex CLI

`Codex CLI` 的配置文件路径通常是：

```text
~/.codex/config.toml
```

将下面内容写入 `~/.codex/config.toml`：

```toml
profile = "dpcc"

[profiles.dpcc]
model_provider = "dpcc"
model = "gpt-5.4"

[profiles.dpcc.windows]
sandbox = "elevated"

[model_providers.dpcc]
name = "DPCC new-api"
base_url = "https://api.dpccgaming.xyz/v1"
env_key = "OPENAI_API_KEY"
requires_openai_auth = true
wire_api = "responses"
model = "gpt-5.4"
model_reasoning_effort = "medium"
```

## 3. 设置环境变量

在终端执行：

```bash
export OPENAI_API_KEY="sk-你的API密钥"
```

如果你希望在 Windows 下永久设置环境变量，可以使用：

```powershell
setx OPENAI_API_KEY "sk-你的API密钥"
```

## 4. 启动命令

```bash
codex -p dpcc
```

## 5. 补充说明

- 上面的配置适用于 `Codex CLI`
- 同样的接入思路也适用于 `Codex App`
- 如果网关支持 `OpenAI Responses` 兼容格式，这套配置通常可以直接使用
