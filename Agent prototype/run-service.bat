@echo off
setlocal

if not "%OWNERMATE_PYTHON%"=="" (
  set "PYTHON_CMD=%OWNERMATE_PYTHON%"
) else (
  set "PYTHON_CMD=py -3"
)

echo Starting OwnerMate dataset analysis service...
%PYTHON_CMD% -m uvicorn api_service:app --host 127.0.0.1 --port 8020
