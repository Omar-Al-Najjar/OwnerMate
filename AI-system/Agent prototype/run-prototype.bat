@echo off
setlocal

if defined OWNERMATE_PYTHON (
  "%OWNERMATE_PYTHON%" -m streamlit run app.py
  goto :eof
)

if exist "C:\Users\HP\Desktop\Data science\python.exe" (
  "C:\Users\HP\Desktop\Data science\python.exe" -m streamlit run app.py
  goto :eof
)

py -3 -m streamlit run app.py
