from typing import Any


def success_response(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    response: dict[str, Any] = {"success": True, "data": data}
    if meta is not None:
        response["meta"] = meta
    return response


def error_response(
    code: str,
    message: str,
    details: Any | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"success": False, "error": error}
