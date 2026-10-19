"""Corre la evaluación de mcp-builder contra unimcp.

Usa el harness de .agents/skills/mcp-builder/scripts y le cambia agent_loop: el original solo
contesta el primer tool_use de cada turno, y cuando el modelo pide varias tools en paralelo la API
rechaza el mensaje siguiente por los tool_use sin tool_result.

    .venv/Scripts/python evals/run_eval.py -t stdio -c node -a build/index.js \
        -m claude-sonnet-5-5 -o evals/report.md evals/unju.xml
"""

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / ".agents/skills/mcp-builder/scripts"))

import evaluation  # noqa: E402


async def agent_loop(client, model, question, tools, connection):
    """Como el original, pero responde todos los tool_use del turno."""
    messages = [{"role": "user", "content": question}]
    tool_metrics = {}

    async def create():
        return await asyncio.to_thread(
            client.messages.create,
            model=model,
            max_tokens=8192,
            system=evaluation.EVALUATION_PROMPT,
            messages=messages,
            tools=tools,
        )

    response = await create()
    messages.append({"role": "assistant", "content": response.content})

    while response.stop_reason == "tool_use":
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            start = time.time()
            try:
                content = await connection.call_tool(block.name, block.input)
                # Las imágenes (PDF escaneados) irían como base64 en el texto: se reemplazan por un aviso.
                text = "\n".join(c.text if c.type == "text" else f"[{c.type} omitida]" for c in content)
            except Exception as e:
                text = f"Error executing tool {block.name}: {e}"
            metrics = tool_metrics.setdefault(block.name, {"count": 0, "durations": []})
            metrics["count"] += 1
            metrics["durations"].append(time.time() - start)
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": text})

        messages.append({"role": "user", "content": results})
        response = await create()
        messages.append({"role": "assistant", "content": response.content})

    text = "\n".join(b.text for b in response.content if getattr(b, "type", None) == "text")
    return text, tool_metrics


evaluation.agent_loop = agent_loop

if __name__ == "__main__":
    asyncio.run(evaluation.main())
