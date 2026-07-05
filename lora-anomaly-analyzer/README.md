---
library_name: peft
license: llama3.2
base_model: meta-llama/Llama-3.2-1B-Instruct
tags:
- generated_from_trainer
- lora
- observability
datasets:
- ../data/training-data-combined.jsonl
model-index:
- name: lora-anomaly-analyzer
  results: []
---

[<img src="https://raw.githubusercontent.com/axolotl-ai-cloud/axolotl/main/image/axolotl-badge-web.png" alt="Built with Axolotl" width="200" height="32"/>](https://github.com/axolotl-ai-cloud/axolotl)

# Anomaly Analyzer — LoRA Adapter

A LoRA adapter (r=16, α=32) for
[meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct),
fine-tuned to turn Krystaline exchange anomaly events into structured
root-cause analyses. It is served locally through Ollama and consumed by the
monitor's streaming analyzer
([`../server/monitor/stream-analyzer.ts`](../server/monitor/stream-analyzer.ts)). `[PUBLIC]`

The role boundary is deliberate: **this model assists triage, it never
pages.** Severity is assigned deterministically by the statistical detectors
(3.0σ–8.0σ ladder with MIN_SAMPLES=10,
[`../server/monitor/anomaly-detector.ts`](../server/monitor/anomaly-detector.ts))
and paging runs through Alertmanager → GoAlert before the LLM ever sees the
event. The adapter only drafts the explanation an operator reads afterwards.

## What it does

**Input** — the anomaly prompt the monitor builds at detection time: service,
operation, observed vs expected duration, σ deviation, severity, span
attributes, correlated system metrics (CPU, memory, error rate, P99), and the
trace's span list.

**Output** — a fixed four-section analysis, enforced both by training and by
the Ollama system prompt in [`../Modelfile`](../Modelfile):

```
SUMMARY: …
CAUSES: …
RECOMMENDATIONS: …
CONFIDENCE: low/medium/high
```

## What is (and is not) committed here

| Committed | Not committed (gitignored) |
|---|---|
| [`adapter_config.json`](adapter_config.json) — LoRA hyperparameters | `adapter_model.safetensors` — trained adapter weights |
| `config.json`, `tokenizer_config.json`, `chat_template.jinja`, `special_tokens_map.json` | `checkpoint-*/` — training checkpoints |
| This model card | `merged/` — adapter merged into the base model (~2.3 GB) |

Weights are large binaries, so only the lightweight config and tokenizer
artifacts are tracked (see the `LoRA training generated outputs` block in
[`../.gitignore`](../.gitignore)). Everything needed to regenerate the weights
— data, config, and pipeline script — is in the repo.

## Training data

Three sources feed one Alpaca-format dataset:

1. **22 operator-curated samples** in
   [`../training-data.jsonl`](../training-data.jsonl) (prompt/completion
   JSONL), collected live by
   [`../server/monitor/training-store.ts`](../server/monitor/training-store.ts)
   from good/bad ratings in the monitor UI and exportable from a running app
   via `GET /api/v1/monitor/training/export`. 14 of the 22 are RLHF-style
   corrections: the operator's rewrite becomes the training `completion`, and
   the model's rejected answer is preserved as `original_completion` — e.g. a
   correction as short as *"0 requests is not a high request rate, therefore
   irrelevant"* replacing a paragraph that blamed load. `[PUBLIC]`
2. **Synthetic samples** from
   [`../scripts/generate-synthetic-training.cjs`](../scripts/generate-synthetic-training.cjs),
   which renders 15 hand-written failure-scenario templates against this
   stack's real span vocabulary (pool exhaustion, cold start, lock contention,
   GC pause, retry storm, cascading timeout, Kong overhead, …).
3. The two are converted
   ([`../scripts/convert-training-data.cjs`](../scripts/convert-training-data.cjs))
   and merged into
   [`../data/training-data-combined.jsonl`](../data/training-data-combined.jsonl)
   — currently **100 samples (22 real + 78 synthetic)**, validated by
   [`../scripts/validate-training-data.cjs`](../scripts/validate-training-data.cjs).
   This combined file is what the training config actually reads.

One real pair from the curated set, verbatim except where truncated with `…`:

