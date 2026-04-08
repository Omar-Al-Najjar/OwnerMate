from __future__ import annotations

import copy
import json
import re
from typing import Any, Literal

from openai import AsyncOpenAI

from pipeline import ConfigError, get_runtime_config

Locale = Literal["en", "ar"]

QUESTION_CATEGORY_AR = {
    "Trend": "الاتجاه",
    "Segmentation": "التقسيم",
    "Correlation": "الارتباط",
    "Distribution": "التوزيع",
    "Performance": "الأداء",
    "DataQuality": "جودة البيانات",
    "Behavioral": "السلوك",
}

SEMANTIC_DTYPE_AR = {
    "int": "عدد صحيح",
    "float": "عدد عشري",
    "string": "نص",
    "datetime": "تاريخ ووقت",
    "category": "فئة",
    "boolean": "منطقي",
}

SEMANTIC_ROLE_AR = {
    "feature": "ميزة",
    "target": "هدف",
    "id": "معرّف",
    "time": "زمن",
    "category": "فئة",
}

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)


def _chunk(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def _extract_json_object(content: str) -> str:
    fenced = _JSON_BLOCK_RE.search(content)
    if fenced:
        return fenced.group(1)

    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end >= start:
        return content[start : end + 1]

    raise ValueError("No JSON object found in translation response.")


def _has_ascii_letters(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text))


def _looks_like_structured_text(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True

    if stripped.startswith(("{", "[", "(")) and stripped.endswith(("}", "]", ")")):
        return True

    if re.fullmatch(r"[\d\s.,:%$+\-_/()]+", stripped):
        return True

    lines = [line for line in stripped.splitlines() if line.strip()]
    if len(lines) >= 3:
        wide_gap_lines = sum(1 for line in lines if re.search(r"\s{2,}", line))
        indexed_lines = sum(1 for line in lines if re.match(r"^\s*\d+\s+", line))
        table_lines = sum(1 for line in lines if "|" in line or "\t" in line)
        if wide_gap_lines >= 2 or indexed_lines >= 2 or table_lines >= 2:
            return True

    return False


def _should_translate_result_text(text: str) -> bool:
    return _has_ascii_letters(text) and not _looks_like_structured_text(text)


async def _translate_texts_to_ar(texts: list[str]) -> dict[str, str]:
    if not texts:
        return {}

    try:
        config = get_runtime_config()
    except ConfigError:
        return {}

    client = AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)
    translations: dict[str, str] = {}

    for batch in _chunk(texts, 20):
        payload = {
            "items": [
                {
                    "id": str(index),
                    "text": text,
                }
                for index, text in enumerate(batch)
            ]
        }

        try:
            response = await client.chat.completions.create(
                model=config.model,
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Translate each English UI string into clear Modern Standard Arabic. "
                            "Return strict JSON with the same item ids. Preserve numbers, field names, "
                            "and any business/entity names when they appear in the text."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Return JSON in the shape "
                            '{"items":[{"id":"0","translation":"..."}]}. '
                            "Do not include markdown.\n"
                            + json.dumps(payload, ensure_ascii=False)
                        ),
                    },
                ],
            )
            content = response.choices[0].message.content or ""
            parsed = json.loads(_extract_json_object(content))
            for item in parsed.get("items", []):
                try:
                    original = batch[int(item["id"])]
                except (KeyError, TypeError, ValueError, IndexError):
                    continue
                translated = item.get("translation")
                if isinstance(translated, str) and translated.strip():
                    translations[original] = translated
        except Exception:
            continue

    return translations


def _collect_result_texts(result: dict[str, Any]) -> list[str]:
    texts: list[str] = []
    seen: set[str] = set()

    def add(text: Any, *, structured_ok: bool = False) -> None:
        if not isinstance(text, str):
            return
        stripped = text.strip()
        if not stripped or stripped in seen or not _has_ascii_letters(stripped):
            return
        if not structured_ok and _looks_like_structured_text(stripped):
            return
        seen.add(stripped)
        texts.append(stripped)

    data = result.get("data") or {}
    questions = data.get("questions") or {}
    findings = data.get("findings") or {}
    insights = data.get("insights") or {}
    semantic_model = data.get("semantic_model") or {}
    run = data.get("run") or {}

    add(questions.get("dataset_understanding"))
    for item in questions.get("items") or []:
        add(item.get("question"))
        add(item.get("priority_reason"))
    for group_name, items in (questions.get("groups") or {}).items():
        add(group_name)
        for item in items:
            add(item.get("question"))
            add(item.get("priority_reason"))

    for item in (findings.get("successful") or []) + (findings.get("failed") or []):
        add(item.get("question"))
        add(item.get("explanation"))
        add(item.get("error"))
        actual_result = item.get("actual_result")
        if isinstance(actual_result, str) and _should_translate_result_text(actual_result):
            add(actual_result, structured_ok=True)

    add(insights.get("executive_summary"))
    for highlight in insights.get("positive_highlights") or []:
        add(highlight)
    for action in insights.get("action_items") or []:
        add(action.get("title"))
        add(action.get("what"))
        add(action.get("why_it_matters"))
        add(action.get("recommendation"))
        add(action.get("expected_impact"))
    for warning in insights.get("watch_out_for") or []:
        add(warning)

    add(semantic_model.get("dataset_description"))
    add(semantic_model.get("inferred_domain"))
    for relationship in semantic_model.get("relationships") or []:
        add(relationship)
    for column in semantic_model.get("columns") or []:
        add(column.get("description"))

    add(run.get("status_label"))
    for event in run.get("events") or []:
        add(event)
    refinement = run.get("refinement") or {}
    add(refinement.get("feedback"))
    add(refinement.get("reasoning"))
    for question in refinement.get("failed_questions") or []:
        add(question)

    error = result.get("error") or {}
    add(error.get("message"))
    details = error.get("details")
    if isinstance(details, str) and _should_translate_result_text(details):
        add(details, structured_ok=True)

    return texts


