# Claude Code 通过 DPCC SWITCH 使用 OpenAI 中转模型

## 适用场景

这篇文档适用于下面这种情况：

- 你希望 `Claude Code` 不直接连接远端中转地址
- 你希望先连接本地 `DPCC SWITCH`
- 再由 `DPCC SWITCH` 转发到兼容 `OpenAI Responses` 的上游接口

如果你的目标只是先跑通一套稳定配置，直接按本文的“最小可用配置”来配即可。

## 链路原理

链路如下：

`Claude Code -> DPCC SWITCH -> OpenAI 格式中转站 -> 实际模型`

关键点只有两个：

- `Claude Code` 连接的是本地 `DPCC SWITCH`
- `DPCC SWITCH` 再把请求转发到你的上游接口

## 前置条件

开始前请先确认：

- `DPCC SWITCH` 已经安装并正在本地运行
- 你有一个可用的 `OpenAI Responses` 兼容上游地址
- 你已经确认上游真实存在至少一个可调用模型，例如 `gpt-5.4`

## 第一步：配置 DPCC SWITCH

新增或编辑一个供应商，建议先按下面这组最稳参数配置：

```text
API 格式: openai_responses
Base URL: https://your-proxy.example.com/v1
完整 URL: 关闭
```

注意事项：

- `Base URL` 填基地址，不要写成 `/v1/responses`
- “完整 URL”一定要关闭
- 先不要急着做复杂映射，先保证一条链路能跑通

### 模型映射建议

最稳的做法是先把几种默认模型都映射到同一个确认存在的上游模型，例如：

```text
ANTHROPIC_MODEL = gpt-5.4
ANTHROPIC_DEFAULT_HAIKU_MODEL = gpt-5.4
ANTHROPIC_DEFAULT_SONNET_MODEL = gpt-5.4
ANTHROPIC_DEFAULT_OPUS_MODEL = gpt-5.4
```

这样做的好处是：

- 先验证链路是否打通
- 减少因为模型名映射错误导致的排查成本
- 后续确认稳定后，再细分 `haiku / sonnet / opus` 对应的真实上游模型

## 第二步：配置 Claude Code

`Claude Code` 不要直连远端中转地址，而是连接本地 `DPCC SWITCH`。

最小配置示例：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:15721",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_API_KEY",
    "ANTHROPIC_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4"
  },
  "model": "haiku"
}
```

说明：

- `ANTHROPIC_BASE_URL` 这里应当是本地 `DPCC SWITCH` 地址：`http://127.0.0.1:15721`
- `ANTHROPIC_AUTH_TOKEN` 填你实际使用的接口密钥
- `model` 顶层可以写 `haiku`
- 真正调用哪个上游模型，由 `DPCC SWITCH` 里的模型映射决定

## 最小可用配置

如果你只是想先跑通，直接按下面这套来：

### DPCC SWITCH

- `API 格式`: `openai_responses`
- `Base URL`: `https://your-proxy.example.com/v1`
- `完整 URL`: `关闭`
- `haiku / sonnet / opus`: 全部先映射到 `gpt-5.4`

### Claude Code

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:15721",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_API_KEY",
    "ANTHROPIC_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4"
  },
  "model": "haiku"
}
```

这套配置的目标不是“最优”，而是“最不容易出错”。

## 常见问题

### 一直重试

优先检查下面几项：

- `DPCC SWITCH` 是否正在运行
- `ANTHROPIC_BASE_URL` 是否为 `http://127.0.0.1:15721`
- 供应商 `API 格式` 是否为 `openai_responses`
- “完整 URL”是否已关闭
- 你的上游地址是否真的可访问

### `model_not_found`

通常是因为你映射的模型名在上游不存在。

例如：

- 上游只有 `gpt-5.4`
- 你却把某个映射写成了 `gpt-5.4-mini`

那么就会报 `model_not_found`。

建议先统一映射到一个你已经确认存在的模型，跑通后再细分。

### Claude Code 误连远端地址

如果你希望走 `DPCC SWITCH`，那 `Claude Code` 端就不应该把 `ANTHROPIC_BASE_URL` 直接写成远端上游地址。

正确思路是：

- `Claude Code` 连本地 `DPCC SWITCH`
- `DPCC SWITCH` 连远端上游接口

## 排查顺序建议

如果配置后仍有问题，建议按这个顺序排查：

1. 先确认 `DPCC SWITCH` 是否在本地正常监听
2. 再确认 `Claude Code` 的 `ANTHROPIC_BASE_URL` 是否指向本地
3. 再确认 `DPCC SWITCH` 的 `API 格式` 是否为 `openai_responses`
4. 再确认上游 `Base URL` 是否只填到 `/v1`
5. 最后确认模型映射名称是否真实存在

## 可选说明

像 `statusLine`、插件配置、界面增强插件这类内容，不属于“通过 DPCC SWITCH 跑通模型链路”的核心步骤。

建议：

- 主文档只保留最小必需配置
- 插件、状态栏、美化功能单独写到扩展文档

这样主流程会更清晰，读者也更容易一次配置成功。

## 完整示例配置

如果你只是想保留一份“个人环境里的完整配置示例”作为参考，可以放这一份。

注意：

- 这是一份“完整示例”，不是最小必需配置
- 其中包含了 `statusLine` 和插件相关配置
- 如果你要严格走“`Claude Code -> 本地 DPCC SWITCH -> 上游接口`”这条链路，请把其中的 `ANTHROPIC_BASE_URL` 改回本地 `DPCC SWITCH` 地址

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "你的API KEY",
    "ANTHROPIC_BASE_URL": "https://api.dpccgaming.xyz/v1",
    "ANTHROPIC_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4"
  },
  "effortLevel": "high",
  "model": "haiku",
  "statusLine": {
    "type": "command",
    "command": "bash -c 'plugin_dir=$(ls -d \"${CLAUDE_CONFIG_DIR:-$HOME/.claude}\"/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null | awk -F/ '\"'\"'{ print $(NF-1) \"\\t\" $(0) }'\"'\"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec \"/Users/dpccskisw/.nvm/versions/node/v25.7.0/bin/node\" \"${plugin_dir}dist/index.js\"'"
  },
  "enabledPlugins": {
    "claude-hud@claude-hud": true
  },
  "extraKnownMarketplaces": {
    "claude-hud": {
      "source": {
        "source": "github",
        "repo": "jarrodwatts/claude-hud"
      }
    }
  }
}
```