```jsonc
// ../training-data.jsonl — sample 16 of 22
{
  "prompt": "You are an expert in distributed systems and observability. Analyze this performance anomaly:\n\n## Anomaly Details\n- Service: kx-exchange\n- Operation: GET\n- Duration: 317.17ms (expected: 75.9ms ± 129.85ms)\n- Deviation: 1.86σ (standard deviations from mean)\n- Severity: SEV4 (Minor)\n…\n## Correlated System Metrics (at time of anomaly)\n- CPU Usage: 0.4%\n- Memory: 108MB\n…- Error Rate: 2.0%\n- P99 Latency: 1666ms\n…",
  "completion": "SUMMARY: The GET request to the kx-exchange service experienced an unexpected delay of 317.17 milliseconds, which is significantly higher than the expected 75.9 milliseconds. …\n\nCAUSES:\n- Increased latency due to network congestion or packet loss (resource utilization)\n…\n\nRECOMMENDATIONS:\n1. Monitor network latency using a tool like Wireshark to identify potential causes of packet loss.\n…\n\nCONFIDENCE: Medium"
}
```

## Training configuration

Ground truth is [`../axolotl-config.yaml`](../axolotl-config.yaml) and the
committed [`adapter_config.json`](adapter_config.json); the two agree:

| Parameter | Value |
|---|---|
| Base model | `meta-llama/Llama-3.2-1B-Instruct`, loaded in 8-bit |
| Adapter | LoRA, r=16, α=32, dropout 0.05 |
| Target modules | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| Epochs | 5 |
| Batch | micro 2 × grad-accum 4 (effective 8) |
| LR | 2e-4, cosine schedule, warmup ratio 0.1, weight decay 0.01 |
| Sequence length | 2048, no sample packing |
| Eval split | 5% held out for eval-loss monitoring |
| Seed | 42 |

The last recorded run took 60 optimizer steps (100 samples × 5 epochs ÷
effective batch 8) on PEFT 0.15.2 / Transformers 4.52.4 / PyTorch 2.6.0+cu124.

## Retraining and deployment (Ollama)

The full pipeline is one script —
[`../scripts/retrain-model.sh`](../scripts/retrain-model.sh): clean →
preprocess → train → merge LoRA into the base → import the merged model into
the compose Ollama container → smoke test.

```bash
# Full retrain (Docker with GPU support; HF_TOKEN in .env)
bash scripts/retrain-model.sh

# Re-import an already-merged model without retraining
bash scripts/retrain-model.sh --skip-train --skip-upload

# Host-local Ollama instead of the compose container — run from the repo
# root, since the Modelfile's FROM points at ./lora-anomaly-analyzer/merged
ollama create anomaly-analyzer -f Modelfile

# Point the monitor's LLM layer at the fine-tune (default is llama3.2:1b)
export OLLAMA_MODEL=anomaly-analyzer
```

[`../Modelfile`](../Modelfile) sets the Llama 3 chat template, temperature
0.7, repeat penalty 1.3, and a system prompt that pins the
SUMMARY/CAUSES/RECOMMENDATIONS/CONFIDENCE format.

## Limitations and evaluation

Honest scope, so the numbers above are not mistaken for more than they are:

- **1B parameters.** Output is an assistive triage summary, not an
  authoritative diagnosis. The deterministic detectors and alert routing do
  not depend on it.
- **Demonstration-scale fine-tune.** 100 training samples (only 22 of them
  real) and 60 optimizer steps. The 5% eval split monitors training loss
  only — it is not a task benchmark.
- **No held-out RCA benchmark yet.** `[BACKLOG]`: task-level RCA accuracy
  evaluation, scored against operator good/bad ratings from the training
  store.
- **Synthetic data is stack-shaped.** The 15 scenario templates encode this
  platform's services and failure modes; the adapter is not expected to
  generalize beyond it.
- **License.** The adapter derives from Llama 3.2 and follows the Llama 3.2
  Community License (`license: llama3.2` above); the surrounding repository is
  [Apache-2.0](../LICENSE).

Full workflow, including data export and validation:
[`../docs/observability/04_FINE_TUNING.md`](../docs/observability/04_FINE_TUNING.md).