def _collect_error_texts(error: dict[str, Any]) -> list[str]:
    texts: list[str] = []
    for key in ("message", "details"):
        value = error.get(key)
        if isinstance(value, str) and value.strip() and _has_ascii_letters(value):
            if key == "details" and not _should_translate_result_text(value):
                continue
            texts.append(value.strip())
    return texts


def _translated_text(translations: dict[str, str], value: Any) -> Any:
    if not isinstance(value, str):
        return value
    return translations.get(value.strip(), value)


def _apply_result_translations(
    result: dict[str, Any], translations: dict[str, str]
) -> dict[str, Any]:
    localized = copy.deepcopy(result)
    data = localized.get("data") or {}
    questions = data.get("questions") or {}
    findings = data.get("findings") or {}
    insights = data.get("insights") or {}
    semantic_model = data.get("semantic_model") or {}
    run = data.get("run") or {}

    questions["dataset_understanding"] = _translated_text(
        translations, questions.get("dataset_understanding")
    )
    questions["items"] = [
        {
            **item,
            "question": _translated_text(translations, item.get("question")),
            "category": QUESTION_CATEGORY_AR.get(item.get("category"), item.get("category")),
            "priority_reason": _translated_text(translations, item.get("priority_reason")),
        }
        for item in questions.get("items") or []
    ]

    translated_groups: dict[str, list[dict[str, Any]]] = {}
    for group_name, items in (questions.get("groups") or {}).items():
        localized_group_name = QUESTION_CATEGORY_AR.get(
            group_name, translations.get(group_name.strip(), group_name)
        )
        translated_groups[localized_group_name] = [
            {
                **item,
                "question": _translated_text(translations, item.get("question")),
                "category": QUESTION_CATEGORY_AR.get(
                    item.get("category"), item.get("category")
                ),
                "priority_reason": _translated_text(
                    translations, item.get("priority_reason")
                ),
            }
            for item in items
        ]
    questions["groups"] = translated_groups

    for key in ("successful", "failed"):
        findings[key] = [
            {
                **item,
                "question": _translated_text(translations, item.get("question")),
                "explanation": _translated_text(translations, item.get("explanation")),
                "error": _translated_text(translations, item.get("error")),
                "actual_result": _translated_text(
                    translations, item.get("actual_result")
                ),
            }
            for item in findings.get(key) or []
        ]

    insights["executive_summary"] = _translated_text(
        translations, insights.get("executive_summary")
    )
    insights["positive_highlights"] = [
        _translated_text(translations, item)
        for item in insights.get("positive_highlights") or []
    ]
    insights["action_items"] = [
        {
            **item,
            "title": _translated_text(translations, item.get("title")),
            "what": _translated_text(translations, item.get("what")),
            "why_it_matters": _translated_text(
                translations, item.get("why_it_matters")
            ),
            "recommendation": _translated_text(
                translations, item.get("recommendation")
            ),
            "expected_impact": _translated_text(
                translations, item.get("expected_impact")
            ),
        }
        for item in insights.get("action_items") or []
    ]
    insights["watch_out_for"] = [
        _translated_text(translations, item)
        for item in insights.get("watch_out_for") or []
    ]

    semantic_model["dataset_description"] = _translated_text(
        translations, semantic_model.get("dataset_description")
    )
    semantic_model["inferred_domain"] = _translated_text(
        translations, semantic_model.get("inferred_domain")
    )
    semantic_model["relationships"] = [
        _translated_text(translations, item)
        for item in semantic_model.get("relationships") or []
    ]
    semantic_model["columns"] = [
        {
            **column,
            "dtype": SEMANTIC_DTYPE_AR.get(column.get("dtype"), column.get("dtype")),
            "role": SEMANTIC_ROLE_AR.get(column.get("role"), column.get("role")),
            "description": _translated_text(translations, column.get("description")),
        }
        for column in semantic_model.get("columns") or []
    ]

    run["status_label"] = _translated_text(translations, run.get("status_label"))
    run["events"] = [
        _translated_text(translations, item) for item in run.get("events") or []
    ]
    refinement = run.get("refinement")
    if isinstance(refinement, dict):
        refinement["feedback"] = _translated_text(translations, refinement.get("feedback"))
        refinement["reasoning"] = _translated_text(
            translations, refinement.get("reasoning")
        )
        refinement["failed_questions"] = [
            _translated_text(translations, item)
            for item in refinement.get("failed_questions") or []
        ]

    error = localized.get("error")
    if isinstance(error, dict):
        error["message"] = _translated_text(translations, error.get("message"))
        error["details"] = _translated_text(translations, error.get("details"))

    return localized


def _apply_error_translations(
    error: dict[str, Any] | None, translations: dict[str, str]
) -> dict[str, Any] | None:
    if not error:
        return error

    localized = copy.deepcopy(error)
    localized["message"] = _translated_text(translations, localized.get("message"))
    localized["details"] = _translated_text(translations, localized.get("details"))
    return localized


async def localize_job_payload(
    result: dict[str, Any] | None,
    error: dict[str, Any] | None,
    locale: Locale,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if locale != "ar":
        return result, error

    texts = _collect_result_texts(result) if result else []
    if error:
        texts.extend(
            text for text in _collect_error_texts(error) if text not in set(texts)
        )

    translations = await _translate_texts_to_ar(texts)
    if not translations:
        return result, error

    localized_result = (
        _apply_result_translations(result, translations) if result else result
    )
    localized_error = _apply_error_translations(error, translations)
    return localized_result, localized_error
